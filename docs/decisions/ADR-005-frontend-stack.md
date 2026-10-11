# ADR-005 - Frontend Technology Stack (OD-002)

**Status:** Accepted  
**Date:** 2026-10-10  
**Last updated:** 2026-10-10  
**Formally approved by Project Owner on 2026-10-10.**

---

## Context

GATE-10 requires a 2D visualization of the Kepler Belt simulation, spatial queries, and the R-tree structure. The project's core is implemented in C++17. A decision (OD-002) was pending regarding which technology stack to use for this frontend, with the constraint that it must not introduce complex network or cross-platform compilation dependencies into the core C++ backend.

---

## Decision (Accepted)

Implement a decoupled **Web-based (Static HTML/JS/Canvas)** frontend, relying on a lightweight **JSON export** from the C++ backend.

- **Backend:** A new C++ executable (`kestrel_export`) acts as the state exporter. It executes the simulation and spatial queries and writes a `state.json` file.
- **Frontend:** A set of static files (`frontend/index.html`, `frontend/app.js`) reads the `state.json` file and renders the bounding boxes (MBRs), entities, query regions, and highlighted results using the native browser Canvas API.

### Rationale
- **Zero Graphical C++ Dependencies:** Preserves the Minimum Necessary Implementation (MNI) for the backend. The C++ build does not require SDL2, SFML, OpenGL, or Qt.
- **Universality:** Any machine with a modern web browser can run the visualization.
- **Complete Decoupling:** Fulfills `GATE-10-AC-05`, proving that the core tests and simulation are entirely unpolluted by the frontend implementation.

---

## Alternatives Considered

- **C++ Graphics Library (SFML / Dear ImGui):** Rejected. Integrating graphical libraries in C++ across different operating systems adds significant build complexity (CMake find modules, linking errors) which violates the MNI rule for a simple visualization requirement.
- **Python / Matplotlib:** Rejected. Requires users to install Python and configure virtual environments. While acceptable, the Web Canvas approach is more universally frictionless.

---

## Consequences and Trade-offs

**Benefits:**
- Simplest possible build toolchain.
- The C++ backend remains purely algorithmic.

**Risks:**
- Browsers enforce CORS (Cross-Origin Resource Sharing) restrictions on `file://` URIs, requiring the user to serve the frontend via a simple local HTTP server (e.g., `python -m http.server`) rather than double-clicking the HTML file directly. This is an acceptable trade-off for zero build dependencies.

---

## Approval Record

| Reviewer | Decision | Date | Notes |
|----------|---------|------|-------|
| Project Owner | ACCEPTED | 2026-10-10 | Authorized static HTML/JS Canvas frontend decoupled via JSON export. |
