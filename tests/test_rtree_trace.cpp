#include "rtree.h"
#include "mission.h"
#include "entity_store.h"
#include <algorithm>
#include <cassert>
#include <iostream>
#include <random>
#include <vector>

using namespace kestrel;

namespace {

// Flattened view of the tree used to validate that trace events reference
// real nodes and real geometry.
struct NodeInfo {
    std::size_t id = 0;
    std::size_t parent_id = 0;
    bool is_leaf = false;
    BoundingBox mbr{0, 0, 0, 0};
};

void collect_nodes(const RTreeNode* node, std::size_t parent_id, std::vector<NodeInfo>& out) {
    if (!node) return;
    out.push_back(NodeInfo{node->id, parent_id, node->is_leaf, node->compute_mbr()});
    if (!node->is_leaf) {
        for (const auto& entry : node->entries) {
            collect_nodes(entry.child.get(), node->id, out);
        }
    }
}

std::vector<NodeInfo> flatten(const RTree& tree) {
    std::vector<NodeInfo> out;
    collect_nodes(tree.get_root(), 0, out);
    return out;
}

bool same_box(const BoundingBox& a, const BoundingBox& b) {
    return a.min_x == b.min_x && a.min_y == b.min_y &&
           a.max_x == b.max_x && a.max_y == b.max_y;
}

std::size_t count_type(const RTreeTrace& trace, RTreeTraceEventType type) {
    std::size_t n = 0;
    for (const auto& ev : trace.events) {
        if (ev.type == type) ++n;
    }
    return n;
}

// Builds a tree with four well separated clusters so that a query window in
// one cluster necessarily prunes the remaining branches.
RTree build_clustered_tree() {
    RTree tree(4, 2);
    for (int c = 0; c < 4; ++c) {
        double bx = (c % 2) * 100.0;
        double by = (c / 2) * 100.0;
        for (int i = 0; i < 4; ++i) {
            int id = c * 4 + i + 1;
            BoundingBox b{bx + i, by + i, bx + i + 1.0, by + i + 1.0};
            tree.insert(b, id);
        }
    }
    return tree;
}

} // namespace

// The trace must be a faithful recording of a real traversal: it starts at the
// root, ends with the completion marker, and contains both visited branches
// and pruned branches.
void test_trace_records_actual_traversal() {
    RTree tree = build_clustered_tree();
    assert(tree.validate_structure());

    const BoundingBox query{-1, -1, 10, 10};
    RTree::QueryMetrics metrics;
    RTreeTrace trace;
    auto results = tree.search(query, metrics, &trace);

    assert(!trace.events.empty());
    assert(trace.events.front().type == RTreeTraceEventType::NodeVisited);
    assert(trace.events.back().type == RTreeTraceEventType::TraversalCompleted);
    assert(!trace.truncated);

    // The first visited node is the root.
    assert(trace.events.front().node_id == tree.get_root()->id);

    // At least one branch was entered and at least one branch was pruned.
    assert(count_type(trace, RTreeTraceEventType::ChildEntered) >= 1);
    assert(count_type(trace, RTreeTraceEventType::BranchPruned) >= 1);

    // One node_visited per node dequeued: matches the search metric.
    assert(count_type(trace, RTreeTraceEventType::NodeVisited) == metrics.nodes_visited);

    // The accepted entities are exactly the query results, in the same order.
    std::vector<int> accepted;
    for (const auto& ev : trace.events) {
        if (ev.type == RTreeTraceEventType::EntityAccepted) {
            accepted.push_back(ev.entity_id);
        }
    }
    assert(accepted == results);
    assert(results.size() == 4);

    // Every accepted entity was preceded by a leaf_entry_examined event.
    std::size_t examined = count_type(trace, RTreeTraceEventType::LeafEntryExamined);
    assert(examined == accepted.size());
}

// The recorded decisions must agree with the geometry they claim to describe.
void test_trace_decisions_match_geometry() {
    RTree tree = build_clustered_tree();
    const BoundingBox query{-1, -1, 110, 10};

    RTree::QueryMetrics metrics;
    RTreeTrace trace;
    tree.search(query, metrics, &trace);

    bool saw_prune = false;
    bool saw_descend = false;

    for (const auto& ev : trace.events) {
        switch (ev.type) {
            case RTreeTraceEventType::MbrTested:
                // The recorded outcome must match the real intersection test.
                assert(ev.intersects == intersects(query, ev.mbr));
                break;
            case RTreeTraceEventType::BranchPruned:
                // A pruned branch genuinely does not intersect the query.
                assert(!intersects(query, ev.mbr));
                assert(ev.child_node_id != 0);
                saw_prune = true;
                break;
            case RTreeTraceEventType::ChildEntered:
                // A descended branch genuinely does intersect the query.
                assert(intersects(query, ev.mbr));
                assert(ev.child_node_id != 0);
                saw_descend = true;
                break;
            case RTreeTraceEventType::LeafEntryExamined:
            case RTreeTraceEventType::EntityAccepted:
                assert(intersects(query, ev.mbr));
                assert(ev.entity_id > 0);
                break;
            case RTreeTraceEventType::NodeVisited:
                assert(ev.node_id != 0);
                break;
            case RTreeTraceEventType::TraversalCompleted:
                break;
        }
    }

    assert(saw_prune);
    assert(saw_descend);

    // Every referenced node exists in the tree and its recorded MBR is the
    // node's real MBR.
    std::vector<NodeInfo> nodes = flatten(tree);
    for (const auto& ev : trace.events) {
        if (ev.type != RTreeTraceEventType::NodeVisited) continue;
        bool found = false;
        for (const auto& n : nodes) {
            if (n.id == ev.node_id) {
                assert(same_box(n.mbr, ev.mbr));
                found = true;
                break;
            }
        }
        assert(found);
    }
}

// A child is entered before it is visited, and the root is visited first.
void test_trace_preserves_execution_order() {
    RTree tree = build_clustered_tree();
    const BoundingBox query{-1, -1, 110, 110};

    RTree::QueryMetrics metrics;
    RTreeTrace trace;
    tree.search(query, metrics, &trace);

    std::vector<std::size_t> entered;
    std::vector<std::size_t> visited;
    for (const auto& ev : trace.events) {
        if (ev.type == RTreeTraceEventType::ChildEntered) entered.push_back(ev.child_node_id);
        if (ev.type == RTreeTraceEventType::NodeVisited) visited.push_back(ev.node_id);
    }

    assert(!entered.empty());
    assert(!visited.empty());
    assert(visited.front() == tree.get_root()->id);

    for (std::size_t child : entered) {
        auto it = std::find(visited.begin(), visited.end(), child);
        assert(it != visited.end());
    }
}

// Instrumentation must not change the returned result set, in content or order.
void test_trace_does_not_change_results() {
    RTree tree(8, 2);

    std::mt19937 gen(7);
    std::uniform_real_distribution<double> pos(-200.0, 200.0);
    std::uniform_real_distribution<double> size(1.0, 12.0);

    for (int i = 0; i < 250; ++i) {
        double x = pos(gen);
        double y = pos(gen);
        double w = size(gen);
        double h = size(gen);
        tree.insert(BoundingBox{x, y, x + w, y + h}, i + 1);
    }
    assert(tree.validate_structure());

    for (int q = 0; q < 40; ++q) {
        double x = pos(gen);
        double y = pos(gen);
        double w = size(gen) * 6.0;
        double h = size(gen) * 6.0;
        BoundingBox query{x, y, x + w, y + h};

        RTree::QueryMetrics plain_metrics;
        RTreeTrace trace;
        RTree::QueryMetrics traced_metrics;
        auto plain = tree.search(query, plain_metrics);
        auto traced = tree.search(query, traced_metrics, &trace);

        assert(plain == traced);
        assert(plain_metrics.nodes_visited == traced_metrics.nodes_visited);

        // The trace must agree with the result set exactly.
        std::vector<int> accepted;
        for (const auto& ev : trace.events) {
            if (ev.type == RTreeTraceEventType::EntityAccepted) accepted.push_back(ev.entity_id);
        }
        assert(accepted == traced);
    }
}

// An empty tree is handled safely: no results, no accepted entities, and a
// structurally valid trace.
void test_empty_tree_trace() {
    RTree tree;
    assert(tree.size() == 0);

    const BoundingBox query{0, 0, 10, 10};
    RTree::QueryMetrics metrics;
    RTreeTrace trace;
    auto results = tree.search(query, metrics, &trace);

    assert(results.empty());
    assert(!trace.events.empty());
    assert(trace.events.front().type == RTreeTraceEventType::NodeVisited);
    assert(trace.events.back().type == RTreeTraceEventType::TraversalCompleted);
    assert(count_type(trace, RTreeTraceEventType::EntityAccepted) == 0);
    assert(count_type(trace, RTreeTraceEventType::ChildEntered) == 0);
    assert(count_type(trace, RTreeTraceEventType::BranchPruned) == 0);
    assert(metrics.nodes_visited == 1);
}

// A query that matches nothing still produces a truthful trace.
void test_empty_result_query_trace() {
    RTree tree = build_clustered_tree();

    const BoundingBox query{40, 40, 60, 60}; // the void between the clusters
    RTree::QueryMetrics metrics;
    RTreeTrace trace;
    auto results = tree.search(query, metrics, &trace);

    assert(results.empty());
    assert(count_type(trace, RTreeTraceEventType::EntityAccepted) == 0);
    assert(count_type(trace, RTreeTraceEventType::LeafEntryExamined) == 0);
    assert(count_type(trace, RTreeTraceEventType::BranchPruned) >= 1);
    assert(trace.events.back().type == RTreeTraceEventType::TraversalCompleted);
}

// A large traversal must not retain unbounded diagnostic data, and the
// completion marker must always survive truncation.
void test_trace_is_bounded() {
    RTree tree(4, 2);
    for (int i = 0; i < 400; ++i) {
        double x = (i % 20) * 10.0;
        double y = (i / 20) * 10.0;
        tree.insert(BoundingBox{x, y, x + 4.0, y + 4.0}, i + 1);
    }

    const BoundingBox query{-1000, -1000, 1000, 1000};
    RTree::QueryMetrics metrics;
    RTreeTrace trace;
    trace.max_events = 25;
    auto results = tree.search(query, metrics, &trace);

    assert(!results.empty());
    assert(trace.events.size() <= 25);
    assert(trace.truncated);
    assert(trace.events.back().type == RTreeTraceEventType::TraversalCompleted);
}

// The mission query interface can expose the trace of the query it executed.
void test_mission_region_scan_exposes_trace() {
    RTree tree = build_clustered_tree();
    EntityStore store;

    MissionControl mission(tree, store);
    const BoundingBox query{-1, -1, 10, 10};

    MissionControl::MissionMetrics metrics;
    RTreeTrace trace;
    auto traced = mission.region_scan(query, &metrics, &trace);

    MissionControl::MissionMetrics plain_metrics;
    auto plain = mission.region_scan(query, &plain_metrics, nullptr);
    assert(traced == plain);
    assert(!trace.events.empty());
    assert(count_type(trace, RTreeTraceEventType::EntityAccepted) == traced.size());
    assert(metrics.nodes_visited == plain_metrics.nodes_visited);
}
// Node identifiers must be unique so a trace can address a single node.
void test_node_identifiers_are_unique() {
    RTree tree = build_clustered_tree();
    std::vector<NodeInfo> nodes = flatten(tree);

    assert(nodes.size() > 1);
    for (std::size_t i = 0; i < nodes.size(); ++i) {
        assert(nodes[i].id != 0);
        for (std::size_t j = i + 1; j < nodes.size(); ++j) {
            assert(nodes[i].id != nodes[j].id);
        }
    }
}

int main() {
    test_trace_records_actual_traversal();
    test_trace_decisions_match_geometry();
    test_trace_preserves_execution_order();
    test_trace_does_not_change_results();
    test_empty_tree_trace();
    test_empty_result_query_trace();
    test_trace_is_bounded();
    test_mission_region_scan_exposes_trace();
    test_node_identifiers_are_unique();
    std::cout << "All R-tree traversal trace tests passed." << std::endl;
    return 0;
}
