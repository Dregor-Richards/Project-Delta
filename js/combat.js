// combat.js
// Handles attacks, damage, and removing dead units.

/**
 * @param {Object} params
 * @param {number} params.dt
 * @param {Array} params.units
 * @param {Function} params.findClosestEnemyInRange
 */
export function updateCombat({
  dt,
  units,
  findClosestEnemyInRange,
  refreshPopulation,
}) {

    // --- Attacks ---
    for (const u of units) {
        if (!u.hp || u.hp <= 0) continue;           // skip dead / non-combatants
        if (u.attackDamage <= 0 || u.attackRange <= 0) continue; // no attack

        // advance attack timer
        u.attackTimer += dt;

        const target = findClosestEnemyInRange(u);
        if (target && u.attackTimer >= u.attackInterval) {
            // perform attack
            u.attackTimer = 0;
            target.hp -= u.attackDamage;
            console.log(
                `${u.type} hit ${target.type} for ${u.attackDamage}. Target hp: ${target.hp}`
            );
        }
    }

    // --- Remove dead units ---
    for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.hp !== undefined && u.hp <= 0) {
            console.log(`Unit ${u.type} died.`);
            units.splice(i, 1);
            if (refreshPopulation) {
                refreshPopulation();
            }
        }
    }
}