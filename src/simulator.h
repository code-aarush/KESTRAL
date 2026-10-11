#ifndef KESTREL_SIMULATOR_H
#define KESTREL_SIMULATOR_H

#include "entity_store.h"
#include "rtree.h"
#include <random>
#include <unordered_map>

namespace kestrel {

struct Velocity {
    double dx;
    double dy;
};

class Simulator {
private:
    EntityStore& store_;
    RTree& rtree_;
    std::mt19937 gen_;
    std::unordered_map<int, Velocity> velocities_;
    
    int next_id_;
    double bounds_width_;
    double bounds_height_;
    double spawn_rate_; 
    double despawn_rate_; 
    
    void spawn_entity();
    void move_entities();
    void despawn_entities();

public:
    Simulator(EntityStore& store, RTree& rtree, unsigned int seed,
              double bounds_width = 1000.0, double bounds_height = 1000.0,
              double spawn_rate = 0.2, double despawn_rate = 0.05);

    // Executes one simulation step
    void step();
    
    // Verifies consistency between EntityStore and RTree
    bool verify_consistency() const;
};

} // namespace kestrel

#endif // KESTREL_SIMULATOR_H
