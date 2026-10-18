#include "export.h"
#include "mission.h"
#include "simulator.h"
#include "rtree.h"
#include "entity_store.h"
#include <iostream>
#include <fstream>
#include <vector>
#include <string>

namespace kestrel {

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

void export_node_hierarchy(const RTreeNode* node, std::ostream& out, int indent_level, int& next_node_id, const std::string& parent_id, int depth, bool is_root) {
    if (!node) {
        out << "null";
        return;
    }

    std::string indent(indent_level * 2, ' ');
    std::string inner_indent((indent_level + 1) * 2, ' ');
    std::string child_indent((indent_level + 2) * 2, ' ');

    std::string node_id = "node_" + std::to_string(next_node_id++);
    BoundingBox mbr = node->entries.empty() ? BoundingBox{0.0, 0.0, 0.0, 0.0} : node->compute_mbr();
    std::string node_type = is_root ? "root" : (node->is_leaf ? "leaf" : "internal");

    out << "{\n";
    out << inner_indent << "\"id\": \"" << node_id << "\",\n";
    if (parent_id.empty()) {
        out << inner_indent << "\"parent_id\": null,\n";
    } else {
        out << inner_indent << "\"parent_id\": \"" << parent_id << "\",\n";
    }
    out << inner_indent << "\"type\": \"" << node_type << "\",\n";
    out << inner_indent << "\"is_root\": " << (is_root ? "true" : "false") << ",\n";
    out << inner_indent << "\"is_leaf\": " << (node->is_leaf ? "true" : "false") << ",\n";
    out << inner_indent << "\"depth\": " << depth << ",\n";
    out << inner_indent << "\"bounds\": [" << mbr.min_x << ", " << mbr.min_y << ", " << mbr.max_x << ", " << mbr.max_y << "],\n";
    out << inner_indent << "\"children\": [";

    if (node->is_leaf) {
        if (!node->entries.empty()) {
            out << "\n";
            for (size_t i = 0; i < node->entries.size(); ++i) {
                if (i > 0) out << ",\n";
                const auto& entry = node->entries[i];
                out << child_indent << "{\n";
                out << child_indent << "  \"id\": \"entity_" << entry.entity_id << "\",\n";
                out << child_indent << "  \"parent_id\": \"" << node_id << "\",\n";
                out << child_indent << "  \"entity_id\": " << entry.entity_id << ",\n";
                out << child_indent << "  \"type\": \"entity\",\n";
                out << child_indent << "  \"bounds\": [" << entry.mbr.min_x << ", " << entry.mbr.min_y << ", " << entry.mbr.max_x << ", " << entry.mbr.max_y << "]\n";
                out << child_indent << "}";
            }
            out << "\n" << inner_indent;
        }
    } else {
        if (!node->entries.empty()) {
            out << "\n";
            for (size_t i = 0; i < node->entries.size(); ++i) {
                if (i > 0) out << ",\n";
                const auto& entry = node->entries[i];
                out << child_indent;
                export_node_hierarchy(entry.child.get(), out, indent_level + 2, next_node_id, node_id, depth + 1, false);
            }
            out << "\n" << inner_indent;
        }
    }

    out << "]\n";
    out << indent << "}";
}

} // namespace kestrel

namespace kestrel {

void export_simulation_state(const RTree& rtree, const EntityStore& store, const BoundingBox& query_box, const std::vector<int>& query_results, std::ostream& out) {
    out << "{\n";
    
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
    out << "    \"height\": " << rtree.height() << ",\n";
    out << "    \"size\": " << rtree.size() << ",\n";
    
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
    
    out << "    \"root\": ";
    int next_node_id = 0;
    export_node_hierarchy(rtree.get_root(), out, 2, next_node_id, "", 0, true);
    out << "\n  },\n";

    // Query
    out << "  \"query\": {\n";
    out << "    \"bounds\": [" << query_box.min_x << ", " << query_box.min_y << ", " << query_box.max_x << ", " << query_box.max_y << "],\n";
    out << "    \"results\": [";
    for (size_t i = 0; i < query_results.size(); ++i) {
        if (i > 0) out << ", ";
        out << query_results[i];
    }
    out << "]\n  }\n";
    
    out << "}\n";
}

} // namespace kestrel

#ifndef KESTREL_NO_MAIN
using namespace kestrel;

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
    auto results = mission.region_scan(query_box);

    // Export to JSON
    std::ofstream out(out_path);
    if (!out.is_open()) {
        std::cerr << "Failed to open output file: " << out_path << std::endl;
        return 1;
    }
    export_simulation_state(rtree, store, query_box, results, out);
    out.close();

    std::cout << "Exported simulation state to state.json" << std::endl;
    return 0;
}
#endif
