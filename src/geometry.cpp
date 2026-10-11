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

double distance(const BoundingBox& a, const BoundingBox& b) {
    double dx = std::max({0.0, a.min_x - b.max_x, b.min_x - a.max_x});
    double dy = std::max({0.0, a.min_y - b.max_y, b.min_y - a.max_y});
    return std::sqrt(dx*dx + dy*dy);
}

double distance(const Point& p, const BoundingBox& b) {
    double dx = std::max({0.0, b.min_x - p.x, p.x - b.max_x});
    double dy = std::max({0.0, b.min_y - p.y, p.y - b.max_y});
    return std::sqrt(dx*dx + dy*dy);
}

double distance(const Point& p, const LineSegment& seg) {
    double l2 = std::pow(seg.start.x - seg.end.x, 2) + std::pow(seg.start.y - seg.end.y, 2);
    if (l2 == 0.0) return std::sqrt(std::pow(p.x - seg.start.x, 2) + std::pow(p.y - seg.start.y, 2));
    double t = std::max(0.0, std::min(1.0, ((p.x - seg.start.x) * (seg.end.x - seg.start.x) + (p.y - seg.start.y) * (seg.end.y - seg.start.y)) / l2));
    Point projection = {seg.start.x + t * (seg.end.x - seg.start.x), seg.start.y + t * (seg.end.y - seg.start.y)};
    return std::sqrt(std::pow(p.x - projection.x, 2) + std::pow(p.y - projection.y, 2));
}

bool intersects(const LineSegment& seg, const BoundingBox& box) {
    if (seg.start.x >= box.min_x && seg.start.x <= box.max_x && seg.start.y >= box.min_y && seg.start.y <= box.max_y) return true;
    if (seg.end.x >= box.min_x && seg.end.x <= box.max_x && seg.end.y >= box.min_y && seg.end.y <= box.max_y) return true;

    auto ccw = [](Point a, Point b, Point c) {
        return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    };
    auto intersect_lines = [&](Point a, Point b, Point c, Point d) {
        return ccw(a,c,d) != ccw(b,c,d) && ccw(a,b,c) != ccw(a,b,d);
    };

    Point c1{box.min_x, box.min_y};
    Point c2{box.max_x, box.min_y};
    Point c3{box.max_x, box.max_y};
    Point c4{box.min_x, box.max_y};

    if (intersect_lines(seg.start, seg.end, c1, c2)) return true;
    if (intersect_lines(seg.start, seg.end, c2, c3)) return true;
    if (intersect_lines(seg.start, seg.end, c3, c4)) return true;
    if (intersect_lines(seg.start, seg.end, c4, c1)) return true;

    return false;
}

double distance(const LineSegment& seg, const BoundingBox& box) {
    if (intersects(seg, box)) return 0.0;

    double d1 = distance(seg.start, box);
    double d2 = distance(seg.end, box);

    Point c1{box.min_x, box.min_y};
    Point c2{box.max_x, box.min_y};
    Point c3{box.max_x, box.max_y};
    Point c4{box.min_x, box.max_y};

    double d3 = distance(c1, seg);
    double d4 = distance(c2, seg);
    double d5 = distance(c3, seg);
    double d6 = distance(c4, seg);

    return std::min({d1, d2, d3, d4, d5, d6});
}

} // namespace kestrel
