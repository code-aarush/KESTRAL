#include "mission.h"
#include "simulator.h"
#include "rtree.h"
#include "entity_store.h"
#include <iostream>
#include <fstream>
#include <vector>
#include <string>

using namespace kestrel;

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
    auto results = mission.region_scan(query_box);

    // Export to JSON
    std::ofstream out(out_path);
    if (!out.is_open()) {
        std::cerr << "Failed to open output file: " << out_path << std::endl;
        return 1;
    }
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
    out << "\n    ]\n";
    
    out << "  },\n";

    // Query
    out << "  \"query\": {\n";
    out << "    \"bounds\": [" << query_box.min_x << ", " << query_box.min_y << ", " << query_box.max_x << ", " << query_box.max_y << "],\n";
    out << "    \"results\": [";
    for (size_t i = 0; i < results.size(); ++i) {
        if (i > 0) out << ", ";
        out << results[i];
    }
    out << "]\n  }\n";
    
    out << "}\n";
    out.close();

    std::cout << "Exported simulation state to state.json" << std::endl;
    return 0;
}
