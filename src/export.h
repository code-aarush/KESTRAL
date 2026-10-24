#ifndef KESTREL_EXPORT_H
#define KESTREL_EXPORT_H

#include "rtree.h"
#include "entity_store.h"
#include "geometry.h"
#include <cstdint>
#include <map>
#include <ostream>
#include <string>
#include <vector>

namespace kestrel {

// Canonical identifier helpers ------------------------------------------------
//
// The scene uses exactly two identifier forms and both are produced here so
// that no other module can invent a conflicting identifier:
//
//   * Nodes  : "node_<index>"   assigned by the exporter in DFS pre-order.
//   * Entities: "entity_<id>"  where <id> is the numeric entity id.
//
// Trace events reference nodes with the very same "node_<index>" identifiers
// that the hierarchy uses, and entities with their numeric entity id (the same
// identifier used by query results and by the exported entity list).

// Canonical identifier of the hierarchy node with the given export index.
std::string hierarchy_node_id(int index);

// Canonical identifier of the entity with the given numeric entity id.
std::string hierarchy_entity_id(int entity_id);

// Maps the internal R-tree node id to the canonical hierarchy identifier.
// Used to translate recorded traversal events into scene-level identifiers.
using CanonicalNodeIdMap = std::map<std::size_t, std::string>;

// Collects flat internal and leaf MBRs from the R-tree (legacy compatibility)
void collect_rtree_nodes(const RTreeNode* node, std::vector<BoundingBox>& internal_mbrs, std::vector<BoundingBox>& leaf_mbrs);

// Serializes the authoritative R-tree hierarchy recursively into JSON.
// When canonical_ids is provided it is filled with the internal R-tree node id
// -> canonical hierarchy identifier mapping for every exported node.
void export_node_hierarchy(const RTreeNode* node, std::ostream& out, int indent_level, int& next_node_id, const std::string& parent_id, int depth, bool is_root, CanonicalNodeIdMap* canonical_ids = nullptr);

// Builds the canonical node id map for the RTree in DFS pre-order.
CanonicalNodeIdMap build_canonical_node_ids(const RTree& rtree);

// Serializes the recorded traversal trace into JSON format with canonical IDs.
void write_trace_json(std::ostream& out, const CanonicalNodeIdMap& canonical_ids, const RTreeTrace* trace, std::uint64_t scene_id, std::uint64_t query_id, const BoundingBox& query_box, bool pretty = true);

// Exports the complete simulation state (entities, rtree with hierarchy, query
// and — when supplied — the recorded traversal trace) into JSON.
//
// The scene_id is derived from the exported scene content, so it changes
// whenever the entities or the query change. It identifies the scene a
// recorded trace belongs to.
void export_simulation_state(const RTree& rtree, const EntityStore& store, const BoundingBox& query_box, const std::vector<int>& query_results, std::ostream& out, const RTreeTrace* trace = nullptr, std::uint64_t query_id = 1);

} // namespace kestrel

#endif // KESTREL_EXPORT_H
