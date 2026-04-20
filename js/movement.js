// movement.js
// Handles per-frame unit movement, collision with buildings, and copper separation.

/**
 * @param {Object} params
 * @param {number} params.dt
 * @param {Array} params.units
 * @param {Object} params.refinery
 * @param {Array} params.barracksList
 * @param {Function} params.getUnitRadius
 * @param {Function} params.separateUnitFromCopper
 * @param {Function} params.separateUnits
 * @param {Function} params.unitCollidesWithRefinery
 * @param {Function} params.unitCollidesWithBuilding
 */
export function updateMovement({
    dt,
    units,
    refinery,
    barracksList,
    getUnitRadius,
    separateUnitFromCopper,
    separateUnits,
    unitCollidesWithRefinery,
    unitCollidesWithBuilding,
}) {
    // --- Movement for all units ---
    for (const u of units) {
        if (!u.moving) continue;

        const oldX = u.x;
        const oldY = u.y;
        const dx = u.tx - u.x;
        const dy = u.ty - u.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 1) {
            u.x = u.tx;
            u.y = u.ty;
            u.moving = false;
            // no "continue" so other systems see the final position
        } else {
            const step = u.speed * dt;
            if (step >= dist) {
                u.x = u.tx;
                u.y = u.ty;
                u.moving = false;
            } else {
                u.x += (dx / dist) * step;
                u.y += (dy / dist) * step;
            }
        }

        // ---- Collision with refinery + barracks ----
        let collided = false;
        let blocking = null;   // which building we hit
        let isRefinery = false;

        // Check refinery first
        if (unitCollidesWithRefinery(u)) {
            collided = true;
            blocking = refinery;
            isRefinery = true;
        } else {
            // Then check barracks
            for (const b of barracksList) {
                if (unitCollidesWithBuilding(u, b)) {
                    collided = true;
                    blocking = b;
                    break;
                }
            }
        }

        if (collided && blocking) {
            // Revert to old position first
            u.x = oldX;
            u.y = oldY;

            if (isRefinery) {
                // Slide around refinery (square)
                const rf = refinery;
                const half = rf.size / 2;
                const bx = rf.x;
                const by = rf.y;

                const vx = u.x - bx;
                const vy = u.y - by;

                if (Math.abs(vx) > Math.abs(vy)) {
                    if (u.tx > bx - half && u.tx < bx + half) {
                        u.tx =
                            vx > 0
                                ? bx + half + getUnitRadius(u)
                                : bx - half - getUnitRadius(u);
                    }
                } else {
                    if (u.ty > by - half && u.ty < by + half) {
                        u.ty =
                            vy > 0
                                ? by + half + getUnitRadius(u)
                                : by - half - getUnitRadius(u);
                    }
                }
            } else {
                // Slide around barracks (rectangle)
                const b = blocking;
                const halfW = b.width / 2;
                const halfH = b.height / 2;
                const bx = b.x;
                const by = b.y;

                const vx = u.x - bx;
                const vy = u.y - by;

                if (Math.abs(vx) > Math.abs(vy)) {
                    if (u.tx > bx - halfW && u.tx < bx + halfW) {
                        u.tx =
                            vx > 0
                                ? bx + halfW + getUnitRadius(u)
                                : bx - halfW - getUnitRadius(u);
                    }
                } else {
                    if (u.ty > by - halfH && u.ty < by + halfH) {
                        u.ty =
                            vy > 0
                                ? by + halfH + getUnitRadius(u)
                                : by - halfH - getUnitRadius(u);
                    }
                }
            }

            // Let the unit keep moving with adjusted target so it slides around
            u.moving = true;
        }

        // Keep units out of copper centers
        separateUnitFromCopper(u);
    }

    // Unit–unit separation
    separateUnits();
}