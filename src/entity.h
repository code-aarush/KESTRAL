#ifndef KESTREL_ENTITY_H
#define KESTREL_ENTITY_H

#include "geometry.h"

namespace kestrel {

struct Entity {
    int id;                // Must be positive, unique, never reused
    BoundingBox bounds;    // Axis-aligned bounding box
    bool active;           // Logical active state
};

} // namespace kestrel

#endif // KESTREL_ENTITY_H
