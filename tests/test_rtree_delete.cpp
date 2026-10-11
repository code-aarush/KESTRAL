#include "rtree.h"
#include <iostream>
#include <cassert>
#include <vector>
#include <algorithm>
#include <random>

using namespace kestrel;

void test_remove_only_entry() {
    // GATE-06-AC-01
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 10, 10}, 1);
    assert(tree.size() == 1);
    
    bool removed = tree.remove(BoundingBox{0, 0, 10, 10}, 1);
    assert(removed);
    assert(tree.size() == 0);
    assert(tree.validate_structure());
    
    RTree::QueryMetrics metrics;
    auto res = tree.search(BoundingBox{0, 0, 100, 100}, metrics);
    assert(res.empty());
}

void test_remove_no_underflow() {
    // GATE-06-AC-02
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 1, 1}, 1);
    tree.insert(BoundingBox{2, 2, 3, 3}, 2);
    tree.insert(BoundingBox{4, 4, 5, 5}, 3);
    
    assert(tree.size() == 3);
    
    bool removed = tree.remove(BoundingBox{2, 2, 3, 3}, 2);
    assert(removed);
    assert(tree.size() == 2);
    assert(tree.validate_structure());
}

void test_remove_underflow() {
    // GATE-06-AC-03 & AC-04
    RTree tree(4, 2);
    // Fill to trigger splits
    for (int i = 0; i < 6; ++i) {
        tree.insert(BoundingBox{static_cast<double>(i), static_cast<double>(i), 
                                static_cast<double>(i+1), static_cast<double>(i+1)}, i);
    }
    
    assert(tree.height() == 2);
    assert(tree.size() == 6);
    
    // Removing items until underflow and root shrinkage
    for (int i = 0; i < 4; ++i) {
        bool removed = tree.remove(BoundingBox{static_cast<double>(i), static_cast<double>(i), 
                                               static_cast<double>(i+1), static_cast<double>(i+1)}, i);
        assert(removed);
        assert(tree.validate_structure());
    }
    
    assert(tree.size() == 2);
    assert(tree.height() == 1);
}

void test_update() {
    // GATE-06-AC-05
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 10, 10}, 1);
    
    bool updated = tree.update(BoundingBox{0, 0, 10, 10}, BoundingBox{20, 20, 30, 30}, 1);
    assert(updated);
    
    RTree::QueryMetrics m;
    auto r1 = tree.search(BoundingBox{0, 0, 10, 10}, m);
    assert(r1.empty());
    
    auto r2 = tree.search(BoundingBox{25, 25, 35, 35}, m);
    assert(r2.size() == 1 && r2[0] == 1);
    assert(tree.validate_structure());
}

void test_missing_entry() {
    // GATE-06-AC-08
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 10, 10}, 1);
    
    bool removed = tree.remove(BoundingBox{20, 20, 30, 30}, 1);
    assert(!removed); 
    
    removed = tree.remove(BoundingBox{0, 0, 10, 10}, 2);
    assert(!removed); 
    
    assert(tree.size() == 1);
    assert(tree.validate_structure());
}

void test_mixed_operations_validation() {
    RTree tree(8, 2);
    std::vector<std::pair<BoundingBox, int>> active;
    std::vector<std::pair<BoundingBox, int>> removed_items;
    
    std::mt19937 gen(42);
    std::uniform_real_distribution<double> dist(-100.0, 100.0);
    std::uniform_real_distribution<double> size_dist(1.0, 10.0);
    
    int id_counter = 0;
    
    for (int i = 0; i < 50; ++i) {
        double x = dist(gen);
        double y = dist(gen);
        BoundingBox b{x, y, x + size_dist(gen), y + size_dist(gen)};
        
        tree.insert(b, id_counter);
        active.push_back({b, id_counter});
        id_counter++;
    }
    
    assert(tree.validate_structure());
    
    std::shuffle(active.begin(), active.end(), gen);
    for (int i = 0; i < 25; ++i) {
        auto item = active.back();
        bool removed = tree.remove(item.first, item.second);
        assert(removed);
        removed_items.push_back(item);
        active.pop_back();
        assert(tree.validate_structure());
    }
    
    for (int i = 0; i < 25; ++i) {
        auto old_item = active[i];
        
        double x = dist(gen);
        double y = dist(gen);
        BoundingBox new_b{x, y, x + size_dist(gen), y + size_dist(gen)};
        
        bool updated = tree.update(old_item.first, new_b, old_item.second);
        assert(updated);
        
        active[i].first = new_b;
        assert(tree.validate_structure());
    }
    
    assert(tree.size() == active.size());
    
    // Explicit verification of active and removed items
    for (const auto& item : active) {
        RTree::QueryMetrics m;
        auto res = tree.search(item.first, m);
        assert(std::find(res.begin(), res.end(), item.second) != res.end());
    }
    
    for (const auto& item : removed_items) {
        RTree::QueryMetrics m;
        auto res = tree.search(item.first, m);
        assert(std::find(res.begin(), res.end(), item.second) == res.end());
    }
}

int main() {
    test_remove_only_entry();
    test_remove_no_underflow();
    test_remove_underflow();
    test_update();
    test_missing_entry();
    test_mixed_operations_validation();
    
    std::cout << "All dynamic operations tests passed." << std::endl;
    return 0;
}
