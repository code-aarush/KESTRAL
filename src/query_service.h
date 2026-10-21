#ifndef KESTREL_QUERY_SERVICE_H
#define KESTREL_QUERY_SERVICE_H

#include "entity_store.h"
#include "rtree.h"
#include <string>

namespace kestrel {

// Handles one query request and returns the matching response.
//
// Both the request and the response are single-line JSON objects. The
// contract is documented in docs/api/QUERY_API.md.
//
// Request:  {"op":"query","bounds":[min_x,min_y,max_x,max_y]}  (op defaults to "query")
//           {"op":"scene"}
// Response: {"status":"ok"|"empty","scene_key":<id>,"query":{"bounds":[...]},
//            "results":[<entity ids>],"metrics":{"nodes_visited":<n>}}
//           {"status":"invalid"|"error","message":"<reason>"}
//
// The function never throws: a malformed request produces an "invalid"
// response and an execution failure produces an "error" response.
std::string handle_query_request(const std::string& request_line,
                                  const RTree& rtree,
                                  const EntityStore& store);

} // namespace kestrel

#endif // KESTREL_QUERY_SERVICE_H
