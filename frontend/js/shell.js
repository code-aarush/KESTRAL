/**
 * KESTREL Workspace Shell Controller (GATE-05 Dockable Mission Workbench)
 *
 * Manages:
 * 1. Layers Popover (preserved from Gate-03).
 * 2. Instrument Manager (Registration, Launcher Rail synchronization, active badges).
 * 3. Docking, Floating, Snapping, Resizing, and Z-Order elevation.
 * 4. Persistent Query HUD capsule reactivity.
 * 5. Traversal Mission Deck bottom dock controls (minimize, float, close).
 * 6. Layout preference persistence in localStorage ('kestrel_workbench_layout_v1').
 * 7. Keyboard shortcuts (Alt+T, Alt+N, Alt+Q, Alt+R, Alt+M, Alt+L).
 */

(function initMissionWorkbench() {
    'use strict';

    const STORAGE_KEY = 'kestrel_workbench_layout_v1';
    const SNAP_THRESHOLD = 60; // Snapping distance in px
    let currentZIndex = 500;

    function setup() {
        // --- 1. Layers Popover (Preserved Gate-03 Contract) ---
        const popoverContainer = document.getElementById('layerPopover');
        const triggerBtn = document.getElementById('btnLayersToggle');
        const badge = document.getElementById('layerBadge');
        const layerInputs = [
            document.getElementById('layerEntities'),
            document.getElementById('layerResults'),
            document.getElementById('layerLeaf'),
            document.getElementById('layerInternal'),
            document.getElementById('layerQuery')
        ].filter(Boolean);

        function updateLayerBadge() {
            if (!badge) return;
            const total = layerInputs.length;
            const active = layerInputs.filter(input => input.checked).length;
            badge.textContent = `${active}/${total}`;
        }

        if (triggerBtn && popoverContainer) {
            triggerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = popoverContainer.classList.toggle('is-open');
                triggerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });

            document.addEventListener('click', (e) => {
                if (popoverContainer.classList.contains('is-open') && !popoverContainer.contains(e.target)) {
                    popoverContainer.classList.remove('is-open');
                    triggerBtn.setAttribute('aria-expanded', 'false');
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && popoverContainer.classList.contains('is-open')) {
                    popoverContainer.classList.remove('is-open');
                    triggerBtn.setAttribute('aria-expanded', 'false');
                    triggerBtn.focus();
                }
            });
        }

        layerInputs.forEach(input => {
            input.addEventListener('change', updateLayerBadge);
        });
        updateLayerBadge();

        // --- 2. Elements & Workbench Infrastructure ---
        const workstationBody = document.getElementById('workstationBody') || document.body;
        const viewportFrame = document.getElementById('viewportFrame') || document.querySelector('.canvas-viewport-frame');
        const dockBayRight = document.getElementById('dockBayRight');
        const dockMissionBottom = document.getElementById('dockMissionBottom');
        const dockGhostPreview = document.getElementById('dockGhostPreview');
        const queryHudStrip = document.getElementById('queryHudStrip');
        const queryBadge = document.getElementById('queryBadge');

        // Rail buttons
        const railBtnTree = document.getElementById('railBtnTree');
        const railBtnNode = document.getElementById('railBtnNode');
        const railBtnQuery = document.getElementById('railBtnQuery');
        const railBtnTrace = document.getElementById('railBtnTrace');
        const railBtnTelemetry = document.getElementById('railBtnTelemetry');
        const railBtnLayers = document.getElementById('railBtnLayers');
        const railBtnResetLayout = document.getElementById('railBtnResetLayout');

        // Window & Dock controls
        const btnCollapseRight = document.getElementById('btnCollapseRight');
        const btnFloatRightBay = document.getElementById('btnFloatRightBay');
        const btnFloatTrace = document.getElementById('btnFloatTrace');
        const btnMinTrace = document.getElementById('btnMinTrace');
        const btnCloseTrace = document.getElementById('btnCloseTrace');
        const btnFloatNode = document.getElementById('btnFloatNode');
        const btnFloatHierarchy = document.getElementById('btnFloatHierarchy');

        // Dynamic badges
        const railTreeBadge = document.getElementById('railTreeBadge');
        const railTraceBadge = document.getElementById('railTraceBadge');
        const hierarchyBadge = document.getElementById('hierarchyBadge');
        const traceBadge = document.getElementById('traceBadge');

        // --- 3. Layout State Store & 6-Section Instrument Bay Model (GATE-A) ---
        const SECTION_TITLES = {
            node: 'NODE INSPECTOR',
            query: 'QUERY PERFORMANCE',
            catalog: 'SPATIAL CATALOG',
            topology: 'R-TREE TOPOLOGY',
            specs: 'SPECIFICATIONS',
            tree: 'R-TREE HIERARCHY'
        };

        const SECTION_PANELS = {
            node: document.getElementById('secNodeInspector'),
            query: document.getElementById('secQueryPerformance'),
            catalog: document.getElementById('secSpatialCatalog'),
            topology: document.getElementById('secRtreeTopology'),
            specs: document.getElementById('secSpecifications'),
            tree: document.getElementById('secHierarchy')
        };

        const SECTION_TABS = {
            node: document.getElementById('btnBayNode'),
            query: document.getElementById('btnBayQuery'),
            catalog: document.getElementById('btnBayCatalog'),
            topology: document.getElementById('btnBayTopology'),
            specs: document.getElementById('btnBaySpecs'),
            tree: document.getElementById('btnBayTree')
        };

        const RAIL_MAP = {
            node: railBtnNode,
            query: railBtnQuery,
            specs: railBtnTelemetry,
            tree: railBtnTree
        };

        let layoutState = {
            version: 2,
            toolbarHeight: 42,
            dockBayWidth: 340,
            dockBottomHeight: 180,
            rightBayCollapsed: false,
            bottomDockClosed: false,
            bottomDockMinimized: false,
            activeBaySection: 'node', // Default section: Node Inspector
            instruments: {
                nodeDetailCard: { isFloating: false, x: 500, y: 80, width: 340, height: 220, isClosed: false },
                hierarchyDock: { isFloating: false, x: 500, y: 320, width: 340, height: 320, isClosed: false },
                traversalDeck: { isFloating: false, x: 120, y: 400, width: 620, height: 200, isClosed: false },
                telemetryRegion: { isFloating: false, x: 500, y: 150, width: 320, height: 360, isClosed: false }
            }
        };

        let canvasResizeRaf = null;
        function notifyCanvasResize() {
            if (canvasResizeRaf) cancelAnimationFrame(canvasResizeRaf);
            canvasResizeRaf = requestAnimationFrame(() => {
                if (typeof window.resizeCanvas === 'function') {
                    window.resizeCanvas();
                } else if (window.app && typeof window.app.resizeCanvas === 'function') {
                    window.app.resizeCanvas();
                } else {
                    window.dispatchEvent(new Event('resize'));
                }
            });
        }

        function setToolbarHeight(h, persist = true) {
            const clamped = Math.max(34, Math.min(80, Math.round(h)));
            layoutState.toolbarHeight = clamped;
            document.documentElement.style.setProperty('--toolbar-height', `${clamped}px`);
            const splitHeader = document.getElementById('splitHeaderHorizontal');
            if (splitHeader) splitHeader.setAttribute('aria-valuenow', clamped);
            if (persist) debouncedSaveLayout();
        }

        function setDockBayWidth(w, persist = true) {
            const minW = 300;
            const maxW = Math.max(300, window.innerWidth - 300 - 60);
            const clamped = Math.max(minW, Math.min(maxW, Math.round(w)));
            layoutState.dockBayWidth = clamped;
            document.documentElement.style.setProperty('--dock-bay-width', `${clamped}px`);
            const splitMain = document.getElementById('splitMainVertical');
            if (splitMain) splitMain.setAttribute('aria-valuenow', clamped);
            notifyCanvasResize();
            if (persist) debouncedSaveLayout();
        }

        function setDockBottomHeight(h, persist = true) {
            const minH = 170;
            const maxH = Math.max(170, Math.round(window.innerHeight * 0.45));
            const clamped = Math.max(minH, Math.min(maxH, Math.round(h)));
            layoutState.dockBottomHeight = clamped;
            document.documentElement.style.setProperty('--dock-bottom-height', `${clamped}px`);
            const splitTraversal = document.getElementById('splitTraversalHorizontal');
            if (splitTraversal) splitTraversal.setAttribute('aria-valuenow', clamped);
            notifyCanvasResize();
            if (persist) debouncedSaveLayout();
        }

        function setActiveBaySection(sectionKey) {
            if (!SECTION_PANELS[sectionKey]) return;
            layoutState.activeBaySection = sectionKey;

            // Single presentation owner: if this instrument is currently floating, redock it
            if (sectionKey === 'node') {
                const nodeCard = document.getElementById('nodeDetailCard');
                if (nodeCard && nodeCard.classList.contains('is-floating')) {
                    dockInstrument(nodeCard, 'nodeDetailCard', 'right');
                }
            } else if (sectionKey === 'tree') {
                const hierarchy = document.getElementById('hierarchyDock');
                if (hierarchy && hierarchy.classList.contains('is-floating')) {
                    dockInstrument(hierarchy, 'hierarchyDock', 'right');
                }
            } else if (sectionKey === 'specs') {
                const telem = document.getElementById('telemetryRegion');
                if (telem && telem.classList.contains('is-floating')) {
                    dockInstrument(telem, 'telemetryRegion', 'right');
                }
            }

            // 1. Update bay tab buttons
            Object.entries(SECTION_TABS).forEach(([key, btn]) => {
                if (btn) {
                    const isSelected = key === sectionKey;
                    btn.classList.toggle('is-active', isSelected);
                    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                }
            });

            // 2. Update rail button highlights
            Object.entries(RAIL_MAP).forEach(([key, btn]) => {
                if (btn) {
                    btn.classList.toggle('is-active', key === sectionKey);
                }
            });

            // 3. Update active section heading
            const bayActiveTitle = document.getElementById('bayActiveTitle');
            if (bayActiveTitle) {
                bayActiveTitle.textContent = SECTION_TITLES[sectionKey] || 'INSTRUMENT';
            }

            // 4. Update panel visibility: EXACTLY ONE ACTIVE, OTHERS CONSUME ZERO SPACE
            Object.entries(SECTION_PANELS).forEach(([key, panel]) => {
                if (panel) {
                    const isSelected = key === sectionKey;
                    panel.classList.toggle('is-active', isSelected);
                    panel.classList.toggle('is-hidden', !isSelected);
                    if (isSelected) {
                        panel.removeAttribute('aria-hidden');
                    } else {
                        panel.setAttribute('aria-hidden', 'true');
                    }
                }
            });

            // 5. Expand right bay if it was collapsed
            if (layoutState.rightBayCollapsed) {
                setRightBayCollapsed(false);
            }

            debouncedSaveLayout();
        }

        function saveLayoutState() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutState));
            } catch (err) {
                // Storage failure ignored safely
            }
        }

        let saveTimeout = null;
        function debouncedSaveLayout() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveLayoutState, 200);
        }

        function loadLayoutState() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        if (typeof parsed.toolbarHeight === 'number') {
                            setToolbarHeight(parsed.toolbarHeight, false);
                        }
                        if (typeof parsed.dockBayWidth === 'number') {
                            setDockBayWidth(parsed.dockBayWidth, false);
                        }
                        if (typeof parsed.dockBottomHeight === 'number') {
                            setDockBottomHeight(parsed.dockBottomHeight, false);
                        }
                        if (typeof parsed.rightBayCollapsed === 'boolean') layoutState.rightBayCollapsed = parsed.rightBayCollapsed;
                        if (typeof parsed.bottomDockClosed === 'boolean') layoutState.bottomDockClosed = parsed.bottomDockClosed;
                        if (typeof parsed.bottomDockMinimized === 'boolean') layoutState.bottomDockMinimized = parsed.bottomDockMinimized;
                        if (typeof parsed.activeBaySection === 'string' && SECTION_PANELS[parsed.activeBaySection]) {
                            layoutState.activeBaySection = parsed.activeBaySection;
                        }
                        if (parsed.instruments && typeof parsed.instruments === 'object') {
                            for (const id in parsed.instruments) {
                                if (layoutState.instruments[id]) {
                                    const item = layoutState.instruments[id];
                                    const saved = parsed.instruments[id];
                                    if (typeof saved.isFloating === 'boolean') item.isFloating = saved.isFloating;
                                    if (typeof saved.isClosed === 'boolean') item.isClosed = saved.isClosed;
                                    if (typeof saved.width === 'number') item.width = Math.max(260, Math.min(800, saved.width));
                                    if (typeof saved.height === 'number') item.height = Math.max(180, Math.min(600, saved.height));
                                    if (typeof saved.x === 'number') item.x = Math.max(44, Math.min(window.innerWidth - 100, saved.x));
                                    if (typeof saved.y === 'number') item.y = Math.max(38, Math.min(window.innerHeight - 60, saved.y));
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                // Malformed state fallback
            }
        }

        // --- 4. Dock Bay & Mission Bottom Management ---
        function setRightBayCollapsed(collapsed) {
            layoutState.rightBayCollapsed = collapsed;
            if (dockBayRight) {
                dockBayRight.classList.toggle('is-collapsed', collapsed);
            }
            if (btnCollapseRight) {
                btnCollapseRight.title = collapsed ? "Expand Instrument Bay" : "Collapse Instrument Bay";
                btnCollapseRight.style.transform = collapsed ? "rotate(180deg)" : "none";
            }
            debouncedSaveLayout();
        }

        if (btnCollapseRight) {
            btnCollapseRight.addEventListener('click', () => {
                setRightBayCollapsed(!layoutState.rightBayCollapsed);
            });
        }

        function setBottomDockClosed(closed) {
            layoutState.bottomDockClosed = closed;
            if (dockMissionBottom) {
                dockMissionBottom.classList.toggle('is-closed', closed);
            }
            if (railBtnTrace) {
                railBtnTrace.classList.toggle('is-active', !closed);
            }
            debouncedSaveLayout();
        }

        function setBottomDockMinimized(minimized) {
            layoutState.bottomDockMinimized = minimized;
            if (dockMissionBottom) {
                dockMissionBottom.classList.toggle('is-minimized', minimized);
            }
            if (btnMinTrace) {
                btnMinTrace.title = minimized ? "Restore Traversal Deck" : "Minimize dock";
            }
            debouncedSaveLayout();
        }

        if (btnMinTrace) {
            btnMinTrace.addEventListener('click', () => {
                setBottomDockMinimized(!layoutState.bottomDockMinimized);
            });
        }

        if (btnCloseTrace) {
            btnCloseTrace.addEventListener('click', () => {
                setBottomDockClosed(true);
            });
        }

        // --- 5. Floating Windows & Drag / 8-Direction Resize Mechanics ---
        const SNAP_THRESHOLD = 60;

        function bringToFront(elem) {
            currentZIndex = Math.min(899, currentZIndex + 1);
            elem.style.zIndex = currentZIndex;
            document.querySelectorAll('.floating-instrument, .is-floating').forEach(el => el.classList.remove('is-focused'));
            elem.classList.add('is-focused');
        }

        const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

        function attach8DirectionResizeHandles(elem, instId) {
            elem.querySelectorAll('.win-resize-handle, .window-resize-handle').forEach(h => h.remove());

            RESIZE_DIRECTIONS.forEach(dir => {
                const handle = document.createElement('div');
                const isSe = dir === 'se';
                handle.className = `win-resize-handle ${isSe ? 'window-resize-handle' : ''} win-resize-${dir}`.replace(/\s+/g, ' ').trim();
                handle.dataset.direction = dir;
                handle.title = `Drag to resize (${dir.toUpperCase()})`;
                elem.appendChild(handle);

                let isResizing = false;
                let startX = 0, startY = 0;
                let startLeft = 0, startTop = 0, startW = 0, startH = 0;

                handle.addEventListener('pointerdown', (e) => {
                    isResizing = true;
                    handle.setPointerCapture(e.pointerId);
                    startX = e.clientX;
                    startY = e.clientY;
                    startLeft = elem.offsetLeft;
                    startTop = elem.offsetTop;
                    startW = elem.offsetWidth;
                    startH = elem.offsetHeight;
                    document.body.classList.add('is-resizing');
                    bringToFront(elem);
                    e.stopPropagation();
                    e.preventDefault();
                });

                handle.addEventListener('pointermove', (e) => {
                    if (!isResizing) return;
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;

                    let newW = startW;
                    let newH = startH;
                    let newLeft = startLeft;
                    let newTop = startTop;

                    const minW = 260;
                    const minH = 180;

                    // East / West
                    if (dir.includes('e')) {
                        newW = Math.max(minW, Math.min(window.innerWidth - startLeft - 10, startW + dx));
                    } else if (dir.includes('w')) {
                        const maxDx = startW - minW;
                        const clampedDx = Math.min(maxDx, Math.max(-startLeft + 44, dx));
                        newW = startW - clampedDx;
                        newLeft = startLeft + clampedDx;
                    }

                    // North / South
                    if (dir.includes('s')) {
                        newH = Math.max(minH, Math.min(window.innerHeight - startTop - 20, startH + dy));
                    } else if (dir.includes('n')) {
                        const maxDy = startH - minH;
                        const clampedDy = Math.min(maxDy, Math.max(-startTop + 34, dy));
                        newH = startH - clampedDy;
                        newTop = startTop + clampedDy;
                    }

                    elem.style.width = `${Math.round(newW)}px`;
                    elem.style.height = `${Math.round(newH)}px`;
                    elem.style.left = `${Math.round(newLeft)}px`;
                    elem.style.top = `${Math.round(newTop)}px`;
                });

                const endResize = (e) => {
                    if (!isResizing) return;
                    isResizing = false;
                    document.body.classList.remove('is-resizing');
                    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
                    const inst = layoutState.instruments[instId];
                    if (inst) {
                        inst.x = elem.offsetLeft;
                        inst.y = elem.offsetTop;
                        inst.width = elem.offsetWidth;
                        inst.height = elem.offsetHeight;
                        saveLayoutState();
                    }
                };

                handle.addEventListener('pointerup', endResize);
                handle.addEventListener('pointercancel', endResize);
            });
        }

        function makeFloating(elem, instId, initX, initY, initW, initH) {
            const inst = layoutState.instruments[instId] || {};
            inst.isFloating = true;
            layoutState.instruments[instId] = inst;

            if (workstationBody && elem.parentElement !== workstationBody) {
                workstationBody.appendChild(elem);
            }

            elem.classList.add('is-floating');
            elem.classList.add('floating-instrument');

            const x = initX ?? inst.x ?? 300;
            const y = initY ?? inst.y ?? 100;
            const w = Math.max(260, initW ?? inst.width ?? 340);
            const h = Math.max(180, initH ?? inst.height ?? 240);

            elem.style.position = 'absolute';
            elem.style.left = `${Math.max(44, Math.min(window.innerWidth - w - 20, x))}px`;
            elem.style.top = `${Math.max(44, Math.min(window.innerHeight - h - 20, y))}px`;
            elem.style.width = `${w}px`;
            elem.style.height = `${h}px`;

            bringToFront(elem);

            attach8DirectionResizeHandles(elem, instId);
            attachDragHandler(elem, instId);

            // Single presentation owner: if popping out the active bay section, select another section
            if (instId === 'nodeDetailCard' && layoutState.activeBaySection === 'node') {
                setActiveBaySection('tree');
            } else if (instId === 'hierarchyDock' && layoutState.activeBaySection === 'tree') {
                setActiveBaySection('node');
            }

            debouncedSaveLayout();
        }

        function dockInstrument(elem, instId, targetDock) {
            const inst = layoutState.instruments[instId] || {};
            inst.isFloating = false;
            layoutState.instruments[instId] = inst;

            elem.classList.remove('is-floating', 'floating-instrument', 'is-focused');
            elem.style.position = '';
            elem.style.left = '';
            elem.style.top = '';
            elem.style.width = '';
            elem.style.height = '';
            elem.style.zIndex = '';

            elem.querySelectorAll('.win-resize-handle, .window-resize-handle').forEach(h => h.remove());

            if (targetDock === 'bottom' && dockMissionBottom) {
                const traversalDeck = document.getElementById('traversalDeck');
                if (traversalDeck && !dockMissionBottom.contains(traversalDeck)) {
                    dockMissionBottom.appendChild(traversalDeck);
                }
                setBottomDockClosed(false);
            } else if (dockBayRight) {
                if (instId === 'nodeDetailCard') {
                    const target = document.getElementById('secNodeInspector') || dockBayRight;
                    if (!target.contains(elem)) target.appendChild(elem);
                    setActiveBaySection('node');
                } else if (instId === 'hierarchyDock') {
                    const target = document.getElementById('secHierarchy') || dockBayRight;
                    if (!target.contains(elem)) target.appendChild(elem);
                    setActiveBaySection('tree');
                } else {
                    const lower = document.getElementById('sidebarLowerDeck') || dockBayRight;
                    if (!lower.contains(elem)) lower.appendChild(elem);
                }
                setRightBayCollapsed(false);
            }

            debouncedSaveLayout();
        }

        function attachDragHandler(elem, instId) {
            const handle = elem.querySelector('.instrument-header') || elem.querySelector('.panel-header') || elem.querySelector('.panel-drag-handle') || elem;
            if (!handle || handle.dataset.dragAttached === 'true') return;
            handle.dataset.dragAttached = 'true';

            let isDragging = false;
            let startX = 0, startY = 0;
            let origLeft = 0, origTop = 0;

            handle.addEventListener('pointerdown', (e) => {
                if (e.target.closest('button, input, select, textarea, a, .btn-icon, .btn-window-ctrl')) return;
                bringToFront(elem);

                // If currently docked, detach and start dragging
                if (!elem.classList.contains('is-floating')) {
                    const rect = elem.getBoundingClientRect();
                    makeFloating(elem, instId, rect.left, rect.top, rect.width, rect.height);
                }

                isDragging = true;
                handle.setPointerCapture(e.pointerId);
                startX = e.clientX;
                startY = e.clientY;
                origLeft = parseInt(elem.style.left, 10) || elem.offsetLeft;
                origTop = parseInt(elem.style.top, 10) || elem.offsetTop;
                e.preventDefault();
            });

            handle.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const newLeft = Math.max(44, Math.min(window.innerWidth - elem.offsetWidth - 10, origLeft + dx));
                const newTop = Math.max(34, Math.min(window.innerHeight - 30, origTop + dy));

                elem.style.left = `${newLeft}px`;
                elem.style.top = `${newTop}px`;

                // Snapping threshold check (~60px)
                const isNearRightEdge = (window.innerWidth - e.clientX) <= SNAP_THRESHOLD;
                const isNearBottomEdge = (window.innerHeight - e.clientY) <= SNAP_THRESHOLD;

                if (isNearRightEdge && dockGhostPreview) {
                    dockGhostPreview.style.top = '48px';
                    dockGhostPreview.style.right = '8px';
                    dockGhostPreview.style.bottom = '8px';
                    dockGhostPreview.style.left = '';
                    dockGhostPreview.style.width = `${layoutState.dockBayWidth || 340}px`;
                    dockGhostPreview.style.height = '';
                    dockGhostPreview.classList.add('is-active');
                } else if (isNearBottomEdge && dockGhostPreview) {
                    dockGhostPreview.style.top = '';
                    dockGhostPreview.style.right = `${(layoutState.dockBayWidth || 340) + 16}px`;
                    dockGhostPreview.style.bottom = '8px';
                    dockGhostPreview.style.left = '52px';
                    dockGhostPreview.style.width = '';
                    dockGhostPreview.style.height = `${layoutState.dockBottomHeight || 180}px`;
                    dockGhostPreview.classList.add('is-active');
                } else if (dockGhostPreview) {
                    dockGhostPreview.classList.remove('is-active');
                }
            });

            const endDrag = (e) => {
                if (!isDragging) return;
                isDragging = false;
                try { handle.releasePointerCapture(e.pointerId); } catch (_) {}

                if (dockGhostPreview && dockGhostPreview.classList.contains('is-active')) {
                    dockGhostPreview.classList.remove('is-active');
                    const isNearRightEdge = (window.innerWidth - e.clientX) <= SNAP_THRESHOLD;
                    const isNearBottomEdge = (window.innerHeight - e.clientY) <= SNAP_THRESHOLD;

                    if (isNearRightEdge) {
                        dockInstrument(elem, instId, 'right');
                    } else if (isNearBottomEdge) {
                        dockInstrument(elem, instId, 'bottom');
                    }
                } else {
                    const inst = layoutState.instruments[instId];
                    if (inst) {
                        inst.x = parseInt(elem.style.left, 10);
                        inst.y = parseInt(elem.style.top, 10);
                        saveLayoutState();
                    }
                }
            };

            handle.addEventListener('pointerup', endDrag);
            handle.addEventListener('pointercancel', endDrag);
        }

        // --- 6. Macro Splitter Infrastructure (GATE-B) ---
        function initSplitters() {
            // 1. Header Splitter (Horizontal)
            const splitHeader = document.getElementById('splitHeaderHorizontal');
            if (splitHeader) {
                let startY = 0, startH = 0, dragging = false;
                splitHeader.addEventListener('pointerdown', (e) => {
                    dragging = true;
                    splitHeader.setPointerCapture(e.pointerId);
                    startY = e.clientY;
                    startH = layoutState.toolbarHeight || 42;
                    document.body.classList.add('is-resizing');
                    splitHeader.classList.add('is-active');
                    e.preventDefault();
                });
                splitHeader.addEventListener('pointermove', (e) => {
                    if (!dragging) return;
                    const dy = e.clientY - startY;
                    setToolbarHeight(startH + dy, false);
                });
                const endHeader = (e) => {
                    if (!dragging) return;
                    dragging = false;
                    document.body.classList.remove('is-resizing');
                    splitHeader.classList.remove('is-active');
                    try { splitHeader.releasePointerCapture(e.pointerId); } catch (_) {}
                    saveLayoutState();
                };
                splitHeader.addEventListener('pointerup', endHeader);
                splitHeader.addEventListener('pointercancel', endHeader);
                splitHeader.addEventListener('keydown', (e) => {
                    const step = e.shiftKey ? 10 : 4;
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setToolbarHeight(layoutState.toolbarHeight + step);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setToolbarHeight(layoutState.toolbarHeight - step);
                    }
                });
            }

            // 2. Main Vertical Splitter (Canvas / Bay)
            const splitMain = document.getElementById('splitMainVertical');
            if (splitMain) {
                let startX = 0, startW = 0, dragging = false;
                splitMain.addEventListener('pointerdown', (e) => {
                    dragging = true;
                    splitMain.setPointerCapture(e.pointerId);
                    startX = e.clientX;
                    startW = layoutState.dockBayWidth || 340;
                    document.body.classList.add('is-resizing');
                    splitMain.classList.add('is-active');
                    e.preventDefault();
                });
                splitMain.addEventListener('pointermove', (e) => {
                    if (!dragging) return;
                    const dx = startX - e.clientX;
                    setDockBayWidth(startW + dx, false);
                });
                const endMain = (e) => {
                    if (!dragging) return;
                    dragging = false;
                    document.body.classList.remove('is-resizing');
                    splitMain.classList.remove('is-active');
                    try { splitMain.releasePointerCapture(e.pointerId); } catch (_) {}
                    saveLayoutState();
                };
                splitMain.addEventListener('pointerup', endMain);
                splitMain.addEventListener('pointercancel', endMain);
                splitMain.addEventListener('keydown', (e) => {
                    const step = e.shiftKey ? 50 : 10;
                    if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        setDockBayWidth(layoutState.dockBayWidth + step);
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        setDockBayWidth(layoutState.dockBayWidth - step);
                    }
                });
            }

            // 3. Traversal Horizontal Splitter (Bottom Mission Dock)
            const splitTraversal = document.getElementById('splitTraversalHorizontal');
            if (splitTraversal) {
                let startY = 0, startH = 0, dragging = false;
                splitTraversal.addEventListener('pointerdown', (e) => {
                    dragging = true;
                    splitTraversal.setPointerCapture(e.pointerId);
                    startY = e.clientY;
                    startH = layoutState.dockBottomHeight || 180;
                    document.body.classList.add('is-resizing');
                    splitTraversal.classList.add('is-active');
                    e.preventDefault();
                });
                splitTraversal.addEventListener('pointermove', (e) => {
                    if (!dragging) return;
                    const dy = startY - e.clientY;
                    setDockBottomHeight(startH + dy, false);
                });
                const endTraversal = (e) => {
                    if (!dragging) return;
                    dragging = false;
                    document.body.classList.remove('is-resizing');
                    splitTraversal.classList.remove('is-active');
                    try { splitTraversal.releasePointerCapture(e.pointerId); } catch (_) {}
                    saveLayoutState();
                };
                splitTraversal.addEventListener('pointerup', endTraversal);
                splitTraversal.addEventListener('pointercancel', endTraversal);
                splitTraversal.addEventListener('keydown', (e) => {
                    const step = e.shiftKey ? 50 : 10;
                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setDockBottomHeight(layoutState.dockBottomHeight + step);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setDockBottomHeight(layoutState.dockBottomHeight - step);
                    }
                });
            }
        }

        // --- 7. Instrument Controls Wire-Up ---
        if (btnFloatTrace) {
            btnFloatTrace.addEventListener('click', () => {
                const deck = document.getElementById('traversalDeck');
                if (!deck) return;
                if (deck.classList.contains('is-floating')) {
                    dockInstrument(deck, 'traversalDeck', 'bottom');
                } else {
                    const rect = deck.getBoundingClientRect();
                    makeFloating(deck, 'traversalDeck', Math.max(60, rect.left), Math.max(60, rect.top - 100), 620, 200);
                }
            });
        }

        if (btnFloatNode) {
            btnFloatNode.addEventListener('click', () => {
                const nodeCard = document.getElementById('nodeDetailCard');
                if (!nodeCard) return;
                if (nodeCard.classList.contains('is-floating')) {
                    dockInstrument(nodeCard, 'nodeDetailCard', 'right');
                } else {
                    const rect = nodeCard.getBoundingClientRect();
                    makeFloating(nodeCard, 'nodeDetailCard', rect.left - 40, rect.top, 340, 220);
                }
            });
        }

        if (btnFloatHierarchy) {
            btnFloatHierarchy.addEventListener('click', () => {
                const hierarchy = document.getElementById('hierarchyDock');
                if (!hierarchy) return;
                if (hierarchy.classList.contains('is-floating')) {
                    dockInstrument(hierarchy, 'hierarchyDock', 'right');
                } else {
                    const rect = hierarchy.getBoundingClientRect();
                    makeFloating(hierarchy, 'hierarchyDock', rect.left - 40, rect.top, 340, 360);
                }
            });
        }

        if (btnFloatRightBay) {
            btnFloatRightBay.addEventListener('click', () => {
                const nodeCard = document.getElementById('nodeDetailCard');
                const hierarchy = document.getElementById('hierarchyDock');
                if (nodeCard) makeFloating(nodeCard, 'nodeDetailCard', window.innerWidth - 380, 60, 340, 220);
                if (hierarchy) makeFloating(hierarchy, 'hierarchyDock', window.innerWidth - 380, 300, 340, 360);
                setRightBayCollapsed(true);
            });
        }

        // Attach drag listeners to all instrument headers initially
        const instruments = [
            { id: 'nodeDetailCard', elem: document.getElementById('nodeDetailCard') },
            { id: 'hierarchyDock', elem: document.getElementById('hierarchyDock') },
            { id: 'traversalDeck', elem: document.getElementById('traversalDeck') },
            { id: 'telemetryRegion', elem: document.getElementById('telemetryRegion') }
        ];

        instruments.forEach(({ id, elem }) => {
            if (elem) attachDragHandler(elem, id);
        });

        // --- 8. Instrument Bay Section Tabs & Launcher Rail Wire-Up (GATE-A & GATE-B) ---
        Object.entries(SECTION_TABS).forEach(([key, btn]) => {
            if (btn) {
                btn.addEventListener('click', () => {
                    setActiveBaySection(key);
                });
            }
        });

        // Left Launcher Rail Handlers (single presentation owner)
        if (railBtnTree) {
            railBtnTree.addEventListener('click', () => {
                const hierarchy = document.getElementById('hierarchyDock');
                if (hierarchy && hierarchy.classList.contains('is-floating')) {
                    dockInstrument(hierarchy, 'hierarchyDock', 'right');
                }
                setActiveBaySection('tree');
            });
        }

        if (railBtnNode) {
            railBtnNode.addEventListener('click', () => {
                const nodeCard = document.getElementById('nodeDetailCard');
                if (nodeCard && nodeCard.classList.contains('is-floating')) {
                    dockInstrument(nodeCard, 'nodeDetailCard', 'right');
                }
                setActiveBaySection('node');
            });
        }

        if (railBtnQuery) {
            railBtnQuery.addEventListener('click', () => {
                setActiveBaySection('query');
            });
        }

        if (railBtnTrace) {
            railBtnTrace.addEventListener('click', () => {
                const deck = document.getElementById('traversalDeck');
                if (deck && deck.classList.contains('is-floating')) {
                    dockInstrument(deck, 'traversalDeck', 'bottom');
                }
                const isCurrentlyClosed = dockMissionBottom && dockMissionBottom.classList.contains('is-closed');
                const isCurrentlyMinimized = dockMissionBottom && dockMissionBottom.classList.contains('is-minimized');
                if (isCurrentlyClosed || isCurrentlyMinimized) {
                    setBottomDockClosed(false);
                    setBottomDockMinimized(false);
                } else {
                    setBottomDockClosed(true);
                }
            });
        }

        if (railBtnTelemetry) {
            railBtnTelemetry.addEventListener('click', () => {
                const telem = document.getElementById('telemetryRegion');
                if (telem && telem.classList.contains('is-floating')) {
                    dockInstrument(telem, 'telemetryRegion', 'right');
                }
                setActiveBaySection('specs');
            });
        }

        if (railBtnLayers && triggerBtn) {
            railBtnLayers.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerBtn.click();
            });
        }

        if (railBtnResetLayout) {
            railBtnResetLayout.addEventListener('click', () => {
                // 1. Cancel any pending debounced save
                clearTimeout(saveTimeout);

                // 2. Clear stored layout preferences
                try {
                    localStorage.removeItem(STORAGE_KEY);
                } catch (err) {}

                // 3. Reset in-memory layout state to defaults
                layoutState.toolbarHeight = 42;
                layoutState.dockBayWidth = 340;
                layoutState.dockBottomHeight = 180;
                layoutState.rightBayCollapsed = false;
                layoutState.bottomDockClosed = false;
                layoutState.bottomDockMinimized = false;
                layoutState.activeBaySection = 'node';

                // 4. Remove custom CSS properties
                document.documentElement.style.removeProperty('--toolbar-height');
                document.documentElement.style.removeProperty('--dock-bay-width');
                document.documentElement.style.removeProperty('--dock-bottom-height');

                // 5. Redock all floating instruments cleanly
                instruments.forEach(({ id, elem }) => {
                    if (elem && elem.classList.contains('is-floating')) {
                        elem.classList.remove('is-floating', 'floating-instrument', 'is-focused');
                        elem.style.position = '';
                        elem.style.left = '';
                        elem.style.top = '';
                        elem.style.width = '';
                        elem.style.height = '';
                        elem.style.zIndex = '';
                        elem.querySelectorAll('.win-resize-handle').forEach(h => h.remove());

                        if (id === 'traversalDeck' && dockMissionBottom) {
                            dockMissionBottom.appendChild(elem);
                        } else if (dockBayRight) {
                            if (id === 'nodeDetailCard') {
                                const target = document.getElementById('secNodeInspector') || dockBayRight;
                                target.appendChild(elem);
                            } else if (id === 'hierarchyDock') {
                                const target = document.getElementById('secHierarchy') || dockBayRight;
                                target.appendChild(elem);
                            } else {
                                const lower = document.getElementById('sidebarLowerDeck') || dockBayRight;
                                lower.appendChild(elem);
                            }
                        }
                        if (layoutState.instruments[id]) {
                            layoutState.instruments[id].isFloating = false;
                        }
                    }
                });

                // 6. Uncollapse bays
                if (dockBayRight) dockBayRight.classList.remove('is-collapsed');
                if (dockMissionBottom) dockMissionBottom.classList.remove('is-closed', 'is-minimized');
                if (btnCollapseRight) {
                    btnCollapseRight.title = "Collapse Instrument Bay";
                    btnCollapseRight.style.transform = "none";
                }
                if (btnMinTrace) {
                    btnMinTrace.title = "Minimize dock";
                }
                if (railBtnTrace) {
                    railBtnTrace.classList.add('is-active');
                }

                // 7. Reset active section in bay: Node Inspector
                Object.entries(SECTION_TABS).forEach(([key, btn]) => {
                    if (btn) {
                        const isSelected = key === 'node';
                        btn.classList.toggle('is-active', isSelected);
                        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                    }
                });
                Object.entries(RAIL_MAP).forEach(([key, btn]) => {
                    if (btn) {
                        btn.classList.toggle('is-active', key === 'node');
                    }
                });
                const bayActiveTitle = document.getElementById('bayActiveTitle');
                if (bayActiveTitle) bayActiveTitle.textContent = SECTION_TITLES['node'];
                Object.entries(SECTION_PANELS).forEach(([key, panel]) => {
                    if (panel) {
                        const isSelected = key === 'node';
                        panel.classList.toggle('is-active', isSelected);
                        panel.classList.toggle('is-hidden', !isSelected);
                        if (isSelected) panel.removeAttribute('aria-hidden');
                        else panel.setAttribute('aria-hidden', 'true');
                    }
                });

                notifyCanvasResize();

                // Crucial: Clear timeout again so no debounced save triggers from DOM events
                clearTimeout(saveTimeout);
            });
        }

        // --- 9. Query HUD Reactivity ---
        if (queryBadge && queryHudStrip) {
            const observer = new MutationObserver(() => {
                const text = (queryBadge.textContent || '').trim().toUpperCase();
                const isActiveQuery = text.includes('HITS') || text === 'DRAWING' || text === 'RUNNING' || text === 'ERROR';
                queryHudStrip.classList.toggle('is-active', isActiveQuery);
            });
            observer.observe(queryBadge, { childList: true, characterData: true, subtree: true });
        }

        // Dynamic badge updates from DOM
        function syncBadges() {
            if (railTreeBadge && hierarchyBadge) {
                const count = hierarchyBadge.textContent.replace(/[^0-9]/g, '');
                if (count) railTreeBadge.textContent = count;
            }
            if (railTraceBadge && traceBadge) {
                const count = traceBadge.textContent.replace(/[^0-9]/g, '');
                if (count) railTraceBadge.textContent = count;
            }
        }

        const badgeObserver = new MutationObserver(syncBadges);
        if (hierarchyBadge) badgeObserver.observe(hierarchyBadge, { childList: true, characterData: true, subtree: true });
        if (traceBadge) badgeObserver.observe(traceBadge, { childList: true, characterData: true, subtree: true });

        // --- 10. Keyboard Shortcuts ---
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dockGhostPreview) {
                dockGhostPreview.classList.remove('is-active');
            }
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 't':
                        e.preventDefault();
                        if (railBtnTree) railBtnTree.click();
                        break;
                    case 'n':
                        e.preventDefault();
                        if (railBtnNode) railBtnNode.click();
                        break;
                    case 'q':
                        e.preventDefault();
                        const btnDraw = document.getElementById('btnDrawQuery');
                        if (btnDraw && !btnDraw.disabled) btnDraw.click();
                        break;
                    case 'r':
                        e.preventDefault();
                        if (railBtnTrace) railBtnTrace.click();
                        break;
                    case 'm':
                        e.preventDefault();
                        if (railBtnTelemetry) railBtnTelemetry.click();
                        break;
                    case 'l':
                        e.preventDefault();
                        if (triggerBtn) triggerBtn.click();
                        break;
                }
            }
        });

        // --- 11. Load Saved Layout & Initialize Splitters ---
        initSplitters();
        loadLayoutState();
        if (layoutState.rightBayCollapsed) setRightBayCollapsed(true);
        if (layoutState.bottomDockClosed) setBottomDockClosed(true);
        if (layoutState.bottomDockMinimized) setBottomDockMinimized(true);
        setActiveBaySection(layoutState.activeBaySection || 'node');

        // Restore floating state if saved
        instruments.forEach(({ id, elem }) => {
            if (elem && layoutState.instruments[id] && layoutState.instruments[id].isFloating) {
                const inst = layoutState.instruments[id];
                makeFloating(elem, id, inst.x, inst.y, inst.width, inst.height);
            }
        });

        // Window resize bounds containment
        window.addEventListener('resize', () => {
            document.querySelectorAll('.is-floating').forEach(elem => {
                const w = elem.offsetWidth;
                const h = elem.offsetHeight;
                const left = parseInt(elem.style.left, 10) || 0;
                const top = parseInt(elem.style.top, 10) || 0;

                const clampX = Math.max(44, Math.min(window.innerWidth - w - 10, left));
                const clampY = Math.max(34, Math.min(window.innerHeight - 40, top));

                elem.style.left = `${clampX}px`;
                elem.style.top = `${clampY}px`;
            });
        });

        // Expose shell API for integration verification
        window.__kestrel_shell = {
            layoutState,
            setActiveBaySection,
            setToolbarHeight,
            setDockBayWidth,
            setDockBottomHeight,
            makeFloating,
            dockInstrument,
            saveLayoutState,
            loadLayoutState,
            notifyCanvasResize
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
})();
