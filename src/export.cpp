#include "mission.h"
#include "simulator.h"
#include "rtree.h"
#include "entity_store.h"
#include <algorithm>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace kestrel;

namespace {

// One row of the exported R-tree node table.
struct NodeRecord {
    std::size_t id;
    std::size_t parent_id;
    int level;
    bool is_leaf;
    std::size_t entry_count;
    BoundingBox mbr;
};

void collect_node_records(const RTreeNode* node, std::size_t parent_id, int level,
                          std::vector<NodeRecord>& out) {
    if (!node) return;
    out.push_back(NodeRecord{node->id, parent_id, level, node->is_leaf,
                             node->entries.size(), node->compute_mbr()});
    if (!node->is_leaf) {
        for (const auto& entry : node->entries) {
            collect_node_records(entry.child.get(), node->id, level + 1, out);
        }
    }
}

// FNV-1a over a canonical text rendering of the scene.
// The result is masked to 53 bits so it survives a JSON round trip through
// JavaScript without losing precision.
std::uint64_t fnv1a64(const std::string& text) {
    std::uint64_t hash = 1469598103934665603ULL;
    for (unsigned char c : text) {
        hash ^= static_cast<std::uint64_t>(c);
        hash *= 1099511628211ULL;
    }
    return hash & ((1ULL << 53) - 1);
}

// Canonical, order-independent description of the scene plus the query.
std::string canonical_scene_text(const EntityStore& store, const BoundingBox& query) {
    std::vector<int> ids;
    ids.reserve(store.size());
    for (auto it = store.begin(); it != store.end(); ++it) {
        ids.push_back(it->first);
    }
    std::sort(ids.begin(), ids.end());

    std::ostringstream os;
    os << std::setprecision(17);
    for (int id : ids) {
        const Entity& e = store.get(id);
        os << id << ':' << e.bounds.min_x << ',' << e.bounds.min_y << ','
           << e.bounds.max_x << ',' << e.bounds.max_y << ';';
    }
    os << "q:" << query.min_x << ',' << query.min_y << ','
       << query.max_x << ',' << query.max_y;
    return os.str();
}

} // namespace

void collect_rtree_nodes(const RTreeNode* node, std::vector<BoundingBox>& internal_mbrs, std::vector<BoundingBox>& leaf_mbrs) {
    if (!node) return;
    if (node->is_leaf) {
        leaf_mbrs.push_back(node->compute_mbr());
    } else {
        internal_mbrs.push_back(node->compute_mbr());
        for (const auto& entry : node->entries) {
            collect_rtree_nodes(entry.child.get(), internal_mbrs, leaf_mbrs);
        }
    }
}

int main(int argc, char* argv[]) {
    std::string out_path = "state.json";
    if (argc > 1) {
        out_path = argv[1];
    }

    EntityStore store;
    RTree rtree(4, 2);
    Simulator sim(store, rtree, 42, 800.0, 600.0, 0.5, 0.05);

    // Run some steps
    for (int i = 0; i < 50; ++i) {
        sim.step();
    }

    // Set up a query
    MissionControl mission(rtree, store);
    BoundingBox query_box{200.0, 200.0, 600.0, 400.0};
    RTreeTrace trace;
    auto results = mission.region_scan(query_box, nullptr, &trace);

    const std::uint64_t scene_id = fnv1a64(canonical_scene_text(store, query_box));
    const std::uint64_t query_id = 1;

    // Export to JSON
    std::ofstream out(out_path);
    if (!out.is_open()) {
        std::cerr << "Failed to open output file: " << out_path << std::endl;
        return 1;
    }
    out << std::setprecision(17);
    out << "{\n";

    // Scene identity (content fingerprint: changes whenever the scene or query changes)
    out << "  \"scene_id\": " << scene_id << ",\n";

    // Entities
    out << "  \"entities\": [\n";
    bool first = true;
    for (auto it = store.begin(); it != store.end(); ++it) {
        if (!first) out << ",\n";
        out << "    {\"id\": " << it->second.id 
            << ", \"bounds\": [" << it->second.bounds.min_x << ", " << it->second.bounds.min_y 
            << ", " << it->second.bounds.max_x << ", " << it->second.bounds.max_y << "]}";
        first = false;
    }
    out << "\n  ],\n";

    // R-Tree Nodes
    std::vector<BoundingBox> internal_mbrs;
    std::vector<BoundingBox> leaf_mbrs;
    collect_rtree_nodes(rtree.get_root(), internal_mbrs, leaf_mbrs);

    out << "  \"rtree\": {\n";
    
    out << "    \"internal_mbrs\": [\n";
    for (size_t i = 0; i < internal_mbrs.size(); ++i) {
        if (i > 0) out << ",\n";
        out << "      [" << internal_mbrs[i].min_x << ", " << internal_mbrs[i].min_y 
            << ", " << internal_mbrs[i].max_x << ", " << internal_mbrs[i].max_y << "]";
    }
    out << "\n    ],\n";
    
    out << "    \"leaf_mbrs\": [\n";
    for (size_t i = 0; i < leaf_mbrs.size(); ++i) {
        if (i > 0) out << ",\n";
        out << "      [" << leaf_mbrs[i].min_x << ", " << leaf_mbrs[i].min_y 
            << ", " << leaf_mbrs[i].max_x << ", " << leaf_mbrs[i].max_y << "]";
    }
    out << "\n    ],\n";

    // Node table: stable identifiers, hierarchy links and levels for the
    // traversal visualiser. The legacy internal_mbrs/leaf_mbrs arrays above are
    // preserved for existing consumers.
    std::vector<NodeRecord> node_records;
    collect_node_records(rtree.get_root(), 0, 0, node_records);

    out << "    \"nodes\": [\n";
    for (size_t i = 0; i < node_records.size(); ++i) {
        const NodeRecord& n = node_records[i];
        if (i > 0) out << ",\n";
        out << "      {\"id\": " << n.id
            << ", \"parent_id\": " << n.parent_id
            << ", \"level\": " << n.level
            << ", \"is_leaf\": " << (n.is_leaf ? "true" : "false")
            << ", \"entry_count\": " << n.entry_count
            << ", \"mbr\": [" << n.mbr.min_x << ", " << n.mbr.min_y
            << ", " << n.mbr.max_x << ", " << n.mbr.max_y << "]}";
    }
    out << "\n    ]\n";
    
    out << "  },\n";

    // Query
    out << "  \"query\": {\n";
    out << "    \"query_id\": " << query_id << ",\n";
    out << "    \"bounds\": [" << query_box.min_x << ", " << query_box.min_y << ", " << query_box.max_x << ", " << query_box.max_y << "],\n";
    out << "    \"results\": [";
    for (size_t i = 0; i < results.size(); ++i) {
        if (i > 0) out << ", ";
        out << results[i];
    }
    out << "]\n  },\n";

    // Traversal trace: the recorded sequence of real R-tree search decisions.
    out << "  \"trace\": {\n";
    out << "    \"scene_id\": " << scene_id << ",\n";
    out << "    \"query_id\": " << query_id << ",\n";
    out << "    \"query_bounds\": [" << query_box.min_x << ", " << query_box.min_y
        << ", " << query_box.max_x << ", " << query_box.max_y << "],\n";
    out << "    \"truncated\": " << (trace.truncated ? "true" : "false") << ",\n";
    out << "    \"total_events\": " << trace.events.size() << ",\n";
    out << "    \"events\": [\n";
    for (size_t i = 0; i < trace.events.size(); ++i) {
        const RTreeTraceEvent& ev = trace.events[i];
        if (i > 0) out << ",\n";
        out << "      {\"type\": \"" << to_string(ev.type) << "\""
            << ", \"node_id\": " << ev.node_id
            << ", \"child_node_id\": " << ev.child_node_id
            << ", \"entity_id\": " << ev.entity_id
            << ", \"mbr\": [" << ev.mbr.min_x << ", " << ev.mbr.min_y
            << ", " << ev.mbr.max_x << ", " << ev.mbr.max_y << "]"
            << ", \"intersects\": " << (ev.intersects ? "true" : "false")
            << "}";
    }
    out << "\n    ]\n";
    out << "  }\n";
    
    out << "}\n";
    out.close();

    std::cout << "Exported simulation state to state.json" << std::endl;
    return 0;
}
