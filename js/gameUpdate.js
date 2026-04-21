// gameUpdate.js
import { updateMovement } from './movement.js';
import { updateEconomy } from './economy.js';
import { updateCombat } from './combat.js';
import { updateProduction } from './production.js';

export function updateGameState({
    dt,
    units,
    refinery,
    copperNodes,
    scraps,
    getUnitRadius,
    gathererAtCopper,
    gathererAtRefinery,
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
    const econResult = updateEconomy({
        dt,
        units,
        refinery,
        scraps,
        gathererAtCopper,
        gathererAtRefinery,
    });
    scraps = econResult.scraps;

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

    separateUnits();

    return {
        scraps,
    };
}