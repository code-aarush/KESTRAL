#include "geometry.h"
#include <algorithm>
#include <cmath>

namespace kestrel {

bool BoundingBox::is_valid() const {
    if (!std::isfinite(min_x) || !std::isfinite(min_y) ||
        !std::isfinite(max_x) || !std::isfinite(max_y)) {
        return false;
    }
    return (min_x <= max_x) && (min_y <= max_y);
}

double area(const BoundingBox& b) {
    if (!b.is_valid()) return 0.0;
    return (b.max_x - b.min_x) * (b.max_y - b.min_y);
}

BoundingBox union_of(const BoundingBox& a, const BoundingBox& b) {
    return BoundingBox{
        std::min(a.min_x, b.min_x),
        std::min(a.min_y, b.min_y),
        std::max(a.max_x, b.max_x),
        std::max(a.max_y, b.max_y)
    };
}

bool intersects(const BoundingBox& a, const BoundingBox& b) {
    // Closed boundary semantics (inclusive):
    // Two boxes do NOT intersect if one is strictly to the left, right, below, or above the other.
    if (a.max_x < b.min_x || a.min_x > b.max_x) return false;
    if (a.max_y < b.min_y || a.min_y > b.max_y) return false;
    return true;
}

bool contains(const BoundingBox& outer, const BoundingBox& inner) {
    return (outer.min_x <= inner.min_x &&
            outer.max_x >= inner.max_x &&
            outer.min_y <= inner.min_y &&
            outer.max_y >= inner.max_y);
}

double enlargement(const BoundingBox& base, const BoundingBox& to_add) {
    double base_area = area(base);
    double union_area = area(union_of(base, to_add));
    return union_area - base_area;
}

} // namespace kestrel
