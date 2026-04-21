// 3‑state Fog of War support (unexplored / explored / visible)
// World‑space grid, rendered as an overlay via the camera.

export const FOG_UNEXPLORED = 0; // black
export const FOG_EXPLORED   = 1; // grey
export const FOG_VISIBLE    = 2; // bright

/**
 * Creates and owns the fog‑of‑war state for a single player.
 *
 * Usage from main.js (eventually):
 *   const fog = createFogOfWar({ worldWidth, worldHeight, cellSize: 40 });
 *   // each frame:
 *   fog.updateVisibility({ units, buildings, localPlayerId: LOCAL_PLAYER_ID });
 *   // in draw():
 *   fog.draw(ctx, camera, canvas.width, canvas.height);
 */
export function createFogOfWar({
  worldWidth,
  worldHeight,
  cellSize = 40, // matches your grid size by default
}) {
  const cols = Math.ceil(worldWidth / cellSize);
  const rows = Math.ceil(worldHeight / cellSize);

  // 2D array: fog[x][y] = FOG_UNEXPLORED | FOG_EXPLORED | FOG_VISIBLE
  const cells = [];
  for (let x = 0; x < cols; x++) {
    cells[x] = [];
    for (let y = 0; y < rows; y++) {
      cells[x][y] = FOG_UNEXPLORED;
    }
  }

  // Internal helper: reset current visibility back to explored.
  function clearVisibility() {
    for (let x = 0; x < cols; x++) {
      const col = cells[x];
      for (let y = 0; y < rows; y++) {
        if (col[y] === FOG_VISIBLE) {
          col[y] = FOG_EXPLORED;
        }
      }
    }
  }

  // Internal helper: reveal a circular area around a world‑space position.
  function revealCircle(worldX, worldY, visionRange) {
    if (visionRange <= 0) return;

    const cx = Math.floor(worldX / cellSize);
    const cy = Math.floor(worldY / cellSize);
    const radiusCells = Math.ceil(visionRange / cellSize);
    const radiusSq = radiusCells * radiusCells;

    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      const gx = cx + dx;
      if (gx < 0 || gx >= cols) continue;

      for (let dy = -radiusCells; dy <= radiusCells; dy++) {
        const gy = cy + dy;
        if (gy < 0 || gy >= rows) continue;

        if (dx * dx + dy * dy > radiusSq) continue;

        const prev = cells[gx][gy];
        cells[gx][gy] = FOG_VISIBLE;
        if (prev === FOG_UNEXPLORED) {
          // First time revealed; currently we just mark as VISIBLE.
          // If you ever need a separate "wasEverSeen" array, hook it here.
        }
      }
    }
  }

  /**
   * Recompute which cells are visible this frame.
   *
   * @param {Object} params
   * @param {Array}  params.units        - all units in the game
   * @param {Array}  params.buildings    - buildings you want to grant vision (refinery, barracks, etc.)
   * @param {number} params.localPlayerId
   *
   * Each unit/building should have:
   *   ownerId      - for player ownership
   *   x, y         - world coordinates
   *   visionRange  - optional, falls back to defaults if missing
   */
  function updateVisibility({
    units,
    buildings,
    localPlayerId,
    defaultUnitVision = 260,
    defaultBuildingVision = 320,
  }) {
    clearVisibility();

    if (Array.isArray(units)) {
      for (const u of units) {
        if (!u) continue;
        if (u.ownerId !== localPlayerId) continue;

        const vision = u.visionRange ?? defaultUnitVision;
        revealCircle(u.x, u.y, vision);
      }
    }

    if (Array.isArray(buildings)) {
      for (const b of buildings) {
        if (!b) continue;
        if (b.ownerId !== localPlayerId) continue;

        const vision = b.visionRange ?? defaultBuildingVision;
        revealCircle(b.x, b.y, vision);
      }
    }
  }

  /**
   * Draw the fog overlay on top of the world.
   *
   * Call this at the end of your draw() in main.js:
   *   fog.draw(ctx, camera, canvas.width, canvas.height);
   */
  function draw(ctx, camera, canvasWidth, canvasHeight) {
    for (let x = 0; x < cols; x++) {
      const col = cells[x];
      for (let y = 0; y < rows; y++) {
        const state = col[y];
        if (state === FOG_VISIBLE) continue; // no overlay

        const worldX = x * cellSize;
        const worldY = y * cellSize;

        const s0 = camera.worldToScreen(worldX, worldY);
        const s1 = camera.worldToScreen(worldX + cellSize, worldY + cellSize);
        const w = s1.x - s0.x;
        const h = s1.y - s0.y;

        // Optionally: skip if the cell is fully off‑screen.
        if (s0.x > canvasWidth || s0.y > canvasHeight || s1.x < 0 || s1.y < 0) {
          continue;
        }

        if (state === FOG_UNEXPLORED) {
          ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';  // black
        } else if (state === FOG_EXPLORED) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';  // grey
        }

        ctx.fillRect(s0.x, s0.y, w, h);
      }
    }
  }

  /**
   * Public API: query fog at a world position.
   * Useful later to hide enemy units/buildings in unexplored tiles.
   */
  function getStateAt(worldX, worldY) {
    const gx = Math.floor(worldX / cellSize);
    const gy = Math.floor(worldY / cellSize);
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return FOG_UNEXPLORED;
    return cells[gx][gy];
  }

  return {
    cols,
    rows,
    cellSize,
    cells,
    updateVisibility,
    draw,
    getStateAt,
  };
}