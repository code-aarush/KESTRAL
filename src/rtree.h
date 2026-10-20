#ifndef KESTREL_RTREE_H
#define KESTREL_RTREE_H

#include "rtree_node.h"
#include <cstddef>
#include <vector>

namespace kestrel {

// Kinds of steps recorded while a range query walks the tree.
// Every kind corresponds to an actual decision point inside RTree::search().
enum class RTreeTraceEventType {
    NodeVisited,       // A node was dequeued and is being examined.
    MbrTested,         // An entry MBR was tested against the query region.
    BranchPruned,      // The tested MBR missed the query; the subtree is abandoned.
    ChildEntered,      // The tested MBR hit the query; traversal descends into the child.
    LeafEntryExamined, // A leaf entry matched the query region.
    EntityAccepted,    // The entity was added to the result set.
    TraversalCompleted // The traversal finished.
};

// Stable wire name for an event kind (used by exporters and the frontend).
const char* to_string(RTreeTraceEventType type);

// A single recorded step of an actual R-tree range-query traversal.
struct RTreeTraceEvent {
    RTreeTraceEventType type = RTreeTraceEventType::TraversalCompleted;

    // Node whose entries were being examined when the event was recorded.
    std::size_t node_id = 0;

    // Child node referenced by the tested entry (0 when the entry is a leaf entry).
    std::size_t child_node_id = 0;

    // Entity referenced by the tested entry (-1 when the entry is an internal branch).
    int entity_id = -1;

    // Bounding box that was tested (the node MBR for NodeVisited).
    BoundingBox mbr{0, 0, 0, 0};

    // Outcome of the intersection test. For NodeVisited it reports whether the
    // node's own MBR overlaps the query region (informational, not a decision).
    bool intersects = false;
};

// Ordered record of one range-query traversal.
//
// The event list is bounded: once max_events is reached the recorder stops
// appending intermediate steps and flags the trace as truncated, so a large
// traversal cannot retain unbounded diagnostic data.
struct RTreeTrace {
    static constexpr std::size_t kDefaultMaxEvents = 20000;

    std::vector<RTreeTraceEvent> events;
    std::size_t max_events = kDefaultMaxEvents;
    bool truncated = false;

    void clear() {
        events.clear();
        truncated = false;
    }
};

class RTree {
private:
    std::unique_ptr<RTreeNode> root_;
    std::size_t M_;
    std::size_t m_;
    std::size_t next_node_id_;

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

    // Allocates a node with a fresh, unique identifier.
    std::unique_ptr<RTreeNode> make_node(bool leaf, RTreeNode* parent);

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

    // Range query without tracing. Behaviour is identical to the tracing overload.
    std::vector<int> search(const BoundingBox& query, QueryMetrics& metrics) const;

    // Range query that additionally records the actual traversal.
    // When trace is null the search behaves exactly like the overload above.
    std::vector<int> search(const BoundingBox& query, QueryMetrics& metrics, RTreeTrace* trace) const;

    std::size_t size() const;
    std::size_t height() const;

    // Structural validation
    bool validate_structure() const;
    
    // For testing/manual construction
    RTreeNode* get_root() const { return root_.get(); }
    void set_root(std::unique_ptr<RTreeNode> new_root);
};

} // namespace kestrel

#endif // KESTREL_RTREE_H
