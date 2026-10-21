# KESTREL Query API

The Mission Control frontend never computes a result set of its own. A user
draws a region on the map, the frontend converts it into world coordinates and
posts it to the local query service. The service answers with the entity ids
that the C++ R-tree actually produced.

```
browser  ──POST /api/query──▶  launcher (query_api.py)  ──stdin/stdout──▶  kestrel_query (C++)
                                    │                                            │
                                    └──────────── response ────────────────────┘
```

The C++ service is a long lived process. It builds the demonstration scene once
and keeps that R-tree in memory, so every request is answered by the very same
tree instance and the simulation is never regenerated per query.

## Endpoints

### `POST /api/query`

Request body:

```json
{ "bounds": [min_x, min_y, max_x, max_y] }
```

* `bounds` — exactly four finite numbers in world space, `min <= max` on both
  axes. A degenerate region (`min == max`) is valid and is executed like any
  other region.
* The optional member `"op": "query"` is accepted and is the default.

Responses:

| Status | HTTP | Body |
|--------|------|------|
| Match | 200 | `{"status":"ok","scene_key":<id>,"query":{"bounds":[...]},"results":[<ids>],"metrics":{"nodes_visited":<n>}}` |
| No match | 200 | same body with `"status":"empty"` and `"results":[]` |
| Invalid input | 400 | `{"status":"invalid","message":"<reason>"}` |
| Execution failure | 500 | `{"status":"error","message":"<reason>"}` |
| Service unavailable | 503 | `{"status":"unavailable","message":"<reason>"}` |

`metrics` only contains the traversal statistics the implementation actually
produces (`nodes_visited`). No execution time, no estimated counters and no
result id is ever invented.

### `GET /api/scene`

Returns the identity of the scene the service holds:

```json
{ "status": "ok", "scene_key": 6086476939198333, "entity_count": 11 }
```

## Scene identity

`scene_key` is a fingerprint of the scene contents (entity ids and bounding
boxes) that does not depend on the query. The exporter writes the same value
into `state.json` as `scene_key`, so a client can prove that a result belongs
to the scene it is displaying:

* the frontend refuses a result whose `scene_key` differs from the `scene_key`
  of the loaded state;
* a state file without a `scene_key` (for example a hand written one) cannot
  be queried, because no live R-tree instance is known to belong to it.

`scene_id` (already present in `state.json`) is the fingerprint of the scene
contents *combined with* the exported demonstration query. It is unchanged by
this feature.

## Geometry semantics

The query is executed by the existing `MissionControl::region_scan`, which uses
`RTree::search` and the shared geometry primitives:

* **Closed / inclusive boundaries** — a region that only touches the boundary
  of an entity includes that entity.
* **Degenerate regions** — a point or a line region is valid and is executed.
* **NaN and infinity** — a region with a non-finite coordinate is rejected
  before the tree is touched (`status: "invalid"`).

The drawn region covers every pixel the drag touched, so a region that
visually touches an entity also touches it in world space.

## Error handling

| Situation | Behaviour |
|-----------|-----------|
| Malformed body | `400` with `status: "invalid"` |
| Body larger than 64 KiB | `400` with `status: "invalid"` |
| Empty body | `400` with `status: "invalid"` |
| Unknown endpoint | `404` |
| C++ service not running or not answering | `503` with `status: "unavailable"` |
| C++ service answered with an unreadable body | `500` with `status: "error"` |

## Running it

```bash
python3 run_demo.py            # builds, exports, starts the service and the server
python3 run_demo.py --once     # builds and exports only (no service, no server)
```

The service is started automatically by the launcher. The frontend is served
from the repository root, so the endpoints live at `/api/query` and
`/api/scene` next to `/frontend/index.html`.
