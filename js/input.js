// input.js
// Centralizes canvas mouse input, selection, and commands.

export function createInputController({
  canvas,
  camera,
  units,
  barracksList,
  refinery,
  copperNodes,
  constructionState,
  getSelectedUnits,
  getSelectedBarracks,
  findNearestCopperNode,
  isPointInUnit,
  isPointOnCopper,
  isPointInRefinery,
  isPointInBarracks,
  refreshUI,
}) {
  const dragStart = { x: 0, y: 0 };
  const dragEnd = { x: 0, y: 0 };
  let isDragging = false;

  // Screen (client) -> world using camera
  function screenToWorldPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cx = (clientX - rect.left) * (canvas.width / rect.width);
    const cy = (clientY - rect.top) * (canvas.height / rect.height);
    camera.updateMousePosition(cx, cy);
    return camera.screenToWorld(cx, cy);
  }

  canvas.addEventListener('mouseleave', () => {
    camera.clearMousePosition();
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  canvas.addEventListener('mousedown', (e) => {
    const pos = screenToWorldPos(e.clientX, e.clientY);

    if (e.button === 0) {
      // PLACEMENT CLICK
      if (constructionState.mode === 'placing') {
        const width = 80;
        const height = 60;
        const topInset = 20;

        constructionState.ghost = {
          x: pos.x,
          y: pos.y,
          width,
          height,
          topInset,
        };

        constructionState.preview = null;
        constructionState.mode = 'building';
        constructionState.buildTimer = 0;

        if (constructionState.builder) {
          const b = constructionState.builder;
          b.tx = pos.x;
          b.ty = pos.y + height * 0.3;
          b.moving = true;
          b.mode = 'building';
        }

        console.log('Placed barracks ghost at', pos.x, pos.y);
        return;
      }

      let somethingSelected = false;

      // BARRACKS SELECTION
      let clickedBarracks = null;
      for (const b of barracksList) {
        if (isPointInBarracks(b, pos.x, pos.y)) {
          clickedBarracks = b;
          break;
        }
      }

      if (clickedBarracks) {
        barracksList.forEach(b => (b.selected = false));
        clickedBarracks.selected = true;
        refinery.selected = false;
        units.forEach(u => (u.selected = false));
        somethingSelected = true;
        isDragging = false;
      } else if (isPointInRefinery(refinery, pos.x, pos.y)) {
        refinery.selected = true;
        barracksList.forEach(b => (b.selected = false));
        units.forEach((u) => (u.selected = false));
        somethingSelected = true;
        isDragging = false;
      } else {
        let clickedUnit = null;
        for (const u of units) {
          if (isPointInUnit(pos.x, pos.y, u)) {
            clickedUnit = u;
            break;
          }
        }
        if (clickedUnit) {
          refinery.selected = false;
          barracksList.forEach(b => (b.selected = false));
          units.forEach((u) => (u.selected = false));
          clickedUnit.selected = true;
          somethingSelected = true;
          isDragging = false;
        }
      }

      if (!somethingSelected) {
        refinery.selected = false;
        barracksList.forEach(b => (b.selected = false));
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
      const selectedBarracks = getSelectedBarracks();

      if (refinery.selected) {
        refinery.rallyX = pos.x;
        refinery.rallyY = pos.y;
      } else if (selectedBarracks) {
        selectedBarracks.rallyX = pos.x;
        selectedBarracks.rallyY = pos.y;
      } else {
        const selectedUnits = getSelectedUnits();
        if (selectedUnits.length === 0) return;

        if (isPointOnCopper(copperNodes, pos.x, pos.y)) {
          const targetNode = findNearestCopperNode(copperNodes, pos.x, pos.y);
          if (!targetNode) return;

          for (const u of selectedUnits) {
            if (u.role === 'gatherer') {
              u.tx = targetNode.x;
              u.ty = targetNode.y;
              u.moving = true;
              u.mining = false;
              u.miningTimer = 0;
              u.homeNode = targetNode;
              u.mode = 'toNode';
            } else {
              u.tx = pos.x;
              u.ty = pos.y;
              u.moving = true;
              u.mining = false;
              u.miningTimer = 0;
            }
          }
        } else {
          for (const u of selectedUnits) {
            u.tx = pos.x;
            u.ty = pos.y;
            u.moving = true;
            if (u.role === 'gatherer') {
              u.mining = false;
              u.miningTimer = 0;
              u.mode = 'idle';
              u.homeNode = null;
            }
          }
        }
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const pos = screenToWorldPos(e.clientX, e.clientY);

    if (constructionState.mode === 'placing') {
      const width = 80;
      const height = 60;
      const topInset = 20;

      constructionState.preview = {
        x: pos.x,
        y: pos.y,
        width,
        height,
        topInset,
      };
    }

    if (!isDragging) return;
    dragEnd.x = pos.x;
    dragEnd.y = pos.y;
  });

  canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (isDragging) {
      isDragging = false;
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
      if (anyUnitSelected) {
        refinery.selected = false;
        barracksList.forEach(b => (b.selected = false));
      }
      refreshUI();
    }
  });

  return {
    getDragState() {
      return {
        isDragging,
        dragStart,
        dragEnd,
      };
    },
    // Expose for reuse from main (e.g. zoom wheel & other tools)
    screenToWorldPos,
  };
}