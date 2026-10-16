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

let currentState = null;
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

    if (state && state.entities) state.entities.forEach(e => expand(e.bounds));
    if (state && state.rtree) {
        (state.rtree.internal_mbrs || []).forEach(expand);
        (state.rtree.leaf_mbrs || []).forEach(expand);
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
 */
function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.floor(rect.width) || 800;
    const h = Math.floor(rect.height) || 600;

    dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const bufferW = Math.round(w * dpr);
    const bufferH = Math.round(h * dpr);

    if (canvas.width !== bufferW || canvas.height !== bufferH) {
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

        if (currentState) {
            if (wasInitial) {
                fitAll(true);
            }
            drawState(currentState);
        } else {
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

function drawMessageScreen(title, subtitle, note = '') {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackgroundGrid();

    const cx = cssWidth / 2;
    const cy = cssHeight / 2;

    // Tactical Radar Calibration Reticle (Empty State Instrument Display)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.arc(cx, cy, 75, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
    ctx.beginPath();
    ctx.moveTo(cx - 160, cy);
    ctx.lineTo(cx + 160, cy);
    ctx.moveTo(cx, cy - 90);
    ctx.lineTo(cx, cy + 90);
    ctx.stroke();

    // Backdrop for Message Text
    ctx.fillStyle = 'rgba(5, 8, 15, 0.88)';
    ctx.fillRect(cx - 240, cy - 48, 480, 96);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.strokeRect(cx - 240, cy - 48, 480, 96);

    ctx.textAlign = 'center';
    ctx.font = '700 13px "JetBrains Mono", Menlo, Consolas, monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(title.toUpperCase(), cx, cy - 18);

    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(subtitle, cx, cy + 6);

    if (note) {
        ctx.font = '11px "JetBrains Mono", Menlo, Consolas, monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(note, cx, cy + 28);
    }
    ctx.restore();
}

function calcOverlapArea(a, b) {
    const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return xOverlap * yOverlap;
}

function drawState(state) {
    if (!ctx) return;

    if (!state) {
        if (emptyStateOverlay) emptyStateOverlay.classList.remove('is-hidden');
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBackgroundGrid();
        ctx.restore();
        return;
    }

    if (emptyStateOverlay) emptyStateOverlay.classList.add('is-hidden');

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBackgroundGrid();

    // 1. Internal MBRs (Level 1+) - Supporting directory hierarchy boundaries
    if (layerInternal && layerInternal.checked && state.rtree && state.rtree.internal_mbrs) {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.65)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        state.rtree.internal_mbrs.forEach(b => {
            const r = projectBox(b);
            if (r) ctx.strokeRect(r.x, r.y, r.w, r.h);
        });
    }

    // 2. Leaf MBRs (Level 0)
    if (layerLeaf && layerLeaf.checked && state.rtree && state.rtree.leaf_mbrs) {
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
    if (state.entities) {
        const resultSet = new Set((state.query && state.query.results) || []);
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

    ctx.restore();

    // Update telemetry bar
    if (valEntities) valEntities.textContent = (state.entities ? state.entities.length : 0);
    if (valResults) valResults.textContent = (state.query && state.query.results ? state.query.results.length : 0);
    if (valLeaf) valLeaf.textContent = (state.rtree && state.rtree.leaf_mbrs ? state.rtree.leaf_mbrs.length : 0);
    if (valInternal) valInternal.textContent = (state.rtree && state.rtree.internal_mbrs ? state.rtree.internal_mbrs.length : 0);
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
        drawBackgroundGrid();
    } else {
        const entityCount = currentState.entities ? currentState.entities.length : 0;
        const matchCount = (currentState.query && currentState.query.results) ? currentState.query.results.length : 0;
        setStatus(`Loaded ${entityCount} entities (${matchCount} matched query)`, 'success');
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
        return;
    }

    currentState = state;
    if (emptyStateOverlay) emptyStateOverlay.classList.add('is-hidden');
    if (emptyFeedback) emptyFeedback.style.display = 'none';

    const entityCount = state.entities ? state.entities.length : 0;
    const matchCount = (state.query && state.query.results) ? state.query.results.length : 0;

    setStatus(`Loaded ${entityCount} entities (${matchCount} matched query) from ${source}`, 'success');
    if (missionClock) missionClock.textContent = `SYNC: OK (${entityCount} ENTITIES)`;

    fitAll(true);
    drawState(currentState);
}

// Setup Event Listeners if DOM environment is present
if (typeof document !== 'undefined') {
    if (btnLoad) btnLoad.addEventListener('click', fetchState);
    if (btnBrowse && fileInput) btnBrowse.addEventListener('click', () => fileInput.click());
    if (btnEmptyLoad) btnEmptyLoad.addEventListener('click', fetchState);
    if (btnEmptyBrowse && fileInput) btnEmptyBrowse.addEventListener('click', () => fileInput.click());

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
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
            if (!file) return;

            // Restrained validation: only accept .json files
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
        });
    }

    if (canvas) {
        // Pointer event navigation (drag-to-pan)
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            viewport.isPanning = true;
            viewport.panStartX = e.clientX;
            viewport.panStartY = e.clientY;
            canvas.classList.add('panning');
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch (_) {}
        });

        canvas.addEventListener('pointermove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            if (viewport.isPanning) {
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

        const endPan = (e) => {
            if (viewport.isPanning) {
                viewport.isPanning = false;
                canvas.classList.remove('panning');
                try {
                    canvas.releasePointerCapture(e.pointerId);
                } catch (_) {}
            }
        };

        canvas.addEventListener('pointerup', endPan);
        canvas.addEventListener('pointercancel', endPan);

        canvas.addEventListener('pointerleave', () => {
            if (!viewport.isPanning && valCoords) {
                valCoords.textContent = '—';
            }
        });

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

    // Reliable Keyboard Shortcuts (F, R, +, -, Space pan mode, Arrow Keys)
    function isEditable(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    let isSpaceHeld = false;

    window.addEventListener('keydown', (e) => {
        if (isEditable(e.target) || isEditable(document.activeElement)) return;
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
        } else if (e.key === 'r' || e.key === 'R' || e.key === '0') {
            e.preventDefault();
            resetView();
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
    });

    // Layer toggle handlers — preserves existing viewport
    [layerEntities, layerResults, layerLeaf, layerInternal, layerQuery].forEach(cb => {
        if (cb) {
            cb.addEventListener('change', () => {
                if (currentState) requestRender();
            });
        }
    });

    // Window and container resizing
    window.addEventListener('resize', resizeCanvas);
    if (typeof ResizeObserver !== 'undefined' && canvas) {
        const ro = new ResizeObserver(() => {
            resizeCanvas();
        });
        ro.observe(canvas.parentElement || canvas);
    }

    // Initial startup
    const startApp = () => {
        resizeCanvas();
        fetchState();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp, { once: true });
    } else {
        startApp();
    }
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
        calcOverlapArea
    };
}
