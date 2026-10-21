// Tests for the interactive query service.
//
// The service is the only place where a user defined region reaches the
// R-tree, so these tests cover the request contract, the validation rules,
// the geometry semantics and the parity between the returned ids and the
// ids produced by the R-tree range query itself.

// Asserts must stay active even in a Release build, otherwise the whole
// suite would silently pass.
#ifdef NDEBUG
#undef NDEBUG
#endif

#include "query_service.h"
#include "scene.h"
#include "rtree.h"
#include "entity_store.h"
#include "geometry.h"
#include <algorithm>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <random>
#include <string>
#include <vector>

using namespace kestrel;

namespace {

// Extracts the value of a string field, e.g. "status":"ok" -> ok.
std::string extract_string_field(const std::string& json, const std::string& key) {
    const std::string needle = "\"" + key + "\":\"";
    const std::size_t start = json.find(needle);
    if (start == std::string::npos) return "";
    const std::size_t value_start = start + needle.size();
    const std::size_t end = json.find('"', value_start);
    if (end == std::string::npos) return "";
    return json.substr(value_start, end - value_start);
}

// Extracts an unsigned integer field, e.g. "scene_key":42 -> 42.
std::uint64_t extract_uint_field(const std::string& json, const std::string& key) {
    const std::string needle = "\"" + key + "\":";
    const std::size_t start = json.find(needle);
    if (start == std::string::npos) return 0;
    std::size_t pos = start + needle.size();
    std::uint64_t value = 0;
    bool any = false;
    while (pos < json.size() && json[pos] >= '0' && json[pos] <= '9') {
        value = value * 10 + static_cast<std::uint64_t>(json[pos] - '0');
        ++pos;
        any = true;
    }
    return any ? value : 0;
}

// Extracts the integer array of the "results" field.
std::vector<int> extract_results(const std::string& json) {
    std::vector<int> results;
    const std::string needle = "\"results\":[";
    const std::size_t start = json.find(needle);
    if (start == std::string::npos) return results;

    std::size_t pos = start + needle.size();
    while (pos < json.size()) {
        if (json[pos] == ']') break;
        if (json[pos] == ',') {
            ++pos;
            continue;
        }
        if (json[pos] == '-' || (json[pos] >= '0' && json[pos] <= '9')) {
            const int value = std::stoi(json.substr(pos));
            results.push_back(value);
            while (pos < json.size() && json[pos] != ',' && json[pos] != ']') ++pos;
            continue;
        }
        ++pos; // skip whitespace
    }
    return results;
}

// Builds a tree with two well separated clusters.
void build_clustered_tree(RTree& tree, EntityStore& store) {
    for (int c = 0; c < 2; ++c) {
        const double base = c * 100.0;
        for (int i = 0; i < 4; ++i) {
            const int id = c * 4 + i + 1;
            const BoundingBox bounds{base + i, static_cast<double>(i), base + i + 1.0, static_cast<double>(i) + 1.0};
            tree.insert(bounds, id);
            Entity entity;
            entity.id = id;
            entity.bounds = bounds;
            entity.active = true;
            store.insert(entity);
        }
    }
}

// Linear reference used only to verify the R-tree result set.
std::vector<int> brute_force(const EntityStore& store, const BoundingBox& region) {
    std::vector<int> hits;
    for (auto it = store.begin(); it != store.end(); ++it) {
        if (intersects(region, it->second.bounds)) hits.push_back(it->second.id);
    }
    std::sort(hits.begin(), hits.end());
    return hits;
}

std::string query_line(const BoundingBox& region) {
    std::string line = "{\"op\":\"query\",\"bounds\":[";
    line += std::to_string(region.min_x) + ",";
    line += std::to_string(region.min_y) + ",";
    line += std::to_string(region.max_x) + ",";
    line += std::to_string(region.max_y) + "]}";
    return line;
}

} // namespace

// A valid request returns the ids produced by the R-tree range query.
void test_valid_query_returns_matching_ids() {
    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    const BoundingBox region{-1, -1, 10, 10};
    const std::string response = handle_query_request(query_line(region), tree, store);

    assert(extract_string_field(response, "status") == "ok");
    assert(extract_uint_field(response, "scene_key") == scene_key(store));

    std::vector<int> results = extract_results(response);
    std::sort(results.begin(), results.end());
    assert(results == brute_force(store, region));
    assert(results.size() == 4);

    // The service reports the nodes the traversal visited.
    assert(extract_uint_field(response, "nodes_visited") > 0);
}

// A region that matches nothing is a successful, empty query.
void test_empty_query_region() {
    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    const BoundingBox region{40, 40, 60, 60}; // the void between the clusters
    const std::string response = handle_query_request(query_line(region), tree, store);

    assert(extract_string_field(response, "status") == "empty");
    assert(extract_results(response).empty());
}

// Boundaries are inclusive: an entity that only touches the query region is
// part of the result set.
void test_boundary_touching_query_is_inclusive() {
    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    // Entity 1 occupies [0,0]-[1,1]; the query touches it at x = 1 only.
    const BoundingBox region{1, 0, 5, 5};
    const std::string response = handle_query_request(query_line(region), tree, store);

    std::vector<int> results = extract_results(response);
    std::sort(results.begin(), results.end());
    assert(results == brute_force(store, region));
    assert(std::find(results.begin(), results.end(), 1) != results.end());
}

// A degenerate (point) region is valid and is executed like any other query.
void test_degenerate_point_query_is_executed() {
    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    const BoundingBox region{0.5, 0.5, 0.5, 0.5}; // inside entity 1
    const std::string response = handle_query_request(query_line(region), tree, store);

    assert(extract_string_field(response, "status") == "ok");
    std::vector<int> results = extract_results(response);
    assert(results.size() == 1);
    assert(results.front() == 1);
}

// Malformed or unsafe requests are rejected before the tree is touched.
void test_invalid_requests_are_rejected() {
    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    const std::vector<std::string> invalid_requests = {
        "",                                        // empty request
        "not json",                               // not an object
        "{}",                                      // no bounds
        "{\"op\":\"query\"}",                      // no bounds
        "{\"op\":\"query\",\"bounds\":[1,2,3]}",   // too few numbers
        "{\"op\":\"query\",\"bounds\":[1,2,3,4,5]}",// too many numbers
        "{\"op\":\"query\",\"bounds\":[\"a\",\"b\",\"c\",\"d\"]}", // not numbers
        "{\"op\":\"query\",\"bounds\":[1,2,3,NaN]}", // NaN coordinate
        "{\"op\":\"query\",\"bounds\":[1,2,3,Infinity]}", // infinite coordinate
        "{\"op\":\"query\",\"bounds\":[10,10,0,0]}", // reversed bounds
        "{\"op\":\"query\",\"bounds\":[1,2,3,4]} trailing", // trailing content
        "{\"op\":\"explode\",\"bounds\":[1,2,3,4]}", // unknown operation
        "{\"op\":\"query\",\"bounds\":[1,2,3,4",     // truncated object
        "[1,2,3,4]"                                // wrong root type
    };

    for (const std::string& request : invalid_requests) {
        const std::string response = handle_query_request(request, tree, store);
        assert(extract_string_field(response, "status") == "invalid");
        assert(!extract_string_field(response, "message").empty());
        assert(extract_results(response).empty());
    }
}

// The scene operation reports the identity of the scene the service holds.
void test_scene_operation_reports_identity() {
    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    const std::string response = handle_query_request("{\"op\":\"scene\"}", tree, store);

    assert(extract_string_field(response, "status") == "ok");
    assert(extract_uint_field(response, "scene_key") == scene_key(store));
    assert(extract_uint_field(response, "entity_count") == store.size());
}

// The scene key identifies the scene contents, not the query.
void test_scene_key_is_query_independent() {
    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    const std::uint64_t key = scene_key(store);
    const std::string response = handle_query_request(query_line(BoundingBox{0, 0, 1, 1}), tree, store);
    assert(extract_uint_field(response, "scene_key") == key);

    // A different scene content produces a different key.
    EntityStore other_store;
    RTree other_tree(4, 2);
    build_clustered_tree(other_tree, other_store);
    Entity extra;
    extra.id = 99;
    extra.bounds = BoundingBox{500, 500, 501, 501};
    extra.active = true;
    other_store.insert(extra);
    assert(scene_key(other_store) != key);
}

// Repeated queries against the same scene return the same answer and never
// regenerate the scene.
void test_repeated_queries_are_stable() {
    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    const std::uint64_t key_before = scene_key(store);
    const BoundingBox region{-1, -1, 10, 10};

    for (int i = 0; i < 5; ++i) {
        const std::string response = handle_query_request(query_line(region), tree, store);
        assert(extract_string_field(response, "status") == "ok");
        assert(extract_uint_field(response, "scene_key") == key_before);
        assert(extract_results(response).size() == 4);
    }
    assert(scene_key(store) == key_before);
}

// The returned ids must equal the ids of the R-tree range query for every
// region of a deterministic sample.
void test_results_match_the_rtree_query() {
    RTree tree(4, 2);
    EntityStore store;

    std::mt19937 gen(20240521);
    std::uniform_real_distribution<double> position(-150.0, 150.0);
    std::uniform_real_distribution<double> extent(0.0, 60.0);

    for (int i = 0; i < 200; ++i) {
        const double x = position(gen);
        const double y = position(gen);
        const BoundingBox bounds{x, y, x + 1.0 + extent(gen) * 0.1, y + 1.0 + extent(gen) * 0.1};
        tree.insert(bounds, i + 1);
        Entity entity;
        entity.id = i + 1;
        entity.bounds = bounds;
        entity.active = true;
        store.insert(entity);
    }

    for (int q = 0; q < 50; ++q) {
        const double x = position(gen);
        const double y = position(gen);
        const double w = extent(gen);
        const double h = extent(gen);
        const BoundingBox region{x, y, x + w, y + h};

        const std::string response = handle_query_request(query_line(region), tree, store);
        assert(extract_string_field(response, "status") == (brute_force(store, region).empty() ? "empty" : "ok"));

        std::vector<int> results = extract_results(response);
        std::sort(results.begin(), results.end());
        assert(results == brute_force(store, region));
    }
}

// The demonstration scene is deterministic: the exporter and the query
// service must observe exactly the same tree.
void test_demo_scene_is_deterministic() {
    EntityStore first_store;
    RTree first_tree(4, 2);
    build_demo_scene(first_store, first_tree);

    EntityStore second_store;
    RTree second_tree(4, 2);
    build_demo_scene(second_store, second_tree);

    assert(scene_key(first_store) == scene_key(second_store));
    assert(first_tree.size() == second_tree.size());
    assert(first_tree.height() == second_tree.height());
    assert(first_store.size() == second_store.size());
}

int main() {
    test_valid_query_returns_matching_ids();
    test_empty_query_region();
    test_boundary_touching_query_is_inclusive();
    test_degenerate_point_query_is_executed();
    test_invalid_requests_are_rejected();
    test_scene_operation_reports_identity();
    test_scene_key_is_query_independent();
    test_repeated_queries_are_stable();
    test_results_match_the_rtree_query();
    test_demo_scene_is_deterministic();
    std::cout << "All query service tests passed." << std::endl;
    return 0;
}
