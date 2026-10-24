# KESTREL Query API

The Mission Control frontend never computes a result set or simulated traversal of its own. A user
draws a region on the canvas, the frontend converts it into world coordinates via an inverse viewport
transformation, and posts it to the local query service. The service executes the range query on the
real C++ R-tree and returns the exact matching entity IDs, traversal metrics, and traversal trace.

```
browser  ──POST /api/query──▶  launcher (query_api.py)  ──stdin/stdout──▶  kestrel_query (C++)
                                    │                                            │
                                    └──────────── response ────────────────────┘
```

The C++ service is a long-lived process (`kestrel_query.exe`). It builds the demonstration scene once
and keeps that R-tree in memory, so every request is answered by the very same tree instance and the
simulation is never regenerated per query.

## Endpoints

### `POST /api/query`

Request body:

```json
{ "bounds": [min_x, min_y, max_x, max_y] }
```

* `bounds` — exactly four finite numbers in world space, `min <= max` on both axes.
  A degenerate region (`min == max`, i.e. a point or line) is valid and is executed.
* The optional member `"op": "query"` is accepted and is the default.

Responses:

| Status | HTTP | Body Overview |
|--------|------|---------------|
| Match | 200 | `{"status":"ok","scene_key":<key>,"scene_id":<id>,"query":{"query_id":1,"bounds":[...],"results":[...]},"results":[...],"metrics":{"nodes_visited":<n>},"trace":{...}}` |
| No match | 200 | Same body with `"status":"empty"`, `"results":[]`, and a valid traversal trace ending in `traversal_completed` |
| Invalid input | 400 | `{"status":"invalid","message":"<reason>"}` |
| Execution failure | 500 | `{"status":"error","message":"<reason>"}` |
| Service unavailable | 503 | `{"status":"unavailable","message":"<reason>"}` |

`metrics` only contains the traversal statistics the implementation actually produces (`nodes_visited`).
No execution time, estimated counters, or synthetic result IDs are ever invented.

### `GET /api/scene`

Returns the identity and size of the scene the service holds:

```json
{ "status": "ok", "scene_key": 8936359257499334, "entity_count": 11 }
```

## Scene & Query Identity

The architecture distinguishes between two identity levels:

* `scene_key` (53-bit FNV-1a hash): Identifies the underlying scene independently of any query. It is a fingerprint of the sorted canonical entity geometries. The C++ exporter writes the same `scene_key` into `build/state.json`. The frontend checks `scene_key` and refuses query results if they belong to a different scene.
* `scene_id` (53-bit FNV-1a hash): Identifies the specific exported scene snapshot and query region combination. Distinct query bounds produce distinct `scene_id` values while preserving `scene_key`.
* `query_id` (integer): Identifies the query within the active session.

## Traversal Trace Contract

When a query is executed, `kestrel_query` collects traversal events using `RTreeTrace`:

* **Canonical Node Identifiers**: Traversal events reference hierarchy nodes using canonical strings (`"node_0"`, `"node_1"`) identical to those in the exported hierarchy (`rtree.root`).
* **Event Types**: Includes `node_visited`, `mbr_tested`, `branch_pruned`, `child_entered`, `leaf_entry_examined`, `entity_accepted`, and `traversal_completed`.
* **Frontend Replay Installation**: The frontend installs the returned `trace` into `replay.trace` via `installTraceForState()`, enabling step-by-step playback, MBR check visualization, and branch pruning examination.

## Geometry Semantics

The query is executed by `MissionControl::region_scan`, which uses `RTree::search` and the shared geometry primitives:

* **Closed / inclusive boundaries** — a region that only touches the boundary of an entity includes that entity.
* **Degenerate regions** — a point or line region is valid and executed against the tree.
* **NaN and infinity** — any non-finite coordinate is rejected before the tree is touched (`status: "invalid"`).

The drawn region covers every pixel the drag touched, so a region that visually touches an entity on canvas also touches it in world space.

## Persistence & Fixture Safety

* **Tracked Fixture Protection**: Running the demo launcher or exporter NEVER overwrites tracked repository fixtures (`state.json` or `frontend/state.json`).
* **Runtime State Location**: Simulation exports are written directly to `build/state.json`.
* **Safe Serving**: The launcher's HTTP server (`NoCacheHTTPRequestHandler`) serves the freshly generated `build/state.json` when `state.json` is requested by the browser, sending strict `no-cache` headers.

## Running the Demo

```bash
python run_demo.py            # builds targets, exports state, starts kestrel_query worker and demo server
python run_demo.py --once     # builds and exports only, verifies state, without starting server
```

The interactive query worker (`kestrel_query`) is automatically spawned by `run_demo.py`. The frontend is served from the repository root, hosting the endpoints at `/api/query` and `/api/scene` alongside `/frontend/index.html`.
