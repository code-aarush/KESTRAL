/**
 * KESTREL Mission Control Visualization (GATE-10 / Issue #1)
 * Interactive Canvas frontend reading C++ R-tree JSON state.
 * Supports cursor-centered zoom, click-drag panning, HiDPI resizing, Fit All, and Reset View.
 */

const canvas = document.getElementById('radar');
const ctx = canvas.getContext('2d');
const statusSpan = document.getElementById('status');
const statusDot = document.getElementById('statusDot');
const missionClock = document.getElementById('missionClock');

const btnLoad = document.getElementById('btnLoad');
const btnBrowse = document.getElementById('btnBrowse');
const fileInput = document.getElementById('fileInput');

// Navigation buttons and HUD indicators
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnFitAll = document.getElementById('btnFitAll');
const btnResetView = document.getElementById('btnResetView');
const valZoom = document.getElementById('valZoom');
const valCoords = document.getElementById('valCoords');

// Layer checkboxes
const layerEntities = document.getElementById('layerEntities');
const layerResults = document.getElementById('layerResults');
const layerLeaf = document.getElementById('layerLeaf');
const layerInternal = document.getElementById('layerInternal');
const layerQuery = document.getElementById('layerQuery');

// Metric cards
const valEntities = document.getElementById('valEntities');
const valResults = document.getElementById('valResults');
const valLeaf = document.getElementById('valLeaf');
const valInternal = document.getElementById('valInternal');

// Empty state & frame elements
const viewportFrame = document.getElementById('viewportFrame') || (typeof document !== 'undefined' ? document.querySelector('.canvas-viewport-frame') : null);
const emptyStateOverlay = document.getElementById('emptyStateOverlay');
const emptyFeedback = document.getElementById('emptyFeedback');
const emptyFeedbackText = document.getElementById('emptyFeedbackText');
const btnEmptyLoad = document.getElementById('btnEmptyLoad');
const btnEmptyBrowse = document.getElementById('btnEmptyBrowse');

// R-Tree Hierarchy panel DOM elements
const hierarchyDock = typeof document !== 'undefined' ? document.getElementById('hierarchyDock') : null;
const hierarchyBadge = typeof document !== 'undefined' ? document.getElementById('hierarchyBadge') : null;
const hierarchyTreeContainer = typeof document !== 'undefined' ? document.getElementById('hierarchyTreeContainer') : null;
const hierarchyTree = typeof document !== 'undefined' ? document.getElementById('hierarchyTree') : null;
const hierarchyEmptyState = typeof document !== 'undefined' ? document.getElementById('hierarchyEmptyState') : null;
const hierarchyEmptyTitle = typeof document !== 'undefined' ? document.getElementById('hierarchyEmptyTitle') : null;
const hierarchyEmptyDesc = typeof document !== 'undefined' ? document.getElementById('hierarchyEmptyDesc') : null;
const nodeDetailCard = typeof document !== 'undefined' ? document.getElementById('nodeDetailCard') : null;
const btnClearSelection = typeof document !== 'undefined' ? document.getElementById('btnClearSelection') : null;
const nodeDetailId = typeof document !== 'undefined' ? document.getElementById('nodeDetailId') : null;
const nodeDetailType = typeof document !== 'undefined' ? document.getElementById('nodeDetailType') : null;
const nodeDetailDepth = typeof document !== 'undefined' ? document.getElementById('nodeDetailDepth') : null;
const nodeDetailEntries = typeof document !== 'undefined' ? document.getElementById('nodeDetailEntries') : null;
const nodeDetailBounds = typeof document !== 'undefined' ? document.getElementById('nodeDetailBounds') : null;
const nodeDetailEntities = typeof document !== 'undefined' ? document.getElementById('nodeDetailEntities') : null;

// Traversal replay elements
const traceBadge = typeof document !== 'undefined' ? document.getElementById('traceBadge') : null;
const traceStatus = typeof document !== 'undefined' ? document.getElementById('traceStatus') : null;
const traceStepLabel = typeof document !== 'undefined' ? document.getElementById('traceStep') : null;
const traceProgressFill = typeof document !== 'undefined' ? document.getElementById('traceProgressFill') : null;
const traceEventTag = typeof document !== 'undefined' ? document.getElementById('traceEventTag') : null;
const traceEventText = typeof document !== 'undefined' ? document.getElementById('traceEventText') : null;
const traceLog = typeof document !== 'undefined' ? document.getElementById('traceLog') : null;
const btnTraceStart = typeof document !== 'undefined' ? document.getElementById('btnTraceStart') : null;
const btnTracePrev = typeof document !== 'undefined' ? document.getElementById('btnTracePrev') : null;
const btnTraceNext = typeof document !== 'undefined' ? document.getElementById('btnTraceNext') : null;
const btnTracePlay = typeof document !== 'undefined' ? document.getElementById('btnTracePlay') : null;
const btnTracePause = typeof document !== 'undefined' ? document.getElementById('btnTracePause') : null;
const btnTraceRestart = typeof document !== 'undefined' ? document.getElementById('btnTraceRestart') : null;
const btnTraceClear = typeof document !== 'undefined' ? document.getElementById('btnTraceClear') : null;

let currentState = null;
let currentHierarchy = null;
let selectedNodeId = null;
const collapsedNodeIds = new Set();
let dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
let cssWidth = 800;
let cssHeight = 600;
let renderRequested = false;

// Shared Viewport State
const viewport = {
    scale: 1.0,
    tx: 0.0,
    ty: 0.0,
    minScale: 1e-4,
    maxScale: 1e4,
    isPanning: false,
    panStartX: 0.0,
    panStartY: 0.0,
    initialTransform: null
};

let activePointerId = null;
let hasActiveCapture = false;

/**
 * Idempotently terminates an active pan gesture.
 * Cleans up viewport panning state, removes visual panning classes,
 * and releases active pointer capture safely.
 */
function endPan(e) {
    if (!viewport.isPanning) return;
    viewport.isPanning = false;
    if (canvas) canvas.classList.remove('panning');

    const pId = (e && typeof e.pointerId === 'number') ? e.pointerId : activePointerId;
    activePointerId = null;
    hasActiveCapture = false;

    if (canvas && pId !== null && pId !== undefined) {
        try {
            if (canvas.hasPointerCapture && canvas.hasPointerCapture(pId)) {
                canvas.releasePointerCapture(pId);
            }
        } catch (_) {}
    }
}

// Candidate URLs for resolving state.json across different local server roots
const CANDIDATE_URLS = [
    './state.json',
    'state.json',
    '../build/state.json',
    '/build/state.json',
    'build/state.json',
    '../state.json',
    '/state.json'
];

function setStatus(text, type = 'normal') {
    if (statusSpan && statusDot) {
        statusSpan.textContent = text;
        statusSpan.title = text;
        statusDot.className = 'status-dot';
        if (type === 'success') statusDot.classList.add('success');
        else if (type === 'loading') statusDot.classList.add('loading');
        else if (type === 'error') statusDot.classList.add('error');
    }

    if (!currentState && emptyFeedback && emptyFeedbackText) {
        if (type === 'loading') {
            emptyFeedback.style.display = 'flex';
            emptyFeedback.className = 'empty-state-feedback loading';
            emptyFeedbackText.textContent = text;
        } else if (type === 'error') {
            emptyFeedback.style.display = 'flex';
            emptyFeedback.className = 'empty-state-feedback error';
            emptyFeedbackText.textContent = text;
        } else if (type === 'success') {
            emptyFeedback.style.display = 'none';
        }
    }
}

/**
 * Transforms world Cartesian point (wx, wy) to canvas CSS screen coordinates (sx, sy).
 * Preserves the existing world-space orientation (world Y increases downward on screen).
 */
function worldToScreen(wx, wy) {
    if (!isFinite(wx) || !isFinite(wy) || !isFinite(viewport.scale) || !isFinite(viewport.tx) || !isFinite(viewport.ty)) {
        return { x: NaN, y: NaN };
    }
    return {
        x: wx * viewport.scale + viewport.tx,
        y: wy * viewport.scale + viewport.ty
    };
}

/**
 * Transforms canvas CSS screen coordinates (sx, sy) to world Cartesian coordinates (wx, wy).
 */
function screenToWorld(sx, sy) {
    if (!isFinite(sx) || !isFinite(sy) || !isFinite(viewport.scale) || viewport.scale === 0 || !isFinite(viewport.tx) || !isFinite(viewport.ty)) {
        return { x: NaN, y: NaN };
    }
    return {
        x: (sx - viewport.tx) / viewport.scale,
        y: (sy - viewport.ty) / viewport.scale
    };
}

/**
 * Projects a 4-element world bounding box [min_x, min_y, max_x, max_y]
 * into screen-space rectangle { x, y, w, h }.
 * Safely ignores non-finite, invalid, or malformed bounds.
 */
function projectBox(b) {
    if (!Array.isArray(b) || b.length < 4) return null;
    const x1 = Math.min(b[0], b[2]);
    const x2 = Math.max(b[0], b[2]);
    const y1 = Math.min(b[1], b[3]);
    const y2 = Math.max(b[1], b[3]);
    if (!isFinite(x1) || !isFinite(x2) || !isFinite(y1) || !isFinite(y2)) return null;

    const p1 = worldToScreen(x1, y1);
    const p2 = worldToScreen(x2, y2);
    if (!isFinite(p1.x) || !isFinite(p1.y) || !isFinite(p2.x) || !isFinite(p2.y)) return null;

    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);
    return { x, y, w, h };
}

/**
 * Computes an aspect-ratio-preserving fit transform mapping all state geometry
 * into the target canvas width/height with margin padding.
 * Robust across single entities, non-square extents, very small and very large ranges.
 */
function computeFitTransform(state, targetW = cssWidth, targetH = cssHeight) {
    const pad = Math.max(20, Math.min(40, Math.min(targetW, targetH) * 0.08));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const expand = (b) => {
        if (!Array.isArray(b) || b.length < 4) return;
        const x1 = Math.min(b[0], b[2]);
        const x2 = Math.max(b[0], b[2]);
        const y1 = Math.min(b[1], b[3]);
        const y2 = Math.max(b[1], b[3]);
        if (isFinite(x1) && isFinite(x2) && isFinite(y1) && isFinite(y2)) {
            minX = Math.min(minX, x1);
            maxX = Math.max(maxX, x2);
            minY = Math.min(minY, y1);
            maxY = Math.max(maxY, y2);
        }
    };

    if (state && Array.isArray(state.entities)) state.entities.forEach(e => e && expand(e.bounds));
    if (state && state.rtree && typeof state.rtree === 'object') {
        if (Array.isArray(state.rtree.internal_mbrs)) state.rtree.internal_mbrs.forEach(expand);
        if (Array.isArray(state.rtree.leaf_mbrs)) state.rtree.leaf_mbrs.forEach(expand);
        if (state.rtree.root && state.rtree.root.bounds) expand(state.rtree.root.bounds);
    }
    if (state && state.query && state.query.bounds) expand(state.query.bounds);

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        return { scale: 1.0, tx: targetW / 2, ty: targetH / 2, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const availW = Math.max(targetW - 2 * pad, 10);
    const availH = Math.max(targetH - 2 * pad, 10);

    let scale = 1.0;
    if (spanX > 0 && spanY > 0) {
        scale = Math.min(availW / spanX, availH / spanY);
    } else if (spanX > 0) {
        scale = availW / spanX;
    } else if (spanY > 0) {
        scale = availH / spanY;
    } else {
        // Single point entity: center cleanly at scale 1.0
        scale = 1.0;
    }

    scale = Math.max(viewport.minScale, Math.min(viewport.maxScale, scale));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const tx = targetW / 2 - centerX * scale;
    const ty = targetH / 2 - centerY * scale;

    return { scale, tx, ty, minX, minY, maxX, maxY };
}

/**
 * Adjusts viewport to fit all active geometry within the canvas.
 */
function fitAll(setAsInitial = false) {
    if (!currentState) return;
    const fit = computeFitTransform(currentState, cssWidth, cssHeight);
    viewport.scale = fit.scale;
    viewport.tx = fit.tx;
    viewport.ty = fit.ty;
    if (setAsInitial || !viewport.initialTransform) {
        viewport.initialTransform = { scale: fit.scale, tx: fit.tx, ty: fit.ty };
    }
    updateHud();
    requestRender();
}

/**
 * Restores initial fitted view from state load.
 */
function resetView() {
    if (viewport.initialTransform) {
        viewport.scale = viewport.initialTransform.scale;
        viewport.tx = viewport.initialTransform.tx;
        viewport.ty = viewport.initialTransform.ty;
    } else if (currentState) {
        fitAll(true);
        return;
    } else {
        viewport.scale = 1.0;
        viewport.tx = cssWidth / 2;
        viewport.ty = cssHeight / 2;
    }
    updateHud();
    requestRender();
}

/**
 * Performs cursor-anchored zoom at screen coordinate (screenX, screenY).
 * The world coordinate directly beneath the pointer remains pinned.
 */
function zoomAt(screenX, screenY, factor) {
    if (!isFinite(screenX) || !isFinite(screenY) || !isFinite(factor) || factor <= 0) return;

    const wx = (screenX - viewport.tx) / viewport.scale;
    const wy = (screenY - viewport.ty) / viewport.scale;
    if (!isFinite(wx) || !isFinite(wy)) return;

    const newScale = Math.max(viewport.minScale, Math.min(viewport.maxScale, viewport.scale * factor));
    if (Math.abs(newScale - viewport.scale) < 1e-6) return;

    viewport.tx = screenX - wx * newScale;
    viewport.ty = screenY - wy * newScale;
    viewport.scale = newScale;

    updateHud();
    requestRender();
}

function zoomIn() {
    zoomAt(cssWidth / 2, cssHeight / 2, 1.25);
}

function zoomOut() {
    zoomAt(cssWidth / 2, cssHeight / 2, 1 / 1.25);
}

function updateHud() {
    if (valZoom) {
        const pct = Math.round(viewport.scale * 100);
        valZoom.textContent = `${pct}%`;
    }
}

/**
 * Adapts canvas buffer to DOM container dimensions and Device Pixel Ratio (HiDPI).
 * Shifts viewport offsets to preserve spatial center when resizing.
 * Updates saved initialTransform so Reset View restores framing for the new canvas size.
 */
function resizeCanvas(targetW, targetH) {
    if (!canvas) return;
    const container = canvas.parentElement || canvas;
    const rect = (container && typeof container.getBoundingClientRect === 'function')
        ? container.getBoundingClientRect()
        : canvas.getBoundingClientRect();
    const w = (typeof targetW === 'number' && targetW > 0) ? Math.floor(targetW) : (Math.floor(rect.width) || 800);
    const h = (typeof targetH === 'number' && targetH > 0) ? Math.floor(targetH) : (Math.floor(rect.height) || 600);

    dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const bufferW = Math.round(w * dpr);
    const bufferH = Math.round(h * dpr);

    if (canvas.width !== bufferW || canvas.height !== bufferH || cssWidth !== w || cssHeight !== h) {
        const wasInitial = !viewport.initialTransform || (
            Math.abs(viewport.scale - viewport.initialTransform.scale) < 1e-4 &&
            Math.abs(viewport.tx - viewport.initialTransform.tx) < 1e-2 &&
            Math.abs(viewport.ty - viewport.initialTransform.ty) < 1e-2
        );

        if (cssWidth > 0 && cssHeight > 0 && isFinite(viewport.tx) && isFinite(viewport.ty) && !wasInitial) {
            viewport.tx += (w - cssWidth) / 2;
            viewport.ty += (h - cssHeight) / 2;
        }

        canvas.width = bufferW;
        canvas.height = bufferH;
        cssWidth = w;
        cssHeight = h;

        if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        if (currentState) {
            const newInitial = computeFitTransform(currentState, w, h);
            viewport.initialTransform = { scale: newInitial.scale, tx: newInitial.tx, ty: newInitial.ty };
            if (wasInitial) {
                viewport.scale = newInitial.scale;
                viewport.tx = newInitial.tx;
                viewport.ty = newInitial.ty;
                updateHud();
            }
            drawState(currentState);
        } else {
            viewport.initialTransform = { scale: 1.0, tx: w / 2, ty: h / 2 };
            if (wasInitial) {
                viewport.scale = 1.0;
                viewport.tx = w / 2;
                viewport.ty = h / 2;
                updateHud();
            }
            drawBackgroundGrid();
        }
    }
}

function requestRender() {
    if (!renderRequested) {
        renderRequested = true;
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                renderRequested = false;
                drawState(currentState);
            });
        } else {
            renderRequested = false;
            drawState(currentState);
        }
    }
}

function drawBackgroundGrid() {
    if (!ctx) return;
    dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Adaptive world coordinate grid
    const targetScreenStep = 80;
    const rawWorldStep = targetScreenStep / viewport.scale;

    if (isFinite(rawWorldStep) && rawWorldStep > 0) {
        const power = Math.pow(10, Math.floor(Math.log10(rawWorldStep)));
        let worldStep = power;
        const ratio = rawWorldStep / power;
        if (ratio >= 5) worldStep = power * 5;
        else if (ratio >= 2) worldStep = power * 2;

        const topLeft = screenToWorld(0, 0);
        const bottomRight = screenToWorld(cssWidth, cssHeight);

        if (isFinite(topLeft.x) && isFinite(topLeft.y) && isFinite(bottomRight.x) && isFinite(bottomRight.y)) {
            const minWX = Math.min(topLeft.x, bottomRight.x);
            const maxWX = Math.max(topLeft.x, bottomRight.x);
            const minWY = Math.min(topLeft.y, bottomRight.y);
            const maxWY = Math.max(topLeft.y, bottomRight.y);

            const startX = Math.floor(minWX / worldStep) * worldStep;
            const endX = Math.ceil(maxWX / worldStep) * worldStep;
            const startY = Math.floor(minWY / worldStep) * worldStep;
            const endY = Math.ceil(maxWY / worldStep) * worldStep;

            const countX = (endX - startX) / worldStep;
            const countY = (endY - startY) / worldStep;

            if (countX >= 0 && countX <= 60 && countY >= 0 && countY <= 60) {
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
                ctx.beginPath();

                for (let x = startX; x <= endX; x += worldStep) {
                    const s = worldToScreen(x, 0);
                    if (s.x >= -1 && s.x <= cssWidth + 1) {
                        const sx = Math.floor(s.x) + 0.5;
                        ctx.moveTo(sx, 0);
                        ctx.lineTo(sx, cssHeight);
                    }
                }
                for (let y = startY; y <= endY; y += worldStep) {
                    const s = worldToScreen(0, y);
                    if (s.y >= -1 && s.y <= cssHeight + 1) {
                        const sy = Math.floor(s.y) + 0.5;
                        ctx.moveTo(0, sy);
                        ctx.lineTo(cssWidth, sy);
                    }
                }
                ctx.stroke();
            }

            // Subtle World Axes (X=0, Y=0) - Supporting reference frame
            const origin = worldToScreen(0, 0);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (origin.x >= 0 && origin.x <= cssWidth) {
                const ox = Math.floor(origin.x) + 0.5;
                ctx.moveTo(ox, 0);
                ctx.lineTo(ox, cssHeight);
            }
            if (origin.y >= 0 && origin.y <= cssHeight) {
                const oy = Math.floor(origin.y) + 0.5;
                ctx.moveTo(0, oy);
                ctx.lineTo(cssWidth, oy);
            }
            ctx.stroke();

            // Origin Marker and Coordinate Indicators
            if (origin.x >= 0 && origin.x <= cssWidth && origin.y >= 0 && origin.y <= cssHeight) {
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
                ctx.beginPath();
                ctx.moveTo(origin.x - 5, origin.y);
                ctx.lineTo(origin.x + 5, origin.y);
                ctx.moveTo(origin.x, origin.y - 5);
                ctx.lineTo(origin.x, origin.y + 5);
                ctx.stroke();

                ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
                ctx.beginPath();
                ctx.arc(origin.x, origin.y, 2.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.font = '9px "JetBrains Mono", Menlo, Consolas, monospace';
                ctx.fillText('(0, 0)', origin.x + 6, origin.y - 4);
            } else {
                ctx.font = '9px "JetBrains Mono", Menlo, Consolas, monospace';
                ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
                if (origin.x >= 12 && origin.x <= cssWidth - 12) {
                    ctx.fillText('X=0', origin.x + 3, 12);
                }
                if (origin.y >= 12 && origin.y <= cssHeight - 12) {
                    ctx.fillText('Y=0', 4, origin.y - 3);
                }
            }
            return;
        }
    }

    // Static fallback grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    const step = 80;
    ctx.beginPath();
    for (let x = 0; x <= cssWidth; x += step) {
        const sx = Math.floor(x) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, cssHeight);
    }
    for (let y = 0; y <= cssHeight; y += step) {
        const sy = Math.floor(y) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(cssWidth, sy);
    }
    ctx.stroke();
}

function calcOverlapArea(a, b) {
    const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return xOverlap * yOverlap;
}

/**
 * Canonical DOM identifier for a hierarchy node.
 *
 * This is the single place where a canonical node id ("node_3", "entity_42")
 * is turned into a DOM id, so the hierarchy tree, the node inspector and the
 * traversal replay all address the very same node.
 */
function hierarchyDomId(nodeId) {
    return 'rtree-item-' + encodeURIComponent(nodeId).replace(/[^a-zA-Z0-9_-]/g, '_');
}

/* ===========================================================================
   Traversal Replay — step-through of the recorded R-tree range query.

   The replay always uses the trace that belongs to the scene and query that
   are currently loaded. A trace whose identity or references disagree with the
   loaded scene is rejected instead of being replayed.
   =========================================================================== */

// Display metadata for each recorded event kind.
const TRACE_EVENT_META = {
    node_visited:        { tag: 'VISITED',  glyph: '●' },
    mbr_tested:          { tag: 'TEST',     glyph: '◇' },
    branch_pruned:       { tag: 'PRUNED',   glyph: '✕' },
    child_entered:       { tag: 'ENTERED',  glyph: '▼' },
    leaf_entry_examined: { tag: 'LEAF',     glyph: '○' },
    entity_accepted:     { tag: 'ACCEPTED', glyph: '✓' },
    traversal_completed: { tag: 'COMPLETE', glyph: '■' }
};

const TRACE_EVENT_TYPES = Object.keys(TRACE_EVENT_META);

// Number of log entries kept in the DOM around the current step.
const TRACE_LOG_WINDOW = 120;

const replay = {
    trace: null,          // { sceneId, queryId, queryBounds, events, totalEvents, truncated }
    index: -1,            // index of the displayed event, -1 when nothing is displayed
    playing: false,
    timer: null,
    intervalMs: 700,
    visited: [],          // nodes visited so far
    entered: [],          // branches entered but not visited yet
    pruned: [],           // branches pruned so far
    accepted: [],         // entities accepted so far
    rejected: null        // reason the last candidate trace was rejected
};

// Set while the replay itself drives the hierarchy selection, so the manual
// "pause on user selection" behaviour does not fight the replay.
let replayDrivingSelection = false;

function replayIsActive() {
    return !!(replay.trace && replay.index >= 0);
}

/**
 * Read-only view of the replay state (used by the browser harnesses).
 */
function getReplayState() {
    return {
        hasTrace: !!replay.trace,
        index: replay.index,
        total: replay.trace ? replay.trace.totalEvents : 0,
        playing: replay.playing,
        truncated: replay.trace ? replay.trace.truncated : false,
        visited: replay.visited.slice(),
        entered: replay.entered.slice(),
        pruned: replay.pruned.slice(),
        accepted: replay.accepted.slice(),
        currentEvent: replay.trace && replay.index >= 0 ? replay.trace.events[replay.index] : null
    };
}

/**
 * Compares two world-space bounding boxes for equality.
 */
function boundsEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const x = Number(a[i]);
        const y = Number(b[i]);
        if (!isFinite(x) || !isFinite(y)) return false;
        if (Math.abs(x - y) > 1e-9) return false;
    }
    return true;
}

/**
 * Entity ids accepted by the recorded traversal, in recorded order.
 */
function traceAcceptedIds(events) {
    const ids = [];
    for (const ev of events) {
        if (ev && ev.type === 'entity_accepted') ids.push(Number(ev.entity_id));
    }
    return ids;
}

/**
 * Validates a single recorded event. Every field the replay relies on must be
 * present and well formed before the trace may be used.
 */
function isValidTraceEvent(ev) {
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return false;
    if (TRACE_EVENT_TYPES.indexOf(ev.type) === -1) return false;

    if (!Array.isArray(ev.mbr) || ev.mbr.length !== 4) return false;
    for (let i = 0; i < 4; i++) {
        if (typeof ev.mbr[i] !== 'number' || !isFinite(ev.mbr[i])) return false;
    }
    if (ev.mbr[0] > ev.mbr[2] || ev.mbr[1] > ev.mbr[3]) return false;

    if (ev.node_id !== null && ev.node_id !== undefined && typeof ev.node_id !== 'string') return false;
    if (ev.child_node_id !== null && ev.child_node_id !== undefined && typeof ev.child_node_id !== 'string') return false;
    if (typeof ev.entity_id !== 'number' || !Number.isInteger(ev.entity_id)) return false;
    if (typeof ev.intersects !== 'boolean') return false;

    return true;
}

/**
 * Extracts the traversal trace that belongs to the given state.
 * Returns null when the state carries no trace, or when the trace does not
 * belong to the loaded scene / query (stale trace protection).
 */
function extractTrace(state) {
    if (!state || typeof state !== 'object') return null;

    const raw = state.trace;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.events) || raw.events.length === 0) {
        return null;
    }

    const sceneId = state.scene_id;
    const queryId = state.query ? state.query.query_id : undefined;

    // The trace must belong to the scene that is currently loaded.
    if (sceneId === undefined || raw.scene_id !== sceneId) return null;

    // ...and to the query that is currently loaded.
    if (queryId !== undefined && raw.query_id !== queryId) return null;
    if (!boundsEqual(raw.query_bounds, state.query ? state.query.bounds : null)) return null;

    // Every event must be well formed.
    for (const ev of raw.events) {
        if (!isValidTraceEvent(ev)) return null;
    }

    // The recorded results must agree with the reported query results.
    if (!raw.truncated) {
        const recorded = traceAcceptedIds(raw.events);
        const reported = (state.query && Array.isArray(state.query.results))
            ? state.query.results.map(Number)
            : [];
        if (recorded.length !== reported.length) return null;
        const a = recorded.slice().sort((x, y) => x - y);
        const b = reported.slice().sort((x, y) => x - y);
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return null;
        }
    }

    return {
        sceneId: sceneId,
        queryId: queryId,
        queryBounds: raw.query_bounds,
        events: raw.events,
        totalEvents: raw.events.length,
        truncated: !!raw.truncated
    };
}

/**
 * Produces the short explanation for a recorded event.
 * The text is derived from the event that is actually displayed.
 */
function describeTraceEvent(ev) {
    if (!ev) return 'No traversal event selected.';

    switch (ev.type) {
        case 'node_visited':
            if (ev.intersects === false) {
                return `Visiting ${ev.node_id}. Its MBR does not intersect the query region, so all of its child branches will be pruned.`;
            }
            return `Visiting ${ev.node_id}.`;
        case 'mbr_tested':
            if (ev.child_node_id) {
                return ev.intersects
                    ? `Testing ${ev.child_node_id}'s MBR against the query region.`
                    : `Testing ${ev.child_node_id}'s MBR against the query region. It does not intersect.`;
            }
            return ev.intersects
                ? `Testing leaf entry #${ev.entity_id}'s MBR against the query region.`
                : `Testing leaf entry #${ev.entity_id}'s MBR against the query region. It does not intersect, so the entity is excluded.`;
        case 'branch_pruned':
            return 'The MBR does not intersect the query; this branch is pruned.';
        case 'child_entered':
            return 'The MBR intersects the query; traversal continues into its children.';
        case 'leaf_entry_examined':
            return 'This leaf entry matches the query.';
        case 'entity_accepted':
            return `Entity #${ev.entity_id} accepted as a query result.`;
        case 'traversal_completed':
            return 'Traversal completed.';
        default:
            return 'Unknown traversal event.';
    }
}

/**
 * Resolves the hierarchy node a recorded event refers to.
 * Node references use the canonical hierarchy identifiers, entity references
 * use the canonical numeric entity id.
 */
function resolveTraceFocusNode(ev) {
    if (!ev) return null;

    if ((ev.type === 'entity_accepted' || ev.type === 'leaf_entry_examined') &&
        ev.entity_id >= 0 && currentHierarchy && currentHierarchy.entityNodeMap) {
        const entityNode = currentHierarchy.entityNodeMap.get(ev.entity_id);
        if (entityNode) return entityNode.id;
    }
    if (ev.child_node_id) return ev.child_node_id;
    if (ev.node_id) return ev.node_id;
    return null;
}

/**
 * Expands the collapsed ancestors of a node so it becomes visible in the tree.
 * The DOM is updated in place — the tree is never re-rendered.
 */
function expandAncestorItems(nodeId) {
    if (!hierarchyTree || !nodeId) return;

    let item = document.getElementById(hierarchyDomId(nodeId));
    while (item) {
        const parentItem = item.parentElement ? item.parentElement.closest('.tree-item') : null;
        if (!parentItem) break;

        if (parentItem.classList.contains('collapsed')) {
            parentItem.classList.remove('collapsed');
            parentItem.classList.add('expanded');
            parentItem.setAttribute('aria-expanded', 'true');
            const parentId = parentItem.dataset.nodeId;
            if (parentId) collapsedNodeIds.delete(parentId);
            const toggleBtn = parentItem.querySelector(':scope > .tree-node-row > .tree-toggle');
            if (toggleBtn && parentId) toggleBtn.setAttribute('aria-label', 'Collapse ' + parentId);
        }
        item = parentItem;
    }
}

/**
 * Selects the hierarchy node a traversal event refers to, expanding its
 * ancestor path when needed. Returns true when the node could be resolved.
 */
function focusHierarchyNode(nodeId) {
    if (!nodeId || !currentHierarchy || !currentHierarchy.nodeMap) return false;
    if (!currentHierarchy.nodeMap.has(nodeId)) return false;

    expandAncestorItems(nodeId);

    replayDrivingSelection = true;
    try {
        selectHierarchyNode(nodeId);
    } finally {
        replayDrivingSelection = false;
    }
    return true;
}

/**
 * Rebuilds the accumulated highlights for the current step.
 */
function recomputeReplayAccumulation() {
    replay.visited = [];
    replay.entered = [];
    replay.pruned = [];
    replay.accepted = [];

    if (!replay.trace) return;

    const events = replay.trace.events;
    for (let i = 0; i <= replay.index && i < events.length; i++) {
        const ev = events[i];
        if (!ev) continue;
        if (ev.type === 'node_visited') {
            replay.visited.push({ nodeId: ev.node_id, mbr: ev.mbr });
        } else if (ev.type === 'child_entered') {
            replay.entered.push({ nodeId: ev.child_node_id, mbr: ev.mbr });
        } else if (ev.type === 'branch_pruned') {
            replay.pruned.push({ nodeId: ev.child_node_id, mbr: ev.mbr });
        } else if (ev.type === 'entity_accepted') {
            replay.accepted.push({ entityId: ev.entity_id, mbr: ev.mbr });
        }
    }

    // A branch that has already been visited is drawn as a visited node.
    const visitedIds = new Set(replay.visited.map(v => v.nodeId));
    replay.entered = replay.entered.filter(e => !visitedIds.has(e.nodeId));
}

/**
 * Moves the replay to a specific recorded event.
 */
function setReplayIndex(index) {
    if (!replay.trace) {
        replay.index = -1;
        recomputeReplayAccumulation();
        updateReplayUi();
        requestRender();
        return;
    }

    const max = replay.trace.totalEvents - 1;
    replay.index = Math.max(0, Math.min(index, max));
    recomputeReplayAccumulation();

    // Keep the hierarchy panel in sync with the traversal.
    const current = replay.trace.events[replay.index];
    focusHierarchyNode(resolveTraceFocusNode(current));

    updateReplayUi();
    requestRender();
}

function stopReplayTimer() {
    if (replay.timer !== null) {
        clearInterval(replay.timer);
        replay.timer = null;
    }
    replay.playing = false;
}

/**
 * Starts auto-advancing through the recorded events.
 */
function startReplayPlayback() {
    if (!replay.trace) return;
    if (replay.index >= replay.trace.totalEvents - 1) {
        setReplayIndex(0);
    }

    stopReplayTimer();
    replay.playing = true;
    replay.timer = setInterval(() => {
        if (!replay.trace) {
            stopReplayTimer();
            updateReplayUi();
            return;
        }
        if (replay.index >= replay.trace.totalEvents - 1) {
            stopReplayTimer();
            updateReplayUi();
            requestRender();
            return;
        }
        setReplayIndex(replay.index + 1);
    }, replay.intervalMs);

    updateReplayUi();
}

/**
 * Installs the trace of a freshly loaded scene. Any previously held trace is
 * discarded first so a new scene or query can never reuse a stale trace.
 */
function installTraceForState(state) {
    stopReplayTimer();
    replay.trace = null;
    replay.index = -1;
    replay.rejected = null;
    recomputeReplayAccumulation();

    const extracted = extractTrace(state);
    if (extracted) {
        replay.trace = extracted;
        setReplayIndex(0);
    } else {
        updateReplayUi();
        requestRender();
    }
}

/**
 * Discards the active trace and stops the replay.
 */
function clearReplayTrace() {
    stopReplayTimer();
    replay.trace = null;
    replay.index = -1;
    replay.rejected = null;
    recomputeReplayAccumulation();
    updateReplayUi();
    requestRender();
}

/**
 * Renders the recorded event log around the current step.
 */
function renderTraceLog() {
    if (!traceLog) return;
    clearElementChildren(traceLog);

    if (!replay.trace) return;

    const events = replay.trace.events;
    const total = events.length;
    let end = Math.min(total, replay.index + 1 + Math.floor(TRACE_LOG_WINDOW / 2));
    let start = Math.max(0, end - TRACE_LOG_WINDOW);
    end = Math.min(total, start + TRACE_LOG_WINDOW);

    for (let i = start; i < end; i++) {
        const ev = events[i];
        const meta = TRACE_EVENT_META[ev && ev.type] || { tag: 'EVENT', glyph: '·' };

        const item = document.createElement('li');
        item.className = 'trace-log-item trace-log-' + (ev && ev.type ? ev.type : 'unknown');
        if (i === replay.index) item.classList.add('is-current');

        const indexSpan = document.createElement('span');
        indexSpan.className = 'trace-log-index';
        indexSpan.textContent = String(i + 1);

        const glyphSpan = document.createElement('span');
        glyphSpan.className = 'trace-log-glyph';
        glyphSpan.textContent = meta.glyph;

        const textSpan = document.createElement('span');
        textSpan.className = 'trace-log-text';
        textSpan.textContent = describeTraceEvent(ev);

        item.appendChild(indexSpan);
        item.appendChild(glyphSpan);
        item.appendChild(textSpan);
        item.addEventListener('click', () => {
            stopReplayTimer();
            setReplayIndex(i);
        });

        traceLog.appendChild(item);
    }

    // Keep the current entry visible without scrolling any ancestor page.
    const current = traceLog.querySelector('.trace-log-item.is-current');
    if (current && typeof traceLog.scrollTop === 'number') {
        const itemTop = current.offsetTop;
        const itemBottom = itemTop + current.offsetHeight;
        if (itemTop < traceLog.scrollTop) {
            traceLog.scrollTop = itemTop;
        } else if (itemBottom > traceLog.scrollTop + traceLog.clientHeight) {
            traceLog.scrollTop = itemBottom - traceLog.clientHeight;
        }
    }
}

/**
 * Refreshes the traversal panel from the current replay state.
 */
function updateReplayUi() {
    const hasTrace = !!replay.trace;
    const total = hasTrace ? replay.trace.totalEvents : 0;
    const step = hasTrace ? replay.index + 1 : 0;

    if (traceBadge) {
        traceBadge.textContent = hasTrace ? `${total} EVENTS` : 'NO TRACE';
        traceBadge.className = 'panel-badge' + (hasTrace ? ' is-active' : '');
    }

    if (traceStatus) {
        if (hasTrace) {
            const truncated = replay.trace.truncated ? ' — trace truncated, history is incomplete' : '';
            traceStatus.textContent = `Recorded traversal of the current query region${truncated}.`;
            traceStatus.classList.remove('is-empty');
        } else {
            traceStatus.textContent = 'No recorded traversal for this scene.';
            traceStatus.classList.add('is-empty');
        }
    }

    if (traceStepLabel) {
        traceStepLabel.textContent = hasTrace ? `${step} / ${total}` : '— / —';
    }

    if (traceProgressFill) {
        const ratio = hasTrace && total > 0 ? (step / total) : 0;
        traceProgressFill.style.width = `${Math.round(ratio * 100)}%`;
    }

    const currentEvent = hasTrace ? replay.trace.events[replay.index] : null;
    const meta = TRACE_EVENT_META[currentEvent && currentEvent.type] || { tag: 'IDLE', glyph: '·' };

    if (traceEventTag) {
        traceEventTag.textContent = currentEvent ? meta.tag : 'IDLE';
        traceEventTag.className = 'trace-event-tag trace-tag-' + (currentEvent && currentEvent.type ? currentEvent.type : 'idle');
    }
    if (traceEventText) {
        traceEventText.textContent = currentEvent
            ? describeTraceEvent(currentEvent)
            : 'No traversal event selected.';
    }

    const atStart = hasTrace && replay.index <= 0;
    const atEnd = hasTrace && replay.index >= total - 1;
    if (btnTraceStart) btnTraceStart.disabled = !hasTrace;
    if (btnTracePrev) btnTracePrev.disabled = !hasTrace || atStart;
    if (btnTraceNext) btnTraceNext.disabled = !hasTrace || atEnd;
    if (btnTracePlay) btnTracePlay.disabled = !hasTrace || (atEnd && !replay.playing);
    if (btnTracePause) btnTracePause.disabled = !replay.playing;
    if (btnTraceRestart) btnTraceRestart.disabled = !hasTrace;
    if (btnTraceClear) btnTraceClear.disabled = !hasTrace;

    renderTraceLog();
}

/**
 * Draws a decorative glyph badge anchored at the top-left corner of a box.
 */
function drawTraceGlyph(x, y, glyph, color) {
    ctx.save();
    ctx.font = 'bold 10px "JetBrains Mono", Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(glyph).width + 6;
    const h = 12;
    const bx = Math.max(0, x - w / 2);
    const by = Math.max(0, y - h / 2);

    ctx.fillStyle = 'rgba(6, 9, 16, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(bx, by, w, h, 2);
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.fillRect(bx, by, w, h);
        ctx.strokeRect(bx, by, w, h);
    }

    ctx.fillStyle = color;
    ctx.fillText(glyph, bx + w / 2, by + h / 2 + 0.5);
    ctx.restore();
}

/**
 * Draws a highlighted rectangle using a distinct line style so the event kind
 * is never communicated by colour alone.
 */
function drawTraceBox(bounds, options) {
    const r = projectBox(bounds);
    if (!r) return null;

    const opts = options || {};
    ctx.save();
    ctx.setLineDash(opts.dash || []);
    ctx.lineWidth = opts.width || 1.5;
    ctx.strokeStyle = opts.color || '#00c8e6';

    if (opts.fill) {
        ctx.fillStyle = opts.fill;
        ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    if (opts.glow) {
        ctx.shadowColor = opts.color || '#00c8e6';
        ctx.shadowBlur = opts.glow;
    }

    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();

    return r;
}

/**
 * Renders the traversal highlights for the event that is currently displayed.
 */
function drawTraceOverlay() {
    if (!replayIsActive()) return;

    // Pruned branches: dashed crimson outline with a cross marker.
    for (const item of replay.pruned) {
        const r = drawTraceBox(item.mbr, {
            color: 'rgba(244, 63, 94, 0.9)',
            dash: [7, 5],
            width: 1.6,
            fill: 'rgba(244, 63, 94, 0.06)'
        });
        if (r) drawTraceGlyph(r.x, r.y, '✕', '#f43f5e');
    }

    // Branches that were entered but not visited yet: dotted amber outline.
    for (const item of replay.entered) {
        const r = drawTraceBox(item.mbr, {
            color: 'rgba(234, 179, 8, 0.95)',
            dash: [2, 4],
            width: 1.6
        });
        if (r) drawTraceGlyph(r.x, r.y, '▼', '#eab308');
    }

    // Visited nodes: solid cyan outline with a filled dot marker.
    for (const item of replay.visited) {
        const r = drawTraceBox(item.mbr, {
            color: 'rgba(0, 200, 230, 0.95)',
            width: 1.8
        });
        if (r) drawTraceGlyph(r.x, r.y, '●', '#00c8e6');
    }

    // Accepted results: ringed entity box with a check marker.
    for (const item of replay.accepted) {
        const r = projectBox(item.mbr);
        if (!r) continue;
        const bw = Math.max(r.w, 7);
        const bh = Math.max(r.h, 7);
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(r.x - 2, r.y - 2, bw + 4, bh + 4);
        ctx.restore();
        drawTraceGlyph(r.x + bw, r.y, '✓', '#22d3ee');
    }

    // The event that is currently displayed gets the strongest treatment.
    // The completion marker carries no geometry, so nothing is highlighted.
    const current = replay.trace.events[replay.index];
    if (current && current.type !== 'traversal_completed' && Array.isArray(current.mbr)) {
        const r = drawTraceBox(current.mbr, {
            color: '#ffffff',
            dash: [10, 4, 2, 4],
            width: 2.4,
            glow: 12
        });
        if (r) {
            const label = current.entity_id >= 0
                ? `#${current.entity_id}`
                : (current.child_node_id ? current.child_node_id : (current.node_id || ''));
            drawTraceGlyph(r.x + r.w, r.y + r.h, label, '#ffffff');
        }
    }
}

function drawState(state) {
    if (!ctx) return;
    dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || dpr || 1;

    if (!state) {
        if (emptyStateOverlay) emptyStateOverlay.classList.remove('is-hidden');
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBackgroundGrid();
        ctx.restore();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return;
    }

    if (emptyStateOverlay) emptyStateOverlay.classList.add('is-hidden');

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBackgroundGrid();

    // 1. Internal MBRs (Level 1+) - Supporting directory hierarchy boundaries
    if (layerInternal && layerInternal.checked && state.rtree && Array.isArray(state.rtree.internal_mbrs)) {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.65)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        state.rtree.internal_mbrs.forEach(b => {
            const r = projectBox(b);
            if (r) ctx.strokeRect(r.x, r.y, r.w, r.h);
        });
    }

    // 2. Leaf MBRs (Level 0)
    if (layerLeaf && layerLeaf.checked && state.rtree && Array.isArray(state.rtree.leaf_mbrs)) {
        ctx.strokeStyle = '#c084fc';
        ctx.fillStyle = 'rgba(192, 132, 252, 0.05)';
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
        state.rtree.leaf_mbrs.forEach(b => {
            const r = projectBox(b);
            if (r) {
                ctx.fillRect(r.x, r.y, r.w, r.h);
                ctx.strokeRect(r.x, r.y, r.w, r.h);
            }
        });
    }

    // 2b. Selected Hierarchy Node MBR Highlight (Translucent Fill)
    let selectedBox = null;
    let selectedNode = null;
    if (selectedNodeId && currentHierarchy && currentHierarchy.nodeMap) {
        selectedNode = currentHierarchy.nodeMap.get(selectedNodeId);
        if (selectedNode && selectedNode.bounds) {
            selectedBox = projectBox(selectedNode.bounds);
            if (selectedBox) {
                ctx.fillStyle = 'rgba(0, 200, 230, 0.12)';
                ctx.fillRect(selectedBox.x, selectedBox.y, selectedBox.w, selectedBox.h);
            }
        }
    }

    // 3. Query Region & Obstacle Registration
    const occupiedBoxes = [];
    if (layerQuery && layerQuery.checked && state.query && state.query.bounds) {
        const r = projectBox(state.query.bounds);
        if (r) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.09)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeRect(r.x, r.y, r.w, r.h);
            ctx.setLineDash([]);

            // Label with subtle contrast backdrop
            const qText = 'QUERY REGION';
            ctx.font = 'bold 9.5px "JetBrains Mono", Menlo, Consolas, monospace';
            const qm = ctx.measureText(qText);
            const qw = Math.ceil(qm.width);
            const qx = r.x + 8;
            const qy = r.y + 6;

            ctx.fillStyle = 'rgba(15, 20, 32, 0.92)';
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
            ctx.lineWidth = 1;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(qx - 3, qy - 2, qw + 6, 15, 2);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(qx - 3, qy - 2, qw + 6, 15);
                ctx.strokeRect(qx - 3, qy - 2, qw + 6, 15);
            }

            ctx.fillStyle = '#fbbf24';
            ctx.textBaseline = 'middle';
            ctx.fillText(qText, qx, qy + 5.5);
            ctx.textBaseline = 'alphabetic';

            // Register query region label banner as an obstacle to avoid label overlap
            occupiedBoxes.push({ id: -1, x: qx - 3, y: qy - 2, w: qw + 6, h: 15 });
        }
    }

    // 4. Active Entities (Deterministic Ordering & Collision Avoidance)
    if (Array.isArray(state.entities)) {
        const resultSet = new Set((state.query && Array.isArray(state.query.results)) ? state.query.results : []);
        ctx.setLineDash([]);

        const queryQueue = [];
        const regularQueue = [];

        // Sort entities deterministically by ID to ensure stable label placement
        const sortedEntities = [...state.entities].sort((a, b) => {
            if (typeof a.id === 'number' && typeof b.id === 'number') return a.id - b.id;
            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });

        // Step 4a: Render Non-highlighted entity geometry
        if (layerEntities && layerEntities.checked) {
            sortedEntities.forEach(e => {
                if (resultSet.has(e.id)) return;
                const r = projectBox(e.bounds);
                if (!r) return;
                const bw = Math.max(r.w, 5);
                const bh = Math.max(r.h, 5);

                ctx.fillStyle = 'rgba(16, 185, 129, 0.55)';
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 1;
                ctx.fillRect(r.x, r.y, bw, bh);
                ctx.strokeRect(r.x, r.y, bw, bh);

                occupiedBoxes.push({ id: e.id, x: r.x, y: r.y, w: bw, h: bh });
                regularQueue.push({
                    id: e.id,
                    text: String(e.id),
                    r: { x: r.x, y: r.y, w: bw, h: bh },
                    isResult: false
                });
            });
        }

        // Step 4b: Render Highlighted query result entity geometry (on top)
        if (layerResults && layerResults.checked) {
            sortedEntities.forEach(e => {
                if (!resultSet.has(e.id)) return;
                const r = projectBox(e.bounds);
                if (!r) return;
                const bw = Math.max(r.w, 6);
                const bh = Math.max(r.h, 6);

                ctx.fillStyle = 'rgba(244, 63, 94, 0.85)';
                ctx.strokeStyle = '#f43f5e';
                ctx.lineWidth = 2;
                ctx.fillRect(r.x, r.y, bw, bh);
                ctx.strokeRect(r.x, r.y, bw, bh);

                occupiedBoxes.push({ id: e.id, x: r.x, y: r.y, w: bw, h: bh });
                queryQueue.push({
                    id: e.id,
                    text: `#${e.id}`,
                    r: { x: r.x, y: r.y, w: bw, h: bh },
                    isResult: true
                });
            });
        }

        // Prioritize query results first, followed by regular active entities
        const labelQueue = [...queryQueue, ...regularQueue];

        // Step 4c: Position and render labels with collision avoidance
        const placedLabels = [];
        const overlaps = (a, b) => (
            a.x < b.x + b.w && a.x + a.w > b.x &&
            a.y < b.y + b.h && a.y + a.h > b.y
        );

        labelQueue.forEach(item => {
            // Skip computing labels for geometry completely outside the canvas bounds
            if (item.r.x + item.r.w < -20 || item.r.x > cssWidth + 20 ||
                item.r.y + item.r.h < -20 || item.r.y > cssHeight + 20) {
                return;
            }

            const font = item.isResult
                ? 'bold 10px "JetBrains Mono", Menlo, Consolas, monospace'
                : '9.5px "JetBrains Mono", Menlo, Consolas, monospace';
            ctx.font = font;

            const tm = ctx.measureText(item.text);
            const tw = Math.ceil(tm.width);
            const th = 11;
            const padX = 4;
            const padY = 2;
            const boxW = tw + padX * 2;
            const boxH = th + padY * 2;

            // 8 Candidate placement positions relative to entity box
            const candidates = [
                // 1. Right (default)
                { x: item.r.x + item.r.w + 4, y: item.r.y + (item.r.h - boxH) / 2 },
                // 2. Top / Above
                { x: item.r.x + (item.r.w - boxW) / 2, y: item.r.y - boxH - 4 },
                // 3. Below
                { x: item.r.x + (item.r.w - boxW) / 2, y: item.r.y + item.r.h + 4 },
                // 4. Left
                { x: item.r.x - boxW - 4, y: item.r.y + (item.r.h - boxH) / 2 },
                // 5. Top-Right
                { x: item.r.x + item.r.w + 4, y: item.r.y - boxH },
                // 6. Bottom-Right
                { x: item.r.x + item.r.w + 4, y: item.r.y + item.r.h },
                // 7. Top-Left
                { x: item.r.x - boxW - 4, y: item.r.y - boxH },
                // 8. Bottom-Left
                { x: item.r.x - boxW - 4, y: item.r.y + item.r.h }
            ];

            // Clamp candidates inside canvas boundaries
            candidates.forEach(c => {
                c.x = Math.max(2, Math.min(cssWidth - boxW - 2, c.x));
                c.y = Math.max(2, Math.min(cssHeight - boxH - 2, c.y));
            });

            let chosen = null;
            for (let i = 0; i < candidates.length; i++) {
                const cand = { x: candidates[i].x, y: candidates[i].y, w: boxW, h: boxH };
                const collidesEntity = occupiedBoxes.some(b => b.id !== item.id && overlaps(cand, b));
                const collidesLabel = placedLabels.some(b => overlaps(cand, b));
                if (!collidesEntity && !collidesLabel) {
                    chosen = cand;
                    break;
                }
            }

            // Fallback for dense clusters:
            if (!chosen) {
                if (item.isResult) {
                    // Query results are non-negotiable: pick candidate with minimum overlap area against placed labels
                    let bestCand = candidates[0];
                    let minOverlap = Infinity;
                    for (let i = 0; i < candidates.length; i++) {
                        const cand = { x: candidates[i].x, y: candidates[i].y, w: boxW, h: boxH };
                        let totalOverlap = 0;
                        for (let j = 0; j < placedLabels.length; j++) {
                            totalOverlap += calcOverlapArea(cand, placedLabels[j]);
                        }
                        if (totalOverlap < minOverlap) {
                            minOverlap = totalOverlap;
                            bestCand = candidates[i];
                        }
                    }
                    chosen = { x: bestCand.x, y: bestCand.y, w: boxW, h: boxH };
                } else {
                    // Regular entities: pick candidate with zero label overlap if available;
                    // otherwise gracefully omit in dense clusters to avoid visual soup
                    const nonLabelCand = candidates.find(c => !placedLabels.some(b => overlaps({ ...c, w: boxW, h: boxH }, b)));
                    if (nonLabelCand) {
                        chosen = { x: nonLabelCand.x, y: nonLabelCand.y, w: boxW, h: boxH };
                    }
                }
            }

            if (chosen) {
                placedLabels.push(chosen);

                // Subtle contrast backdrop pill
                ctx.fillStyle = item.isResult ? 'rgba(28, 10, 18, 0.94)' : 'rgba(10, 16, 28, 0.92)';
                ctx.strokeStyle = item.isResult ? 'rgba(244, 63, 94, 0.75)' : 'rgba(16, 185, 129, 0.45)';
                ctx.lineWidth = 1;

                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(chosen.x, chosen.y, chosen.w, chosen.h, 3);
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.fillRect(chosen.x, chosen.y, chosen.w, chosen.h);
                    ctx.strokeRect(chosen.x, chosen.y, chosen.w, chosen.h);
                }

                // Render label text centered in pill
                ctx.fillStyle = item.isResult ? '#ffffff' : '#86efac';
                ctx.font = font;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.text, chosen.x + padX, chosen.y + chosen.h / 2);
            }
        });

        // Restore baseline and alignment
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    // 5. Selected Hierarchy Node MBR Outline, Reticle Accents, and Identification Badge
    if (selectedBox && selectedNode) {
        ctx.save();
        // Ensure box dimensions have a clean minimum visible footprint for degenerate bounds
        const boxW = Math.max(selectedBox.w, 6);
        const boxH = Math.max(selectedBox.h, 6);
        const boxX = selectedBox.x - (boxW - selectedBox.w) / 2;
        const boxY = selectedBox.y - (boxH - selectedBox.h) / 2;

        // Outer halo / glow
        ctx.strokeStyle = 'rgba(0, 200, 230, 0.35)';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.strokeRect(boxX - 1, boxY - 1, boxW + 2, boxH + 2);

        // Primary precision cyan border
        ctx.strokeStyle = '#00c8e6';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Precision corner reticle accents
        const cornerLen = Math.min(10, Math.max(3, Math.min(boxW, boxH) / 3));
        if (cornerLen > 3) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Top-Left
            ctx.moveTo(boxX, boxY + cornerLen);
            ctx.lineTo(boxX, boxY);
            ctx.lineTo(boxX + cornerLen, boxY);
            // Top-Right
            ctx.moveTo(boxX + boxW - cornerLen, boxY);
            ctx.lineTo(boxX + boxW, boxY);
            ctx.lineTo(boxX + boxW, boxY + cornerLen);
            // Bottom-Left
            ctx.moveTo(boxX, boxY + boxH - cornerLen);
            ctx.lineTo(boxX, boxY + boxH);
            ctx.lineTo(boxX + cornerLen, boxY + boxH);
            // Bottom-Right
            ctx.moveTo(boxX + boxW - cornerLen, boxY + boxH);
            ctx.lineTo(boxX + boxW, boxY + boxH);
            ctx.lineTo(boxX + boxW, boxY + boxH - cornerLen);
            ctx.stroke();
        }

        // Selection Tag / Badge
        const typeName = selectedNode.type === 'entity' ? 'ENT' : (selectedNode.type === 'internal' ? 'DIR' : selectedNode.type.toUpperCase());
        const idName = selectedNode.type === 'entity' ? `#${selectedNode.entityId}` : selectedNode.id;
        const tagText = `${idName} • ${typeName}`;

        ctx.font = 'bold 9px "JetBrains Mono", Menlo, Consolas, monospace';
        const tm = ctx.measureText(tagText);
        const tagW = Math.ceil(tm.width) + 12;
        const tagH = 16;
        let tagX = Math.max(2, Math.min(cssWidth - tagW - 2, boxX));
        let tagY = (boxY - tagH - 3 >= 2) ? (boxY - tagH - 3) : (boxY + 3);

        ctx.fillStyle = 'rgba(6, 12, 22, 0.94)';
        ctx.strokeStyle = 'rgba(0, 200, 230, 0.75)';
        ctx.lineWidth = 1;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(tagX, tagY, tagW, tagH, 2);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(tagX, tagY, tagW, tagH);
            ctx.strokeRect(tagX, tagY, tagW, tagH);
        }

        ctx.fillStyle = '#00c8e6';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, tagX + 6, tagY + tagH / 2);
        ctx.restore();
    }

    // 6. Traversal Replay Highlights (visited nodes, pruned branches, results)
    drawTraceOverlay();

    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Update telemetry bar
    if (valEntities) valEntities.textContent = (Array.isArray(state.entities) ? state.entities.length : 0);
    if (valResults) valResults.textContent = (state.query && Array.isArray(state.query.results) ? state.query.results.length : 0);
    if (valLeaf) valLeaf.textContent = (state.rtree && Array.isArray(state.rtree.leaf_mbrs) ? state.rtree.leaf_mbrs.length : 0);
    if (valInternal) valInternal.textContent = (state.rtree && Array.isArray(state.rtree.internal_mbrs) ? state.rtree.internal_mbrs.length : 0);
}

/**
 * Attempts to fetch state.json from candidate URLs.
 */
async function fetchState() {
    setStatus('Loading state.json...', 'loading');
    let lastError = null;

    for (const url of CANDIDATE_URLS) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                handleLoadedState(data, url);
                return;
            }
        } catch (err) {
            lastError = err;
        }
    }

    const errMsg = lastError ? lastError.message : 'HTTP 404 (file not found)';
    if (!currentState) {
        setStatus(`Failed to fetch state.json (${errMsg}). Use "Upload JSON" button.`, 'error');
        if (emptyFeedback && emptyFeedbackText) {
            emptyFeedback.style.display = 'flex';
            emptyFeedback.className = 'empty-state-feedback error';
            emptyFeedbackText.textContent = `state.json not found on local server. Click "Upload JSON" or run build export.`;
        }
        if (emptyStateOverlay) emptyStateOverlay.classList.remove('is-hidden');
        if (ctx) {
            dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || dpr || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        drawBackgroundGrid();
    } else {
        const entityCount = currentState.entities ? currentState.entities.length : 0;
        const matchCount = (currentState.query && currentState.query.results) ? currentState.query.results.length : 0;
        setStatus(`Loaded ${entityCount} entities (${matchCount} matched query)`, 'success');
    }
}

const MAX_HIERARCHY_DEPTH = 100;

/**
 * Validates and normalizes R-tree hierarchy data from raw simulation state.
 *
 * Requirements & Invariants:
 * - Accepts valid hierarchy data (root, internal, leaf, entity nodes).
 * - Distinguishes a valid empty hierarchy (root is null or root leaf has 0 children) from malformed data.
 * - Distinguishes legacy files lacking hierarchy (status: 'unavailable') from corrupted hierarchy (status: 'invalid').
 * - Validates node IDs, node types, MBR shape and numeric values, child references, parent-child consistency, and entity references.
 * - Detects duplicate node IDs, dangling child references, cycles, and invalid recursive structures.
 * - Prevents malformed hierarchy data from causing infinite recursion or throwing exceptions.
 * - Does not fabricate parent-child relationships when hierarchy data is absent.
 * - Preserves map usability by providing graceful fallback statuses without breaking map layers.
 * - Is computed once upon state load, never inside the 60fps animation frame.
 *
 * @param {Object} state Simulation state object
 * @returns {Object} Normalized hierarchy descriptor
 */
function validateAndNormalizeHierarchy(state) {
    if (!state || typeof state !== 'object') {
        return {
            status: 'unavailable',
            error: null,
            message: 'State object missing or invalid',
            root: null,
            nodeMap: new Map(),
            entityNodeMap: new Map(),
            totalNodes: 0,
            internalNodes: 0,
            leafNodes: 0,
            entityNodes: 0,
            maxDepth: 0
        };
    }

    if (!state.rtree || typeof state.rtree !== 'object' || Array.isArray(state.rtree) || !('root' in state.rtree) || state.rtree.root === undefined) {
        return {
            status: 'unavailable',
            error: null,
            message: 'No hierarchy data present in dataset (legacy format)',
            root: null,
            nodeMap: new Map(),
            entityNodeMap: new Map(),
            totalNodes: 0,
            internalNodes: 0,
            leafNodes: 0,
            entityNodes: 0,
            maxDepth: 0
        };
    }

    const rawRoot = state.rtree.root;
    if (rawRoot === null) {
        return {
            status: 'empty',
            error: null,
            message: 'R-tree hierarchy is empty',
            root: null,
            nodeMap: new Map(),
            entityNodeMap: new Map(),
            totalNodes: 0,
            internalNodes: 0,
            leafNodes: 0,
            entityNodes: 0,
            maxDepth: 0
        };
    }

    if (typeof rawRoot !== 'object' || Array.isArray(rawRoot)) {
        return {
            status: 'invalid',
            error: 'Hierarchy root must be an object or null',
            root: null,
            nodeMap: new Map(),
            entityNodeMap: new Map(),
            totalNodes: 0,
            internalNodes: 0,
            leafNodes: 0,
            entityNodes: 0,
            maxDepth: 0
        };
    }

    const visitedIds = new Set();
    const ancestorIds = new Set();
    const nodeMap = new Map();
    const entityNodeMap = new Map();
    let maxDepth = 0;
    let internalCount = 0;
    let leafCount = 0;
    let entityCount = 0;

    function validateBounds(bounds, nodeId) {
        if (!Array.isArray(bounds) || bounds.length !== 4) {
            return `Node "${nodeId}" bounds must be an array of 4 numbers`;
        }
        for (let i = 0; i < 4; i++) {
            if (typeof bounds[i] !== 'number' || !Number.isFinite(bounds[i])) {
                return `Node "${nodeId}" contains non-finite coordinate at bounds[${i}]`;
            }
        }
        if (bounds[0] > bounds[2]) {
            return `Node "${nodeId}" bounds min_x (${bounds[0]}) > max_x (${bounds[2]})`;
        }
        if (bounds[1] > bounds[3]) {
            return `Node "${nodeId}" bounds min_y (${bounds[1]}) > max_y (${bounds[3]})`;
        }
        return null;
    }

    function processNode(rawNode, expectedParentId, currentDepth, isRoot) {
        if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
            return { error: `Encountered null or non-object node at depth ${currentDepth}` };
        }

        if (currentDepth > MAX_HIERARCHY_DEPTH) {
            return { error: `Hierarchy depth exceeded maximum safe limit (${MAX_HIERARCHY_DEPTH})` };
        }

        const id = rawNode.id;
        if (typeof id !== 'string' || id.trim() === '') {
            return { error: `Node at depth ${currentDepth} is missing a valid string ID` };
        }

        if (ancestorIds.has(id)) {
            return { error: `Cycle detected: node "${id}" is an ancestor of itself` };
        }

        if (visitedIds.has(id)) {
            return { error: `Duplicate node ID: "${id}" appears multiple times in tree` };
        }

        visitedIds.add(id);
        ancestorIds.add(id);

        // Check parent-child consistency
        if (isRoot) {
            if (rawNode.parent_id !== null && rawNode.parent_id !== undefined) {
                return { error: `Root node "${id}" cannot specify a non-null parent_id` };
            }
        } else {
            if (rawNode.parent_id !== undefined && rawNode.parent_id !== null && rawNode.parent_id !== expectedParentId) {
                return { error: `Parent-child inconsistency: node "${id}" has parent_id "${rawNode.parent_id}", expected "${expectedParentId}"` };
            }
        }

        // Validate type
        const type = rawNode.type;
        const validTypes = ['root', 'internal', 'leaf', 'entity'];
        if (!validTypes.includes(type)) {
            return { error: `Node "${id}" has invalid type "${type}"` };
        }

        if (isRoot && type !== 'root' && type !== 'leaf') {
            return { error: `Root node "${id}" must have type "root" or "leaf"` };
        }

        // Validate bounds
        const boundsErr = validateBounds(rawNode.bounds, id);
        if (boundsErr) return { error: boundsErr };

        // Process based on type
        if (type === 'entity') {
            const entityId = rawNode.entity_id;
            if (typeof entityId !== 'number' || !Number.isInteger(entityId) || entityId <= 0) {
                return { error: `Entity node "${id}" must have a positive integer entity_id` };
            }
            if (rawNode.children && (!Array.isArray(rawNode.children) || rawNode.children.length > 0)) {
                return { error: `Entity node "${id}" cannot contain child nodes` };
            }

            entityCount++;
            maxDepth = Math.max(maxDepth, currentDepth);

            const normalized = {
                id,
                parentId: expectedParentId,
                type: 'entity',
                isRoot: false,
                isLeaf: false,
                depth: currentDepth,
                bounds: [rawNode.bounds[0], rawNode.bounds[1], rawNode.bounds[2], rawNode.bounds[3]],
                entityId,
                children: []
            };

            nodeMap.set(id, normalized);
            entityNodeMap.set(entityId, normalized);
            ancestorIds.delete(id);
            return { node: normalized };
        }

        // Internal, leaf, or root
        const isLeaf = (type === 'leaf') || (isRoot && rawNode.is_leaf === true);
        if (isLeaf) {
            leafCount++;
        } else {
            internalCount++;
        }

        maxDepth = Math.max(maxDepth, currentDepth);

        const rawChildren = rawNode.children;
        if (!Array.isArray(rawChildren)) {
            return { error: `Node "${id}" (${type}) must have an array of children` };
        }

        // Validate children types
        const normalizedChildren = [];
        for (let i = 0; i < rawChildren.length; i++) {
            const rawChild = rawChildren[i];
            if (!rawChild || typeof rawChild !== 'object') {
                return { error: `Node "${id}" has dangling/null child reference at index ${i}` };
            }

            if (isLeaf) {
                if (rawChild.type !== 'entity') {
                    return { error: `Leaf node "${id}" cannot have non-entity child "${rawChild.id || i}" (type: ${rawChild.type})` };
                }
            } else {
                if (rawChild.type === 'entity') {
                    return { error: `Internal node "${id}" cannot directly contain entity child "${rawChild.id || i}"` };
                }
            }

            const res = processNode(rawChild, id, currentDepth + 1, false);
            if (res.error) return res;
            normalizedChildren.push(res.node);
        }

        const normalized = {
            id,
            parentId: expectedParentId,
            type: isRoot ? 'root' : (isLeaf ? 'leaf' : 'internal'),
            isRoot: !!isRoot,
            isLeaf,
            depth: currentDepth,
            bounds: [rawNode.bounds[0], rawNode.bounds[1], rawNode.bounds[2], rawNode.bounds[3]],
            entityId: null,
            children: normalizedChildren
        };

        nodeMap.set(id, normalized);
        ancestorIds.delete(id);
        return { node: normalized };
    }

    try {
        const rootResult = processNode(rawRoot, null, 0, true);
        if (rootResult.error) {
            return {
                status: 'invalid',
                error: rootResult.error,
                root: null,
                nodeMap: new Map(),
                entityNodeMap: new Map(),
                totalNodes: 0,
                internalNodes: 0,
                leafNodes: 0,
                entityNodes: 0,
                maxDepth: 0
            };
        }

        const normRoot = rootResult.node;
        const totalNodes = visitedIds.size;

        // Check if empty tree (e.g. root leaf with 0 children)
        const isEmpty = (normRoot.isLeaf && normRoot.children.length === 0);

        return {
            status: isEmpty ? 'empty' : 'valid',
            error: null,
            message: isEmpty ? 'R-tree hierarchy is empty' : 'R-tree hierarchy loaded successfully',
            root: normRoot,
            nodeMap,
            entityNodeMap,
            totalNodes,
            internalNodes: internalCount,
            leafNodes: leafCount,
            entityNodes: entityCount,
            maxDepth
        };
    } catch (err) {
        return {
            status: 'invalid',
            error: `Unexpected error during hierarchy normalization: ${err.message}`,
            root: null,
            nodeMap: new Map(),
            entityNodeMap: new Map(),
            totalNodes: 0,
            internalNodes: 0,
            leafNodes: 0,
            entityNodes: 0,
            maxDepth: 0
        };
    }
}

function getHierarchyState() {
    return currentHierarchy;
}

function getSelectedNodeId() {
    return selectedNodeId;
}

function getCollapsedNodeIds() {
    return collapsedNodeIds;
}

/**
 * Safely clears all children of a DOM element without using innerHTML.
 */
function clearElementChildren(el) {
    if (!el) return;
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

/**
 * Updates the Node Inspector detail card with attributes of the selected node.
 */
function updateNodeDetailCard(node) {
    if (!nodeDetailCard) return;

    if (!node) {
        if (nodeDetailId) nodeDetailId.textContent = '—';
        if (nodeDetailType) nodeDetailType.textContent = '—';
        if (nodeDetailDepth) nodeDetailDepth.textContent = '—';
        if (nodeDetailEntries) nodeDetailEntries.textContent = '—';
        if (nodeDetailBounds) {
            nodeDetailBounds.textContent = '—';
            nodeDetailBounds.title = '';
        }
        if (nodeDetailEntities) {
            nodeDetailEntities.textContent = '—';
            nodeDetailEntities.title = '';
        }
        if (btnClearSelection) btnClearSelection.disabled = true;
        return;
    }

    if (nodeDetailId) nodeDetailId.textContent = node.id;
    if (nodeDetailType) nodeDetailType.textContent = node.type.toUpperCase();
    if (nodeDetailDepth) nodeDetailDepth.textContent = String(node.depth);
    if (nodeDetailEntries) {
        nodeDetailEntries.textContent = node.type === 'entity' ? '0' : String(node.children ? node.children.length : 0);
    }
    if (nodeDetailBounds) {
        const b = node.bounds;
        const bStr = `[${b[0].toFixed(2)}, ${b[1].toFixed(2)}, ${b[2].toFixed(2)}, ${b[3].toFixed(2)}]`;
        nodeDetailBounds.textContent = bStr;
        nodeDetailBounds.title = bStr;
    }
    if (nodeDetailEntities) {
        if (node.type === 'entity') {
            const eStr = `#${node.entityId}`;
            nodeDetailEntities.textContent = eStr;
            nodeDetailEntities.title = `Entity ID: ${node.entityId}`;
        } else if (node.type === 'leaf' || node.isLeaf) {
            const ids = (node.children || []).map(c => '#' + c.entityId);
            const displayStr = ids.join(', ') || 'None';
            nodeDetailEntities.textContent = displayStr;
            nodeDetailEntities.title = ids.join(', ');
        } else {
            // Root or internal directory: collect all descendant entity IDs
            const ids = [];
            function collectEntities(curr) {
                if (!curr) return;
                if (curr.type === 'entity') {
                    ids.push('#' + curr.entityId);
                } else if (curr.children) {
                    for (let i = 0; i < curr.children.length; i++) {
                        collectEntities(curr.children[i]);
                    }
                }
            }
            collectEntities(node);
            const total = ids.length;
            const preview = ids.slice(0, 8).join(', ');
            const displayStr = total > 8 ? `${preview} ... (${total} total)` : (preview || 'None');
            nodeDetailEntities.textContent = displayStr;
            nodeDetailEntities.title = ids.join(', ');
        }
    }
    if (btnClearSelection) btnClearSelection.disabled = false;
}

/**
 * Selects a node in the hierarchy tree and synchronizes inspector details.
 */
function selectHierarchyNode(nodeId) {
    if (!nodeId) return;
    const hierarchy = getHierarchyState();
    if (!hierarchy || !hierarchy.nodeMap) return;

    const node = hierarchy.nodeMap.get(nodeId);
    if (!node) return;

    // Deselect previously selected row
    if (hierarchyTree) {
        const prevSelected = hierarchyTree.querySelector('.tree-node-row.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
            const parentItem = prevSelected.closest('.tree-item');
            if (parentItem) parentItem.removeAttribute('aria-selected');
        }
    }

    selectedNodeId = nodeId;

    // Apply selection in DOM
    if (hierarchyTree) {
        const safeId = hierarchyDomId(nodeId);
        const item = document.getElementById(safeId) || hierarchyTree.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
        if (item) {
            const row = item.querySelector(':scope > .tree-node-row');
            if (row) {
                row.classList.add('selected');
                item.setAttribute('aria-selected', 'true');
            }
        }
    }

    updateNodeDetailCard(node);
    requestRender();

    // A manual selection pauses an auto-advancing replay so the hierarchy
    // panel and the traversal replay do not fight over the selection.
    if (!replayDrivingSelection && replay.playing) {
        stopReplayTimer();
        updateReplayUi();
    }
}

/**
 * Clears current hierarchy node selection.
 */
function clearHierarchySelection() {
    selectedNodeId = null;
    if (hierarchyTree) {
        const prevSelected = hierarchyTree.querySelector('.tree-node-row.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
            const parentItem = prevSelected.closest('.tree-item');
            if (parentItem) parentItem.removeAttribute('aria-selected');
        }
    }
    updateNodeDetailCard(null);
    requestRender();
}

/**
 * Returns the projected screen-space bounding box { x, y, w, h }
 * for the currently selected hierarchy node, or null if no node is selected.
 */
function getSelectedNodeBox() {
    if (!selectedNodeId || !currentHierarchy || !currentHierarchy.nodeMap) return null;
    const node = currentHierarchy.nodeMap.get(selectedNodeId);
    if (!node || !node.bounds) return null;
    return projectBox(node.bounds);
}

/**
 * Toggles expand/collapse state on a tree item without re-rendering or resetting map state.
 */
function toggleNodeExpanded(treeItem) {
    if (!treeItem) return;
    const nodeId = treeItem.dataset.nodeId;
    if (!nodeId) return;

    const isCollapsed = treeItem.classList.contains('collapsed');
    const toggleBtn = treeItem.querySelector(':scope > .tree-node-row > .tree-toggle');

    if (isCollapsed) {
        treeItem.classList.remove('collapsed');
        treeItem.classList.add('expanded');
        treeItem.setAttribute('aria-expanded', 'true');
        collapsedNodeIds.delete(nodeId);
        if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Collapse ' + nodeId);
    } else {
        treeItem.classList.remove('expanded');
        treeItem.classList.add('collapsed');
        treeItem.setAttribute('aria-expanded', 'false');
        collapsedNodeIds.add(nodeId);
        if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Expand ' + nodeId);
    }
}

/**
 * Recursively creates a tree item DOM element using safe DOM APIs.
 */
function createTreeNodeElement(node) {
    const li = document.createElement('li');
    li.className = 'tree-item tree-item-' + node.type;
    li.setAttribute('role', 'treeitem');
    li.dataset.nodeId = node.id;
    li.id = hierarchyDomId(node.id);

    const row = document.createElement('div');
    row.className = 'tree-node-row';
    row.setAttribute('tabindex', '0');
    row.dataset.nodeId = node.id;
    if (selectedNodeId === node.id) {
        row.classList.add('selected');
        li.setAttribute('aria-selected', 'true');
    }

    const hasChildren = node.children && node.children.length > 0;

    if (hasChildren) {
        const isCollapsed = collapsedNodeIds.has(node.id);
        li.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        li.classList.add(isCollapsed ? 'collapsed' : 'expanded');

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'tree-toggle';
        toggleBtn.setAttribute('aria-label', (isCollapsed ? 'Expand ' : 'Collapse ') + node.id);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'tree-toggle-icon');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M6 3l5 5-5 5');
        svg.appendChild(path);
        toggleBtn.appendChild(svg);
        row.appendChild(toggleBtn);
    } else {
        const spacer = document.createElement('span');
        spacer.className = 'tree-toggle-spacer';
        if (node.type === 'entity') {
            const bullet = document.createElement('span');
            bullet.className = 'tree-leaf-bullet';
            bullet.setAttribute('aria-hidden', 'true');
            spacer.appendChild(bullet);
        }
        row.appendChild(spacer);
    }

    // Type Badge
    const badge = document.createElement('span');
    badge.className = 'tree-type-badge ' + node.type;
    badge.textContent = node.type === 'internal' ? 'DIR' : (node.type === 'entity' ? 'ENT' : node.type.toUpperCase());
    row.appendChild(badge);

    // Node ID
    const idSpan = document.createElement('span');
    idSpan.className = 'tree-node-id';
    idSpan.textContent = node.type === 'entity' ? `#${node.entityId}` : node.id;
    idSpan.title = node.id;
    row.appendChild(idSpan);

    // Node Meta
    const metaSpan = document.createElement('span');
    metaSpan.className = 'tree-node-meta';
    if (node.type === 'entity') {
        metaSpan.textContent = `[${node.bounds[0].toFixed(1)}, ${node.bounds[1].toFixed(1)}]`;
    } else {
        const count = node.children ? node.children.length : 0;
        metaSpan.textContent = `${count} ${count === 1 ? 'entry' : 'entries'}`;
    }
    row.appendChild(metaSpan);

    li.appendChild(row);

    // Children
    if (hasChildren) {
        const ul = document.createElement('ul');
        ul.className = 'tree-children';
        ul.setAttribute('role', 'group');
        for (let i = 0; i < node.children.length; i++) {
            ul.appendChild(createTreeNodeElement(node.children[i]));
        }
        li.appendChild(ul);
    }

    return li;
}

/**
 * Renders the R-tree hierarchy tree and updates inspector/empty state.
 * Never called inside the 60fps canvas render loop.
 */
function renderHierarchyTree(hierarchy) {
    if (!hierarchyTree || !hierarchyEmptyState) return;

    // Clear previously rendered tree nodes safely
    clearElementChildren(hierarchyTree);

    if (!hierarchy || hierarchy.status === 'unavailable') {
        hierarchyEmptyState.classList.remove('is-hidden');
        hierarchyEmptyState.style.display = 'flex';
        if (hierarchyEmptyTitle) hierarchyEmptyTitle.textContent = 'Hierarchy Unavailable';
        if (hierarchyEmptyDesc) {
            hierarchyEmptyDesc.textContent = 'This dataset uses a legacy format without hierarchy data. Map layers (MBRs & entities) remain fully operational.';
        }
        hierarchyTree.style.display = 'none';
        hierarchyTree.setAttribute('aria-hidden', 'true');
        if (hierarchyBadge) {
            hierarchyBadge.textContent = 'LEGACY';
            hierarchyBadge.className = 'panel-badge';
        }
        clearHierarchySelection();
        return;
    }

    if (hierarchy.status === 'invalid') {
        hierarchyEmptyState.classList.remove('is-hidden');
        hierarchyEmptyState.style.display = 'flex';
        if (hierarchyEmptyTitle) hierarchyEmptyTitle.textContent = 'Hierarchy Corrupted';
        if (hierarchyEmptyDesc) {
            hierarchyEmptyDesc.textContent = `Invalid hierarchy structure (${hierarchy.error}). Map layers remain operational.`;
        }
        hierarchyTree.style.display = 'none';
        hierarchyTree.setAttribute('aria-hidden', 'true');
        if (hierarchyBadge) {
            hierarchyBadge.textContent = 'INVALID';
            hierarchyBadge.className = 'panel-badge badge-error';
        }
        clearHierarchySelection();
        return;
    }

    if (hierarchy.status === 'empty' && !hierarchy.root) {
        hierarchyEmptyState.classList.remove('is-hidden');
        hierarchyEmptyState.style.display = 'flex';
        if (hierarchyEmptyTitle) hierarchyEmptyTitle.textContent = 'R-Tree Is Empty';
        if (hierarchyEmptyDesc) {
            hierarchyEmptyDesc.textContent = 'The spatial index currently contains no nodes or entities.';
        }
        hierarchyTree.style.display = 'none';
        hierarchyTree.setAttribute('aria-hidden', 'true');
        if (hierarchyBadge) {
            hierarchyBadge.textContent = 'EMPTY';
            hierarchyBadge.className = 'panel-badge';
        }
        clearHierarchySelection();
        return;
    }

    // Render valid hierarchy (or valid empty root leaf)
    hierarchyEmptyState.classList.add('is-hidden');
    hierarchyEmptyState.style.display = 'none';
    hierarchyTree.style.display = 'flex';
    hierarchyTree.setAttribute('aria-hidden', 'false');

    if (hierarchyBadge) {
        const count = hierarchy.totalNodes;
        hierarchyBadge.textContent = `${count} ${count === 1 ? 'NODE' : 'NODES'}`;
        hierarchyBadge.className = 'panel-badge';
    }

    if (hierarchy.root) {
        const rootElement = createTreeNodeElement(hierarchy.root);
        hierarchyTree.appendChild(rootElement);
    }

    // If previously selected node still exists in tree, re-apply selection; otherwise clear stale selection
    if (selectedNodeId && hierarchy.nodeMap && hierarchy.nodeMap.has(selectedNodeId)) {
        selectHierarchyNode(selectedNodeId);
    } else {
        clearHierarchySelection();
    }
}

/**
 * Keyboard navigation handler for hierarchy tree nodes.
 */
function handleTreeKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        clearHierarchySelection();
        return;
    }

    const row = e.target.closest('.tree-node-row');
    if (!row) return;
    const item = row.closest('.tree-item');
    if (!item) return;

    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const nodeId = row.dataset.nodeId;
        if (nodeId) selectHierarchyNode(nodeId);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const hasChildren = item.querySelector(':scope > .tree-children');
        if (hasChildren) {
            if (item.classList.contains('collapsed')) {
                toggleNodeExpanded(item);
            } else {
                const firstChildRow = item.querySelector(':scope > .tree-children > .tree-item > .tree-node-row');
                if (firstChildRow) firstChildRow.focus();
            }
        }
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const hasChildren = item.querySelector(':scope > .tree-children');
        if (hasChildren && item.classList.contains('expanded')) {
            toggleNodeExpanded(item);
        } else {
            const parentItem = item.parentElement && item.parentElement.closest('.tree-item');
            if (parentItem) {
                const parentRow = parentItem.querySelector(':scope > .tree-node-row');
                if (parentRow) parentRow.focus();
            }
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hierarchyTree) {
            const allVisibleRows = Array.from(hierarchyTree.querySelectorAll('.tree-node-row')).filter(r => r.offsetParent !== null);
            const idx = allVisibleRows.indexOf(row);
            if (idx >= 0 && idx < allVisibleRows.length - 1) {
                allVisibleRows[idx + 1].focus();
            }
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (hierarchyTree) {
            const allVisibleRows = Array.from(hierarchyTree.querySelectorAll('.tree-node-row')).filter(r => r.offsetParent !== null);
            const idx = allVisibleRows.indexOf(row);
            if (idx > 0) {
                allVisibleRows[idx - 1].focus();
            }
        }
    }
}

function handleLoadedState(state, source = 'file') {
    if (!state || typeof state !== 'object') {
        setStatus('Invalid JSON schema received.', 'error');
        if (emptyFeedback && emptyFeedbackText && !currentState) {
            emptyFeedback.style.display = 'flex';
            emptyFeedback.className = 'empty-state-feedback error';
            emptyFeedbackText.textContent = 'Invalid State Format: JSON root is not an object.';
        }
        currentHierarchy = null;
        clearHierarchySelection();
        renderHierarchyTree(null);
        installTraceForState(null);
        return;
    }

    currentState = state;

    // Validate and normalize hierarchy once per state load (never inside 60fps render loop)
    currentHierarchy = validateAndNormalizeHierarchy(state);
    state.rtreeHierarchy = currentHierarchy;

    // Check if previously selected node still exists in newly loaded hierarchy; clear stale selection safely
    const prevSelectedId = selectedNodeId;
    if (prevSelectedId && currentHierarchy && currentHierarchy.nodeMap && currentHierarchy.nodeMap.has(prevSelectedId)) {
        selectedNodeId = prevSelectedId;
    } else {
        selectedNodeId = null;
    }

    collapsedNodeIds.clear();
    renderHierarchyTree(currentHierarchy);

    // The recorded traversal belongs to this scene and this query. Any trace
    // held for the previous scene is discarded before the new one is
    // installed, so a stale trace can never be replayed.
    installTraceForState(state);

    if (emptyStateOverlay) emptyStateOverlay.classList.add('is-hidden');
    if (emptyFeedback) emptyFeedback.style.display = 'none';

    const entityCount = Array.isArray(state.entities) ? state.entities.length : 0;
    const matchCount = (state.query && Array.isArray(state.query.results)) ? state.query.results.length : 0;

    let hierMsg = '';
    if (currentHierarchy.status === 'valid') {
        hierMsg = ` | Tree: ${currentHierarchy.totalNodes} nodes (depth ${currentHierarchy.maxDepth})`;
    } else if (currentHierarchy.status === 'empty') {
        hierMsg = ' | Tree: empty';
    } else if (currentHierarchy.status === 'unavailable') {
        hierMsg = ' | Tree: unavailable';
    } else if (currentHierarchy.status === 'invalid') {
        hierMsg = ` | Tree: invalid (${currentHierarchy.error})`;
        console.warn(`[KESTREL Hierarchy] ${currentHierarchy.error}`);
    }

    setStatus(`Loaded ${entityCount} entities (${matchCount} matched query)${hierMsg} from ${source}`, 'success');
    if (missionClock) {
        const treeTag = currentHierarchy.status === 'valid'
            ? ` | TREE: ${currentHierarchy.totalNodes} NODES`
            : (currentHierarchy.status === 'invalid' ? ' | TREE: INVALID' : '');
        missionClock.textContent = `SYNC: OK (${entityCount} ENTITIES${treeTag})`;
    }

    fitAll(true);
    drawState(currentState);
}

function loadJsonFile(file) {
    if (!file) return;

    const isJson = file.name.toLowerCase().endsWith('.json') || (file.type && file.type === 'application/json');
    if (!isJson) {
        setStatus('Rejected: only .json spatial files are supported', 'error');
        if (emptyFeedback && emptyFeedbackText && !currentState) {
            emptyFeedback.style.display = 'flex';
            emptyFeedback.className = 'empty-state-feedback error';
            emptyFeedbackText.textContent = `Rejected non-JSON file (${file.name}). Please provide a .json dataset.`;
        }
        return;
    }

    setStatus(`Loading ${file.name}...`, 'loading');
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            handleLoadedState(data, file.name);
        } catch (err) {
            setStatus(`JSON parse error: ${err.message}`, 'error');
            if (emptyFeedback && emptyFeedbackText && !currentState) {
                emptyFeedback.style.display = 'flex';
                emptyFeedback.className = 'empty-state-feedback error';
                emptyFeedbackText.textContent = `JSON parse error: ${err.message}`;
            }
        }
    };
    reader.onerror = () => {
        setStatus('Failed to read selected file', 'error');
    };
    reader.readAsText(file);
}

// Setup Event Listeners if DOM environment is present
if (typeof document !== 'undefined') {
    const triggerBrowse = () => {
        if (fileInput) fileInput.click();
    };

    if (btnLoad) btnLoad.addEventListener('click', fetchState);
    if (btnBrowse) btnBrowse.addEventListener('click', triggerBrowse);
    if (btnEmptyLoad) btnEmptyLoad.addEventListener('click', fetchState);
    if (btnEmptyBrowse) btnEmptyBrowse.addEventListener('click', triggerBrowse);

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            loadJsonFile(file);
        });
    }

    // Drag-and-drop support on viewport frame / canvas for file loading
    const dropTarget = viewportFrame || canvas;
    if (dropTarget) {
        let dragCounter = 0;

        dropTarget.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (viewportFrame) viewportFrame.classList.add('drag-over');
        });

        dropTarget.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        });

        dropTarget.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                if (viewportFrame) viewportFrame.classList.remove('drag-over');
            }
        });

        dropTarget.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            if (viewportFrame) viewportFrame.classList.remove('drag-over');

            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            loadJsonFile(file);
        });
    }

    if (canvas) {
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            viewport.isPanning = true;
            viewport.panStartX = e.clientX;
            viewport.panStartY = e.clientY;
            activePointerId = e.pointerId;
            hasActiveCapture = false;
            canvas.classList.add('panning');
            try {
                canvas.setPointerCapture(e.pointerId);
                hasActiveCapture = canvas.hasPointerCapture ? canvas.hasPointerCapture(e.pointerId) : true;
            } catch (_) {
                hasActiveCapture = false;
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            if (viewport.isPanning) {
                if (typeof e.buttons === 'number' && (e.buttons & 1) === 0) {
                    endPan(e);
                    return;
                }
                const dx = e.clientX - viewport.panStartX;
                const dy = e.clientY - viewport.panStartY;
                viewport.panStartX = e.clientX;
                viewport.panStartY = e.clientY;
                viewport.tx += dx;
                viewport.ty += dy;
                requestRender();
            }

            if (valCoords && isFinite(sx) && isFinite(sy)) {
                const w = screenToWorld(sx, sy);
                if (isFinite(w.x) && isFinite(w.y)) {
                    const coordStr = `X: ${w.x.toFixed(1)}, Y: ${w.y.toFixed(1)}`;
                    if (valCoords.textContent !== coordStr) {
                        valCoords.textContent = coordStr;
                    }
                }
            }
        });

        canvas.addEventListener('pointerup', endPan);
        canvas.addEventListener('pointercancel', endPan);
        canvas.addEventListener('lostpointercapture', endPan);

        canvas.addEventListener('pointerleave', (e) => {
            if (!viewport.isPanning && valCoords) {
                valCoords.textContent = '—';
            } else if (viewport.isPanning && !hasActiveCapture) {
                // If pointer capture is not holding, leaving the canvas terminates the pan
                endPan(e);
                if (valCoords) valCoords.textContent = '—';
            }
        });

        // Global fallback listeners registered ONCE to catch pointer release/cancel outside canvas
        window.addEventListener('pointerup', endPan);
        window.addEventListener('pointercancel', endPan);

        // Cursor-centered mouse-wheel zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
            zoomAt(sx, sy, factor);
        }, { passive: false });
    }

    // Viewport Navigation Buttons
    if (btnZoomIn) btnZoomIn.addEventListener('click', zoomIn);
    if (btnZoomOut) btnZoomOut.addEventListener('click', zoomOut);
    if (btnFitAll) btnFitAll.addEventListener('click', () => fitAll(false));
    if (btnResetView) btnResetView.addEventListener('click', resetView);

    // Traversal Replay Transport Controls
    if (btnTraceStart) {
        btnTraceStart.addEventListener('click', () => {
            if (!replay.trace) return;
            stopReplayTimer();
            setReplayIndex(0);
            startReplayPlayback();
        });
    }
    if (btnTracePrev) {
        btnTracePrev.addEventListener('click', () => {
            if (!replay.trace) return;
            stopReplayTimer();
            setReplayIndex(replay.index - 1);
        });
    }
    if (btnTraceNext) {
        btnTraceNext.addEventListener('click', () => {
            if (!replay.trace) return;
            stopReplayTimer();
            setReplayIndex(replay.index + 1);
        });
    }
    if (btnTracePlay) {
        btnTracePlay.addEventListener('click', () => {
            startReplayPlayback();
        });
    }
    if (btnTracePause) {
        btnTracePause.addEventListener('click', () => {
            stopReplayTimer();
            updateReplayUi();
        });
    }
    if (btnTraceRestart) {
        btnTraceRestart.addEventListener('click', () => {
            if (!replay.trace) return;
            stopReplayTimer();
            setReplayIndex(0);
        });
    }
    if (btnTraceClear) {
        btnTraceClear.addEventListener('click', () => {
            clearReplayTrace();
        });
    }

    // Reliable Keyboard Shortcuts (F, R, +, -, Space pan mode, Arrow Keys)
    function isEditable(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    let isSpaceHeld = false;

    window.addEventListener('keydown', (e) => {
        if (isEditable(e.target) || isEditable(document.activeElement)) return;
        if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.hierarchy-dock')) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            if (!isSpaceHeld) {
                isSpaceHeld = true;
                if (canvas) canvas.classList.add('space-pan-active');
            }
            return;
        }

        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            fitAll(false);
        } else if (e.key === 'r' || e.key === '0') {
            e.preventDefault();
            resetView();
        } else if (e.key === 'R') {
            // Shift+R restarts the traversal replay.
            if (!replay.trace) return;
            e.preventDefault();
            stopReplayTimer();
            setReplayIndex(0);
        } else if (e.key === 'n' || e.key === 'N') {
            // Next recorded traversal event.
            if (!replay.trace) return;
            e.preventDefault();
            stopReplayTimer();
            setReplayIndex(replay.index + 1);
        } else if (e.key === 'b' || e.key === 'B') {
            // Previous recorded traversal event.
            if (!replay.trace) return;
            e.preventDefault();
            stopReplayTimer();
            setReplayIndex(replay.index - 1);
        } else if (e.key === 'p' || e.key === 'P') {
            // Toggle auto-advance of the traversal replay.
            if (!replay.trace) return;
            e.preventDefault();
            if (replay.playing) {
                stopReplayTimer();
                updateReplayUi();
            } else {
                startReplayPlayback();
            }
        } else if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            zoomIn();
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            zoomOut();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            viewport.tx += 40;
            requestRender();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            viewport.tx -= 40;
            requestRender();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            viewport.ty += 40;
            requestRender();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            viewport.ty -= 40;
            requestRender();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' || e.key === ' ') {
            isSpaceHeld = false;
            if (canvas) canvas.classList.remove('space-pan-active');
        }
    });

    window.addEventListener('blur', () => {
        isSpaceHeld = false;
        if (canvas) canvas.classList.remove('space-pan-active');
        endPan();
    });

    // Layer toggle handlers — preserves existing viewport
    [layerEntities, layerResults, layerLeaf, layerInternal, layerQuery].forEach(cb => {
        if (cb) {
            cb.addEventListener('change', () => {
                if (currentState) requestRender();
            });
        }
    });

    // R-Tree Hierarchy Tree interaction events
    if (hierarchyTree) {
        hierarchyTree.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.tree-toggle');
            if (toggleBtn) {
                e.stopPropagation();
                const treeItem = toggleBtn.closest('.tree-item');
                if (treeItem) toggleNodeExpanded(treeItem);
                return;
            }
            const nodeRow = e.target.closest('.tree-node-row');
            if (nodeRow) {
                const nodeId = nodeRow.dataset.nodeId;
                if (nodeId) selectHierarchyNode(nodeId);
            }
        });

        hierarchyTree.addEventListener('keydown', handleTreeKeydown);
    }

    if (btnClearSelection) {
        btnClearSelection.addEventListener('click', clearHierarchySelection);
    }

    // Window and container resizing
    window.addEventListener('resize', resizeCanvas);
    if (typeof ResizeObserver !== 'undefined' && canvas) {
        const ro = new ResizeObserver(() => {
            resizeCanvas();
        });
        ro.observe(canvas.parentElement || canvas);
    }

    // Dynamic DPR / browser zoom change listener
    let dprMediaQuery = null;
    const onDprChange = () => {
        setupDprListener();
        resizeCanvas();
    };
    function setupDprListener() {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        if (dprMediaQuery) {
            if (dprMediaQuery.removeEventListener) {
                dprMediaQuery.removeEventListener('change', onDprChange);
            } else if (dprMediaQuery.removeListener) {
                dprMediaQuery.removeListener(onDprChange);
            }
        }
        const curDpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        dprMediaQuery = window.matchMedia(`(resolution: ${curDpr}dppx)`);
        if (dprMediaQuery.addEventListener) {
            dprMediaQuery.addEventListener('change', onDprChange);
        } else if (dprMediaQuery.addListener) {
            dprMediaQuery.addListener(onDprChange);
        }
    }
    setupDprListener();

    // Initial startup
    const startApp = () => {
        resizeCanvas();
        updateReplayUi();
        fetchState();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp, { once: true });
    } else {
        startApp();
    }
}

if (typeof window !== 'undefined') {
    window.resizeCanvas = resizeCanvas;
    window.fitAll = fitAll;
    window.resetView = resetView;
    window.drawBackgroundGrid = drawBackgroundGrid;
    window.drawState = drawState;
    window.endPan = endPan;
    window.validateAndNormalizeHierarchy = validateAndNormalizeHierarchy;
    window.getHierarchyState = getHierarchyState;
    window.renderHierarchyTree = renderHierarchyTree;
    window.selectHierarchyNode = selectHierarchyNode;
    window.clearHierarchySelection = clearHierarchySelection;
    window.toggleNodeExpanded = toggleNodeExpanded;
    window.updateNodeDetailCard = updateNodeDetailCard;
    window.getSelectedNodeId = getSelectedNodeId;
    window.getSelectedNodeBox = getSelectedNodeBox;
    window.getCollapsedNodeIds = getCollapsedNodeIds;
    window.hierarchyDomId = hierarchyDomId;
    window.getReplayState = getReplayState;
    window.extractTrace = extractTrace;
    window.describeTraceEvent = describeTraceEvent;
    window.isValidTraceEvent = isValidTraceEvent;
    window.traceAcceptedIds = traceAcceptedIds;
    window.boundsEqual = boundsEqual;
    window.setReplayIndex = setReplayIndex;
    window.stopReplayTimer = stopReplayTimer;
    window.startReplayPlayback = startReplayPlayback;
    window.installTraceForState = installTraceForState;
    window.clearReplayTrace = clearReplayTrace;
    window.resolveTraceFocusNode = resolveTraceFocusNode;
    window.focusHierarchyNode = focusHierarchyNode;
}

// Module exports for unit testing in Node/CommonJS environments if present
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        viewport,
        worldToScreen,
        screenToWorld,
        projectBox,
        computeFitTransform,
        zoomAt,
        fitAll,
        resetView,
        resizeCanvas,
        drawBackgroundGrid,
        drawState,
        endPan,
        calcOverlapArea,
        validateAndNormalizeHierarchy,
        getHierarchyState,
        handleLoadedState,
        renderHierarchyTree,
        selectHierarchyNode,
        clearHierarchySelection,
        toggleNodeExpanded,
        updateNodeDetailCard,
        getSelectedNodeId,
        getSelectedNodeBox,
        getCollapsedNodeIds,
        hierarchyDomId,
        getReplayState,
        extractTrace,
        describeTraceEvent,
        isValidTraceEvent,
        traceAcceptedIds,
        boundsEqual,
        setReplayIndex,
        stopReplayTimer,
        startReplayPlayback,
        installTraceForState,
        clearReplayTrace,
        resolveTraceFocusNode,
        focusHierarchyNode
    };
}
