// Draw The Game

const LOCAL_PLAYER_ID = 1;

export function drawSelectionBox(ctx, dragStart, dragEnd, isDragging) {
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

export function drawCopperNode(ctx, node) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#b87333';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
}

export function drawUnit(ctx, u) {
    const half = u.size / 2;

    // --- Color by ownerId instead of faction ---
    let baseColor;
    if (u.ownerId === LOCAL_PLAYER_ID) {
        baseColor = '#4da6ff';   // blue for local player
    } else {
        baseColor = '#ff4d4d';   // red-ish for enemies / others
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    // --- Shape: gatherer = triangle, others = square ---
    if (u.type === 'gatherer') {
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(u.x, u.y - half);          // top
        ctx.lineTo(u.x + half, u.y + half);   // bottom-right
        ctx.lineTo(u.x - half, u.y + half);   // bottom-left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.rect(u.x - half, u.y - half, u.size, u.size);
        ctx.fill();
        ctx.stroke();
    }

    // --- Health bar above unit ---
    // Only show when damaged
    if (
        u.hp !== undefined &&
        u.maxHp !== undefined &&
        u.maxHp > 0 &&
        u.hp < u.maxHp
    ) {
        const barWidth = u.size;        // same width as unit
        const barHeight = 4;            // thin bar
        const barOffset = 8;            // pixels above unit

        const x = u.x - barWidth / 2;
        const y = u.y - (u.size / 2) - barOffset - barHeight;

        const ratio = Math.max(0, Math.min(1, u.hp / u.maxHp));

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y, barWidth, barHeight);

        // Foreground (same color logic as before)
        const hpColor = u.ownerId === 1 ? '#00ff66' : '#ff3333';
        ctx.fillStyle = hpColor;
        ctx.fillRect(x, y, barWidth * ratio, barHeight);

        // Optional border
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }

    // --- Selection outline ---
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

export function drawBarracks(ctx, b) {
    const halfW = b.width / 2;
    const halfH = b.height / 2;
    const bottomLeftX = b.x - halfW;
    const bottomRightX = b.x + halfW;
    const bottomY = b.y + halfH;
    const topLeftX = b.x - halfW + b.topInset;
    const topRightX = b.x + halfW - b.topInset;
    const topY = b.y - halfH;

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

export function drawRefinery(ctx, r) {
    const half = r.size / 2;
    ctx.fillStyle = '#3b74c7';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y - half);
    ctx.lineTo(r.x + half, r.y);
    ctx.lineTo(r.x, r.y + half);
    ctx.lineTo(r.x - half, r.y);
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

export function drawRallyPoint(ctx, b) {
    const x = b.rallyX;
    const y = b.rallyY;
    ctx.save();
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y + 12);
    ctx.stroke();
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 10, y - 8);
    ctx.lineTo(x, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

export function drawGrid(ctx, canvasWidth, canvasHeight, camera) {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const gridSize = 40;

    const offsetX = camera ? camera.x : 0;
    const offsetY = camera ? camera.y : 0;

    // Find first vertical grid line visible in the viewport
    let startX = - (offsetX % gridSize);
    if (startX > 0) startX -= gridSize;

    for (let x = startX; x <= canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }

    // Horizontal lines
    let startY = - (offsetY % gridSize);
    if (startY > 0) startY -= gridSize;

    for (let y = startY; y <= canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }
}