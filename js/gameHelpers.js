/** Radius used for circular approximations around units. */
export function getUnitRadius(u) {
  return u.size * 0.6;
}

export function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Find the nearest active copper node to (x, y).
 */
export function findNearestCopperNode(copperNodes, x, y) {
  let best = null;
  let bestDistSq = Infinity;
  for (const node of copperNodes) {
    if (!node.active) continue;
    const dx = x - node.x;
    const dy = y - node.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      best = node;
    }
  }
  return best;
}

/**
 * Find the closest enemy unit within attack range of attacker.
 */
export function findClosestEnemyInRange(attacker, units) {
  if (attacker.attackDamage <= 0 || attacker.attackRange <= 0) return null;
  let bestTarget = null;
  let bestDistSq = Infinity;
  const rangeSq = attacker.attackRange * attacker.attackRange;

  for (const target of units) {
    if (target === attacker) continue;
    if (!target.hp || target.hp <= 0) continue;
    if (target.ownerId === attacker.ownerId) continue;

    const d2 = distanceSquared(attacker, target);
    if (d2 <= rangeSq && d2 < bestDistSq) {
      bestDistSq = d2;
      bestTarget = target;
    }
  }
  return bestTarget;
}

/**
 * Axis-aligned point-in-rect for units.
 */
export function isPointInUnit(px, py, u) {
  const half = u.size / 2;
  return (
    px >= u.x - half &&
    px <= u.x + half &&
    py >= u.y - half &&
    py <= u.y + half
  );
}

/**
 * Check if a world point is on/near any active copper node.
 */
export function isPointOnCopper(copperNodes, px, py) {
  for (const node of copperNodes) {
    if (!node.active) continue;
    const dx = px - node.x;
    const dy = py - node.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= node.radius + 10) return true;
  }
  return false;
}

/**
 * Point in refinery diamond/square (treated as AABB here).
 */
export function isPointInRefinery(refinery, px, py) {
  const r = refinery;
  const half = r.size / 2;
  return (
    px >= r.x - half &&
    px <= r.x + half &&
    py >= r.y - half &&
    py <= r.y + half
  );
}

/**
 * Point in barracks AABB.
 */
export function isPointInBarracks(b, px, py) {
  const halfW = b.width / 2;
  const halfH = b.height / 2;
  return (
    px >= b.x - halfW &&
    px <= b.x + halfW &&
    py >= b.y - halfH &&
    py <= b.y + halfH
  );
}

/**
 * Push a unit out of overlapping copper nodes.
 */
export function separateUnitFromCopper(u, copperNodes) {
  const ur = getUnitRadius(u);
  for (const node of copperNodes) {
    const nr = node.radius;
    const minDist = ur + nr;
    const dx = u.x - node.x;
    const dy = u.y - node.y;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      const angle = Math.random() * Math.PI * 2;
      u.x = node.x + Math.cos(angle) * minDist;
      u.y = node.y + Math.sin(angle) * minDist;
      continue;
    }

    if (dist < minDist) {
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      u.x += nx * overlap;
      u.y += ny * overlap;
    }
  }
}

/**
 * Is gatherer close enough to the refinery.
 */
export function gathererAtRefinery(u, refinery) {
  const ur = getUnitRadius(u);
  const rf = refinery;
  const half = rf.size / 2;
  const rx = rf.x - half;
  const ry = rf.y - half;
  const rw = rf.size;
  const rh = rf.size;
  let closestX = u.x;
  let closestY = u.y;
  if (u.x < rx) closestX = rx;
  else if (u.x > rx + rw) closestX = rx + rw;
  if (u.y < ry) closestY = ry;
  else if (u.y > ry + rh) closestY = ry + rh;
  const dx = u.x - closestX;
  const dy = u.y - closestY;
  const distSq = dx * dx + dy * dy;
  return distSq <= ur * ur * 1.5;
}

/**
 * Is gatherer correctly positioned on a copper ring.
 */
export function gathererAtCopper(u, copperNodes) {
  const ur = getUnitRadius(u);
  for (const node of copperNodes) {
    const dx = u.x - node.x;
    const dy = u.y - node.y;
    const dist = Math.hypot(dx, dy);
    const inner = node.radius - ur * 0.5;
    const outer = node.radius + ur * 1.5;
    if (dist >= inner && dist <= outer) {
      return true;
    }
  }
  return false;
}

/**
 * Push overlapping units apart.
 */
export function separateUnits(units) {
  const len = units.length;
  for (let i = 0; i < len; i++) {
    for (let j = i + 1; j < len; j++) {
      const a = units[i];
      const b = units[j];
      const ra = getUnitRadius(a);
      const rb = getUnitRadius(b);
      const minDist = ra + rb;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < minDist) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const push = overlap / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

/**
 * Circle vs building rect collision.
 */
export function unitCollidesWithBuilding(u, building) {
  const r = getUnitRadius(u);
  const halfW = building.width / 2;
  const halfH = building.height / 2;

  const bx = building.x - halfW;
  const by = building.y - halfH;
  const bw = building.width;
  const bh = building.height;

  let closestX = u.x;
  let closestY = u.y;

  if (u.x < bx) closestX = bx;
  else if (u.x > bx + bw) closestX = bx + bw;

  if (u.y < by) closestY = by;
  else if (u.y > by + bh) closestY = by + bh;

  const dx = u.x - closestX;
  const dy = u.y - closestY;
  const distSq = dx * dx + dy * dy;
  return distSq < r * r;
}

/**
 * Circle vs refinery rect collision.
 */
export function unitCollidesWithRefinery(u, refinery) {
  const r = getUnitRadius(u);
  const rf = refinery;
  const half = rf.size / 2;
  const rx = rf.x - half;
  const ry = rf.y - half;
  const rw = rf.size;
  const rh = rf.size;
  let closestX = u.x;
  let closestY = u.y;
  if (u.x < rx) closestX = rx;
  else if (u.x > rx + rw) closestX = rx + rw;
  if (u.y < ry) closestY = ry;
  else if (u.y > ry + rh) closestY = ry + rh;
  const dx = u.x - closestX;
  const dy = u.y - closestY;
  const distSq = dx * dx + dy * dy;
  return distSq < r * r;
}