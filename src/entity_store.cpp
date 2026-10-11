#include "entity_store.h"
#include <stdexcept>

namespace kestrel {

void EntityStore::insert(const Entity& e) {
    if (e.id <= 0) {
        throw std::invalid_argument("Entity ID must be positive.");
    }
    if (entities_.find(e.id) != entities_.end()) {
        throw std::invalid_argument("Duplicate Entity ID.");
    }
    entities_[e.id] = e;
}

void EntityStore::update(int id, const Entity& updated) {
    auto it = entities_.find(id);
    if (it == entities_.end()) {
        throw std::out_of_range("Entity ID not found for update.");
    }
    // Note: The specification requires updating the entity with the given ID.
    // Ensure the updated entity has the same ID.
    Entity to_update = updated;
    to_update.id = id; 
    it->second = to_update;
}

void EntityStore::remove(int id) {
    auto it = entities_.find(id);
    if (it == entities_.end()) {
        throw std::out_of_range("Entity ID not found for remove.");
    }
    entities_.erase(it);
}

const Entity& EntityStore::get(int id) const {
    auto it = entities_.find(id);
    if (it == entities_.end()) {
        throw std::out_of_range("Entity ID not found.");
    }
    return it->second;
}

bool EntityStore::contains(int id) const {
    return entities_.find(id) != entities_.end();
}

std::size_t EntityStore::size() const {
    return entities_.size();
}

} // namespace kestrel
