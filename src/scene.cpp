#include "scene.h"
#include "simulator.h"
#include <algorithm>
#include <iomanip>
#include <sstream>
#include <vector>

namespace kestrel {

namespace {

// FNV-1a over a canonical text rendering of the scene.
// The result is masked to 53 bits so it survives a JSON round trip through
// JavaScript without losing precision.
std::uint64_t fnv1a64(const std::string& text) {
    std::uint64_t hash = 1469598103934665603ULL;
    for (char c : text) {
        hash ^= static_cast<std::uint64_t>(static_cast<unsigned char>(c));
        hash *= 1099511628211ULL;
    }
    return hash & ((1ULL << 53) - 1);
}

} // namespace

void build_demo_scene(EntityStore& store, RTree& rtree) {
    Simulator sim(store, rtree, 42, 800.0, 600.0, 0.5, 0.05);
    for (int i = 0; i < 50; ++i) {
        sim.step();
    }
}

std::string canonical_entities_text(const EntityStore& store) {
    std::vector<int> ids;
    ids.reserve(store.size());
    for (auto it = store.begin(); it != store.end(); ++it) {
        ids.push_back(it->first);
    }
    std::sort(ids.begin(), ids.end());

    std::ostringstream os;
    os << std::setprecision(17);
    for (int id : ids) {
        const Entity& e = store.get(id);
        os << id << ':' << e.bounds.min_x << ',' << e.bounds.min_y << ','
           << e.bounds.max_x << ',' << e.bounds.max_y << ';';
    }
    return os.str();
}

std::uint64_t scene_key(const EntityStore& store) {
    return fnv1a64(canonical_entities_text(store));
}

std::uint64_t scene_id(const EntityStore& store, const BoundingBox& query) {
    std::ostringstream os;
    os << std::setprecision(17);
    os << "q:" << query.min_x << ',' << query.min_y << ','
       << query.max_x << ',' << query.max_y;
    return fnv1a64(canonical_entities_text(store) + os.str());
}

} // namespace kestrel
