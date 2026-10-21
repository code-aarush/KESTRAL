#ifndef KESTREL_MISSION_H
#define KESTREL_MISSION_H

#include "rtree.h"
#include "entity_store.h"
#include "geometry.h"
#include <vector>

namespace kestrel {

struct Corridor {
    LineSegment path;
    double width;
};

class MissionControl {
private:
    const RTree& rtree_;
    const EntityStore& store_;

public:
    MissionControl(const RTree& rtree, const EntityStore& store);

    struct MissionMetrics {
        std::size_t nodes_visited = 0;
        std::size_t narrow_phase_checks = 0;
    };

    // GATE-08-AC-01
    // When trace is non-null the actual R-tree traversal is recorded into it.
    std::vector<int> region_scan(const BoundingBox& region,
                                 MissionMetrics* metrics = nullptr,
                                 RTreeTrace* trace = nullptr) const;

    // GATE-08-AC-02
    std::vector<int> nearby_objects(const BoundingBox& target, double threshold, MissionMetrics* metrics = nullptr) const;

    // GATE-08-AC-03
    std::vector<int> corridor_query(const Corridor& corridor, MissionMetrics* metrics = nullptr) const;

    // GATE-08-AC-04
    bool assess_hazard(const Entity& entity, const Corridor& path) const;
};

} // namespace kestrel

#endif // KESTREL_MISSION_H
