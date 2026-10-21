#ifndef KESTREL_SCENE_H
#define KESTREL_SCENE_H

#include "entity_store.h"
#include "geometry.h"
#include "rtree.h"
#include <cstdint>
#include <string>

namespace kestrel {

// Builds the deterministic demonstration scene (seed 42, 800x600 world,
// 50 simulation steps) into the given store and tree.
//
// The exporter and the interactive query service must observe exactly the
// same tree, therefore both build the scene through this single function.
void build_demo_scene(EntityStore& store, RTree& rtree);

// Canonical text of the scene contents: entity ids in ascending order,
// each followed by its bounding box. The text is independent of the query
// region and of the iteration order of the store.
std::string canonical_entities_text(const EntityStore& store);

// Query independent fingerprint of the scene contents. Two processes that hold
// the same scene compute the same key, so a client can verify that a backend
// query belongs to the scene it is displaying.
std::uint64_t scene_key(const EntityStore& store);

// Fingerprint of the scene contents combined with the query region. This is
// the identity written into the exported state file.
std::uint64_t scene_id(const EntityStore& store, const BoundingBox& query);

} // namespace kestrel

#endif // KESTREL_SCENE_H
