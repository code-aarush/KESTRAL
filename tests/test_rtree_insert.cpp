#include "rtree.h"
#include <iostream>
#include <cassert>
#include <stdexcept>

using namespace kestrel;

void test_single_insertion() {
    // GATE-04-AC-01
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 1, 1}, 100);
    
    assert(tree.size() == 1);
    assert(tree.height() == 1);
    assert(tree.validate_structure() == true);
}

void test_multiple_insertions_no_split() {
    // GATE-04-AC-02
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 1, 1}, 100);
    tree.insert(BoundingBox{2, 2, 3, 3}, 101);
    tree.insert(BoundingBox{4, 4, 5, 5}, 102);
    tree.insert(BoundingBox{6, 6, 7, 7}, 103);
    
    assert(tree.size() == 4);
    assert(tree.height() == 1);
    assert(tree.validate_structure() == true);
    
    BoundingBox root_mbr = tree.get_root()->compute_mbr();
    assert(root_mbr.min_x == 0 && root_mbr.max_x == 7);
    assert(root_mbr.min_y == 0 && root_mbr.max_y == 7);
}

void test_overflow_and_split() {
    // GATE-04-AC-03, GATE-04-AC-04, GATE-04-AC-05, GATE-04-AC-06
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 1, 1}, 100);
    tree.insert(BoundingBox{2, 2, 3, 3}, 101);
    tree.insert(BoundingBox{4, 4, 5, 5}, 102);
    tree.insert(BoundingBox{6, 6, 7, 7}, 103);
    
    // This will trigger a split
    tree.insert(BoundingBox{8, 8, 9, 9}, 104);
    
    assert(tree.size() == 5);
    assert(tree.height() == 2);
    assert(tree.validate_structure() == true);
    
    RTreeNode* root = tree.get_root();
    assert(!root->is_leaf);
    assert(root->entries.size() == 2);
    
    RTreeNode* child1 = root->entries[0].child.get();
    RTreeNode* child2 = root->entries[1].child.get();
    
    assert(child1->parent == root);
    assert(child2->parent == root);
    
    assert(child1->entries.size() >= 2 && child1->entries.size() <= 4);
    assert(child2->entries.size() >= 2 && child2->entries.size() <= 4);
    assert(child1->entries.size() + child2->entries.size() == 5);
}

void test_deterministic_edge_cases() {
    // GATE-04-AC-07
    RTree tree1(4, 2);
    RTree tree2(4, 2);
    
    for (int i = 0; i < 10; ++i) {
        BoundingBox b{static_cast<double>(i), static_cast<double>(i), 
                      static_cast<double>(i+1), static_cast<double>(i+1)};
        tree1.insert(b, i);
        tree2.insert(b, i);
    }
    
    assert(tree1.size() == 10);
    assert(tree2.size() == 10);
    assert(tree1.height() == tree2.height());
    assert(tree1.get_root()->entries.size() == tree2.get_root()->entries.size());
    
    assert(tree1.validate_structure() == true);
    assert(tree2.validate_structure() == true);
    
    // Test identical overlapping bounding boxes
    RTree tree3(4, 2);
    for (int i = 0; i < 6; ++i) {
        tree3.insert(BoundingBox{0, 0, 1, 1}, i);
    }
    assert(tree3.size() == 6);
    assert(tree3.validate_structure() == true);
}

int main() {
    std::cout << "Running test_single_insertion..." << std::endl;
    test_single_insertion();
    std::cout << "Running test_multiple_insertions_no_split..." << std::endl;
    test_multiple_insertions_no_split();
    std::cout << "Running test_overflow_and_split..." << std::endl;
    test_overflow_and_split();
    std::cout << "Running test_deterministic_edge_cases..." << std::endl;
    test_deterministic_edge_cases();
    
    std::cout << "All insertion and split tests passed." << std::endl;
    return 0;
}
