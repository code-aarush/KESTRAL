// Integration tests for the exported traversal trace.
//
// These verify that the hierarchy schema introduced for the R-tree hierarchy
// visualizer and the recorded traversal trace coexist in one valid export and
// that both use the very same canonical identifiers.
//
// The test is self contained: it uses its own minimal JSON reader so that the
// existing exporter test (tests/test_export.cpp) stays untouched.

#include "export.h"
#include "rtree.h"
#include "entity_store.h"
#include "mission.h"
#include <cassert>
#include <iostream>
#include <algorithm>
#include <map>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace kestrel;

// ---------------------------------------------------------------------------
// Minimal zero-dependency JSON reader
// ---------------------------------------------------------------------------

enum class JsonType { Null, Bool, Number, String, Array, Object };

struct JsonValue {
    JsonType type = JsonType::Null;
    bool bool_val = false;
    double num_val = 0.0;
    std::string str_val;
    std::vector<JsonValue> arr_val;
    std::vector<std::pair<std::string, JsonValue>> obj_val;

    bool is_null() const { return type == JsonType::Null; }
    bool is_bool() const { return type == JsonType::Bool; }
    bool is_number() const { return type == JsonType::Number; }
    bool is_string() const { return type == JsonType::String; }
    bool is_array() const { return type == JsonType::Array; }
    bool is_object() const { return type == JsonType::Object; }

    const JsonValue& operator[](const std::string& key) const {
        for (const auto& kv : obj_val) {
            if (kv.first == key) return kv.second;
        }
        static JsonValue null_val;
        return null_val;
    }

    const JsonValue& operator[](size_t index) const {
        if (index < arr_val.size()) return arr_val[index];
        static JsonValue null_val;
        return null_val;
    }

    bool has(const std::string& key) const {
        for (const auto& kv : obj_val) {
            if (kv.first == key) return true;
        }
        return false;
    }
};

class JsonReader {
    std::string src;
    size_t pos = 0;

    void skip_ws() {
        while (pos < src.size() &&
               (src[pos] == ' ' || src[pos] == '\t' || src[pos] == '\n' || src[pos] == '\r')) {
            ++pos;
        }
    }

    char peek() { skip_ws(); return pos < src.size() ? src[pos] : '\0'; }
    char get() { skip_ws(); return pos < src.size() ? src[pos++] : '\0'; }

    std::string parse_string() {
        get(); // opening quote
        std::string s;
        while (pos < src.size()) {
            char c = src[pos++];
            if (c == '"') return s;
            if (c == '\\' && pos < src.size()) c = src[pos++];
            s += c;
        }
        return s;
    }

    JsonValue parse_number() {
        size_t start = pos;
        if (pos < src.size() && (src[pos] == '-' || src[pos] == '+')) ++pos;
        while (pos < src.size() &&
               ((src[pos] >= '0' && src[pos] <= '9') || src[pos] == '.' ||
                src[pos] == 'e' || src[pos] == 'E' || src[pos] == '-' || src[pos] == '+')) {
            ++pos;
        }
        JsonValue v;
        v.type = JsonType::Number;
        v.num_val = std::stod(src.substr(start, pos - start));
        return v;
    }

public:
    explicit JsonReader(std::string text) : src(std::move(text)) {}

    JsonValue parse() {
        char c = peek();
        if (c == '{') {
            get();
            JsonValue v;
            v.type = JsonType::Object;
            while (peek() != '}' && peek() != '\0') {
                std::string key = parse_string();
                if (get() != ':') throw std::runtime_error("Expected ':'");
                v.obj_val.emplace_back(std::move(key), parse());
                if (peek() == ',') get();
            }
            if (get() != '}') throw std::runtime_error("Expected '}'");
            return v;
        }
        if (c == '[') {
            get();
            JsonValue v;
            v.type = JsonType::Array;
            while (peek() != ']' && peek() != '\0') {
                v.arr_val.push_back(parse());
                if (peek() == ',') get();
            }
            if (get() != ']') throw std::runtime_error("Expected ']'");
            return v;
        }
        if (c == '"') {
            JsonValue v;
            v.type = JsonType::String;
            v.str_val = parse_string();
            return v;
        }
        if (src.compare(pos, 4, "true") == 0) {
            pos += 4;
            JsonValue v;
            v.type = JsonType::Bool;
            v.bool_val = true;
            return v;
        }
        if (src.compare(pos, 5, "false") == 0) {
            pos += 5;
            JsonValue v;
            v.type = JsonType::Bool;
            v.bool_val = false;
            return v;
        }
        if (src.compare(pos, 4, "null") == 0) {
            pos += 4;
            JsonValue v;
            v.type = JsonType::Null;
            return v;
        }
        return parse_number();
    }
};

JsonValue parse_json(const std::string& text) {
    JsonReader reader(text);
    return reader.parse();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Collects every identifier present in the exported hierarchy.
void collect_hierarchy_ids(const JsonValue& node, std::set<std::string>& ids,
                           std::map<std::string, double>& entity_ids) {
    if (!node.is_object()) return;
    ids.insert(node["id"].str_val);
    if (node["type"].str_val == "entity") {
        entity_ids[node["id"].str_val] = node["entity_id"].num_val;
    }
    for (const auto& child : node["children"].arr_val) {
        collect_hierarchy_ids(child, ids, entity_ids);
    }
}

// Builds a tree with two well separated clusters so a query must prune one of
// the root's branches.
void build_clustered_tree(RTree& tree, EntityStore& store) {
    for (int c = 0; c < 2; ++c) {
        double bx = c * 100.0;
        for (int i = 0; i < 4; ++i) {
            int id = c * 4 + i + 1;
            BoundingBox b{bx + i, static_cast<double>(i), bx + i + 1.0, static_cast<double>(i) + 1.0};
            tree.insert(b, id);
            Entity e;
            e.id = id;
            e.bounds = b;
            e.active = true;
            store.insert(e);
        }
    }
}

// ---------------------------------------------------------------------------
// Test Case 1: The trace is exported next to the hierarchy
// ---------------------------------------------------------------------------
void test_trace_is_exported_with_hierarchy() {
    std::cout << "[Test 1] Verifying trace and hierarchy coexist in one export..." << std::endl;

    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    MissionControl mission(tree, store);
    BoundingBox query{-1, -1, 10, 10};
    RTreeTrace trace;
    auto results = mission.region_scan(query, nullptr, &trace);
    assert(!results.empty());
    assert(!trace.events.empty());

    std::ostringstream ss;
    export_simulation_state(tree, store, query, results, ss, &trace);
    JsonValue doc = parse_json(ss.str());

    assert(doc.is_object());
    assert(doc.has("scene_id"));
    assert(doc.has("entities"));
    assert(doc.has("rtree"));
    assert(doc.has("query"));
    assert(doc.has("trace"));

    // The hierarchy is untouched by the trace addition.
    assert(doc["rtree"].has("root"));
    assert(doc["rtree"]["root"].is_object());
    assert(doc["rtree"]["root"]["id"].str_val == "node_0");
    assert(doc["rtree"]["root"]["type"].str_val == "root");
    assert(doc["rtree"].has("internal_mbrs"));
    assert(doc["rtree"].has("leaf_mbrs"));
    assert(doc["rtree"].has("height"));
    assert(doc["rtree"].has("size"));

    // The trace is a complete object.
    const JsonValue& t = doc["trace"];
    assert(t.is_object());
    assert(t.has("scene_id"));
    assert(t.has("query_id"));
    assert(t.has("query_bounds"));
    assert(t.has("truncated"));
    assert(t.has("total_events"));
    assert(t.has("events"));
    assert(t["events"].is_array());
    assert(t["total_events"].num_val == static_cast<double>(t["events"].arr_val.size()));
    assert(t["events"].arr_val.size() == trace.events.size());
    assert(t["truncated"].bool_val == false);
}

// ---------------------------------------------------------------------------
// Test Case 2: Scene and query identity agree between the export and the trace
// ---------------------------------------------------------------------------
void test_trace_identity_matches_scene() {
    std::cout << "[Test 2] Verifying trace scene/query identity..." << std::endl;

    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    MissionControl mission(tree, store);
    BoundingBox query{-1, -1, 10, 10};
    RTreeTrace trace;
    auto results = mission.region_scan(query, nullptr, &trace);

    std::ostringstream ss;
    export_simulation_state(tree, store, query, results, ss, &trace);
    JsonValue doc = parse_json(ss.str());

    assert(doc["trace"]["scene_id"].num_val == doc["scene_id"].num_val);
    assert(doc["trace"]["query_id"].num_val == doc["query"]["query_id"].num_val);
    assert(doc["trace"]["query_bounds"][0].num_val == doc["query"]["bounds"][0].num_val);
    assert(doc["trace"]["query_bounds"][1].num_val == doc["query"]["bounds"][1].num_val);
    assert(doc["trace"]["query_bounds"][2].num_val == doc["query"]["bounds"][2].num_val);
    assert(doc["trace"]["query_bounds"][3].num_val == doc["query"]["bounds"][3].num_val);

    // A different query must produce a different scene identity, so a trace
    // can never be mistaken for the trace of another query.
    std::ostringstream other;
    export_simulation_state(tree, store, BoundingBox{500, 500, 600, 600}, {}, other, &trace);
    JsonValue other_doc = parse_json(other.str());
    assert(other_doc["scene_id"].num_val != doc["scene_id"].num_val);
}

// ---------------------------------------------------------------------------
// Test Case 3: Every trace reference resolves to a hierarchy node / entity
// ---------------------------------------------------------------------------
void test_trace_references_resolve_to_hierarchy() {
    std::cout << "[Test 3] Verifying trace references resolve in the hierarchy..." << std::endl;

    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    MissionControl mission(tree, store);
    BoundingBox query{-1, -1, 10, 10};
    RTreeTrace trace;
    auto results = mission.region_scan(query, nullptr, &trace);

    std::ostringstream ss;
    export_simulation_state(tree, store, query, results, ss, &trace);
    JsonValue doc = parse_json(ss.str());

    std::set<std::string> hierarchy_ids;
    std::map<std::string, double> hierarchy_entities;
    collect_hierarchy_ids(doc["rtree"]["root"], hierarchy_ids, hierarchy_entities);
    assert(hierarchy_ids.size() > 2);

    bool saw_prune = false;
    bool saw_visit = false;

    for (const auto& ev : doc["trace"]["events"].arr_val) {
        assert(ev.has("type"));
        assert(ev.has("node_id"));
        assert(ev.has("child_node_id"));
        assert(ev.has("entity_id"));
        assert(ev.has("mbr"));
        assert(ev.has("intersects"));

        // Node references use canonical hierarchy identifiers.
        if (!ev["node_id"].is_null()) {
            assert(ev["node_id"].is_string());
            assert(hierarchy_ids.count(ev["node_id"].str_val) == 1);
        }
        if (!ev["child_node_id"].is_null()) {
            assert(ev["child_node_id"].is_string());
            assert(hierarchy_ids.count(ev["child_node_id"].str_val) == 1);
        }

        const std::string type = ev["type"].str_val;
        if (type == "branch_pruned") saw_prune = true;
        if (type == "node_visited") saw_visit = true;

        if (type == "entity_accepted") {
            assert(ev["entity_id"].num_val > 0);
            const std::string entity_ref = hierarchy_entity_id(static_cast<int>(ev["entity_id"].num_val));
            assert(hierarchy_ids.count(entity_ref) == 1);
        }
    }

    assert(saw_visit);
    assert(saw_prune);
}

// ---------------------------------------------------------------------------
// Test Case 4: The recorded results equal the exported query results
// ---------------------------------------------------------------------------
void test_trace_results_match_query_results() {
    std::cout << "[Test 4] Verifying trace results equal query results..." << std::endl;

    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    MissionControl mission(tree, store);
    BoundingBox query{-1, -1, 10, 10};
    RTreeTrace trace;
    auto results = mission.region_scan(query, nullptr, &trace);

    std::ostringstream ss;
    export_simulation_state(tree, store, query, results, ss, &trace);
    JsonValue doc = parse_json(ss.str());

    std::vector<double> exported_results;
    for (const auto& r : doc["query"]["results"].arr_val) {
        exported_results.push_back(r.num_val);
    }

    std::vector<double> accepted;
    for (const auto& ev : doc["trace"]["events"].arr_val) {
        if (ev["type"].str_val == "entity_accepted") {
            accepted.push_back(ev["entity_id"].num_val);
        }
    }

    assert(exported_results.size() == accepted.size());
    assert(!accepted.empty());

    std::vector<double> a = accepted;
    std::vector<double> b = exported_results;
    std::sort(a.begin(), a.end());
    std::sort(b.begin(), b.end());
    assert(a == b);
}

// ---------------------------------------------------------------------------
// Test Case 5: Exporting without a trace keeps a valid document
// ---------------------------------------------------------------------------
void test_export_without_trace_is_still_valid() {
    std::cout << "[Test 5] Verifying export without trace stays valid..." << std::endl;

    RTree tree(4, 2);
    EntityStore store;
    build_clustered_tree(tree, store);

    std::ostringstream ss;
    export_simulation_state(tree, store, BoundingBox{0, 0, 10, 10}, {1, 2}, ss);
    JsonValue doc = parse_json(ss.str());

    assert(doc.is_object());
    assert(doc["rtree"]["root"].is_object());
    assert(doc["rtree"]["root"]["id"].str_val == "node_0");
    assert(doc["query"]["results"].arr_val.size() == 2);
    assert(doc["trace"].is_null());
}

// ---------------------------------------------------------------------------
// Test Case 6: The canonical identifier map matches the exported hierarchy
// ---------------------------------------------------------------------------
void test_canonical_id_map_matches_hierarchy() {
    std::cout << "[Test 6] Verifying canonical identifier map..." << std::endl;

    RTree tree(4, 2);
    for (int i = 0; i < 9; ++i) {
        double pos = static_cast<double>(i * 10);
        tree.insert(BoundingBox{pos, pos, pos + 4.0, pos + 4.0}, 700 + i);
    }
    assert(tree.height() >= 2);

    std::ostringstream ss;
    int next_id = 0;
    CanonicalNodeIdMap canonical;
    export_node_hierarchy(tree.get_root(), ss, 0, next_id, "", 0, true, &canonical);
    JsonValue root = parse_json(ss.str());

    std::set<std::string> hierarchy_ids;
    std::map<std::string, double> hierarchy_entities;
    collect_hierarchy_ids(root, hierarchy_ids, hierarchy_entities);

    // Every canonical id refers to a node that exists in the hierarchy.
    assert(!canonical.empty());
    for (const auto& entry : canonical) {
        assert(hierarchy_ids.count(entry.second) == 1);
    }

    // The internal identifiers are unique, so the mapping cannot collide.
    std::set<std::size_t> internal_ids;
    for (const auto& entry : canonical) {
        assert(internal_ids.insert(entry.first).second);
    }

    // The root is always the first exported node.
    assert(canonical.at(tree.get_root()->id) == "node_0");
}

// ---------------------------------------------------------------------------
// Test Case 7: A truncated trace is flagged in the export
// ---------------------------------------------------------------------------
void test_truncated_trace_is_flagged() {
    std::cout << "[Test 7] Verifying truncated trace flag..." << std::endl;

    RTree tree(4, 2);
    for (int i = 0; i < 40; ++i) {
        double pos = static_cast<double>(i * 10);
        tree.insert(BoundingBox{pos, pos, pos + 4.0, pos + 4.0}, 800 + i);
    }

    EntityStore empty_store;
    MissionControl mission(tree, empty_store);
    BoundingBox query{-1000, -1000, 1000, 1000};
    RTreeTrace trace;
    trace.max_events = 8;
    auto results = mission.region_scan(query, nullptr, &trace);

    assert(!results.empty());
    assert(trace.truncated);
    assert(trace.events.size() <= 8);
    assert(trace.events.back().type == RTreeTraceEventType::TraversalCompleted);

    std::ostringstream ss;
    export_simulation_state(tree, empty_store, query, results, ss, &trace);
    JsonValue doc = parse_json(ss.str());

    assert(doc["trace"]["truncated"].bool_val == true);
    assert(doc["trace"]["total_events"].num_val == static_cast<double>(trace.events.size()));
}

int main() {
    test_trace_is_exported_with_hierarchy();
    test_trace_identity_matches_scene();
    test_trace_references_resolve_to_hierarchy();
    test_trace_results_match_query_results();
    test_export_without_trace_is_still_valid();
    test_canonical_id_map_matches_hierarchy();
    test_truncated_trace_is_flagged();
    std::cout << "All export trace integration tests passed." << std::endl;
    return 0;
}
