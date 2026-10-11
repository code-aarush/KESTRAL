#include "rtree.h"
#include <iostream>
#include <cassert>
#include <stdexcept>
#include <memory>

using namespace kestrel;

void test_node_types_and_occupancy() {
    // GATE-03-AC-01 and GATE-03-AC-02
    RTree tree(10, 4);
    assert(tree.M() == 10);
    assert(tree.m() == 4);
    
    bool caught = false;
    try {
        RTree invalid_tree(10, 6);
    } catch (const std::invalid_argument&) {
        caught = true;
    }
    assert(caught);
}

void test_empty_tree() {
    // GATE-03-AC-03
    RTree tree;
    assert(tree.size() == 0);
    assert(tree.height() == 0);
    assert(tree.validate_structure() == true);
}

void test_mbr_computation() {
    // GATE-03-AC-04
    RTreeNode node(true);
    node.entries.push_back(RTreeEntry(BoundingBox{0, 0, 2, 2}, 1));
    node.entries.push_back(RTreeEntry(BoundingBox{4, 4, 6, 6}, 2));
    
    BoundingBox mbr = node.compute_mbr();
    assert(mbr.min_x == 0 && mbr.max_x == 6);
    assert(mbr.min_y == 0 && mbr.max_y == 6);
}

void test_validate_structure_violations() {
    // GATE-03-AC-05
    RTree tree;
    auto root = std::make_unique<RTreeNode>(false);
    
    auto child1 = std::make_unique<RTreeNode>(true, root.get());
    child1->entries.push_back(RTreeEntry(BoundingBox{0, 0, 1, 1}, 1));
    child1->entries.push_back(RTreeEntry(BoundingBox{2, 2, 3, 3}, 2));
    
    // Valid case
    root->entries.push_back(RTreeEntry(BoundingBox{0, 0, 3, 3}, std::move(child1)));
    
    // Add another child to satisfy root >= 2
    auto child2 = std::make_unique<RTreeNode>(true, root.get());
    child2->entries.push_back(RTreeEntry(BoundingBox{10, 10, 11, 11}, 3));
    child2->entries.push_back(RTreeEntry(BoundingBox{12, 12, 13, 13}, 4));
    root->entries.push_back(RTreeEntry(BoundingBox{10, 10, 13, 13}, std::move(child2)));
    
    tree.set_root(std::move(root));
    assert(tree.validate_structure() == true);
    
    // Violation 1: Broken parent link
    tree.get_root()->entries[0].child->parent = nullptr;
    bool caught = false;
    try { tree.validate_structure(); } catch (const std::logic_error&) { caught = true; }
    assert(caught);
    tree.get_root()->entries[0].child->parent = tree.get_root(); // restore
    
    // Violation 2: Incorrect MBR in internal node entry
    BoundingBox old_mbr = tree.get_root()->entries[0].mbr;
    tree.get_root()->entries[0].mbr = BoundingBox{0, 0, 2, 2}; // too small
    caught = false;
    try { tree.validate_structure(); } catch (const std::logic_error&) { caught = true; }
    assert(caught);
    tree.get_root()->entries[0].mbr = old_mbr; // restore
    
    // Violation 3: Node underflow
    RTreeEntry saved = std::move(tree.get_root()->entries[0].child->entries.back());
    tree.get_root()->entries[0].child->entries.pop_back(); // Now has 1 entry, m=2
    caught = false;
    try { tree.validate_structure(); } catch (const std::logic_error&) { caught = true; }
    assert(caught);
    // restore
    tree.get_root()->entries[0].child->entries.push_back(std::move(saved));
}

int main() {
    test_node_types_and_occupancy();
    test_empty_tree();
    test_mbr_computation();
    test_validate_structure_violations();
    
    std::cout << "All RTree foundation tests passed." << std::endl;
    return 0;
}
