#include "mission.h"
#include <iostream>
#include <cassert>
#include <algorithm>

using namespace kestrel;

void test_region_scan(MissionControl& mission) {
    BoundingBox query{200, 200, 400, 400};
    auto rtree_res = mission.region_scan(query);
    
    std::vector<int> expected_res = {1, 2}; // e1, e2 intersect. e3 is outside.
    
    std::sort(rtree_res.begin(), rtree_res.end());
    assert(rtree_res == expected_res);
}

void test_nearby_objects(MissionControl& mission) {
    BoundingBox target{1500, 1500, 1520, 1520};
    double threshold = 100.0;
    
    auto rtree_res = mission.nearby_objects(target, threshold);
    
    std::vector<int> expected_res = {4, 5}; // e4, e5 within distance. e6 is outside.
    
    std::sort(rtree_res.begin(), rtree_res.end());
    assert(rtree_res == expected_res);
}

void test_corridor_query(MissionControl& mission) {
    Corridor path{{{2000, 2000}, {3000, 3000}}, 50.0};
    
    auto rtree_res = mission.corridor_query(path);
    
    std::vector<int> expected_res = {7, 8}; // e7, e8 inside corridor. e9 outside.
    
    std::sort(rtree_res.begin(), rtree_res.end());
    assert(rtree_res == expected_res);
}

void test_hazard_assessment() {
    EntityStore store;
    RTree rtree(4, 2);
    MissionControl mission(rtree, store);
    
    Entity e1{1, {50, 50, 60, 60}, true};
    Corridor path{{{0, 0}, {100, 100}}, 10.0};
    
    assert(mission.assess_hazard(e1, path) == true);
    
    Entity e2{2, {100, 0, 110, 10}, true};
    assert(mission.assess_hazard(e2, path) == false);
}

int main() {
    EntityStore store;
    RTree rtree(8, 2);
    
    // Region Scan targets (query: 200, 200, 400, 400)
    Entity e1{1, {250, 250, 300, 300}, true};
    Entity e2{2, {380, 380, 450, 450}, true};
    Entity e3{3, {0, 0, 100, 100}, true}; // outside
    
    // Nearby targets (near 1500, 1500; target: 1500, 1500, 1520, 1520)
    Entity e4{4, {1550, 1550, 1560, 1560}, true}; // distance ~ 30
    Entity e5{5, {1450, 1450, 1480, 1480}, true}; // distance ~ 20
    Entity e6{6, {1800, 1800, 1810, 1810}, true}; // outside > 100
    
    // Corridor targets (path 2000,2000 to 3000,3000, width 50)
    Entity e7{7, {2200, 2200, 2210, 2210}, true};
    Entity e8{8, {2510, 2490, 2520, 2500}, true};
    Entity e9{9, {2100, 2800, 2150, 2850}, true}; // outside
    
    std::vector<Entity> initial_entities = {e1, e2, e3, e4, e5, e6, e7, e8, e9};
    for (const auto& e : initial_entities) {
        store.insert(e);
        rtree.insert(e.bounds, e.id);
    }
    
    MissionControl mission(rtree, store);
    
    test_region_scan(mission);
    test_nearby_objects(mission);
    test_corridor_query(mission);
    test_hazard_assessment();
    
    std::cout << "All mission tests passed." << std::endl;
    return 0;
}
