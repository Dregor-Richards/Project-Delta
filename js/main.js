import {
    drawSelectionBox,
    drawCopperNode,
    drawUnit,
    drawBarracks,
    drawRefinery,
    drawRallyPoint,
    drawGrid,
} from './gameRender.js';

window.addEventListener('DOMContentLoaded', () => {
console.log('Delta main.js DOMContentLoaded hook running');

const canvas = document.getElementById('gameCanvas');
console.log('Canvas element:', canvas);

const ctx = canvas.getContext('2d');
const scrapsAmountEl = document.getElementById('scraps-amount');
const buildingUi = document.getElementById('building-ui');
const trainBtn = document.getElementById('train-unit-btn');
const trainProgress = document.getElementById('train-progress');
const trainProgressFill = document.getElementById('train-progress-fill');
const trainTimeLabel = document.getElementById('train-time-label');
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragEnd = { x: 0, y: 0 };

const SOLDIER_COST = 50;
const GATHERER_COST = 25;
let scraps = 10; // starting resources

const copperNode = {
    x: canvas.width / 4 - 120,  // left of the barracks
    y: canvas.height / 4,
    radius: 10,
};

const units = [
    {
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: 20,
        speed: 150,
        moving: false,
        tx: canvas.width / 2,
        ty: canvas.height / 2,
        selected: false,
        type: 'soldier',
        role: 'soldier',
        mining: false,
        miningTimer: 0,
        carried: 0,
        maxCarry: 5,
        mode: 'idle',      // 'idle' | 'toNode' | 'mining' | 'toRefinery'
        homeNode: null,    // for gatherers

        // --- Combat stats (Mid / Mid baseline) ---
        hp: 80,
        maxHp: 80,
        attackDamage: 10,
        attackInterval: 1.0,   // seconds between attacks
        attackTimer: 0,        // time since last attack
        attackRange: 25,       // simple fixed melee range for now
        faction: 'player',     // who this unit belongs to
    },
];

units.push({
    x: canvas.width / 2 + 60,
    y: canvas.height / 2 - 40,
    size: 20,
    speed: 150,
    moving: false,
    tx: canvas.width / 2 + 60,
    ty: canvas.height / 2 - 40,
    selected: false,
    type: 'gatherer',
    role: 'gatherer',
    mining: false,
    miningTimer: 0,
    carried: 0,
    maxCarry: 5,
    mode: 'idle',
    homeNode: null,

    // basic HP so they can die
    hp: 50,
    maxHp: 50,
    attackDamage: 0,      // no attack yet
    attackInterval: 1.0,
    attackTimer: 0,
    attackRange: 0,
    faction: 'player',
});

// Example enemy soldier near top-right quadrant
units.push({
    x: (canvas.width / 4) * 3,
    y: canvas.height / 4,
    size: 20,
    speed: 150,
    moving: false,
    tx: (canvas.width / 4) * 3,
    ty: canvas.height / 4,
    selected: false,
    type: 'enemy_soldier',
    role: 'soldier',
    mining: false,
    miningTimer: 0,
    carried: 0,
    maxCarry: 5,
    mode: 'idle',
    homeNode: null,

    hp: 80,
    maxHp: 80,
    attackDamage: 10,
    attackInterval: 1.0,
    attackTimer: 0,
    attackRange: 25,
    faction: 'enemy',    // important for target selection
});

const barracks = {
    x: canvas.width / 4,
    y: canvas.height / 4,
    width: 80,
    height: 60,
    topInset: 20,
    selected: false,
    training: false,
    trainingTime: 0,
    trainingDuration: 5, // seconds for soldier
    rallyX: canvas.width / 4 + 100,
    rallyY: canvas.height / 2,
};

const refinery = {
    x: canvas.width / 4, // right side
    y: canvas.height - 200,
    size: 70,                  // rhombus size
    selected: false,
    training: false,
    trainingTime: 0,
    trainingDuration: 3,       // seconds for gatherer
    rallyX: (canvas.width / 4) * 3 - 100,
    rallyY: canvas.height / 2,
};

let lastTime = 0;

function screenToCanvas(x, y) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (x - rect.left) * (canvas.width / rect.width),
        y: (y - rect.top) * (canvas.height / rect.height),
    };
}

function getUnitRadius(u) {
    return u.size * 0.6; // a bit smaller than the square/triangle for nicer spacing
}

function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function findClosestEnemyInRange(attacker) {
    if (attacker.attackDamage <= 0 || attacker.attackRange <= 0) return null;
    let bestTarget = null;
    let bestDistSq = Infinity;
    const rangeSq = attacker.attackRange * attacker.attackRange;

    for (const target of units) {
        if (target === attacker) continue;
        if (!target.hp || target.hp <= 0) continue;
        if (target.faction === attacker.faction) continue; // only enemies

        const d2 = distanceSquared(attacker, target);
        if (d2 <= rangeSq && d2 < bestDistSq) {
            bestDistSq = d2;
            bestTarget = target;
        }
    }
    return bestTarget;
}

function isPointInUnit(px, py, u) {
    const half = u.size / 2;
    return (
        px >= u.x - half &&
        px <= u.x + half &&
        py >= u.y - half &&
        py <= u.y + half
    );
}

function isPointOnCopper(px, py) {
    const dx = px - copperNode.x;
    const dy = py - copperNode.y;
    const dist = Math.hypot(dx, dy);
    return dist <= copperNode.radius + 10; // small padding
}

function getSelectedUnit() {
    return units.find((u) => u.selected) || null;
}

function getSelectedUnits() {
    return units.filter((u) => u.selected);
}

function isPointInBarracks(px, py) {
    const b = barracks;
    const halfW = b.width / 2;
    const halfH = b.height / 2;
    return (
    px >= b.x - halfW &&
    px <= b.x + halfW &&
    py >= b.y - halfH &&
    py <= b.y + halfH
    );
}

function isPointInRefinery(px, py) {
    const r = refinery;
    const half = r.size / 2;
    // Simple bounding box for hit test
    return (
    px >= r.x - half &&
    px <= r.x + half &&
    py >= r.y - half &&
    py <= r.y + half
    );
}

function separateUnitFromCopper(u) {
    const ur = getUnitRadius(u);
    const nr = copperNode.radius;
    const minDist = ur + nr;
    const dx = u.x - copperNode.x;
    const dy = u.y - copperNode.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) {
        // Avoid NaN: if exactly at center, nudge randomly
        const angle = Math.random() * Math.PI * 2;
        u.x = copperNode.x + Math.cos(angle) * minDist;
        u.y = copperNode.y + Math.sin(angle) * minDist;
        return;
    }
    if (dist < minDist) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        // Push unit out so its edge touches the node's edge
        u.x += nx * overlap;
        u.y += ny * overlap;
    }
}

function gathererAtRefinery(u) {
    const ur = getUnitRadius(u);
    const rf = refinery;
    const half = rf.size / 2;
    const rx = rf.x - half;
    const ry = rf.y - half;
    const rw = rf.size;
    const rh = rf.size;
    // Circle vs AABB approximate
    let closestX = u.x;
    let closestY = u.y;
    if (u.x < rx) closestX = rx;
    else if (u.x > rx + rw) closestX = rx + rw;
    if (u.y < ry) closestY = ry;
    else if (u.y > ry + rh) closestY = ry + rh;
    const dx = u.x - closestX;
    const dy = u.y - closestY;
    const distSq = dx * dx + dy * dy;
    return distSq <= ur * ur * 1.5; // small padding
}

function gathererAtCopper(u) {
    const ur = getUnitRadius(u);
    const dx = u.x - copperNode.x;
    const dy = u.y - copperNode.y;
    const dist = Math.hypot(dx, dy);
    // Mining band: from just inside to a bit outside the ring
    const inner = copperNode.radius - ur * 0.5;
    const outer = copperNode.radius + ur * 1.5;
    return dist >= inner && dist <= outer;
}

function separateUnits() {
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
                // Move each unit half the overlap away from each other
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

function unitCollidesWithBarracks(u) {
    const r = getUnitRadius(u);
    const b = barracks;
    const halfW = b.width / 2;
    const halfH = b.height / 2;
    const rx = b.x - halfW;
    const ry = b.y - halfH;
    const rw = b.width;
    const rh = b.height;
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

function unitCollidesWithRefinery(u) {
    const r = getUnitRadius(u);
    const rf = refinery;
    const half = rf.size / 2;
    // Bounding box for the rhombus
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

function spawnUnitFromBuilding(type, b) {
    if (units.length >= 10) {
        console.log('Unit cap reached (10).');
        return null;
    }
    const spawnOffsetX = 50 + Math.random() * 20;
    const spawnOffsetY = (Math.random() - 0.5) * 30;
    const spawnX = b.x + spawnOffsetX;
    const spawnY = b.y + spawnOffsetY;
    const isSoldier = type === 'soldier';

    const u = {
        x: spawnX,
        y: spawnY,
        size: 20,
        speed: 150,
        moving: false,
        tx: b.rallyX,
        ty: b.rallyY,
        selected: false,
        type,            // 'soldier' or 'gatherer'
        role: type,      // same for now
        mining: false,
        miningTimer: 0,
        carried: 0,
        maxCarry: 5,
        mode: 'idle',
        homeNode: null,

        // Combat stats
        hp: isSoldier ? 80 : 50,
        maxHp: isSoldier ? 80 : 50,
        attackDamage: isSoldier ? 10 : 0,
        attackInterval: 1.0,
        attackTimer: 0,
        attackRange: isSoldier ? 25 : 0,
        faction: 'player',
    };
    u.moving = true;
    units.push(u);
    console.log(
        `Spawned ${type} from ${b === barracks ? 'barracks' : 'refinery'}. Total units: ${units.length}`
    );
    return u;
}


function refreshResources() {
    if (!scrapsAmountEl) return;
    scrapsAmountEl.textContent = scraps.toString();
}

function refreshUI() {
    if (!buildingUi) return;
    const buildingSelected = barracks.selected || refinery.selected;
    // Panel visibility
    if (buildingSelected) {
        buildingUi.classList.remove('hidden');
    } else {
        buildingUi.classList.add('hidden');
    }
    // Button and progress bar state
    if (trainBtn) {
        const atCap = units.length >= 10;
        const trainingActive =
        (barracks.selected && barracks.training) ||
        (refinery.selected && refinery.training);
        trainBtn.disabled = !buildingSelected || atCap || trainingActive;
    }
    if (trainProgress && trainProgressFill) {
        let training = null;
        if (barracks.selected && barracks.training) training = barracks;
        if (refinery.selected && refinery.training) training = refinery;
        if (training) {
            // Show bar and update fill
            trainProgress.classList.remove('hidden');
            const ratio = Math.min(
                training.trainingTime / training.trainingDuration,
                1
            );
            trainProgressFill.style.width = (ratio * 100).toFixed(1) + '%';
        } else {
            // Hide bar and reset fill
            trainProgress.classList.add('hidden');
            trainProgressFill.style.width = '0%';
        }
    }
    updateTrainControls();
}

function updateTrainControls() {
    if (!trainBtn) return;
    if (barracks.selected) {
        trainBtn.textContent = `Train Soldier (${SOLDIER_COST} Scraps)`;
        if (trainTimeLabel) {
            trainTimeLabel.textContent = `Build time: ${barracks.trainingDuration.toFixed(1)}s`;
        }
    } else if (refinery.selected) {
        trainBtn.textContent = `Train Gatherer (${GATHERER_COST} Scraps)`;
        if (trainTimeLabel) {
            trainTimeLabel.textContent = `Build time: ${refinery.trainingDuration.toFixed(1)}s`;
        }
    } else {
        trainBtn.textContent = 'Train Unit';
        if (trainTimeLabel) {
            trainTimeLabel.textContent = '';
        }
    }
}

if (trainBtn) {
    trainBtn.addEventListener('click', () => {
        if (!barracks.selected && !refinery.selected) return;
        if (units.length >= 10) {
            console.log('Unit cap reached (10).');
            return;
        }
        if (barracks.selected) {
            // Barracks → soldier
            if (barracks.training) {
                console.log('Barracks already training a unit.');
                return;
            }
            if (scraps < SOLDIER_COST) {
                console.log(`Not enough Scraps for soldier. Need ${SOLDIER_COST}, have ${scraps}.`);
                return;
            }
            scraps -= SOLDIER_COST;
            refreshResources();
            barracks.training = true;
            barracks.trainingTime = 0;
            console.log(`Barracks started training soldier (cost ${SOLDIER_COST}).`);
        } else if (refinery.selected) {
            // Refinery → gatherer
            if (refinery.training) {
                console.log('Refinery already training a unit.');
                return;
            }
            if (scraps < GATHERER_COST) {
                console.log(`Not enough Scraps for gatherer. Need ${GATHERER_COST}, have ${scraps}.`);
                return;
            }
            scraps -= GATHERER_COST;
            refreshResources();
            refinery.training = true;
            refinery.trainingTime = 0;
            console.log(`Refinery started training gatherer (cost ${GATHERER_COST}).`);
        }
        refreshUI();
    });
}

// Disable default right-click menu on the canvas
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

canvas.addEventListener('mousedown', (e) => {
    const pos = screenToCanvas(e.clientX, e.clientY);
    if (e.button === 0) {
        // LEFT CLICK: selection or drag-select
        let somethingSelected = false;
        // 1. Check buildings first
        if (isPointInBarracks(pos.x, pos.y)) {
            barracks.selected = true;
            refinery.selected = false;
            units.forEach((u) => (u.selected = false));
            somethingSelected = true;
            isDragging = false;
        } else if (isPointInRefinery(pos.x, pos.y)) {
            refinery.selected = true;
            barracks.selected = false;
            units.forEach((u) => (u.selected = false));
            somethingSelected = true;
            isDragging = false;
        } else {
            // 2. Check units (single-click select)
            let clickedUnit = null;
            for (const u of units) {
                if (isPointInUnit(pos.x, pos.y, u)) {
                    clickedUnit = u;
                    break;
                }
            }
            if (clickedUnit) {
                barracks.selected = false;
                refinery.selected = false;
                units.forEach((u) => (u.selected = false));
                clickedUnit.selected = true;
                somethingSelected = true;
                isDragging = false;
            }
        }
        // 3. If nothing was directly clicked, start a drag-box
        if (!somethingSelected) {
            barracks.selected = false;
            refinery.selected = false;
            units.forEach((u) => (u.selected = false));
            isDragging = true;
            dragStart.x = pos.x;
            dragStart.y = pos.y;
            dragEnd.x = pos.x;
            dragEnd.y = pos.y;
        }

        refreshUI();

        } else if (e.button === 2) {
            // RIGHT CLICK
            if (barracks.selected) {
                barracks.rallyX = pos.x;
                barracks.rallyY = pos.y;
            } else if (refinery.selected) {
                refinery.rallyX = pos.x;
                refinery.rallyY = pos.y;
            } else {
                const selectedUnits = getSelectedUnits();
                if (selectedUnits.length === 0) return;
                // If click is on the copper node, gatherers should mine
            if (isPointOnCopper(pos.x, pos.y)) {
                for (const u of selectedUnits) {
                    if (u.role === 'gatherer') {
                        // Move toward node with intent to mine
                        u.tx = copperNode.x;
                        u.ty = copperNode.y;
                        u.moving = true;
                        u.mining = false;              // will start when in range
                        u.miningTimer = 0;
                        u.homeNode = copperNode;       // remember where to return
                        u.mode = 'toNode';
                    } else {
                        // non-gatherers just move there normally
                        u.tx = pos.x;
                        u.ty = pos.y;
                        u.moving = true;
                        u.mining = false;
                        u.miningTimer = 0;
                    }
                }
            } else {
                // Normal move order; stop any mining behavior & auto loop
                for (const u of selectedUnits) {
                    u.tx = pos.x;
                    u.ty = pos.y;
                    u.moving = true;
                    if (u.role === 'gatherer') {
                        u.mining = false;
                        u.miningTimer = 0;
                        u.mode = 'idle';       // manual override cancels auto loop
                        u.homeNode = null;
                    }
                }
            }
            }
        }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    dragEnd.x = pos.x;
    dragEnd.y = pos.y;
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return; // only care about left-button up
    if (isDragging) {
        isDragging = false;
        // Normalize rectangle
        const x1 = Math.min(dragStart.x, dragEnd.x);
        const y1 = Math.min(dragStart.y, dragEnd.y);
        const x2 = Math.max(dragStart.x, dragEnd.x);
        const y2 = Math.max(dragStart.y, dragEnd.y);
        let anyUnitSelected = false;
        for (const u of units) {
            if (u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) {
                u.selected = true;
                anyUnitSelected = true;
            } else {
                u.selected = false;
            }
        }
        // If we selected at least one unit, ensure no building is selected
        if (anyUnitSelected) {
            barracks.selected = false;
            refinery.selected = false;
        }
        refreshUI();
    }
});



function update(dt) {
    // Move units
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
            // no "continue", we still want to check mining below
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
        // Prevent entering buildings - allow sliding along edges
        const collidesBarracks = unitCollidesWithBarracks(u);
        const collidesRefinery = unitCollidesWithRefinery(u);

        if (collidesBarracks || collidesRefinery) {
            // Revert to old position first
            u.x = oldX;
            u.y = oldY;
            // Determine which building we hit
            const b = collidesBarracks ? barracks : refinery;
            const halfW = b === barracks ? b.width / 2 : b.size / 2;
            const halfH = b === barracks ? b.height / 2 : b.size / 2;
            const bx = b.x;
            const by = b.y;
            // Vector from building center to unit
            const vx = u.x - bx;
            const vy = u.y - by;
            // Decide whether to block X or Y more strongly
            if (Math.abs(vx) > Math.abs(vy)) {
                // We are more to the left/right: block X movement, allow Y
                u.tx = u.tx; // unchanged
                // If target is inside the building horizontally, nudge the target
                if (u.tx > bx - halfW && u.tx < bx + halfW) {
                    u.tx = (vx > 0) ? bx + halfW + getUnitRadius(u) : bx - halfW - getUnitRadius(u);
                }
            } else {
                // We are more above/below: block Y movement, allow X
                if (u.ty > by - halfH && u.ty < by + halfH) {
                    u.ty = (vy > 0) ? by + halfH + getUnitRadius(u) : by - halfH - getUnitRadius(u);
                }
            }
            // Let the unit keep moving with adjusted target so it slides around
            u.moving = true;
        }
        // Keep unit outside copper center
        separateUnitFromCopper(u);
    }

    // Unit-unit separation
    separateUnits();

    // --- Mining logic and carry/return for gatherers ---
    for (const u of units) {
        if (u.role !== 'gatherer') continue;

        // 1) If we were walking to a node and reached it, start mining
        if (u.mode === 'toNode' && u.homeNode && gathererAtCopper(u)) {
            u.moving = false;
            u.mining = true;
            u.mode = 'mining';
            u.miningTimer = 0;
        }

        // 2) Mining at node
        if (u.mode === 'mining' && u.mining && gathererAtCopper(u)) {
            u.moving = false;   // stay put while mining
            u.miningTimer += dt;
            if (u.miningTimer >= 1) {
                const cycles = Math.floor(u.miningTimer);
                if (cycles > 0) {
                    const spaceLeft = u.maxCarry - u.carried;
                    // how much we can actually pick up
                    const mined = Math.min(cycles, spaceLeft);
                    u.carried += mined;
                    u.miningTimer -= cycles;

                    console.log(
                        `Gatherer mined ${mined}. Carrying: ${u.carried}/${u.maxCarry}`
                    );
                }

                // If full, head back to refinery
                if (u.carried >= u.maxCarry) {
                    u.mining = false;
                    u.miningTimer = 0;
                    u.mode = 'toRefinery';
                    u.tx = refinery.x;
                    u.ty = refinery.y;
                    u.moving = true;
                }
            }
        } else if (u.mode === 'mining' && !gathererAtCopper(u)) {
            // somehow drifted off node (pushed by separation, etc.)
            u.mining = false;
            u.mode = 'toNode';
            if (u.homeNode) {
                u.tx = u.homeNode.x;
                u.ty = u.homeNode.y;
                u.moving = true;
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
                refreshResources();
                u.carried = 0;
            }

            // After deposit, go back to node if we have one
            if (u.homeNode) {
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

        // Safety: if not mining and no movement, reset timer
        if (!u.mining) {
            // don't reset carried, only timer
            // u.carried persists between trips
            if (u.mode !== 'mining') {
                // only reset when not in active mining state
                u.miningTimer = 0;
            }
        }
    }
    // Barracks training (soldiers)
    if (barracks.training) {
        barracks.trainingTime += dt;
        if (barracks.trainingTime >= barracks.trainingDuration) {
            barracks.training = false;
            barracks.trainingTime = 0;
            if (units.length < 10) {
                spawnUnitFromBuilding('soldier', barracks);
            } else {
                console.log('Barracks finished, but unit cap reached (10).');
            }
            refreshUI();
        } else {
        refreshUI();
        }
    }
    // Refinery training (gatherers)
    if (refinery.training) {
        refinery.trainingTime += dt;
        if (refinery.trainingTime >= refinery.trainingDuration) {
            refinery.training = false;
            refinery.trainingTime = 0;
            if (units.length < 10) {
                spawnUnitFromBuilding('gatherer', refinery);
            } else {
                console.log('Refinery finished, but unit cap reached (10).');
            }
            refreshUI();
        } else {
            refreshUI();
        }
    }
        // --- Combat: attacks and deaths ---
    for (const u of units) {
        if (!u.hp || u.hp <= 0) continue;        // skip dead or non-combatants
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

    // Remove dead units
    for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.hp !== undefined && u.hp <= 0) {
            console.log(`Unit ${u.type} died.`);
            units.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);
    drawSelectionBox(ctx, dragStart, dragEnd, isDragging);
    drawCopperNode(ctx, copperNode);
    drawBarracks(ctx, barracks);
    drawRefinery(ctx, refinery);
    drawRallyPoint(ctx, barracks);
    drawRallyPoint(ctx, refinery);
    for (const u of units) {
        drawUnit(ctx, u);
    }
}

function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

refreshUI();
refreshResources();

requestAnimationFrame((t) => {
    lastTime = t;
    loop(t);
});

});