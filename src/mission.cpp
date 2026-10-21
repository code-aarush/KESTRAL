#include "mission.h"
#include <algorithm>

namespace kestrel {

MissionControl::MissionControl(const RTree& rtree, const EntityStore& store)
    : rtree_(rtree), store_(store) {}

std::vector<int> MissionControl::region_scan(const BoundingBox& region, MissionMetrics* metrics, RTreeTrace* trace) const {
    RTree::QueryMetrics m;
    auto results = rtree_.search(region, m, trace);
    if (metrics) metrics->nodes_visited = m.nodes_visited;
    return results;
}

std::vector<int> MissionControl::nearby_objects(const BoundingBox& target, double threshold, MissionMetrics* metrics) const {
    BoundingBox expanded_box{
        target.min_x - threshold,
        target.min_y - threshold,
        target.max_x + threshold,
        target.max_y + threshold
    };
    
    RTree::QueryMetrics m;
    std::vector<int> candidates = rtree_.search(expanded_box, m);
    std::vector<int> results;
    
    if (metrics) {
        metrics->nodes_visited = m.nodes_visited;
    }
    for (int id : candidates) {
        if (!store_.contains(id)) continue;
        const Entity& e = store_.get(id);
        
        if (metrics) metrics->narrow_phase_checks++;
        
        if (distance(e.bounds, target) <= threshold) {
            results.push_back(id);
        }
    }
    return results;
}

std::vector<int> MissionControl::corridor_query(const Corridor& corridor, MissionMetrics* metrics) const {
    double min_x = std::min(corridor.path.start.x, corridor.path.end.x) - corridor.width;
    double min_y = std::min(corridor.path.start.y, corridor.path.end.y) - corridor.width;
    double max_x = std::max(corridor.path.start.x, corridor.path.end.x) + corridor.width;
    double max_y = std::max(corridor.path.start.y, corridor.path.end.y) + corridor.width;
    
    BoundingBox aabb{min_x, min_y, max_x, max_y};
    
    RTree::QueryMetrics m;
    std::vector<int> candidates = rtree_.search(aabb, m);
    std::vector<int> results;
    
    if (metrics) {
        metrics->nodes_visited = m.nodes_visited;
    }
    for (int id : candidates) {
        if (!store_.contains(id)) continue;
        const Entity& e = store_.get(id);
        
        if (metrics) metrics->narrow_phase_checks++;

        if (distance(corridor.path, e.bounds) <= corridor.width) {
            results.push_back(id);
        }
    }
    return results;
}

bool MissionControl::assess_hazard(const Entity& entity, const Corridor& path) const {
    return distance(path.path, entity.bounds) <= path.width;
}

} // namespace kestrel
