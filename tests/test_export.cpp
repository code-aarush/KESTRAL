#include "export.h"
#include "rtree.h"
#include "entity_store.h"
#include <iostream>
#include <sstream>
#include <cassert>
#include <string>
#include <vector>
#include <set>
#include <map>
#include <stdexcept>

using namespace kestrel;

// Minimal, zero-dependency recursive-descent JSON parser for test validation
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

class JsonParser {
    std::string src;
    size_t pos = 0;

    void skip_whitespace() {
        while (pos < src.size() && (src[pos] == ' ' || src[pos] == '\t' || src[pos] == '\n' || src[pos] == '\r')) {
            pos++;
        }
    }

    char peek() { skip_whitespace(); return pos < src.size() ? src[pos] : '\0'; }
    char get() { skip_whitespace(); return pos < src.size() ? src[pos++] : '\0'; }

    std::string parse_string() {
        get(); // consume '"'
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
        if (src[pos] == '-') pos++;
        while (pos < src.size() && ((src[pos] >= '0' && src[pos] <= '9') || src[pos] == '.' || src[pos] == 'e' || src[pos] == 'E' || src[pos] == '+' || src[pos] == '-')) {
            pos++;
        }
        JsonValue v;
        v.type = JsonType::Number;
        v.num_val = std::stod(src.substr(start, pos - start));
        return v;
    }

public:
    explicit JsonParser(std::string s) : src(std::move(s)) {}

    JsonValue parse_value() {
        char c = peek();
        if (c == '{') {
            get();
            JsonValue v;
            v.type = JsonType::Object;
            while (peek() != '}' && peek() != '\0') {
                std::string key = parse_string();
                if (get() != ':') throw std::runtime_error("Expected ':'");
                v.obj_val.emplace_back(std::move(key), parse_value());
                if (peek() == ',') get();
            }
            if (get() != '}') throw std::runtime_error("Expected '}'");
            return v;
        } else if (c == '[') {
            get();
            JsonValue v;
            v.type = JsonType::Array;
            while (peek() != ']' && peek() != '\0') {
                v.arr_val.push_back(parse_value());
                if (peek() == ',') get();
            }
            if (get() != ']') throw std::runtime_error("Expected ']'");
            return v;
        } else if (c == '"') {
            JsonValue v;
            v.type = JsonType::String;
            v.str_val = parse_string();
            return v;
        } else if (c == 't' || c == 'f') {
            JsonValue v;
            v.type = JsonType::Bool;
            if (src.substr(pos, 4) == "true") { pos += 4; v.bool_val = true; }
            else if (src.substr(pos, 5) == "false") { pos += 5; v.bool_val = false; }
            return v;
        } else if (c == 'n') {
            if (src.substr(pos, 4) == "null") pos += 4;
            return JsonValue{};
        } else if ((c >= '0' && c <= '9') || c == '-') {
            return parse_number();
        }
        throw std::runtime_error(std::string("Unexpected character in JSON: ") + c);
    }
};

static JsonValue parse_json(const std::string& s) {
    JsonParser parser(s);
    return parser.parse_value();
}

// -----------------------------------------------------------------------------
// Test Case 1: Empty tree exports valid representation without crashing
// -----------------------------------------------------------------------------
void test_empty_tree_export() {
    std::cout << "[Test 1] Verifying empty tree export..." << std::endl;
    RTree tree(4, 2);
    EntityStore store;
    BoundingBox query{0, 0, 10, 10};
    std::ostringstream ss;

    export_simulation_state(tree, store, query, {}, ss);
    std::string json_str = ss.str();
    assert(!json_str.empty());

    JsonValue doc = parse_json(json_str);
    assert(doc.is_object());
    assert(doc["rtree"].is_object());
    assert(doc["rtree"]["size"].num_val == 0.0);
    assert(doc["rtree"]["height"].num_val == 0.0);
    assert(doc["rtree"]["internal_mbrs"].arr_val.empty());
    assert(doc["rtree"]["leaf_mbrs"].arr_val.size() == 1);
    assert(doc["rtree"]["leaf_mbrs"][0][0].num_val == 0.0);
    assert(doc["rtree"]["leaf_mbrs"][0][1].num_val == 0.0);
    assert(doc["rtree"]["leaf_mbrs"][0][2].num_val == 0.0);
    assert(doc["rtree"]["leaf_mbrs"][0][3].num_val == 0.0);

    const auto& root = doc["rtree"]["root"];
    assert(root.is_object());
    assert(root["id"].str_val == "node_0");
    assert(root["parent_id"].is_null());
    assert(root["type"].str_val == "root");
    assert(root["is_root"].bool_val == true);
    assert(root["is_leaf"].bool_val == true);
    assert(root["children"].arr_val.empty());

    // Also verify null node pointer handling
    std::ostringstream null_ss;
    int next_id = 0;
    export_node_hierarchy(nullptr, null_ss, 0, next_id, "", 0, true);
    assert(null_ss.str() == "null");
}

// -----------------------------------------------------------------------------
// Test Case 2: Single-leaf tree preserves actual entity IDs and MBRs
// -----------------------------------------------------------------------------
void test_single_leaf_tree_export() {
    std::cout << "[Test 2] Verifying single-leaf tree export..." << std::endl;
    RTree tree(4, 2);
    tree.insert(BoundingBox{10.0, 20.0, 30.0, 40.0}, 42);
    tree.insert(BoundingBox{50.0, 60.0, 70.0, 80.0}, 84);

    std::ostringstream ss;
    int next_id = 0;
    export_node_hierarchy(tree.get_root(), ss, 0, next_id, "", 0, true);
    JsonValue root = parse_json(ss.str());

    assert(root["type"].str_val == "root");
    assert(root["is_root"].bool_val == true);
    assert(root["is_leaf"].bool_val == true);
    assert(root["depth"].num_val == 0.0);

    // MBR must enclose both entities: [10, 20, 70, 80]
    assert(root["bounds"][0].num_val == 10.0);
    assert(root["bounds"][1].num_val == 20.0);
    assert(root["bounds"][2].num_val == 70.0);
    assert(root["bounds"][3].num_val == 80.0);

    assert(root["children"].arr_val.size() == 2);
    const auto& e1 = root["children"][0];
    const auto& e2 = root["children"][1];

    assert(e1["type"].str_val == "entity");
    assert(e1["entity_id"].num_val == 42.0);
    assert(e1["bounds"][0].num_val == 10.0);
    assert(e1["parent_id"].str_val == "node_0");

    assert(e2["type"].str_val == "entity");
    assert(e2["entity_id"].num_val == 84.0);
    assert(e2["bounds"][0].num_val == 50.0);
    assert(e2["parent_id"].str_val == "node_0");
}

// -----------------------------------------------------------------------------
// Test Case 3: Tree with internal nodes exposes correct parent-child relationships
// -----------------------------------------------------------------------------
void test_internal_node_parent_child_relationships() {
    std::cout << "[Test 3] Verifying internal node parent-child relationships..." << std::endl;
    RTree tree(4, 2);
    // Insert 5 elements to trigger split with M=4
    for (int i = 0; i < 5; ++i) {
        double pos = static_cast<double>(i * 10);
        tree.insert(BoundingBox{pos, pos, pos + 5.0, pos + 5.0}, 100 + i);
    }

    assert(tree.height() == 2);
    std::ostringstream ss;
    int next_id = 0;
    export_node_hierarchy(tree.get_root(), ss, 0, next_id, "", 0, true);
    JsonValue root = parse_json(ss.str());

    assert(root["type"].str_val == "root");
    assert(root["is_root"].bool_val == true);
    assert(root["is_leaf"].bool_val == false);
    assert(root["parent_id"].is_null());
    assert(root["children"].arr_val.size() >= 2);

    for (size_t c = 0; c < root["children"].arr_val.size(); ++c) {
        const auto& child = root["children"][c];
        assert(child["type"].str_val == "leaf");
        assert(child["is_root"].bool_val == false);
        assert(child["is_leaf"].bool_val == true);
        assert(child["parent_id"].str_val == root["id"].str_val);
        assert(child["depth"].num_val == 1.0);

        for (size_t e = 0; e < child["children"].arr_val.size(); ++e) {
            const auto& ent = child["children"][e];
            assert(ent["type"].str_val == "entity");
            assert(ent["parent_id"].str_val == child["id"].str_val);
        }
    }
}

// -----------------------------------------------------------------------------
// Test Case 4: Multi-level tree preserves correct root and descendants
// -----------------------------------------------------------------------------
void test_multi_level_tree_hierarchy() {
    std::cout << "[Test 4] Verifying multi-level tree hierarchy..." << std::endl;
    // Capacity 3, min 1 -> 9 elements will create at least height 3
    RTree tree(3, 1);
    for (int i = 0; i < 9; ++i) {
        double pos = static_cast<double>(i * 20);
        tree.insert(BoundingBox{pos, pos, pos + 2.0, pos + 2.0}, 200 + i);
    }

    assert(tree.height() >= 2);
    std::ostringstream ss;
    int next_id = 0;
    export_node_hierarchy(tree.get_root(), ss, 0, next_id, "", 0, true);
    JsonValue root = parse_json(ss.str());

    assert(root["depth"].num_val == 0.0);

    // Verify all descendants are geometrically bounded by root
    double root_min_x = root["bounds"][0].num_val;
    double root_min_y = root["bounds"][1].num_val;
    double root_max_x = root["bounds"][2].num_val;
    double root_max_y = root["bounds"][3].num_val;

    std::vector<JsonValue> stack = root["children"].arr_val;
    while (!stack.empty()) {
        JsonValue curr = stack.back();
        stack.pop_back();

        assert(curr["bounds"][0].num_val >= root_min_x - 1e-6);
        assert(curr["bounds"][1].num_val >= root_min_y - 1e-6);
        assert(curr["bounds"][2].num_val <= root_max_x + 1e-6);
        assert(curr["bounds"][3].num_val <= root_max_y + 1e-6);

        if (curr["type"].str_val != "entity") {
            for (const auto& child : curr["children"].arr_val) {
                stack.push_back(child);
            }
        }
    }
}

// -----------------------------------------------------------------------------
// Test Case 5: Node IDs are unique and stable across repeated exports
// -----------------------------------------------------------------------------
void test_node_id_stability_and_uniqueness() {
    std::cout << "[Test 5] Verifying node ID stability and uniqueness..." << std::endl;
    RTree tree(4, 2);
    for (int i = 0; i < 7; ++i) {
        double pos = static_cast<double>(i * 15);
        tree.insert(BoundingBox{pos, pos, pos + 5.0, pos + 5.0}, 300 + i);
    }

    std::ostringstream ss1, ss2;
    int id1 = 0, id2 = 0;
    export_node_hierarchy(tree.get_root(), ss1, 0, id1, "", 0, true);
    export_node_hierarchy(tree.get_root(), ss2, 0, id2, "", 0, true);

    // Stability across repeated exports
    assert(ss1.str() == ss2.str());

    // Uniqueness of IDs within the tree
    JsonValue root = parse_json(ss1.str());
    std::set<std::string> seen_ids;

    std::vector<JsonValue> queue;
    queue.push_back(root);

    while (!queue.empty()) {
        JsonValue item = queue.back();
        queue.pop_back();

        std::string id = item["id"].str_val;
        assert(!id.empty());
        assert(seen_ids.find(id) == seen_ids.end()); // Must not be duplicate
        seen_ids.insert(id);

        if (item["type"].str_val != "entity") {
            for (const auto& ch : item["children"].arr_val) {
                queue.push_back(ch);
            }
        }
    }
}

// -----------------------------------------------------------------------------
// Test Case 6: Every exported child reference resolves to exactly one exported node
// -----------------------------------------------------------------------------
void test_child_reference_bijection() {
    std::cout << "[Test 6] Verifying child reference bijection..." << std::endl;
    RTree tree(4, 2);
    for (int i = 0; i < 8; ++i) {
        double pos = static_cast<double>(i * 10);
        tree.insert(BoundingBox{pos, pos, pos + 3.0, pos + 3.0}, 400 + i);
    }

    std::ostringstream ss;
    int next_id = 0;
    export_node_hierarchy(tree.get_root(), ss, 0, next_id, "", 0, true);
    JsonValue root = parse_json(ss.str());

    std::map<std::string, JsonValue> id_to_node;
    std::vector<JsonValue> all_nodes;

    std::vector<JsonValue> queue;
    queue.push_back(root);
    while (!queue.empty()) {
        JsonValue item = queue.back();
        queue.pop_back();
        id_to_node[item["id"].str_val] = item;
        all_nodes.push_back(item);

        if (item["type"].str_val != "entity") {
            for (const auto& ch : item["children"].arr_val) {
                queue.push_back(ch);
            }
        }
    }

    // Verify parent-child bidirectional consistency
    for (const auto& node : all_nodes) {
        if (node["id"].str_val == root["id"].str_val) {
            assert(node["parent_id"].is_null());
        } else {
            std::string parent_id = node["parent_id"].str_val;
            assert(id_to_node.find(parent_id) != id_to_node.end());
            const auto& parent = id_to_node[parent_id];

            bool found_in_parent = false;
            for (const auto& ch : parent["children"].arr_val) {
                if (ch["id"].str_val == node["id"].str_val) {
                    found_in_parent = true;
                    break;
                }
            }
            assert(found_in_parent);
        }
    }
}

// -----------------------------------------------------------------------------
// Test Case 7: Every leaf entity reference corresponds to actual leaf entry
// -----------------------------------------------------------------------------
void test_leaf_entity_fidelity() {
    std::cout << "[Test 7] Verifying leaf entity fidelity against C++ structures..." << std::endl;
    RTree tree(4, 2);
    tree.insert(BoundingBox{5.0, 5.0, 10.0, 10.0}, 501);
    tree.insert(BoundingBox{15.0, 15.0, 20.0, 20.0}, 502);
    tree.insert(BoundingBox{25.0, 25.0, 30.0, 30.0}, 503);

    std::ostringstream ss;
    int next_id = 0;
    export_node_hierarchy(tree.get_root(), ss, 0, next_id, "", 0, true);
    JsonValue root = parse_json(ss.str());

    const RTreeNode* cpp_root = tree.get_root();
    assert(cpp_root->entries.size() == root["children"].arr_val.size());

    for (size_t i = 0; i < cpp_root->entries.size(); ++i) {
        const auto& cpp_entry = cpp_root->entries[i];
        const auto& json_entry = root["children"][i];

        assert(json_entry["type"].str_val == "entity");
        assert(json_entry["entity_id"].num_val == static_cast<double>(cpp_entry.entity_id));
        assert(json_entry["bounds"][0].num_val == cpp_entry.mbr.min_x);
        assert(json_entry["bounds"][1].num_val == cpp_entry.mbr.min_y);
        assert(json_entry["bounds"][2].num_val == cpp_entry.mbr.max_x);
        assert(json_entry["bounds"][3].num_val == cpp_entry.mbr.max_y);
    }
}

// -----------------------------------------------------------------------------
// Test Case 8: Old internal_mbrs and leaf_mbrs arrays remain present and populated
// -----------------------------------------------------------------------------
void test_legacy_mbr_arrays_coexistence() {
    std::cout << "[Test 8] Verifying backward-compatible internal_mbrs and leaf_mbrs..." << std::endl;
    RTree tree(4, 2);
    EntityStore store;
    for (int i = 0; i < 6; ++i) {
        double p = static_cast<double>(i * 10);
        int entity_id = i + 1;
        tree.insert(BoundingBox{p, p, p + 5.0, p + 5.0}, entity_id);
        store.insert(Entity{entity_id, BoundingBox{p, p, p + 5.0, p + 5.0}, true});
    }

    std::ostringstream ss;
    export_simulation_state(tree, store, BoundingBox{0, 0, 100, 100}, {1, 2}, ss);
    JsonValue doc = parse_json(ss.str());

    assert(doc.has("entities"));
    assert(doc.has("query"));
    assert(doc["query"]["results"].arr_val.size() == 2);

    const auto& rtree_obj = doc["rtree"];
    assert(rtree_obj.has("internal_mbrs"));
    assert(rtree_obj.has("leaf_mbrs"));
    assert(rtree_obj.has("root"));

    // Multi-element tree with split has 1 internal (root) and 2 leaves
    assert(rtree_obj["internal_mbrs"].arr_val.size() == 1);
    assert(rtree_obj["leaf_mbrs"].arr_val.size() == 2);

    // Root bounds must match internal MBR 0
    const auto& root_mbr = rtree_obj["internal_mbrs"][0];
    const auto& root_node = rtree_obj["root"];
    for (size_t d = 0; d < 4; ++d) {
        assert(root_mbr[d].num_val == root_node["bounds"][d].num_val);
    }
}

// -----------------------------------------------------------------------------
// Test Case 9: Exported JSON is valid, well-formed and parseable
// -----------------------------------------------------------------------------
void test_json_syntax_validity() {
    std::cout << "[Test 9] Verifying JSON parseability across complex edge datasets..." << std::endl;
    RTree tree(4, 2);
    EntityStore store;

    // Extreme coordinates: negative, tiny, very large
    std::vector<BoundingBox> test_boxes = {
        {-5000000.0, -3000000.0, -1000000.0, -500000.0},
        {0.00001, 0.00002, 0.00003, 0.00004},
        {1000000.0, 2000000.0, 3000000.0, 4000000.0},
        {0.0, 0.0, 0.0, 0.0}
    };

    for (size_t i = 0; i < test_boxes.size(); ++i) {
        int entity_id = static_cast<int>(i + 1);
        tree.insert(test_boxes[i], entity_id);
        store.insert(Entity{entity_id, test_boxes[i], true});
    }

    std::ostringstream ss;
    export_simulation_state(tree, store, BoundingBox{-100, -100, 100, 100}, {}, ss);

    JsonValue doc = parse_json(ss.str());
    assert(doc.is_object());
    assert(doc["entities"].arr_val.size() == 4);
    assert(doc["rtree"]["size"].num_val == 4.0);
    assert(doc["rtree"]["root"].is_object());
}

int main() {
    std::cout << "=== Running test_export ===" << std::endl;
    test_empty_tree_export();
    test_single_leaf_tree_export();
    test_internal_node_parent_child_relationships();
    test_multi_level_tree_hierarchy();
    test_node_id_stability_and_uniqueness();
    test_child_reference_bijection();
    test_leaf_entity_fidelity();
    test_legacy_mbr_arrays_coexistence();
    test_json_syntax_validity();
    std::cout << "All export hierarchy regression tests passed successfully." << std::endl;
    return 0;
}
