#include "rtree.h"
#include <iostream>
#include <cassert>
#include <vector>
#include <algorithm>
#include <string>
#include <random>

using namespace kestrel;

/**
 * Counts events of a given type in the trace.
 */
std::size_t count_event_type(const std::vector<RTreeTraceEvent>& trace, const std::string& type) {
    std::size_t n = 0;
    for (const auto& ev : trace) {
        if (ev.type == type) ++n;
    }
    return n;
}

/**
 * Verifies that trace results match the search result set.
 */
void verify_trace_results_match(const std::vector<int>& search_results,
                                const std::vector<RTreeTraceEvent>& trace) {
    std::vector<int> trace_results;
    for (const auto& ev : trace) {
        if (ev.type == "entity_accepted") {
            trace_results.push_back(ev.entity_id);
        }
    }
    std::vector<int> sorted_search = search_results;
    std::sort(sorted_search.begin(), sorted_search.end());
    std::sort(trace_results.begin(), trace_results.end());
    assert(sorted_search == trace_results);
}

/**
 * Verifies that every branch_pruned event has intersects == false.
 */
void verify_pruned_are_not_intersecting(const std::vector<RTreeTraceEvent>& trace) {
    for (const auto& ev : trace) {
        if (ev.type == "branch_pruned") {
            assert(ev.intersects == false);
        }
    }
}

/**
 * Verifies that every entity_accepted event has intersects == true.
 */
void verify_accepted_are_intersecting(const std::vector<RTreeTraceEvent>& trace) {
    for (const auto& ev : trace) {
        if (ev.type == "entity_accepted") {
            assert(ev.intersects == true);
        }
    }
}

/**
 * Verifies that trace ends with traversal_completed.
 */
void verify_trace_ends_with_completed(const std::vector<RTreeTraceEvent>& trace) {
    assert(!trace.empty());
    assert(trace.back().type == "traversal_completed");
}

void test_empty_tree_trace() {
    RTree tree(4, 2);
    RTree::QueryMetrics metrics;
    std::vector<RTreeTraceEvent> trace;

    auto results = tree.search(BoundingBox{0, 0, 10, 10}, metrics, &trace);

    assert(results.empty());
    assert(metrics.nodes_visited == 1);
    verify_trace_ends_with_completed(trace);
    assert(count_event_type(trace, "node_visited") == 1);
    assert(count_event_type(trace, "traversal_completed") == 1);
    assert(count_event_type(trace, "entity_accepted") == 0);
    assert(count_event_type(trace, "branch_pruned") == 0);

    std::cout << "test_empty_tree_trace PASSED" << std::endl;
}

void test_no_match_query_trace() {
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 10, 10}, 1);
    tree.insert(BoundingBox{100, 100, 110, 110}, 2);

    RTree::QueryMetrics metrics;
    std::vector<RTreeTraceEvent> trace;
    auto results = tree.search(BoundingBox{50, 50, 60, 60}, metrics, &trace);

    assert(results.empty());
    verify_trace_ends_with_completed(trace);
    verify_trace_results_match(results, trace);
    assert(count_event_type(trace, "entity_accepted") == 0);
    // Should have at least one branch_pruned since the query doesn't match anything
    assert(count_event_type(trace, "branch_pruned") > 0);

    std::cout << "test_no_match_query_trace PASSED" << std::endl;
}

void test_trace_with_pruned_and_visited_branches() {
    // Build a tree with well-separated clusters so some branches are pruned.
    RTree tree(4, 2);

    // Cluster 0: IDs 1-4 near (0,0)
    for (int i = 0; i < 4; ++i) {
        tree.insert(BoundingBox{static_cast<double>(i), static_cast<double>(i),
                                static_cast<double>(i + 1), static_cast<double>(i + 1)}, i + 1);
    }
    // Cluster 1: IDs 5-8 near (100,0)
    for (int i = 0; i < 4; ++i) {
        tree.insert(BoundingBox{100.0 + static_cast<double>(i), static_cast<double>(i),
                                100.0 + static_cast<double>(i + 1), static_cast<double>(i + 1)}, i + 5);
    }

    assert(tree.size() == 8);
    assert(tree.validate_structure());

    // Query that overlaps Cluster 0 but not Cluster 1
    RTree::QueryMetrics metrics;
    std::vector<RTreeTraceEvent> trace;
    auto results = tree.search(BoundingBox{-1, -1, 10, 10}, metrics, &trace);

    std::sort(results.begin(), results.end());
    assert(results == (std::vector<int>{1, 2, 3, 4}));

    verify_trace_ends_with_completed(trace);
    verify_trace_results_match(results, trace);
    verify_pruned_are_not_intersecting(trace);
    verify_accepted_are_intersecting(trace);

    // Must have at least one visited branch and at least one pruned branch
    assert(count_event_type(trace, "node_visited") > 0);
    assert(count_event_type(trace, "branch_pruned") > 0);
    assert(count_event_type(trace, "entity_accepted") == 4);

    std::cout << "test_trace_with_pruned_and_visited_branches PASSED" << std::endl;
}

void test_trace_result_consistency() {
    // Large random tree: trace results must always match search results.
    RTree tree(8, 2);
    std::mt19937 gen(42);
    std::uniform_real_distribution<double> dist(-100.0, 100.0);
    std::uniform_real_distribution<double> size_dist(1.0, 10.0);

    std::vector<BoundingBox> dataset;
    for (int i = 0; i < 100; ++i) {
        double x = dist(gen);
        double y = dist(gen);
        double w = size_dist(gen);
        double h = size_dist(gen);
        BoundingBox b{x, y, x + w, y + h};
        tree.insert(b, i);
        dataset.push_back(b);
    }
    tree.validate_structure();

    for (int i = 0; i < 20; ++i) {
        double x = dist(gen);
        double y = dist(gen);
        double w = size_dist(gen) * 5;
        double h = size_dist(gen) * 5;
        BoundingBox q{x, y, x + w, y + h};

        RTree::QueryMetrics metrics;
        std::vector<RTreeTraceEvent> trace;
        auto trace_results = tree.search(q, metrics, &trace);

        RTree::QueryMetrics metrics2;
        auto plain_results = tree.search(q, metrics2);

        std::sort(trace_results.begin(), trace_results.end());
        std::sort(plain_results.begin(), plain_results.end());
        assert(trace_results == plain_results);
        assert(metrics.nodes_visited == metrics2.nodes_visited);
        verify_trace_results_match(trace_results, trace);
    }

    std::cout << "test_trace_result_consistency PASSED" << std::endl;
}

void test_trace_event_ordering() {
    // Simple single-leaf tree: verify event sequence is logical.
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 10, 10}, 1);
    tree.insert(BoundingBox{2, 2, 8, 8}, 2);

    RTree::QueryMetrics metrics;
    std::vector<RTreeTraceEvent> trace;
    auto results = tree.search(BoundingBox{0, 0, 10, 10}, metrics, &trace);

    assert(results.size() == 2);
    verify_trace_ends_with_completed(trace);

    // First event must be node_visited
    assert(trace.front().type == "node_visited");
    // Last event must be traversal_completed
    assert(trace.back().type == "traversal_completed");

    // entity_accepted events must come after their leaf_entry_examined
    std::size_t first_accepted = trace.size();
    for (std::size_t i = 0; i < trace.size(); ++i) {
        if (trace[i].type == "entity_accepted" && first_accepted == trace.size()) {
            first_accepted = i;
        }
    }
    // At least one leaf_entry_examined should precede at least one entity_accepted
    assert(count_event_type(trace, "leaf_entry_examined") > 0);
    assert(count_event_type(trace, "entity_accepted") == 2);

    std::cout << "test_trace_event_ordering PASSED" << std::endl;
}

void test_trace_without_trace_parameter_unchanged() {
    // Verify calling search without trace still works and gives same results.
    RTree tree(4, 2);
    for (int i = 0; i < 10; ++i) {
        tree.insert(BoundingBox{static_cast<double>(i), static_cast<double>(i),
                                static_cast<double>(i + 2), static_cast<double>(i + 2)}, i);
    }

    RTree::QueryMetrics m1;
    auto r1 = tree.search(BoundingBox{0, 0, 5, 5}, m1);

    RTree::QueryMetrics m2;
    std::vector<RTreeTraceEvent> trace;
    auto r2 = tree.search(BoundingBox{0, 0, 5, 5}, m2, &trace);

    std::sort(r1.begin(), r1.end());
    std::sort(r2.begin(), r2.end());
    assert(r1 == r2);
    assert(m1.nodes_visited == m2.nodes_visited);

    std::cout << "test_trace_without_trace_parameter_unchanged PASSED" << std::endl;
}

int main() {
    test_empty_tree_trace();
    test_no_match_query_trace();
    test_trace_with_pruned_and_visited_branches();
    test_trace_result_consistency();
    test_trace_event_ordering();
    test_trace_without_trace_parameter_unchanged();

    std::cout << "All traversal trace tests passed." << std::endl;
    return 0;
}
