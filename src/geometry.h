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

// Calculates the area by which base would need to be enlarged to include to_add.
// Returns 0.0 if to_add is already contained within base.
double enlargement(const BoundingBox& base, const BoundingBox& to_add);

} // namespace kestrel

#endif // KESTREL_GEOMETRY_H
