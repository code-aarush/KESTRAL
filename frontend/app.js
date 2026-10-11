/**
 * KESTREL Mission Control Visualization (GATE-10)
 * Decoupled static Canvas frontend reading C++ R-tree JSON state.
 */

const canvas = document.getElementById('radar');
const ctx = canvas.getContext('2d');
const statusSpan = document.getElementById('status');
const statusDot = document.getElementById('statusDot');
const missionClock = document.getElementById('missionClock');

const btnLoad = document.getElementById('btnLoad');
const btnBrowse = document.getElementById('btnBrowse');
const fileInput = document.getElementById('fileInput');

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

let currentState = null;

// Candidate URLs for resolving state.json across different local server roots
const CANDIDATE_URLS = [
    '../build/state.json',
    './state.json',
    '/build/state.json',
    'build/state.json',
    '../state.json',
    '/state.json',
    'state.json'
];

function setStatus(text, type = 'normal') {
    statusSpan.textContent = text;
    statusDot.className = 'status-dot';
    if (type === 'success') statusDot.classList.add('success');
    else if (type === 'loading') statusDot.classList.add('loading');
    else if (type === 'error') statusDot.classList.add('error');
}

/**
 * Computes an aspect-ratio-preserving affine transform mapping world coordinates
 * into canvas coordinates with padding.
 */
function computeTransform(state) {
    const pad = 40;
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

    if (state.entities) state.entities.forEach(e => expand(e.bounds));
    if (state.rtree) {
        (state.rtree.internal_mbrs || []).forEach(expand);
        (state.rtree.leaf_mbrs || []).forEach(expand);
    }
    if (state.query && state.query.bounds) expand(state.query.bounds);

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        return { scale: 1, tx: canvas.width / 2, ty: canvas.height / 2, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const dataW = Math.max(maxX - minX, 1);
    const dataH = Math.max(maxY - minY, 1);
    const sx = (canvas.width - 2 * pad) / dataW;
    const sy = (canvas.height - 2 * pad) / dataH;
    const scale = Math.min(sx, sy);
    const tx = pad - minX * scale + ((canvas.width - 2 * pad) - dataW * scale) / 2;
    const ty = pad - minY * scale + ((canvas.height - 2 * pad) - dataH * scale) / 2;

    return { scale, tx, ty, minX, minY, maxX, maxY };
}

function projectBox(b, t) {
    if (!Array.isArray(b) || b.length < 4) return { x: 0, y: 0, w: 0, h: 0 };
    const x1 = Math.min(b[0], b[2]);
    const x2 = Math.max(b[0], b[2]);
    const y1 = Math.min(b[1], b[3]);
    const y2 = Math.max(b[1], b[3]);
    const x = x1 * t.scale + t.tx;
    const y = y1 * t.scale + t.ty;
    const w = (x2 - x1) * t.scale;
    const h = (y2 - y1) * t.scale;
    return { x, y, w, h };
}

function drawBackgroundGrid() {
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle coordinate grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    const step = 80;
    for (let x = 0; x <= canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawMessageScreen(title, subtitle, note = '') {
    drawBackgroundGrid();
    ctx.save();
    ctx.textAlign = 'center';

    // Title
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = '#f0f4fc';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 25);

    // Subtitle
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillStyle = '#9ab0d3';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 5);

    // Note / instruction
    if (note) {
        ctx.font = '12px monospace';
        ctx.fillStyle = '#5e7399';
        ctx.fillText(note, canvas.width / 2, canvas.height / 2 + 35);
    }
    ctx.restore();
}

function drawState(state) {
    if (!state) {
        drawMessageScreen('No Simulation State Loaded', 'Click "Load state.json" or use "Upload JSON".');
        return;
    }

    drawBackgroundGrid();
    const t = computeTransform(state);

    // 1. Draw Internal MBRs (Level 1+)
    if (layerInternal.checked && state.rtree && state.rtree.internal_mbrs) {
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        state.rtree.internal_mbrs.forEach(b => {
            const r = projectBox(b, t);
            ctx.strokeRect(r.x, r.y, r.w, r.h);
        });
    }

    // 2. Draw Leaf MBRs (Level 0)
    if (layerLeaf.checked && state.rtree && state.rtree.leaf_mbrs) {
        ctx.strokeStyle = '#e040fb';
        ctx.fillStyle = 'rgba(224, 64, 251, 0.04)';
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
        state.rtree.leaf_mbrs.forEach(b => {
            const r = projectBox(b, t);
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeRect(r.x, r.y, r.w, r.h);
        });
    }

    // 3. Draw Query Region
    if (layerQuery.checked && state.query && state.query.bounds) {
        const r = projectBox(state.query.bounds, t);
        ctx.fillStyle = 'rgba(255, 214, 0, 0.15)';
        ctx.strokeStyle = '#ffd600';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeRect(r.x, r.y, r.w, r.h);

        // Label
        ctx.fillStyle = '#ffd600';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('QUERY REGION', r.x + 6, r.y + 14);
    }

    // 4. Draw Active Entities
    if (state.entities) {
        const resultSet = new Set((state.query && state.query.results) || []);
        ctx.setLineDash([]);

        // Pass 1: Non-highlighted active entities
        if (layerEntities.checked) {
            state.entities.forEach(e => {
                if (resultSet.has(e.id)) return; // Drawn in pass 2
                const r = projectBox(e.bounds, t);
                const bw = Math.max(r.w, 5);
                const bh = Math.max(r.h, 5);

                ctx.fillStyle = 'rgba(0, 230, 118, 0.55)';
                ctx.strokeStyle = '#00e676';
                ctx.lineWidth = 1;
                ctx.fillRect(r.x, r.y, bw, bh);
                ctx.strokeRect(r.x, r.y, bw, bh);

                ctx.fillStyle = '#c8f7d4';
                ctx.font = '10px monospace';
                ctx.fillText(e.id, r.x + bw + 3, r.y + bh / 2 + 3);
            });
        }

        // Pass 2: Highlighted query result entities (rendered on top)
        if (layerResults.checked) {
            state.entities.forEach(e => {
                if (!resultSet.has(e.id)) return;
                const r = projectBox(e.bounds, t);
                const bw = Math.max(r.w, 6);
                const bh = Math.max(r.h, 6);

                ctx.fillStyle = 'rgba(255, 23, 68, 0.85)';
                ctx.strokeStyle = '#ff1744';
                ctx.lineWidth = 2;
                ctx.fillRect(r.x, r.y, bw, bh);
                ctx.strokeRect(r.x, r.y, bw, bh);

                // Highlighted badge
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px monospace';
                ctx.fillText(`★ #${e.id}`, r.x + bw + 3, r.y + bh / 2 + 4);
            });
        }
    }

    // Update telemetry bar
    valEntities.textContent = (state.entities ? state.entities.length : 0);
    valResults.textContent = (state.query && state.query.results ? state.query.results.length : 0);
    valLeaf.textContent = (state.rtree && state.rtree.leaf_mbrs ? state.rtree.leaf_mbrs.length : 0);
    valInternal.textContent = (state.rtree && state.rtree.internal_mbrs ? state.rtree.internal_mbrs.length : 0);
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

    // All failed
    const errMsg = lastError ? lastError.message : 'HTTP 404 (file not found)';
    setStatus(`Failed to fetch state.json (${errMsg}). Use "Upload JSON" button.`, 'error');
    drawMessageScreen(
        'state.json Not Found',
        'Could not fetch state.json from local server.',
        'Run: ./build/src/kestrel_export or click "Upload JSON" to choose the file.'
    );
}

function handleLoadedState(state, source = 'file') {
    if (!state || typeof state !== 'object') {
        setStatus('Invalid JSON schema received.', 'error');
        drawMessageScreen('Invalid State Format', 'JSON root is not an object.');
        return;
    }

    currentState = state;
    const entityCount = state.entities ? state.entities.length : 0;
    const matchCount = (state.query && state.query.results) ? state.query.results.length : 0;

    setStatus(`Loaded ${entityCount} entities (${matchCount} matched query) from ${source}`, 'success');
    missionClock.textContent = `SYNC: OK (${entityCount} ENTITIES)`;
    drawState(state);
}

// Event Listeners
btnLoad.addEventListener('click', fetchState);

btnBrowse.addEventListener('click', () => fileInput.click());

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
            drawMessageScreen('JSON Parse Error', err.message);
        }
    };
    reader.onerror = () => {
        setStatus('Failed to read selected file', 'error');
    };
    reader.readAsText(file);
});

// Drag and drop support on canvas
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    canvas.style.borderColor = '#00b0ff';
});

canvas.addEventListener('dragleave', () => {
    canvas.style.borderColor = '#24344d';
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.style.borderColor = '#24344d';
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
        setStatus(`Loading ${file.name}...`, 'loading');
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                handleLoadedState(data, file.name);
            } catch (err) {
                setStatus(`JSON parse error: ${err.message}`, 'error');
                drawMessageScreen('JSON Parse Error', err.message);
            }
        };
        reader.readAsText(file);
    }
});

// Layer toggle handlers
[layerEntities, layerResults, layerLeaf, layerInternal, layerQuery].forEach(cb => {
    cb.addEventListener('change', () => {
        if (currentState) drawState(currentState);
    });
});

// Initial startup: automatic load attempt
document.addEventListener('DOMContentLoaded', () => {
    fetchState();
});

// Also trigger immediately if already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    fetchState();
}
