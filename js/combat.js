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
  // --- Attack-move detection pass (check BEFORE attacks) ---
  for (const u of units) {
    if (!u.isAttackMoving) {
      u.inCombat = false; // reset if not attack-moving
      continue;
    }

    // Check if there's an enemy within half vision range
    const detectionRange = (u.visionRange || 220) * 0.5;
    const enemy = findClosestEnemyInRange(u, units, detectionRange);

    if (enemy) {
      // Enemy detected: stop moving, engage
      u.moving = false;
      u.inCombat = true;
      console.log(`${u.type} detected enemy during attack-move, engaging.`);
    } else if (u.inCombat) {
      // Was in combat, no more enemies nearby: resume movement
      u.inCombat = false;
      if (u.attackMoveDest) {
        u.tx = u.attackMoveDest.x;
        u.ty = u.attackMoveDest.y;
        u.moving = true;
        console.log(`${u.type} resuming attack-move to destination.`);
      }
    }
  }

  // --- Attacks ---
  for (const u of units) {
    if (!u.hp || u.hp <= 0) continue;
    if (u.attackDamage <= 0 || u.attackRange <= 0) continue;

    u.attackTimer += dt;

    const target = findClosestEnemyInRange(u);
    if (target && u.attackTimer >= u.attackInterval) {
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