#include "simulator.h"
#include <stdexcept>
#include <algorithm>
#include <vector>

namespace kestrel {

Simulator::Simulator(EntityStore& store, RTree& rtree, unsigned int seed,
                     double bounds_width, double bounds_height,
                     double spawn_rate, double despawn_rate)
    : store_(store), rtree_(rtree), gen_(seed),
      next_id_(1), bounds_width_(bounds_width), bounds_height_(bounds_height),
      spawn_rate_(spawn_rate), despawn_rate_(despawn_rate) {
}

void Simulator::spawn_entity() {
    std::uniform_real_distribution<double> chance(0.0, 1.0);
    if (chance(gen_) < spawn_rate_) {
        std::uniform_real_distribution<double> pos_x(0.0, bounds_width_);
        std::uniform_real_distribution<double> pos_y(0.0, bounds_height_);
        std::uniform_real_distribution<double> size(1.0, 10.0);
        std::uniform_real_distribution<double> vel(-5.0, 5.0);

        int id = next_id_++;
        double x = pos_x(gen_);
        double y = pos_y(gen_);
        BoundingBox bounds{x, y, x + size(gen_), y + size(gen_)};
        
        store_.insert({id, bounds, true});
        rtree_.insert(bounds, id);
        
        velocities_[id] = {vel(gen_), vel(gen_)};
    }
}

void Simulator::move_entities() {
    std::vector<int> active_ids;
    for (auto it = store_.begin(); it != store_.end(); ++it) {
        active_ids.push_back(it->second.id);
    }
    
    for (int id : active_ids) {
        const Entity& e = store_.get(id);
        Velocity v = velocities_[id];
        
        BoundingBox new_bounds = e.bounds;
        new_bounds.min_x += v.dx;
        new_bounds.max_x += v.dx;
        new_bounds.min_y += v.dy;
        new_bounds.max_y += v.dy;
        
        rtree_.update(e.bounds, new_bounds, id);
        
        Entity new_e = e;
        new_e.bounds = new_bounds;
        store_.update(id, new_e);
    }
}

void Simulator::despawn_entities() {
    std::uniform_real_distribution<double> chance(0.0, 1.0);
    std::vector<int> to_remove;
    
    for (auto it = store_.begin(); it != store_.end(); ++it) {
        if (chance(gen_) < despawn_rate_) {
            to_remove.push_back(it->second.id);
        }
    }
    
    for (int id : to_remove) {
        const Entity& e = store_.get(id);
        rtree_.remove(e.bounds, id);
        store_.remove(id);
        velocities_.erase(id);
    }
}

// Executes one simulation step
// Physics model: Linear motion. Each step, every entity's bounding box shifts by its constant (dx, dy) velocity.
// Entities have a chance to spawn and despawn on each step.
void Simulator::step() {
    spawn_entity();
    move_entities();
    despawn_entities();
}

bool Simulator::verify_consistency() const {
    if (store_.size() != rtree_.size()) return false;
    
    for (auto it = store_.begin(); it != store_.end(); ++it) {
        const Entity& e = it->second;
        RTree::QueryMetrics m;
        std::vector<int> res = rtree_.search(e.bounds, m);
        
        if (std::find(res.begin(), res.end(), e.id) == res.end()) {
            return false;
        }
    }
    
    return true;
}

} // namespace kestrel
