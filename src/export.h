#ifndef KESTREL_EXPORT_H
#define KESTREL_EXPORT_H

#include "rtree.h"
#include "entity_store.h"
#include "geometry.h"
#include <vector>
#include <string>
#include <ostream>

namespace kestrel {

// Collects flat internal and leaf MBRs from the R-tree (legacy compatibility)
void collect_rtree_nodes(const RTreeNode* node, std::vector<BoundingBox>& internal_mbrs, std::vector<BoundingBox>& leaf_mbrs);

// Serializes the authoritative R-tree hierarchy recursively into JSON
void export_node_hierarchy(const RTreeNode* node, std::ostream& out, int indent_level, int& next_node_id, const std::string& parent_id, int depth, bool is_root);

// Exports the complete simulation state (entities, rtree with hierarchy, query) into JSON
void export_simulation_state(const RTree& rtree, const EntityStore& store, const BoundingBox& query_box, const std::vector<int>& query_results, std::ostream& out);

} // namespace kestrel

#endif // KESTREL_EXPORT_H
