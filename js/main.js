import { createCamera } from './camera.js';
import { updateGameState } from './gameUpdate.js';
import { createMap1 } from './map1.js';
// Later:
// import { createMap2 } from './map2.js';
// import { createMap3 } from './map3.js';
// import { createMap4 } from './map4.js';
import { createFogOfWar, FOG_UNEXPLORED, FOG_EXPLORED, FOG_VISIBLE } from './fogOfWar.js';
import { createUnitForPlayer } from './unitTemplates.js';
import { createBuildingFromTemplate } from './buildingTemplates.js';
import { CONTINENT_UNIT_KEYS } from './factions.js';
import { players, getPlayerById } from './players.js';
import {
    drawSelectionBox,
    drawCopperNode,
    drawUnit,
    drawBarracks,
    drawRefinery,
    drawRallyPoint,
    drawGrid,
} from './gameRender.js';
import {
    getUnitRadius,
    distanceSquared,
    findNearestCopperNode,
    findClosestEnemyInRange,
    isPointInUnit,
    isPointOnCopper,
    isPointInRefinery,
    isPointInBarracks,
    separateUnitFromCopper,
    gathererAtRefinery,
    gathererAtCopper,
    separateUnits,
    unitCollidesWithBuilding,
    unitCollidesWithRefinery,
} from './gameHelpers.js';
import { createUIController } from './uiController.js';
import { createInputController } from './input.js';
import {
    getPlayerUnitCount as getPlayerUnitCountFromModule,
    getPopulationCap as getPopulationCapFromModule,
    createSpawnUnitFromBuilding,
} from './population.js';

window.addEventListener('DOMContentLoaded', () => {
    console.log('Delta main.js DOMContentLoaded hook running');

    const LOCAL_PLAYER_ID = 1;
    const ENEMY_PLAYER_ID = 2;

    const storedMapId = localStorage.getItem('moa_mapId') || 'map1';
    const storedFaction = localStorage.getItem('moa_playerFaction') || 'Foldari';
    const storedAiCount = parseInt(localStorage.getItem('moa_aiCount') || '1', 10);

    const localPlayer = getPlayerById(LOCAL_PLAYER_ID);
    if (localPlayer) {
        localPlayer.faction = storedFaction;
    }
    const LOCAL_PLAYER_FACTION = localPlayer?.faction ?? 'Foldari';
    const ENEMY_FACTION = 'Foldari'; // for now

    const canvas = document.getElementById('gameCanvas');
    console.log('Canvas element:', canvas);

    const ctx = canvas.getContext('2d');

        // --- Cost table (centralized) ---
    const UNIT_COSTS = {
        // Units
        gatherer: 25,       // generic gatherer cost
        melee: 50,          // generic melee cost (baseline)
        ranged: 75,         // generic ranged cost
        // Buildings
        barracks: 100,
        refinery: 500,
    };

    // Derive the legacy constants from UNIT_COSTS so UI stays the same API for now
    const MELEE_COST = UNIT_COSTS.melee;
    const RANGED_COST = UNIT_COSTS.ranged;
    const GATHERER_COST = UNIT_COSTS.gatherer;
    const BARRACKS_COST = UNIT_COSTS.barracks;
    const REFINERY_COST = UNIT_COSTS.refinery;

    const REFINERY_SUPPLY = 15;
    let scraps = 25; // starting amount
    let enemyScraps = 25;

    // --- Map selection helper ---
    function createSelectedMap({
        mapId,
        canvas,
        localPlayerId,
        enemyPlayerId,
        localFaction,
        enemyFaction,
    }) {
    switch (mapId) {
        case 'map1':
        return createMap1({
            canvas,
            localPlayerId,
            enemyPlayerId,
            localFaction,
            enemyFaction,
        });

        // case 'map2':
        //   return createMap2({ canvas, localPlayerId, enemyPlayerId, localFaction, enemyFaction });
        // case 'map3':
        //   return createMap3({ canvas, localPlayerId, enemyPlayerId, localFaction, enemyFaction });
        // case 'map4':
        //   return createMap4({ canvas, localPlayerId, enemyPlayerId, localFaction, enemyFaction });

        default:
        console.warn(`Unknown mapId '${mapId}', falling back to map1.`);
        return createMap1({
            canvas,
            localPlayerId,
            enemyPlayerId,
            localFaction,
            enemyFaction,
        });
    }
    }

    // --- Map-specific starting state ---
    const {
        copperNodes,
        enemyCopperNodes,
        units,
        barracksList,
        refinery,
        enemyRefinery,
        worldWidth = canvas.width,    // TEMP fallback
        worldHeight = canvas.height,  // TEMP fallback
    } = createSelectedMap({
        mapId: storedMapId,
        canvas,
        localPlayerId: LOCAL_PLAYER_ID,
        enemyPlayerId: ENEMY_PLAYER_ID,
        localFaction: LOCAL_PLAYER_FACTION,
        enemyFaction: ENEMY_FACTION,
    });

    const fog = createFogOfWar({
        worldWidth,
        worldHeight,
        cellSize: 40, // matches gridSize in drawGrid
    });

    // --- Camera (initialized after we know world size) ---
    const camera = createCamera({
        x: 0,
        y: 0,
        speed: 400,
        worldWidth,
        worldHeight,
        viewWidth: canvas.width,
        viewHeight: canvas.height,
        edgeSize: 20,
        edgeSpeedMultiplier: 1.0,
    });

    // Focus camera on a world position, clamped to map bounds
    function focusCameraOn(x, y) {
        camera.x = x - (camera.viewWidth  / (2 * camera.zoom));
        camera.y = y - (camera.viewHeight / (2 * camera.zoom));
        camera.clamp();
    }

    // Initial focus: the local player's refinery
    focusCameraOn(refinery.x, refinery.y);

    // Hotkey: Space refocuses camera on base (local player's refinery)
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
            return;
        }
        if (e.code === 'Space') {
            e.preventDefault();
            focusCameraOn(refinery.x, refinery.y);
        }
    });

    const scrapsAmountEl = document.getElementById('scraps-amount');
    const popAmountEl = document.getElementById('pop-amount');
    const popCapEl = document.getElementById('pop-cap');
    const olivesAmountEl = document.getElementById('olives-amount');
    const prismsAmountEl = document.getElementById('prisms-amount');
    const buildBarracksBtn = document.getElementById('build-barracks-btn');
    const buildingUi = document.getElementById('building-ui');
    const trainBtn = document.getElementById('train-unit-btn');
    const trainMeleeBtn = document.getElementById('train-melee-btn');
    const trainRangedBtn = document.getElementById('train-ranged-btn');
    const trainProgress = document.getElementById('train-progress');
    const trainProgressFill = document.getElementById('train-progress-fill');
    const trainTimeLabel = document.getElementById('train-time-label');

        // --- Game menu & settings modals ---
    const gameMenuButton = document.getElementById('game-menu-button');
    const gameMenuModal = document.getElementById('game-menu-modal');
    const menuSettingsBtn = document.getElementById('menu-settings-btn');
    const menuRestartBtn = document.getElementById('menu-restart-btn');
    const menuMainMenuBtn = document.getElementById('menu-main-menu-btn');
    const menuCloseBtn = document.getElementById('menu-close-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseBtn = document.getElementById('settings-close-btn');

    function openGameMenu() {
        gameMenuModal.classList.remove('hidden');
        setPaused(true);
    }

    function closeGameMenu() {
        gameMenuModal.classList.add('hidden');
        // Only unpause if settings isn’t open (so nested settings doesn’t resume the game)
        if (settingsModal.classList.contains('hidden')) {
            setPaused(false);
        }
    }

    function openSettings() {
        settingsModal.classList.remove('hidden');
        setPaused(true);
    }

    function closeSettings() {
        settingsModal.classList.add('hidden');
        // If the main menu is still open, stay paused; otherwise resume
        if (gameMenuModal.classList.contains('hidden')) {
            setPaused(false);
        }
    }

    if (gameMenuButton) {
        gameMenuButton.addEventListener('click', () => {
            openGameMenu();
        });
    }

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', () => {
            closeGameMenu();
        });
    }

    if (menuSettingsBtn) {
        menuSettingsBtn.addEventListener('click', () => {
            // Close main menu, open settings
            closeGameMenu();
            openSettings();
        });
    }

    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', () => {
            closeSettings();
        });
    }

    if (menuRestartBtn) {
        menuRestartBtn.addEventListener('click', () => {
            // Reload the current level page
            window.location.reload();
        });
    }

    if (menuMainMenuBtn) {
        menuMainMenuBtn.addEventListener('click', () => {
            // Navigate back to main menu
            window.location.href = '../index.html';
        });
    }

    gameMenuModal?.addEventListener('click', (e) => {
        if (e.target === gameMenuModal || e.target.classList.contains('game-menu-backdrop')) {
            closeGameMenu();
        }
    });

    settingsModal?.addEventListener('click', (e) => {
        if (e.target === settingsModal || e.target.classList.contains('game-menu-backdrop')) {
            closeSettings();
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // If settings open, close it first
            if (settingsModal && !settingsModal.classList.contains('hidden')) {
                closeSettings();
                return;
            }

            // If game menu open, close it (and maybe unpause)
            if (gameMenuModal && !gameMenuModal.classList.contains('hidden')) {
                closeGameMenu();
            } else {
                // Otherwise, open menu and pause
                openGameMenu();
            }
        }
    });

    // Construction system
    let constructionState = {
        mode: 'idle',     // 'idle' | 'placing'
        preview: null,    // follows mouse while placing
    };
    let constructionJobs = []; // array of active builds

    let lastTime = 0;
    let isPaused = false;

    function setPaused(paused) {
        isPaused = paused;
    }

    function togglePaused() {
        isPaused = !isPaused;
    }

    function startConstructionJob({ x, y, builder }) {
        const width = 80;
        const height = 60;
        const topInset = 20;

        const ghost = { x, y, width, height, topInset };

        const job = {
            id: Date.now() + Math.random(),
            ghost,
            builder,
            buildTimer: 0,
            buildDuration: 45,
            completed: false,
        };

        constructionJobs.push(job);

        // send builder toward site
        if (builder) {
            builder.tx = x;
            builder.ty = y + height * 0.3;
            builder.moving = true;
            builder.mode = 'building';
        }
        }

    function updateConstructionJobs(dt) {
    for (const job of constructionJobs) {
        if (job.completed) continue;

        job.buildTimer += dt;
        if (job.buildTimer >= job.buildDuration) {
        job.completed = true;

        const { ghost, builder } = job;

        const barracks = createBuildingFromTemplate('foldari_barracks', {
            x: ghost.x,
            y: ghost.y,
            rallyX: ghost.x + 100,
            rallyY: ghost.y,
            ownerId: builder.ownerId,
        });

        if (barracks) {
            barracksList.push(barracks);
            console.log('Barracks added to barracksList; total:', barracksList.length);
        }

        const safeOffset = (barracks?.height || 60) / 2 + getUnitRadius(builder) + 5;
        builder.x = ghost.x;
        builder.y = ghost.y + safeOffset;
        builder.tx = builder.x;
        builder.ty = builder.y;
        builder.moving = false;
        builder.mode = 'idle';
        }
    }

    constructionJobs = constructionJobs.filter(job => !job.completed);
    }

    // --- Game-level helpers that still live in main ---

    // --- Population wiring (using population.js) ---

    // Adapter: count units for a given owner via population.js
    function getPlayerUnitCount(ownerId) {
        return getPlayerUnitCountFromModule(units, ownerId);
    }

    // Adapter: get population cap for a given player via population.js
    function getPopulationCap(playerId) {
        return getPopulationCapFromModule({
            playerId,
            refinery,
            enemyRefinery,
            REFINERY_SUPPLY,
        });
    }

    // Bound spawn function using population.js
    const spawnUnitFromBuilding = createSpawnUnitFromBuilding({
        units,
        refinery,
        enemyRefinery,
        REFINERY_SUPPLY,
        onPopulationChanged: () => ui.refreshPopulation(),
    });

    function getSelectedUnits() {
        return units.filter((u) => u.selected);
    }

    function getSelectedBarracks() {
        return barracksList.find(b => b.selected) || null;
    }

    // --- Scraps accessors for UI controller ---
    function getScraps() { return scraps; }
    function setScraps(value) { scraps = value; }

    // --- Camera-related input: mouse wheel zoom ---
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (e.clientY - rect.top) * (canvas.height / rect.height);

        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        camera.zoomAt(cx, cy, zoomFactor);
    }, { passive: false });

    canvas.addEventListener('mouseleave', () => {
        camera.clearMousePosition();
    });

    // --- UI Controller wiring ---
    const ui = createUIController({
        LOCAL_PLAYER_ID,
        scrapsAmountEl,
        popAmountEl,
        popCapEl,
        buildBarracksBtn,
        buildingUi,
        // Old single button:
        trainBtn,
        // New buttons:
        trainMeleeBtn,
        trainRangedBtn,
        trainProgress,
        trainProgressFill,
        trainTimeLabel,
        units,
        barracksList,
        refinery,
        MELEE_COST,
        RANGED_COST,
        GATHERER_COST,
        BARRACKS_COST,
        getPlayerUnitCount,
        getPopulationCap,
        spawnUnitFromBuilding,
        getScraps,
        setScraps,
        constructionState,
    });

    // --- Input controller wiring (mouse selection + commands) ---
    const input = createInputController({
        canvas,
        camera,
        units,
        barracksList,
        refinery,
        copperNodes,
        constructionState,
        getSelectedUnits,
        getSelectedBarracks,
        findNearestCopperNode,
        isPointInUnit,
        isPointOnCopper,
        isPointInRefinery,
        isPointInBarracks,
        refreshUI: ui.refreshUI,
        startConstructionJob,
    });

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGrid(ctx, canvas.width, canvas.height, camera);

        // Selection box: convert world -> screen using drag state from input
        const { isDragging, dragStart, dragEnd } = input.getDragState();
        const selStart = camera.worldToScreen(dragStart.x, dragStart.y);
        const selEnd = camera.worldToScreen(dragEnd.x, dragEnd.y);
        drawSelectionBox(ctx, selStart, selEnd, isDragging);

        // Player 1 copper
        for (const node of copperNodes) {
            if (!node.active) continue;
            const s = camera.worldToScreen(node.x, node.y);
            drawCopperNode(ctx, { ...node, x: s.x, y: s.y });
        }

        // Enemy copper
        for (const node of enemyCopperNodes) {
            if (!node.active) continue;
            const s = camera.worldToScreen(node.x, node.y);
            drawCopperNode(ctx, { ...node, x: s.x, y: s.y });
        }

        // Placement preview ghost
        if (constructionState.mode === 'placing' && constructionState.preview) {
            const ghost = constructionState.preview;
            const s = camera.worldToScreen(ghost.x, ghost.y);
            ctx.save();
            ctx.globalAlpha = 0.3;
            drawBarracks(ctx, {
                x: s.x,
                y: s.y,
                width: ghost.width,
                height: ghost.height,
                topInset: ghost.topInset,
                selected: false,
            });
            ctx.restore();
        }

        // Fixed ghosts while building (one per job)
        for (const job of constructionJobs) {
        if (job.completed) continue;
        const ghost = job.ghost;
        const s = camera.worldToScreen(ghost.x, ghost.y);

        ctx.save();
        ctx.globalAlpha = 0.4;
        drawBarracks(ctx, {
            x: s.x,
            y: s.y,
            width: ghost.width,
            height: ghost.height,
            topInset: ghost.topInset,
            selected: false,
        });
        ctx.restore();

        // --- Build progress bar ---
        const progress = Math.max(0, Math.min(1, job.buildTimer / job.buildDuration));

        const barWidth = ghost.width;
        const barHeight = 6;

        // Barracks bottom in screen space
        const bottomY = s.y + ghost.height / 2;

        const barX = s.x - barWidth / 2;
        const topY = s.y - ghost.height / 2;
        const barY = topY - 10; // 10px above roof

        // Background
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Filled portion
        ctx.fillStyle = '#4caf50'; // green
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);

        // Border
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        ctx.restore();
        }

        // Real barracks
        for (const b of barracksList) {
        const s = camera.worldToScreen(b.x, b.y);
        const rallyScreen = camera.worldToScreen(b.rallyX, b.rallyY);

        drawBarracks(ctx, { ...b, x: s.x, y: s.y });

        if (b.selected) {
            drawRallyPoint(ctx, {
            ...b,
            x: s.x,
            y: s.y,
            rallyX: rallyScreen.x,
            rallyY: rallyScreen.y,
            });
        }
        }

        // Refinery
        const refScreen = camera.worldToScreen(refinery.x, refinery.y);
        const refRallyScreen = camera.worldToScreen(refinery.rallyX, refinery.rallyY);

        drawRefinery(ctx, { ...refinery, x: refScreen.x, y: refScreen.y });

        if (refinery.selected) {
        drawRallyPoint(ctx, {
            ...refinery,
            x: refScreen.x,
            y: refScreen.y,
            rallyX: refRallyScreen.x,
            rallyY: refRallyScreen.y,
        });
        }

        const enemyRefScreen = camera.worldToScreen(enemyRefinery.x, enemyRefinery.y);
        drawRefinery(ctx, { ...enemyRefinery, x: enemyRefScreen.x, y: enemyRefScreen.y });

        for (const u of units) {
            // Example: only show enemies when fog is visible
            if (u.ownerId !== LOCAL_PLAYER_ID) {
                const fogState = fog.getStateAt(u.x, u.y);
                if (fogState !== FOG_VISIBLE) {
                    continue; // skip drawing this enemy
                }
            }
            const s = camera.worldToScreen(u.x, u.y);
            drawUnit(ctx, { ...u, x: s.x, y: s.y });
        }
        
        fog.draw(ctx, camera, canvas.width, canvas.height);
    }

    function loop(timestamp) {
        const dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        if (isPaused) {
            // Only update lastTime to current timestamp so dt stays small on resume
            lastTime = timestamp;
            // Still draw (so menus / overlays render)
            draw();
            requestAnimationFrame(loop);
            return;
        }

        // Camera movement
        camera.update(dt);

        const result = updateGameState({
            dt,
            units,
            refinery,
            enemyRefinery,
            copperNodes,
            enemyCopperNodes,
            scraps,
            enemyScraps,
            getUnitRadius,
            gathererAtCopper: (u) => gathererAtCopper(u, copperNodes),
            gathererAtEnemyCopper: (u) => gathererAtCopper(u, enemyCopperNodes),
            gathererAtRefinery: (u) => gathererAtRefinery(u, refinery),
            gathererAtEnemyRefinery: (u) => gathererAtRefinery(u, enemyRefinery),
            separateUnitFromCopper: (u) => separateUnitFromCopper(u, copperNodes),
            separateUnits: () => separateUnits(units),
            unitCollidesWithRefinery: (u) => unitCollidesWithRefinery(u, refinery),
            unitCollidesWithBuilding: (u, b) => unitCollidesWithBuilding(u, b),
            findClosestEnemyInRange: (attacker) => findClosestEnemyInRange(attacker, units),
            refreshResources: ui.refreshResources,
            refreshUI: ui.refreshUI,
            spawnUnitFromBuilding,
            constructionState,
            barracksList,
            getPlayerUnitCount,
            getPopulationCap,
            refreshPopulation: ui.refreshPopulation,
        });

        fog.updateVisibility({
            units,
            buildings: [...barracksList, refinery, enemyRefinery], // or just your vision‑granting buildings
            localPlayerId: LOCAL_PLAYER_ID,
            defaultUnitVision: 260,
            defaultBuildingVision: 320,
        });

        if (result) {
            if (typeof result.scraps === 'number') {
                scraps = result.scraps;
            }
            if (typeof result.enemyScraps === 'number') {
                enemyScraps = result.enemyScraps;
            }
            ui.refreshResources();
        }

        updateConstructionJobs(dt);

        draw();
        requestAnimationFrame(loop);
    }

    // Initial UI refresh
    ui.refreshUI();
    ui.refreshResources();
    ui.refreshPopulation();

    requestAnimationFrame((t) => {
        lastTime = t;
        loop(t);
    });
});