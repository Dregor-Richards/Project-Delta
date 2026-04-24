// renderLoop.js
import {
  drawSelectionBox,
  drawCopperNode,
  drawUnit,
  drawBarracks,
  drawRefinery,
  drawRallyPoint,
  drawGrid,
} from './gameRender.js';
import { FOG_VISIBLE } from './fogOfWar.js';

export function createRenderer({
  ctx,
  canvas,
  camera,
  LOCAL_PLAYER_ID,
  fog,
  copperNodes,
  enemyCopperNodes,
  barracksList,
  refinery,
  enemyRefinery,
  getConstructionState,
  getConstructionJobs,
  getDragState,
  units,
}) {
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrid(ctx, canvas.width, canvas.height, camera);

    // Selection box
    const { isDragging, dragStart, dragEnd } = getDragState();
    const selStart = camera.worldToScreen(dragStart.x, dragStart.y);
    const selEnd = camera.worldToScreen(dragEnd.x, dragEnd.y);
    drawSelectionBox(ctx, selStart, selEnd, isDragging);

    // Player copper
    for (const node of copperNodes) {
      if (!node.active) continue;
      const s = camera.worldToScreen(node.x, node.y);
      drawCopperNode(ctx, { ...node, x: s.x, y: s.y });
    }

    // Enemy copper
    for (const node of enemyCopperNodes) {
      if (!node.active) continue;
      const s = camera.worldToScreen(node.x, node.y);
      drawCopperNode(ctx, { ...node, x: s.x, y: s.y });
    }

    // Placement preview ghost
    const constructionState = getConstructionState();
    if (constructionState.mode === 'placing' && constructionState.preview) {
      const ghost = constructionState.preview;
      const s = camera.worldToScreen(ghost.x, ghost.y);
      ctx.save();
      ctx.globalAlpha = 0.3;
      drawBarracks(ctx, {
        x: s.x,
        y: s.y,
        width: ghost.width,
        height: ghost.height,
        topInset: ghost.topInset,
        selected: false,
      });
      ctx.restore();
    }

    // Fixed ghosts while building (one per job)
    for (const job of getConstructionJobs()) {
      if (job.completed) continue;
      const ghost = job.ghost;
      const s = camera.worldToScreen(ghost.x, ghost.y);

      ctx.save();
      ctx.globalAlpha = 0.4;
      drawBarracks(ctx, {
        x: s.x,
        y: s.y,
        width: ghost.width,
        height: ghost.height,
        topInset: ghost.topInset,
        selected: false,
      });
      ctx.restore();

      const progress = Math.max(0, Math.min(1, job.buildTimer / job.buildDuration));
      const barWidth = ghost.width;
      const barHeight = 6;
      const barX = s.x - barWidth / 2;
      const topY = s.y - ghost.height / 2;
      const barY = topY - 10;

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = '#4caf50';
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);

      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
      ctx.restore();
    }

    // Real barracks
    for (const b of barracksList) {
      const s = camera.worldToScreen(b.x, b.y);
      const rallyScreen = camera.worldToScreen(b.rallyX, b.rallyY);

      drawBarracks(ctx, { ...b, x: s.x, y: s.y });

      if (b.selected) {
        drawRallyPoint(ctx, {
          ...b,
          x: s.x,
          y: s.y,
          rallyX: rallyScreen.x,
          rallyY: rallyScreen.y,
        });
      }
    }

    // Refinery
    const refScreen = camera.worldToScreen(refinery.x, refinery.y);
    const refRallyScreen = camera.worldToScreen(refinery.rallyX, refinery.rallyY);
    drawRefinery(ctx, { ...refinery, x: refScreen.x, y: refScreen.y });

    if (refinery.selected) {
      drawRallyPoint(ctx, {
        ...refinery,
        x: refScreen.x,
        y: refScreen.y,
        rallyX: refRallyScreen.x,
        rallyY: refRallyScreen.y,
      });
    }

    const enemyRefScreen = camera.worldToScreen(enemyRefinery.x, enemyRefinery.y);
    drawRefinery(ctx, { ...enemyRefinery, x: enemyRefScreen.x, y: enemyRefScreen.y });

    for (const u of units) {
      if (u.ownerId !== LOCAL_PLAYER_ID) {
        const fogState = fog.getStateAt(u.x, u.y);
        if (fogState !== FOG_VISIBLE) {
          continue;
        }
      }
      const s = camera.worldToScreen(u.x, u.y);
      drawUnit(ctx, { ...u, x: s.x, y: s.y });
    }

    fog.draw(ctx, camera, canvas.width, canvas.height);
  }

  return { draw };
}