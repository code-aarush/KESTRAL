#include "query_service.h"
#include "mission.h"
#include "scene.h"
#include <cerrno>
#include <cmath>
#include <cstdlib>
#include <exception>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace kestrel {

namespace {

// ---------------------------------------------------------------------------
// Minimal JSON reader for the query request.
//
// The request format is fixed and flat, so a focused reader is enough. It
// accepts exactly what the contract describes and rejects everything else.
// ---------------------------------------------------------------------------

class RequestReader {
public:
    explicit RequestReader(const std::string& text) : text_(text) {}

    // Parses the request. Returns false and fills `error` when the request
    // is malformed.
    bool parse(std::string& op, std::vector<double>& bounds, std::string& error) {
        if (!consume('{')) {
            error = "request must be a JSON object";
            return false;
        }

        bool has_op = false;
        bool has_bounds = false;

        while (true) {
            if (consume('}')) break;

            std::string key;
            if (!read_string(key)) {
                error = "request contains an invalid member name";
                return false;
            }
            if (!consume(':')) {
                error = "request member '" + key + "' is missing its value";
                return false;
            }

            if (key == "op") {
                if (!read_string(op)) {
                    error = "'op' must be a string";
                    return false;
                }
                has_op = true;
            } else if (key == "bounds") {
                if (!read_bounds(bounds)) {
                    error = "'bounds' must be an array of four numbers";
                    return false;
                }
                has_bounds = true;
            } else if (!skip_value()) {
                error = "request contains an invalid value for '" + key + "'";
                return false;
            }

            if (consume(',')) continue;
            if (consume('}')) break;

            error = "request is malformed";
            return false;
        }

        skip_whitespace();
        if (pos_ != text_.size()) {
            error = "request contains trailing content";
            return false;
        }

        if (!has_op) op = "query";
        if (op != "query" && op != "scene") {
            error = "unknown operation '" + op + "'";
            return false;
        }
        if (op == "query" && !has_bounds) {
            error = "a query request requires 'bounds'";
            return false;
        }
        return true;
    }

private:
    const std::string& text_;
    std::size_t pos_ = 0;

    void skip_whitespace() {
        while (pos_ < text_.size()) {
            const char c = text_[pos_];
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                ++pos_;
            } else {
                break;
            }
        }
    }

    bool consume(char expected) {
        skip_whitespace();
        if (pos_ < text_.size() && text_[pos_] == expected) {
            ++pos_;
            return true;
        }
        return false;
    }

    bool read_string(std::string& out) {
        skip_whitespace();
        if (pos_ >= text_.size() || text_[pos_] != '"') return false;
        ++pos_;

        out.clear();
        while (pos_ < text_.size()) {
            const char c = text_[pos_++];
            if (c == '"') return true;
            if (c == '\\') {
                if (pos_ >= text_.size()) return false;
                const char escaped = text_[pos_++];
                switch (escaped) {
                    case '"': out.push_back('"'); break;
                    case '\\': out.push_back('\\'); break;
                    case '/': out.push_back('/'); break;
                    case 'b': out.push_back('\b'); break;
                    case 'f': out.push_back('\f'); break;
                    case 'n': out.push_back('\n'); break;
                    case 'r': out.push_back('\r'); break;
                    case 't': out.push_back('\t'); break;
                    default: return false; // unsupported escape (e.g. \u)
                }
                continue;
            }
            if (static_cast<unsigned char>(c) < 0x20) return false; // raw control character
            out.push_back(c);
        }
        return false; // unterminated string
    }

    bool read_number(double& out) {
        skip_whitespace();
        const char* start = text_.c_str() + pos_;
        char* end = nullptr;
        errno = 0;
        const double value = std::strtod(start, &end);
        if (end == start) return false;
        if (errno == ERANGE) return false; // out of range for a double

        const char after = *end;
        const bool delimited = after == '\0' || after == ',' || after == ']' || after == '}' ||
                               after == ' ' || after == '\t' || after == '\n' || after == '\r';
        if (!delimited) return false;

        pos_ += static_cast<std::size_t>(end - start);
        if (!std::isfinite(value)) return false; // rejects NaN and infinity
        out = value;
        return true;
    }

    bool read_bounds(std::vector<double>& bounds) {
        if (!consume('[')) return false;

        bounds.clear();
        while (true) {
            double value = 0.0;
            if (!read_number(value)) return false;
            bounds.push_back(value);

            if (consume(',')) continue;
            if (consume(']')) break;
            return false;
        }

        return bounds.size() == 4;
    }

    // Skips over a value of any type so that unknown members do not break the
    // request. Depth limited to keep a malformed request from exhausting the
    // stack.
    bool skip_value(int depth = 0) {
        if (depth > 32) return false;
        skip_whitespace();
        if (pos_ >= text_.size()) return false;

        const char c = text_[pos_];
        if (c == '"') {
            std::string ignored;
            return read_string(ignored);
        }
        if (c == '{' || c == '[') {
            const char closing = (c == '{') ? '}' : ']';
            ++pos_;
            while (true) {
                skip_whitespace();
                if (pos_ >= text_.size()) return false;
                if (text_[pos_] == closing) {
                    ++pos_;
                    return true;
                }
                if (c == '{') {
                    std::string ignored_key;
                    if (!read_string(ignored_key)) return false;
                    if (!consume(':')) return false;
                }
                if (!skip_value(depth + 1)) return false;
                if (consume(',')) continue;
                if (consume(closing)) return true;
                return false;
            }
        }
        if (c == 't' || c == 'f' || c == 'n') {
            const char* literal = (c == 't') ? "true" : (c == 'f') ? "false" : "null";
            const std::size_t length = std::char_traits<char>::length(literal);
            if (text_.compare(pos_, length, literal) != 0) return false;
            pos_ += length;
            return true;
        }

        double ignored = 0.0;
        return read_number(ignored);
    }
};

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

std::string error_response(const std::string& status, const std::string& message) {
    std::ostringstream os;
    os << "{\"status\":\"" << status << "\",\"message\":\"" << message << "\"}";
    return os.str();
}

void write_bounds(std::ostream& out, const BoundingBox& bounds) {
    out << std::setprecision(17);
    out << '[' << bounds.min_x << ", " << bounds.min_y << ", "
        << bounds.max_x << ", " << bounds.max_y << ']';
}

} // namespace

std::string handle_query_request(const std::string& request_line,
                                  const RTree& rtree,
                                  const EntityStore& store) {
    std::string op;
    std::vector<double> bounds;
    std::string error;

    RequestReader reader(request_line);
    if (!reader.parse(op, bounds, error)) {
        return error_response("invalid", error);
    }

    if (op == "scene") {
        std::ostringstream os;
        os << "{\"status\":\"ok\",\"scene_key\":" << scene_key(store)
           << ",\"entity_count\":" << store.size() << '}';
        return os.str();
    }

    // The bounds must describe a valid box: finite coordinates and
    // min <= max. A degenerate box (min == max) is valid and is executed
    // exactly like any other query region.
    const BoundingBox region{bounds[0], bounds[1], bounds[2], bounds[3]};
    if (!region.is_valid()) {
        return error_response("invalid", "bounds are not a valid bounding box");
    }

    MissionControl mission(rtree, store);
    MissionControl::MissionMetrics metrics;
    std::vector<int> results;
    try {
        results = mission.region_scan(region, &metrics, nullptr);
    } catch (const std::exception& e) {
        return error_response("error", std::string("query execution failed: ") + e.what());
    } catch (...) {
        return error_response("error", "query execution failed");
    }

    std::ostringstream os;
    os << "{\"status\":\"" << (results.empty() ? "empty" : "ok") << '"'
       << ",\"scene_key\":" << scene_key(store)
       << ",\"query\":{\"bounds\":";
    write_bounds(os, region);
    os << "},\"results\":[";
    for (std::size_t i = 0; i < results.size(); ++i) {
        if (i > 0) os << ", ";
        os << results[i];
    }
    os << "],\"metrics\":{\"nodes_visited\":" << metrics.nodes_visited << "}}";
    return os.str();
}

} // namespace kestrel

#ifndef KESTREL_NO_MAIN
using namespace kestrel;

int main() {
    EntityStore store;
    RTree rtree(4, 2);

    // The scene is built once and then held for the lifetime of the process,
    // so every request is answered by the very same R-tree instance.
    build_demo_scene(store, rtree);

    std::string line;
    while (std::getline(std::cin, line)) {
        // Every request line is answered, including an empty one, so that a
        // client never waits for an answer that does not come.
        std::cout << handle_query_request(line, rtree, store) << std::endl;
    }
    return 0;
}
#endif
