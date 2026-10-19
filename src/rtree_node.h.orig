#ifndef KESTREL_RTREE_NODE_H
#define KESTREL_RTREE_NODE_H

#include "geometry.h"
#include <vector>
#include <memory>

namespace kestrel {

struct RTreeNode;

struct RTreeEntry {
    BoundingBox mbr;
    int entity_id; // Valid if node is leaf
    std::unique_ptr<RTreeNode> child; // Valid if node is internal

    RTreeEntry() : mbr{0,0,0,0}, entity_id(0), child(nullptr) {}
    
    // Leaf entry constructor
    RTreeEntry(BoundingBox b, int id) 
        : mbr(b), entity_id(id), child(nullptr) {}
        
    // Internal entry constructor
    RTreeEntry(BoundingBox b, std::unique_ptr<RTreeNode> c) 
        : mbr(b), entity_id(0), child(std::move(c)) {}
};

struct RTreeNode {
    bool is_leaf;
    RTreeNode* parent;
    std::vector<RTreeEntry> entries;
    std::size_t id; // Unique node identifier for traceability

    explicit RTreeNode(bool leaf, RTreeNode* p = nullptr, std::size_t node_id = 0) 
        : is_leaf(leaf), parent(p), id(node_id) {}
    
    // Computes the MBR of this node based on its entries
    BoundingBox compute_mbr() const;
};

} // namespace kestrel

#endif // KESTREL_RTREE_NODE_H
