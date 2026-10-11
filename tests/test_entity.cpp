#include "entity_store.h"
#include "geometry.h"
#include <iostream>
#include <cassert>
#include <stdexcept>
#include <vector>
#include <algorithm>

using namespace kestrel;

bool entities_equal(const Entity& a, const Entity& b) {
    return a.id == b.id &&
           a.bounds.min_x == b.bounds.min_x &&
           a.bounds.min_y == b.bounds.min_y &&
           a.bounds.max_x == b.bounds.max_x &&
           a.bounds.max_y == b.bounds.max_y &&
           a.active == b.active;
}

void test_entity_fields_and_bounds() {
    Entity e{1, BoundingBox{8.0, 9.0, 12.0, 11.0}, true};
    assert(e.id == 1);
    assert(e.bounds.min_x == 8.0 && e.bounds.max_x == 12.0);
    assert(e.bounds.min_y == 9.0 && e.bounds.max_y == 11.0);
    assert(e.active == true);
}

void test_store_insert_and_get() {
    EntityStore store;
    Entity e{1, BoundingBox{0.0, 0.0, 1.0, 1.0}, true};
    
    assert(!store.contains(1));
    store.insert(e);
    assert(store.contains(1));
    
    const Entity& retrieved = store.get(1);
    assert(entities_equal(retrieved, e));
}

void test_store_duplicate_id() {
    EntityStore store;
    Entity e1{1, BoundingBox{0.0, 0.0, 1.0, 1.0}, true};
    Entity e2{1, BoundingBox{1.0, 1.0, 2.0, 2.0}, true};
    
    store.insert(e1);
    
    bool caught = false;
    try {
        store.insert(e2);
    } catch (const std::invalid_argument&) {
        caught = true;
    }
    assert(caught);
    
    // Original entity remains untouched
    assert(entities_equal(store.get(1), e1));
}

void test_store_missing_id() {
    EntityStore store;
    bool caught = false;
    try {
        store.get(999);
    } catch (const std::out_of_range&) {
        caught = true;
    }
    assert(caught);
    assert(!store.contains(999));
}

void test_store_update() {
    EntityStore store;
    Entity e1{1, BoundingBox{0.0, 0.0, 1.0, 1.0}, true};
    store.insert(e1);
    
    Entity updated_data{1, BoundingBox{5.0, 5.0, 7.0, 7.0}, false};
    store.update(1, updated_data);
    
    const Entity& e2 = store.get(1);
    assert(entities_equal(e2, updated_data));
}

void test_store_remove() {
    EntityStore store;
    Entity e1{1, BoundingBox{0.0, 0.0, 1.0, 1.0}, true};
    store.insert(e1);
    
    store.remove(1);
    assert(!store.contains(1));
    
    bool caught = false;
    try {
        store.get(1);
    } catch (const std::out_of_range&) {
        caught = true;
    }
    assert(caught);
}

void test_store_size() {
    EntityStore store;
    assert(store.size() == 0);
    
    store.insert(Entity{1, BoundingBox{0.0, 0.0, 1.0, 1.0}, true});
    store.insert(Entity{2, BoundingBox{0.0, 0.0, 1.0, 1.0}, true});
    store.insert(Entity{3, BoundingBox{0.0, 0.0, 1.0, 1.0}, true});
    assert(store.size() == 3);
    
    store.remove(2);
    assert(store.size() == 2);
}

void test_store_iteration() {
    EntityStore store;
    for (int i = 1; i <= 5; ++i) {
        store.insert(Entity{i, BoundingBox{0.0, 0.0, 1.0, 1.0}, true});
    }
    
    std::vector<int> ids;
    for (auto it = store.begin(); it != store.end(); ++it) {
        ids.push_back(it->first);
        assert(it->first == it->second.id);
    }
    
    assert(ids.size() == 5);
    std::sort(ids.begin(), ids.end());
    for (int i = 0; i < 5; ++i) {
        assert(ids[i] == i + 1);
    }
}

int main() {
    test_entity_fields_and_bounds();
    test_store_insert_and_get();
    test_store_duplicate_id();
    test_store_missing_id();
    test_store_update();
    test_store_remove();
    test_store_size();
    test_store_iteration();
    
    std::cout << "All entity store tests passed." << std::endl;
    return 0;
}

