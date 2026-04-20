import { createCamera } from './camera.js';
import { updateGameState } from './gameUpdate.js';
import { createMap1 } from './map1.js';
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

window.addEventListener('DOMContentLoaded', () => {
    console.log('Delta main.js DOMContentLoaded hook running');

    const LOCAL_PLAYER_ID = 1;
    const ENEMY_PLAYER_ID = 2;

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

    // --- Map-specific starting state ---
    const {
        copperNodes,
        enemyCopperNodes,
        units,
        barracksList,
        refinery,
        enemyRefinery,
        worldWidth = canvas.width,   // TEMP fallback
        worldHeight = canvas.height, // TEMP fallback
    } = createMap1({
        canvas,
        localPlayerId: LOCAL_PLAYER_ID,
        enemyPlayerId: ENEMY_PLAYER_ID,
        localFaction: LOCAL_PLAYER_FACTION,
        enemyFaction: ENEMY_FACTION,
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

    const scrapsAmountEl = document.getElementById('scraps-amount');
    const popAmountEl = document.getElementById('pop-amount');
    const popCapEl = document.getElementById('pop-cap');
    const olivesAmountEl = document.getElementById('olives-amount');
    const prismsAmountEl = document.getElementById('prisms-amount');
    const buildBarracksBtn = document.getElementById('build-barracks-btn');
    const buildingUi = document.getElementById('building-ui');
    const trainBtn = document.getElementById('train-unit-btn');
    const trainProgress = document.getElementById('train-progress');
    const trainProgressFill = document.getElementById('train-progress-fill');
    const trainTimeLabel = document.getElementById('train-time-label');

    const MELEE_COST = 50;
    const GATHERER_COST = 25;
    const BARRACKS_COST = 100;
    const REFINERY_COST = 500;
    const REFINERY_SUPPLY = 15;
    let scraps = 25; // starting amount

    // Construction state
    let constructionState = {
        mode: 'idle',      // 'idle' | 'placing' | 'building'
        ghost: null,       // finalized placement (during building)
        builder: null,
        buildTimer: 0,
        buildDuration: 45,
        completed: false,
        preview: null,     // follows mouse while placing
    };

    let lastTime = 0;

    // --- Game-level helpers that still live in main ---

    function getPlayerUnitCount(ownerId) {
        return units.filter(u => u.ownerId === ownerId).length;
    }

    function getSelectedUnits() {
        return units.filter((u) => u.selected);
    }

    function getSelectedBarracks() {
        return barracksList.find(b => b.selected) || null;
    }

    function getPopulationCap(playerId) {
        let cap = 0;

        if (refinery && refinery.ownerId === playerId && !refinery.destroyed) {
            cap += REFINERY_SUPPLY;
        }
        if (enemyRefinery && enemyRefinery.ownerId === playerId && !enemyRefinery.destroyed) {
            cap += REFINERY_SUPPLY;
        }

        return cap;
    }

    function spawnUnitFromBuilding(type, building) {
        const ownerId = building.ownerId;
        const ownerUnitCount = getPlayerUnitCount(ownerId);
        const cap = getPopulationCap(ownerId);

        if (ownerUnitCount >= cap) {
            console.log(`Unit cap reached (${cap}) for player ${ownerId}.`);
            return null;
        }

        const owner = getPlayerById(ownerId);
        if (!owner) {
            console.warn(`No player found for ownerId ${ownerId}`);
            return null;
        }

        const factionUnits = CONTINENT_UNIT_KEYS[owner.faction];
        const templateKey = factionUnits?.[type];
        if (!templateKey) {
            console.warn(
                `No unit template for type '${type}' and faction '${owner.faction}'`
            );
            return null;
        }

        const spawnOffsetX = 50 + Math.random() * 20;
        const spawnOffsetY = (Math.random() - 0.5) * 30;
        const spawnX = building.x + spawnOffsetX;
        const spawnY = building.y + spawnOffsetY;

        const unit = createUnitForPlayer(templateKey, ownerId, {
            x: spawnX,
            y: spawnY,
            tx: building.rallyX,
            ty: building.rallyY,
            moving: true,
        });

        units.push(unit);

        console.log(
            `Spawned ${type} (${templateKey}) for player ${ownerId} from building. Total units for this player: ${getPlayerUnitCount(ownerId)}`
        );

        ui.refreshPopulation();
        return unit;
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
        trainBtn,
        trainProgress,
        trainProgressFill,
        trainTimeLabel,
        units,
        barracksList,
        refinery,
        MELEE_COST,
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

        // Fixed ghost while building
        if (constructionState.ghost) {
            const ghost = constructionState.ghost;
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
        }

        // Real barracks
        for (const b of barracksList) {
            const s = camera.worldToScreen(b.x, b.y);
            drawBarracks(ctx, { ...b, x: s.x, y: s.y });
            if (b.selected) {
                drawRallyPoint(ctx, {
                    ...b,
                    x: s.x,
                    y: s.y,
                });
            }
        }

        // Refinery
        const refScreen = camera.worldToScreen(refinery.x, refinery.y);
        drawRefinery(ctx, { ...refinery, x: refScreen.x, y: refScreen.y });
        if (refinery.selected) {
            drawRallyPoint(ctx, { ...refinery, x: refScreen.x, y: refScreen.y });
        }

        const enemyRefScreen = camera.worldToScreen(enemyRefinery.x, enemyRefinery.y);
        drawRefinery(ctx, { ...enemyRefinery, x: enemyRefScreen.x, y: enemyRefScreen.y });

        for (const u of units) {
            const s = camera.worldToScreen(u.x, u.y);
            drawUnit(ctx, { ...u, x: s.x, y: s.y });
        }
    }

    function loop(timestamp) {
        const dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        // Camera movement
        camera.update(dt);

        const result = updateGameState({
            dt,
            units,
            refinery,
            copperNodes,
            scraps,
            getUnitRadius,
            gathererAtCopper: (u) => gathererAtCopper(u, copperNodes),
            gathererAtRefinery: (u) => gathererAtRefinery(u, refinery),
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
        });

        if (result && typeof result.scraps === 'number') {
            scraps = result.scraps;
            ui.refreshResources();
        }

        if (
            constructionState.completed &&
            constructionState.ghost &&
            constructionState.builder
        ) {
            const ghost = constructionState.ghost;
            const builder = constructionState.builder;

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

            constructionState.ghost = null;
            constructionState.builder = null;
            constructionState.completed = false;
            constructionState.buildTimer = 0;
        }

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