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
}) {
    // --- Refinery training (gatherers) ---
    if (refinery.training) {
        refinery.trainingTime += dt;
        if (refinery.trainingTime >= refinery.trainingDuration) {
            refinery.training = false;
            refinery.trainingTime = 0;

            if (getPlayerUnitCount(refinery.ownerId) < POP_CAP) {
                // Refinery always produces 'gatherer'
                spawnUnitFromBuilding('gatherer', refinery);
            } else {
                console.log('Refinery finished, but unit cap reached (10).');
            }

            refreshUI();
        } else {
            // Still training, update progress bar/UI
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

            if (getPlayerUnitCount(b.ownerId) < POP_CAP) {
                // For now, barracks always produce 'melee'
                spawnUnitFromBuilding('melee', b);
            } else {
                console.log('Barracks finished, but unit cap reached (10).');
            }

            refreshUI();
        } else {
            // Still training, update UI if barracks is selected
            refreshUI();
        }
    }
}