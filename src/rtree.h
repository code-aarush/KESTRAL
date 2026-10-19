#ifndef KESTREL_RTREE_H
#define KESTREL_RTREE_H

#include "rtree_node.h"
#include <cstddef>
#include <string>
#include <vector>

namespace kestrel {

// A single recorded step of an R-tree range-query traversal.
// Every field is populated from actual C++ execution; nothing is fabricated.
struct RTreeTraceEvent {
    std::string type;           // node_visited | mbr_tested | branch_pruned | child_entered | leaf_entry_examined | entity_accepted | traversal_completed
    std::size_t node_id = 0;    // ID of the node being processed (0 for traversal_completed)
    int entity_id = -1;         // Entity ID for leaf entries / accepted results (-1 if N/A)
    BoundingBox mbr{0, 0, 0, 0};// MBR being tested (degenerate for traversal_completed)
    bool intersects = false;    // Whether this MBR intersects the query region
    std::string explanation;    // Human-readable description of the operation
};

class RTree {
private:
    std::unique_ptr<RTreeNode> root_;
    std::size_t M_;
    std::size_t m_;
    std::size_t next_node_id_;  // Monotonically increasing node ID counter

    // Helper for validation
    bool validate_node(const RTreeNode* node, BoundingBox expected_mbr) const;
    std::size_t height_node(const RTreeNode* node) const;

    // Insertion helpers
    RTreeNode* choose_leaf(const BoundingBox& bounds) const;
    std::unique_ptr<RTreeNode> split_node(RTreeNode* node, RTreeEntry&& new_entry);
    void adjust_tree(RTreeNode* node, std::unique_ptr<RTreeNode> split_node);
    
    RTreeNode* find_leaf(const BoundingBox& bounds, int entity_id) const;
    void condense_tree(RTreeNode* leaf, std::vector<std::pair<BoundingBox, int>>& reinsert_list);
    void flatten_subtree(RTreeNode* node, std::vector<std::pair<BoundingBox, int>>& reinsert_list) const;

    // Assigns a fresh unique node ID
    std::size_t assign_node_id() { return next_node_id_++; }

public:
    explicit RTree(std::size_t M = 8, std::size_t m = 2);

    std::size_t M() const { return M_; }
    std::size_t m() const { return m_; }

    void insert(BoundingBox bounds, int entity_id);
    bool remove(const BoundingBox& bounds, int entity_id);
    bool update(const BoundingBox& old_bounds, const BoundingBox& new_bounds, int entity_id);

    struct QueryMetrics {
        std::size_t nodes_visited = 0;
    };
    std::vector<int> search(const BoundingBox& query, QueryMetrics& metrics) const;
    std::vector<int> search(const BoundingBox& query, QueryMetrics& metrics, std::vector<RTreeTraceEvent>* trace) const;

    std::size_t size() const;
    std::size_t height() const;

    // Structural validation
    bool validate_structure() const;
    
    // For testing/manual construction
    RTreeNode* get_root() const { return root_.get(); }
    void set_root(std::unique_ptr<RTreeNode> new_root) { root_ = std::move(new_root); }
};

} // namespace kestrel

#endif // KESTREL_RTREE_H
