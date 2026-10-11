#include "rtree_node.h"
#include <stdexcept>

namespace kestrel {

BoundingBox RTreeNode::compute_mbr() const {
    if (entries.empty()) {
        return BoundingBox{0.0, 0.0, 0.0, 0.0}; // Or throw, but returning degenerate is safe
    }

    BoundingBox result = entries[0].mbr;
    for (size_t i = 1; i < entries.size(); ++i) {
        result = union_of(result, entries[i].mbr);
    }
    return result;
}

} // namespace kestrel
