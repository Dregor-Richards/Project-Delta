(function () {
    const canvas = document.getElementById('gameCanvas');
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
        const u = {
            x: spawnX,
            y: spawnY,
            size: 20,
            speed: 150,
            moving: false,
            tx: b.rallyX,
            ty: b.rallyY,
            selected: false,
            type, // 'soldier' or 'gatherer'
            role: type,          // same as type for now
            mining: false,
            miningTimer: 0,
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
                                // Move toward node, with mining intent
                                u.tx = copperNode.x;
                                u.ty = copperNode.y;
                                u.moving = true;
                                u.mining = true;        // they intend to mine on arrival
                                u.miningTimer = 0;
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
                        // Normal move order; stop any mining behavior
                        for (const u of selectedUnits) {
                            u.tx = pos.x;
                            u.ty = pos.y;
                            u.moving = true;
                            if (u.role === 'gatherer') {
                                u.mining = false;
                                u.miningTimer = 0;
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
            // Prevent entering buildings
            if (unitCollidesWithBarracks(u) || unitCollidesWithRefinery(u)) {
                u.x = oldX;
                u.y = oldY;
                u.moving = false;
            }
            // Keep unit outside copper center
            separateUnitFromCopper(u);
        }

        // Unit-unit separation
        separateUnits();

        // --- Mining logic for gatherers ---
        for (const u of units) {
            if (u.role !== 'gatherer') continue;
            if (u.mining && gathererAtCopper(u)) {
                // They have arrived and are in range; ensure they don't "drift"
                u.moving = false;
                u.miningTimer += dt;
                if (u.miningTimer >= 1) {
                    const cycles = Math.floor(u.miningTimer);
                    scraps += cycles;               // 1 Scrap per second
                    u.miningTimer -= cycles;
                    console.log(`Gatherer mined ${cycles} Scraps. Total: ${scraps}`);
                    refreshResources();
                }
            } else if (!u.mining) {
                u.miningTimer = 0;
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
    }



    function drawSelectionBox() {
        if (!isDragging) return;
        const x = dragStart.x;
        const y = dragStart.y;
        const w = dragEnd.x - dragStart.x;
        const h = dragEnd.y - dragStart.y;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }

    function drawCopperNode(node) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#b87333';   // copper color [web:119]
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }

    function drawUnit(u) {
        const half = u.size / 2;
        // Body
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        if (u.type === 'gatherer') {
            // Blue triangle
            ctx.fillStyle = '#4da6ff';
            ctx.beginPath();
            ctx.moveTo(u.x, u.y - half);           // top
            ctx.lineTo(u.x + half, u.y + half);    // bottom-right
            ctx.lineTo(u.x - half, u.y + half);    // bottom-left
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            // Default: blue square (soldier)
            ctx.fillStyle = '#4da6ff';
            ctx.beginPath();
            ctx.rect(u.x - half, u.y - half, u.size, u.size);
            ctx.fill();
            ctx.stroke();
        }
        // Selection outline
        if (u.selected) {
            ctx.strokeStyle = '#ff5900';
            ctx.lineWidth = 3;
            const padding = 4;
            ctx.beginPath();
            ctx.rect(
            u.x - half - padding,
            u.y - half - padding,
            u.size + padding * 2,
            u.size + padding * 2
            );
            ctx.stroke();
        }
    }

    function drawBarracks(b) {
        const halfW = b.width / 2;
        const halfH = b.height / 2;
        const bottomLeftX = b.x - halfW;
        const bottomRightX = b.x + halfW;
        const bottomY = b.y + halfH;
        const topLeftX = b.x - halfW + b.topInset;
        const topRightX = b.x + halfW - b.topInset;
        const topY = b.y - halfH;
        // Body
        ctx.fillStyle = '#3b74c7';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bottomLeftX, bottomY);
        ctx.lineTo(bottomRightX, bottomY);
        ctx.lineTo(topRightX, topY);
        ctx.lineTo(topLeftX, topY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Selection outline
        if (b.selected) {
            ctx.strokeStyle = '#ff5900';
            ctx.lineWidth = 3;
            const pad = 6;
            ctx.beginPath();
            ctx.moveTo(bottomLeftX - pad, bottomY + pad);
            ctx.lineTo(bottomRightX + pad, bottomY + pad);
            ctx.lineTo(topRightX + pad, topY - pad);
            ctx.lineTo(topLeftX - pad, topY - pad);
            ctx.closePath();
            ctx.stroke();
        }
    }

    function drawRefinery(r) {
        const half = r.size / 2;
        ctx.fillStyle = '#3b74c7';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - half);     // top
        ctx.lineTo(r.x + half, r.y);     // right
        ctx.lineTo(r.x, r.y + half);     // bottom
        ctx.lineTo(r.x - half, r.y);     // left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (r.selected) {
            const pad = 6;
            ctx.strokeStyle = '#ff5900';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(r.x, r.y - half - pad);
            ctx.lineTo(r.x + half + pad, r.y);
            ctx.lineTo(r.x, r.y + half + pad);
            ctx.lineTo(r.x - half - pad, r.y);
            ctx.closePath();
            ctx.stroke();
        }
    }

    function drawRallyPoint(b) {
        const x = b.rallyX;
        const y = b.rallyY;
        ctx.save();
        // Pole
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x, y + 12);
        ctx.stroke();
        // Flag
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x + 10, y - 8);
        ctx.lineTo(x, y - 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawGrid() {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x <= canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        drawSelectionBox();
        drawCopperNode(copperNode);
        drawBarracks(barracks);
        drawRefinery(refinery);
        drawRallyPoint(barracks);
        drawRallyPoint(refinery);
        for (const u of units) {
            drawUnit(u);
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
    })();