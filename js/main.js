import { createCamera } from './camera.js';
import { updateGameState } from './gameUpdate.js';
import { createRenderer } from './renderLoop.js';
import { getGameDomRefs } from './docuRef.js';
import { createMenuController } from './uiMenu.js';
import { createSelectedMap } from './maps.js';
import { createFogOfWar } from './fogOfWar.js';
import {
  getUnitRadius,
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
import { createConstructionManager } from './production.js';
import { getPlayerById } from './players.js';

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

  // --- DOM refs (single source) ---
  const {
    canvas,
    scrapsAmountEl,
    popAmountEl,
    popCapEl,
    olivesAmountEl,
    prismsAmountEl,
    idleWorkerWarningEl,
    buildBarracksBtn,
    buildingUi,
    trainBtn,
    trainMeleeBtn,
    trainRangedBtn,
    trainProgress,
    trainProgressFill,
    trainTimeLabel,
    gameMenuButton,
    gameMenuModal,
    menuSettingsBtn,
    menuRestartBtn,
    menuMainMenuBtn,
    menuCloseBtn,
    settingsModal,
    settingsCloseBtn,
  } = getGameDomRefs();

  console.log('Canvas element:', canvas);
  const ctx = canvas.getContext('2d');

  // --- Cost table (centralized) ---
  const UNIT_COSTS = {
    gatherer: 25,
    melee: 50,
    ranged: 75,
    barracks: 100,
    refinery: 500,
  };
  const MELEE_COST = UNIT_COSTS.melee;
  const RANGED_COST = UNIT_COSTS.ranged;
  const GATHERER_COST = UNIT_COSTS.gatherer;
  const BARRACKS_COST = UNIT_COSTS.barracks;
  const REFINERY_COST = UNIT_COSTS.refinery;

  const REFINERY_SUPPLY = 15;
  let scraps = 25;
  let enemyScraps = 25;

  // --- Map-specific starting state ---
  const {
    copperNodes,
    enemyCopperNodes,
    units,
    barracksList,
    refinery,
    enemyRefinery,
    worldWidth = canvas.width,
    worldHeight = canvas.height,
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
    cellSize: 40,
  });

  // --- Camera ---
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

  function focusCameraOn(x, y) {
    camera.x = x - (camera.viewWidth / (2 * camera.zoom));
    camera.y = y - (camera.viewHeight / (2 * camera.zoom));
    camera.clamp();
  }

  // Initial focus
  focusCameraOn(refinery.x, refinery.y);

  // --- Menus / pause ---
  const menu = createMenuController({
    gameMenuButton,
    gameMenuModal,
    menuSettingsBtn,
    menuRestartBtn,
    menuMainMenuBtn,
    menuCloseBtn,
    settingsModal,
    settingsCloseBtn,
  });

  let lastTime = 0;

  // --- Population wiring ---
  function getPlayerUnitCount(ownerId) {
    return getPlayerUnitCountFromModule(units, ownerId);
  }

  function getPopulationCap(playerId) {
    return getPopulationCapFromModule({
      playerId,
      refinery,
      enemyRefinery,
      REFINERY_SUPPLY,
    });
  }

  const {
    getConstructionState,
    getConstructionJobs,
    startConstructionJob,
    updateConstructionJobs,
  } = createConstructionManager({ barracksList });

  function getScraps() {
    return scraps;
  }
  function setScraps(value) {
    scraps = value;
  }

  // --- UI Controller wiring ---
  const ui = createUIController({
    LOCAL_PLAYER_ID,
    scrapsAmountEl,
    popAmountEl,
    popCapEl,
    buildBarracksBtn,
    buildingUi,
    trainBtn,
    trainMeleeBtn,
    trainRangedBtn,
    trainProgress,
    trainProgressFill,
    trainTimeLabel,
    idleWorkerWarningEl,
    units,
    barracksList,
    refinery,
    MELEE_COST,
    RANGED_COST,
    GATHERER_COST,
    BARRACKS_COST,
    getPlayerUnitCount,
    getPopulationCap,
    spawnUnitFromBuilding: null, // temporary; wired after spawn factory
    getScraps,
    setScraps,
    constructionState: getConstructionState(),
  });

  // Bound spawn function (needs ui.refreshPopulation)
  const spawnUnitFromBuilding = createSpawnUnitFromBuilding({
    units,
    refinery,
    enemyRefinery,
    REFINERY_SUPPLY,
    onPopulationChanged: () => ui.refreshPopulation(),
  });

  // Patch spawnUnitFromBuilding into UI now that it's created
  ui.spawnUnitFromBuilding = spawnUnitFromBuilding;

  function getSelectedUnits() {
    return units.filter((u) => u.selected);
  }

  function getSelectedBarracks() {
    return barracksList.find((b) => b.selected) || null;
  }

  // --- Camera-related input: mouse wheel zoom ---
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const cy = (e.clientY - rect.top) * (canvas.height / rect.height);

      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      camera.zoomAt(cx, cy, zoomFactor);
    },
    { passive: false },
  );

  canvas.addEventListener('mouseleave', () => {
    camera.clearMousePosition();
  });

  // --- Input controller wiring ---
  const input = createInputController({
    canvas,
    camera,
    units,
    barracksList,
    refinery,
    copperNodes,
    constructionState: getConstructionState(),
    getSelectedUnits,
    getSelectedBarracks,
    findNearestCopperNode,
    isPointInUnit,
    isPointOnCopper,
    isPointInRefinery,
    isPointInBarracks,
    refreshUI: ui.refreshUI,
    startConstructionJob,
    localPlayerId: LOCAL_PLAYER_ID,
    focusCameraOn,
  });

  // --- Renderer (draw) via renderLoop.js ---
  const renderer = createRenderer({
    ctx,
    canvas,
    camera,
    LOCAL_PLAYER_ID,
    fog,
    copperNodes,
    enemyCopperNodes,
    barracksList,
    refinery,
    enemyRefinery,
    getConstructionState,
    getConstructionJobs,
    getDragState: input.getDragState,
    units,
  });

  function draw() {
    renderer.draw();
  }

  // --- Keyboard input ---
  window.addEventListener('keydown', (e) => {
    // Ignore keypresses when typing in inputs/textareas
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      return;
    }

    // SPACE: refocus camera on base
    if (e.code === 'Space') {
      e.preventDefault();
      focusCameraOn(refinery.x, refinery.y);
      return;
    }

    // ESC: menus / pause
    if (e.key === 'Escape') {
      menu.handleKeyDown(e);
      return;
    }

    // Backslash: select idle worker
    if (e.code === 'Backslash' || e.key === '\\') {
      e.preventDefault();
      if (gameMenuModal && !gameMenuModal.classList.contains('hidden')) return;
      if (settingsModal && !settingsModal.classList.contains('hidden')) return;

      input.selectIdleWorker();
      return;
    }
  });

  // --- Main loop ---
  function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (menu.isPaused()) {
      lastTime = timestamp;
      draw();
      requestAnimationFrame(loop);
      return;
    }

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
      constructionState: getConstructionState(),
      barracksList,
      getPlayerUnitCount,
      getPopulationCap,
      refreshPopulation: ui.refreshPopulation,
    });

    fog.updateVisibility({
      units,
      buildings: [...barracksList, refinery, enemyRefinery],
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

    ui.updateIdleWorkerWarning();
    updateConstructionJobs(dt);

    draw();
    requestAnimationFrame(loop);
  }

  // Initial UI refresh
  ui.refreshUI();
  ui.refreshResources();
  ui.refreshPopulation();
  ui.updateIdleWorkerWarning();

  requestAnimationFrame((t) => {
    lastTime = t;
    loop(t);
  });
});