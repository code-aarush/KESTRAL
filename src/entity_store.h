#ifndef KESTREL_ENTITY_STORE_H
#define KESTREL_ENTITY_STORE_H

#include "entity.h"
#include <unordered_map>
#include <cstddef>

namespace kestrel {

class EntityStore {
private:
    std::unordered_map<int, Entity> entities_;

public:
    // Inserts entity. Throws std::invalid_argument if id <= 0 or if ID already exists.
    void insert(const Entity& e);
    
    // Updates entity. Throws std::out_of_range if ID does not exist.
    void update(int id, const Entity& updated);
    
    // Removes entity. Throws std::out_of_range if ID does not exist.
    void remove(int id);
    
    // Retrieves entity. Throws std::out_of_range if ID does not exist.
    const Entity& get(int id) const;
    
    bool contains(int id) const;
    std::size_t size() const;
    
    // Iterators for consistency verification
    auto begin() const { return entities_.begin(); }
    auto end() const { return entities_.end(); }
};

} // namespace kestrel

#endif // KESTREL_ENTITY_STORE_H
