// economy.js
// Handles gatherer mining, carrying, and depositing resources.

/**
 * @param {Object} params
 * @param {number} params.dt
 * @param {Array}  params.units
 * @param {Object} params.refinery
 * @param {number} params.scraps
 * @param {Function} params.gathererAtCopper
 * @param {Function} params.gathererAtRefinery
 * @returns {{scraps: number}}
 */
export function updateEconomy({
    dt,
    units,
    refinery,
    scraps,
    gathererAtCopper,
    gathererAtRefinery,
}) {
    for (const u of units) {
        if (u.ownerId === 2 && u.role === 'gatherer') {
            console.log('Enemy gatherer', u.id, 'mode', u.mode, 'carried', u.carried);
        }
        
        if (u.role !== 'gatherer') continue;

        // 1) If we were walking to a node and reached it, start mining
        if (u.mode === 'toNode' && u.homeNode && u.homeNode.active && gathererAtCopper(u)) {
            u.moving = false;
            u.mining = true;
            u.mode = 'mining';
            u.miningTimer = 0;
        }

        // 2) Mining at node
        if (u.mode === 'mining' && u.mining && u.homeNode && u.homeNode.active && gathererAtCopper(u)) {
            const node = u.homeNode;

            // Node is depleted, stop mining
            if (node.remaining <= 0) {
                node.remaining = 0;
                node.active = false;
                u.mining = false;
                u.mode = 'idle';
                u.homeNode = null;
            } else {
                u.moving = false; // stay put while mining
                u.miningTimer += dt;

                if (u.miningTimer >= 1) {
                    const cycles = Math.floor(u.miningTimer);
                    if (cycles > 0) {
                        const spaceLeft = u.maxCarry - u.carried;
                        // Each cycle = 1 scrap; clamp by carry space and node.remaining
                        const potential = Math.min(cycles, spaceLeft, node.remaining);

                        if (potential > 0) {
                            u.carried += potential;
                            node.remaining -= potential;
                            console.log(
                                `Gatherer mined ${potential}. Carrying: ${u.carried}/${u.maxCarry}. Node remaining: ${node.remaining}`
                            );
                        }

                        u.miningTimer -= cycles;
                    }

                    // If node hit 0 in this tick, mark depleted
                    if (node.remaining <= 0) {
                        node.remaining = 0;
                        node.active = false;
                        u.mining = false;
                        u.mode = 'idle';
                        u.homeNode = null;
                    } else if (u.carried >= u.maxCarry) {
                        // If full, head back to refinery
                        u.mining = false;
                        u.miningTimer = 0;
                        u.mode = 'toRefinery';
                        u.tx = refinery.x;
                        u.ty = refinery.y;
                        u.moving = true;
                    }
                }
            }
        } else if (u.mode === 'mining' && !gathererAtCopper(u)) {
            // Drifted off node (pushed by separation, etc.)
            u.mining = false;
            if (u.homeNode && u.homeNode.active) {
                u.mode = 'toNode';
                u.tx = u.homeNode.x;
                u.ty = u.homeNode.y;
                u.moving = true;
            } else {
                u.homeNode = null;
                u.mode = 'idle';
            }
        }

        // 3) Returning to refinery to deposit
        if (u.mode === 'toRefinery' && gathererAtRefinery(u)) {
            u.moving = false;
            if (u.carried > 0) {
                scraps += u.carried;
                console.log(
                    `Gatherer deposited ${u.carried} at refinery. Total scraps: ${scraps}`
                );
                u.carried = 0;
            }

            // After deposit, go back to node if we have an active one
            if (u.homeNode && u.homeNode.active) {
                u.mode = 'toNode';
                u.tx = u.homeNode.x;
                u.ty = u.homeNode.y;
                u.mining = false;
                u.miningTimer = 0;
                u.moving = true;
            } else {
                u.mode = 'idle';
            }
        }

        // Safety: if not mining and not in mining mode, reset timer
        if (!u.mining && u.mode !== 'mining') {
            u.miningTimer = 0;
        }
    }

    // Return the updated scraps; main.js should assign and then call refreshResources()
    return { scraps };
}