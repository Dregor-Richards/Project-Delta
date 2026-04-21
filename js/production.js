// production.js
// Handles building training queues (e.g., refinery producing gatherers, barracks producing melee).

/**
 * @param {Object} params
 * @param {number} params.dt
 * @param {Array}  params.units
 * @param {Object} params.refinery
 * @param {Array}  params.barracksList
 * @param {Function} params.spawnUnitFromBuilding
 * @param {Function} params.refreshUI
 */
export function updateProduction({
    dt,
    units,
    refinery,
    barracksList,
    spawnUnitFromBuilding,
    refreshUI,
    getPlayerUnitCount,
    getPopulationCap,
}) {
    // --- Refinery training (gatherers) ---
    if (refinery.training) {
    refinery.trainingTime += dt;
    if (refinery.trainingTime >= refinery.trainingDuration) {
        refinery.training = false;
        refinery.trainingTime = 0;

        const ownerId = refinery.ownerId;
        const cap = getPopulationCap(ownerId);
        if (getPlayerUnitCount(ownerId) < cap) {
        // Refinery always produces 'gatherer'
        spawnUnitFromBuilding('gatherer', refinery);
        } else {
        console.log(`Refinery finished, but unit cap reached (${cap}).`);
        }

        refreshUI();
    } else {
        refreshUI();
    }
    }

    // --- Barracks training (melee) ---
    if (!barracksList) return;

    for (const b of barracksList) {
    if (!b.training) continue;

    b.trainingTime += dt;

    if (b.trainingTime >= b.trainingDuration) {
        b.training = false;
        b.trainingTime = 0;

        const ownerId = b.ownerId;
        const cap = getPopulationCap(ownerId);
        if (getPlayerUnitCount(ownerId) < cap) {
        // Use the trainingType set by the UI: 'melee' or 'ranged'
        const unitType = b.trainingType || 'melee';
        spawnUnitFromBuilding(unitType, b);
        } else {
        console.log(`Barracks finished, but unit cap reached (${cap}).`);
        }

        b.trainingType = null;
        refreshUI();
    } else {
        refreshUI();
    }
    }
}