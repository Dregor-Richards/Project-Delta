// gameUpdate.js
import { updateMovement } from './movement.js';
import { updateEconomy } from './economy.js';
import { updateCombat } from './combat.js';
import { updateProduction } from './production.js';

function updateEnemyGatherersAI({
  units,
  enemyRefinery,
  enemyCopperNodes,
}) {
  // Simple rule: every enemy gatherer should be working if possible
  for (const u of units) {
    if (!u) continue;
    if (u.ownerId !== 2) continue;        // ENEMY_PLAYER_ID = 2
    if (u.role !== 'gatherer') continue;  // only gatherers

    // If this gatherer is already in a gather/return cycle, leave them alone
    if (u.mode === 'toNode' || u.mode === 'mining' || u.mode === 'toRefinery') {
      continue;
    }

    // Find the nearest active enemy copper node
    const targetNode = enemyCopperNodes
      .filter(n => n.active)
      .reduce((best, node) => {
        if (!best) return node;
        const dx = node.x - u.x;
        const dy = node.y - u.y;
        const d2 = dx * dx + dy * dy;
        const bestDx = best.x - u.x;
        const bestDy = best.y - u.y;
        const bestD2 = bestDx * bestDx + bestDy * bestDy;
        return d2 < bestD2 ? node : best;
      }, null);

    if (!targetNode) {
      // No resources left on enemy side
      continue;
    }

    // Send gatherer to that node (mirror of your player command)
    u.tx = targetNode.x;
    u.ty = targetNode.y;
    u.moving = true;
    u.mining = false;
    u.miningTimer = 0;
    u.homeNode = targetNode;
    u.mode = 'toNode';
  }
}

export function updateGameState({
    dt,
    units,
    refinery,
    enemyRefinery,
    copperNodes,
    enemyCopperNodes,
    scraps,
    enemyScraps,
    getUnitRadius,
    gathererAtCopper,
    gathererAtRefinery,
    gathererAtEnemyRefinery,
    gathererAtEnemyCopper,
    separateUnitFromCopper,
    separateUnits,
    unitCollidesWithRefinery,
    unitCollidesWithBuilding,
    findClosestEnemyInRange,
    refreshUI,
    spawnUnitFromBuilding,
    constructionState,
    barracksList,
    getPlayerUnitCount,
    getPopulationCap,
    refreshPopulation,
}) {
    // --- Movement system ---
    updateMovement({
        dt,
        units,
        refinery,
        barracksList,              // <-- pass this once movement.js uses it
        getUnitRadius,
        separateUnitFromCopper,
        separateUnits,
        unitCollidesWithRefinery,
        unitCollidesWithBuilding,
    });

    // --- Economy system (gatherers / scraps) ---
    // Split units by owner
    const playerUnits = units.filter(u => u.ownerId === 1);
    const enemyUnits  = units.filter(u => u.ownerId === 2);
    // Player economy
    const playerEcon = updateEconomy({
        dt,
        units: playerUnits,
        refinery,
        scraps,
        gathererAtCopper,
        gathererAtRefinery,
    });
    scraps = playerEcon.scraps;
    // Enemy economy
    const enemyEcon = updateEconomy({
        dt,
        units: enemyUnits,
        refinery: enemyRefinery,
        scraps: enemyScraps,
        gathererAtCopper: gathererAtEnemyCopper,
        gathererAtRefinery: gathererAtEnemyRefinery,
    });
    enemyScraps = enemyEcon.scraps;

    // --- Combat system ---
    updateCombat({
        dt,
        units,
        findClosestEnemyInRange,
        refreshPopulation,
    });

    // --- Production system (buildings training units) ---
    updateProduction({
        dt,
        units,
        refinery,
        barracksList,
        spawnUnitFromBuilding,
        refreshUI,
        getPlayerUnitCount,
        getPopulationCap,
    });

    // --- Simple construction system (gatherer building barracks) ---
    if (
        constructionState &&
        constructionState.mode === 'building' &&
        constructionState.ghost &&
        constructionState.builder
    ) {
        const builder = constructionState.builder;
        const ghost = constructionState.ghost;

        const dx = builder.x - ghost.x;
        const dy = builder.y - ghost.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 40) { // or your increased range
            constructionState.buildTimer += dt;

            if (constructionState.buildTimer >= constructionState.buildDuration) {
                constructionState.completed = true;
                console.log('Barracks construction complete at', ghost.x, ghost.y);
                constructionState.mode = 'idle';
            }
        }
    }

    updateEnemyGatherersAI({
        units,
        enemyRefinery,
        enemyCopperNodes,
    });

    separateUnits();

    return {
        scraps,
        enemyScraps,
    };
}