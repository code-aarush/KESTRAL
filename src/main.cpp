#include "simulator.h"
#include "mission.h"
#include <iostream>

using namespace kestrel;

int main() {
    std::cout << "KESTREL Demo Initialized\n";
    
    EntityStore store;
    RTree rtree(8, 2);
    Simulator sim(store, rtree, 42, 1000.0, 1000.0, 0.5, 0.05);
    
    std::cout << "Running simulation...\n";
    for (int i = 0; i < 50; ++i) {
        sim.step();
    }
    
    std::cout << "Entities generated: " << store.size() << "\n";
    
    MissionControl mission(rtree, store);
    
    // 1. Region Scan
    BoundingBox scan_region{400, 400, 600, 600};
    auto region_results = mission.region_scan(scan_region);
    std::cout << "Region scan found " << region_results.size() << " entities.\n";
    
    // 2. Nearby Objects
    BoundingBox target_box{500, 500, 510, 510};
    double threshold = 50.0;
    auto nearby_results = mission.nearby_objects(target_box, threshold);
    std::cout << "Nearby search found " << nearby_results.size() << " entities within " << threshold << " units.\n";
    
    // 3. Trajectory Corridor
    Corridor path{{{100, 100}, {900, 900}}, 20.0};
    auto corridor_results = mission.corridor_query(path);
    std::cout << "Corridor query found " << corridor_results.size() << " potential hazards along trajectory.\n";
    
    std::cout << "KESTREL Demo Completed Successfully\n";
    return 0;
}
