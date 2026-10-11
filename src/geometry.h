#ifndef KESTREL_GEOMETRY_H
#define KESTREL_GEOMETRY_H

namespace kestrel {

// NaN and Infinity Policy:
// The system does not support NaN or infinite coordinates. Any operation given
// such coordinates may yield undefined results. The `is_valid` function on
// BoundingBox explicitly checks for finite values and returns false if they are not.

struct Point {
    double x;
    double y;
};

struct BoundingBox {
    double min_x;
    double min_y;
    double max_x;
    double max_y;

    // A valid box has finite coordinates and min <= max.
    // Degenerate (zero-area) boxes with min == max are considered valid.
    bool is_valid() const;
};

struct LineSegment {
    Point start;
    Point end;
};

// Calculates the area of the box. Returns 0.0 for degenerate (zero-area) boxes.
double area(const BoundingBox& b);

// Returns the Minimum Bounding Rectangle containing both boxes a and b.
BoundingBox union_of(const BoundingBox& a, const BoundingBox& b);

// Checks if two boxes intersect.
// Closed/inclusive semantics: boxes sharing only an edge or corner intersect.
bool intersects(const BoundingBox& a, const BoundingBox& b);

// Checks if outer completely contains inner.
// Inclusive boundaries: a box contains another if its boundaries touch and all
// inner points are within outer. A box contains itself.
bool contains(const BoundingBox& outer, const BoundingBox& inner);

// Checks if two bounding boxes intersect (including touching edges/corners)
bool intersects(const BoundingBox& a, const BoundingBox& b);

// Calculates the area by which base would need to be enlarged to include to_add.
// Returns 0.0 if to_add is already contained within base.
double enlargement(const BoundingBox& base, const BoundingBox& to_add);

// Returns shortest distance between two bounding boxes
double distance(const BoundingBox& a, const BoundingBox& b);

// Returns shortest distance from a point to a bounding box
double distance(const Point& p, const BoundingBox& b);

// Returns shortest distance from a point to a line segment
double distance(const Point& p, const LineSegment& seg);

// Checks if line segment intersects a bounding box
bool intersects(const LineSegment& seg, const BoundingBox& box);

// Returns shortest distance from a line segment to a bounding box
double distance(const LineSegment& seg, const BoundingBox& box);

} // namespace kestrel

#endif // KESTREL_GEOMETRY_H
