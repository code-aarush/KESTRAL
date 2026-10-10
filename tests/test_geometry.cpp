#include "geometry.h"
#include <iostream>
#include <cmath>
#include <cassert>
#include <limits>

using namespace kestrel;

void test_point_defined() {
    Point p{1.0, 2.0};
    assert(p.x == 1.0);
    assert(p.y == 2.0);
}

void test_box_validity() {
    BoundingBox valid{0.0, 0.0, 1.0, 1.0};
    assert(valid.is_valid());

    BoundingBox degenerate{1.0, 2.0, 1.0, 2.0};
    assert(degenerate.is_valid());

    BoundingBox invalid_x{2.0, 0.0, 1.0, 1.0};
    assert(!invalid_x.is_valid());

    BoundingBox invalid_y{0.0, 2.0, 1.0, 1.0};
    assert(!invalid_y.is_valid());

    // GATE-01-AC-08 (NaN/Infinity policy)
    BoundingBox nan_box{std::nan(""), 0.0, 1.0, 1.0};
    assert(!nan_box.is_valid());

    BoundingBox inf_box{0.0, 0.0, std::numeric_limits<double>::infinity(), 1.0};
    assert(!inf_box.is_valid());
}

void test_area() {
    BoundingBox square{0.0, 0.0, 2.0, 2.0};
    assert(area(square) == 4.0);

    BoundingBox rect{1.0, -1.0, 4.0, 3.0};
    assert(area(rect) == 12.0);

    BoundingBox degenerate{1.0, 1.0, 1.0, 1.0};
    assert(area(degenerate) == 0.0);
}

void test_union_of() {
    BoundingBox a{0.0, 0.0, 1.0, 1.0};
    BoundingBox b{2.0, 2.0, 3.0, 3.0};
    BoundingBox u1 = union_of(a, b);
    assert(u1.min_x == 0.0 && u1.min_y == 0.0 && u1.max_x == 3.0 && u1.max_y == 3.0);

    BoundingBox u2 = union_of(a, a);
    assert(u2.min_x == 0.0 && u2.min_y == 0.0 && u2.max_x == 1.0 && u2.max_y == 1.0);

    BoundingBox c{0.5, 0.5, 1.5, 1.5};
    BoundingBox u3 = union_of(a, c);
    assert(u3.min_x == 0.0 && u3.min_y == 0.0 && u3.max_x == 1.5 && u3.max_y == 1.5);
}

void test_intersects() {
    BoundingBox a{0.0, 0.0, 2.0, 2.0};
    BoundingBox disjoint{3.0, 3.0, 4.0, 4.0};
    assert(!intersects(a, disjoint));

    BoundingBox overlapping{1.0, 1.0, 3.0, 3.0};
    assert(intersects(a, overlapping));

    // Shared edge
    BoundingBox right_edge{2.0, 0.0, 3.0, 2.0};
    assert(intersects(a, right_edge));

    // Shared corner
    BoundingBox top_right_corner{2.0, 2.0, 3.0, 3.0};
    assert(intersects(a, top_right_corner));

    // Containment
    BoundingBox inner{0.5, 0.5, 1.5, 1.5};
    assert(intersects(a, inner));
    assert(intersects(inner, a));

    // Point box touching boundary
    BoundingBox pt_box{2.0, 1.0, 2.0, 1.0};
    assert(intersects(a, pt_box));
}

void test_contains() {
    BoundingBox outer{0.0, 0.0, 3.0, 3.0};
    BoundingBox inner{1.0, 1.0, 2.0, 2.0};
    assert(contains(outer, inner));

    // Self-containment
    assert(contains(outer, outer));

    // Extends beyond one side
    BoundingBox extends{1.0, 1.0, 4.0, 2.0};
    assert(!contains(outer, extends));

    // Touching boundary (contained)
    BoundingBox touches_inside{0.0, 1.0, 2.0, 2.0};
    assert(contains(outer, touches_inside));

    // Touching boundary (not contained, inner is larger)
    BoundingBox touches_outside{-1.0, 0.0, 3.0, 3.0};
    assert(!contains(outer, touches_outside));
}

void test_enlargement() {
    BoundingBox base{0.0, 0.0, 2.0, 2.0}; // area = 4
    BoundingBox inner{0.5, 0.5, 1.5, 1.5};
    assert(enlargement(base, inner) == 0.0);

    BoundingBox disjoint{3.0, 0.0, 4.0, 2.0}; // union area = 8, base = 4 -> enlargement = 4
    assert(enlargement(base, disjoint) == 4.0);
}

int main() {
    test_point_defined();
    test_box_validity();
    test_area();
    test_union_of();
    test_intersects();
    test_contains();
    test_enlargement();

    std::cout << "All geometry tests passed." << std::endl;
    return 0;
}
