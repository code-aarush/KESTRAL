#include "rtree.h"
#include <iostream>
#include <cassert>
#include <vector>
#include <algorithm>
#include <random>

using namespace kestrel;

void test_empty_tree() {
    // GATE-05-AC-01
    RTree tree(4, 2);
    RTree::QueryMetrics metrics;
    std::vector<int> results = tree.search(BoundingBox{0, 0, 10, 10}, metrics);
    assert(results.empty());
    assert(metrics.nodes_visited == 1); 
}

void test_boundary_touching() {
    // GATE-05-AC-05
    RTree tree(4, 2);
    tree.insert(BoundingBox{0, 0, 10, 10}, 1);
    
    // Touching corner
    RTree::QueryMetrics m1;
    auto r1 = tree.search(BoundingBox{10, 10, 20, 20}, m1);
    assert(r1.size() == 1 && r1[0] == 1);
    
    // Touching edge
    RTree::QueryMetrics m2;
    auto r2 = tree.search(BoundingBox{5, 10, 8, 20}, m2);
    assert(r2.size() == 1 && r2[0] == 1);
    
    // Disjoint
    RTree::QueryMetrics m3;
    auto r3 = tree.search(BoundingBox{11, 11, 20, 20}, m3);
    assert(r3.empty());
}

void test_small_deterministic_query() {
    RTree tree(4, 2);
    
    for (int i = 0; i < 20; ++i) {
        BoundingBox b{static_cast<double>(i), static_cast<double>(i), 
                      static_cast<double>(i+2), static_cast<double>(i+2)};
        tree.insert(b, i);
    }
    
    struct ExpectedResult {
        BoundingBox query;
        std::vector<int> ids;
    };

    std::vector<ExpectedResult> expected = {
        { BoundingBox{0, 0, 5, 5}, {0, 1, 2, 3, 4, 5} },
        { BoundingBox{10, 10, 11, 11}, {8, 9, 10, 11} },
        { BoundingBox{-5, -5, -1, -1}, {} }, 
        { BoundingBox{4, 4, 18, 18}, {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18} },
        { BoundingBox{19, 19, 25, 25}, {17, 18, 19} }
    };
    
    for (const auto& expect : expected) {
        RTree::QueryMetrics metrics;
        std::vector<int> tree_result = tree.search(expect.query, metrics);
        std::sort(tree_result.begin(), tree_result.end());
        
        auto last = std::unique(tree_result.begin(), tree_result.end());
        assert(last == tree_result.end()); 
        
        assert(tree_result == expect.ids);
        assert(metrics.nodes_visited > 0 || expect.ids.empty());
    }
}

void test_large_random_query() {
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
        std::vector<int> tree_result = tree.search(q, metrics);
        std::sort(tree_result.begin(), tree_result.end());
        
        auto last = std::unique(tree_result.begin(), tree_result.end());
        assert(last == tree_result.end()); 
        
        for (int id : tree_result) {
            assert(intersects(q, dataset[id]));
        }
    }
    
    for (int i = 0; i < 100; ++i) {
        RTree::QueryMetrics m;
        auto res = tree.search(dataset[i], m);
        assert(std::find(res.begin(), res.end(), i) != res.end());
    }
}

void test_query_completeness_under_mutations() {
    // GATE-11 Limitation 3.B: Explicitly constructed multi-level tree with deterministic completeness.
    // Capacity M=4, m=2 ensures multiple splits into leaves and internal nodes.
    RTree tree(4, 2);

    // 16 entities across 4 isolated clusters:
    // Cluster 0: (0,0)..(3,3), IDs 1..4
    // Cluster 1: (100,0)..(103,3), IDs 5..8
    // Cluster 2: (0,100)..(3,103), IDs 9..12
    // Cluster 3: (100,100)..(103,103), IDs 13..16
    for (int c = 0; c < 4; ++c) {
        double bx = (c % 2) * 100.0;
        double by = (c / 2) * 100.0;
        for (int i = 0; i < 4; ++i) {
            int id = c * 4 + i + 1;
            BoundingBox b{bx + i, by + i, bx + i + 1.0, by + i + 1.0};
            tree.insert(b, id);
        }
    }
    assert(tree.size() == 16);
    assert(tree.validate_structure());

    auto run_query = [&](BoundingBox q) {
        RTree::QueryMetrics m;
        std::vector<int> res = tree.search(q, m);
        std::sort(res.begin(), res.end());
        return res;
    };

    // 1. Query individual clusters: full completeness, zero false negatives, zero false positives
    assert(run_query({-1, -1, 10, 10}) == (std::vector<int>{1, 2, 3, 4}));
    assert(run_query({95, -1, 110, 10}) == (std::vector<int>{5, 6, 7, 8}));
    assert(run_query({-1, 95, 10, 110}) == (std::vector<int>{9, 10, 11, 12}));
    assert(run_query({95, 95, 110, 110}) == (std::vector<int>{13, 14, 15, 16}));

    // 2. Query spanning Cluster 0 and 1 horizontally
    assert(run_query({-1, -1, 110, 10}) == (std::vector<int>{1, 2, 3, 4, 5, 6, 7, 8}));

    // 3. Query spanning all clusters
    assert(run_query({-5, -5, 120, 120}) == (std::vector<int>{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}));

    // 4. Query in the empty inter-cluster void
    assert(run_query({20, 20, 80, 80}).empty());

    // 5. Boundary touching queries (point / edge contacts)
    // Touching exactly entity 4's max corner (4.0, 4.0)
    assert(run_query({4.0, 4.0, 10.0, 10.0}) == (std::vector<int>{4}));
    // Touching exactly entity 5's min corner (100.0, 0.0)
    assert(run_query({90.0, -5.0, 100.0, 0.0}) == (std::vector<int>{5}));

    // 6. Deletion effects on completeness
    // Delete entity 2 from Cluster 0
    tree.remove({1.0, 1.0, 2.0, 2.0}, 2);
    assert(tree.size() == 15);
    assert(tree.validate_structure());
    assert(run_query({-1, -1, 10, 10}) == (std::vector<int>{1, 3, 4}));

    // Delete entity 3 (triggers node underflow m=2, reinserting remaining entries)
    tree.remove({2.0, 2.0, 3.0, 3.0}, 3);
    assert(tree.size() == 14);
    assert(tree.validate_structure());
    assert(run_query({-1, -1, 10, 10}) == (std::vector<int>{1, 4}));
    // Confirm other clusters unaffected
    assert(run_query({95, -1, 110, 10}) == (std::vector<int>{5, 6, 7, 8}));

    // 7. Dynamic update effects on completeness
    // Move entity 1 from Cluster 0 into Cluster 3 at (104, 104, 105, 105)
    tree.update({0.0, 0.0, 1.0, 1.0}, {104.0, 104.0, 105.0, 105.0}, 1);
    assert(tree.size() == 14);
    assert(tree.validate_structure());
    // Cluster 0 now has only entity 4
    assert(run_query({-1, -1, 10, 10}) == (std::vector<int>{4}));
    // Cluster 3 now has {1, 13, 14, 15, 16}
    assert(run_query({95, 95, 110, 110}) == (std::vector<int>{1, 13, 14, 15, 16}));
}

int main() {
    test_empty_tree();
    test_boundary_touching();
    test_small_deterministic_query();
    test_large_random_query();
    test_query_completeness_under_mutations();
    std::cout << "All range query tests passed." << std::endl;
    return 0;
}
