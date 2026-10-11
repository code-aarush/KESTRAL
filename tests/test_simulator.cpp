#include "simulator.h"
#include <iostream>
#include <cassert>

using namespace kestrel;

void test_determinism() {
    // GATE-07-AC-01
    EntityStore store1, store2;
    RTree rtree1(4, 2), rtree2(4, 2);
    
    Simulator sim1(store1, rtree1, 42);
    Simulator sim2(store2, rtree2, 42);
    
    for (int i = 0; i < 100; ++i) {
        sim1.step();
        sim2.step();
        
        if (i == 10 || i == 50 || i == 99) {
            assert(store1.size() == store2.size());
            assert(rtree1.size() == rtree2.size());
            
            for (auto it = store1.begin(); it != store1.end(); ++it) {
                assert(store2.contains(it->first));
                assert(store2.get(it->first).bounds.min_x == it->second.bounds.min_x);
                assert(store2.get(it->first).bounds.min_y == it->second.bounds.min_y);
            }
        }
    }
}

void test_consistency() {
    // GATE-07-AC-02, AC-03, AC-04
    EntityStore store;
    RTree rtree(4, 2);
    // high spawn rate to ensure many entities exist
    Simulator sim(store, rtree, 12345, 1000.0, 1000.0, 1.0, 0.1); 
    
    for (int i = 0; i < 50; ++i) {
        sim.step();
        assert(sim.verify_consistency());
    }
}

int main() {
    test_determinism();
    test_consistency();
    std::cout << "All simulator tests passed." << std::endl;
    return 0;
}
