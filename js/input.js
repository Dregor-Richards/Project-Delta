// Centralizes canvas mouse input, selection, and commands.

import { findIdleWorkers } from './targeting.js';

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
  startConstructionJob,
  localPlayerId,
  focusCameraOn,
}) {
  const dragStart = { x: 0, y: 0 };
  const dragEnd = { x: 0, y: 0 };
  let isDragging = false;

  let isAttackMoveMode = false;

  // --- Idle worker selection state (moved OUT of handlers) ---
  let lastIdleWorkerIndex = -1;

  let lastClickTime = 0;
  let lastClickedUnit = null;
  const DOUBLE_CLICK_THRESHOLD = 300;

  function selectIdleWorker() {
    const idleWorkers = findIdleWorkers(units, localPlayerId);
    if (idleWorkers.length === 0) {
      return;
    }

    // Advance index cyclically
    lastIdleWorkerIndex = (lastIdleWorkerIndex + 1) % idleWorkers.length;
    const worker = idleWorkers[lastIdleWorkerIndex];

    // Clear all selections
    for (const u of units) {
      u.selected = false;
    }

    // Select this worker
    worker.selected = true;

    // Focus camera on the worker
    if (focusCameraOn) {
      focusCameraOn(worker.x, worker.y);
    }

    if (refreshUI) {
      refreshUI();
    }
  }

  // Screen (client) -> world using camera
  function screenToWorldPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cx = (clientX - rect.left) * (canvas.width / rect.width);
    const cy = (clientY - rect.top) * (canvas.height / rect.height);
    camera.updateMousePosition(cx, cy);
    return camera.screenToWorld(cx, cy);
  }

  function selectAllVisibleUnitsOfType(unitType) {
    // Get visible viewport bounds in world coordinates
    const viewBounds = camera.getViewBounds();
    
    let selectedCount = 0;
    for (const u of units) {
      if (u.ownerId !== localPlayerId) continue; // Only select player's units
      if (u.type !== unitType) continue; // Must match type
      
      // Check if unit is within visible viewport
      if (
        u.x >= viewBounds.left &&
        u.x <= viewBounds.right &&
        u.y >= viewBounds.top &&
        u.y <= viewBounds.bottom
      ) {
        u.selected = true;
        selectedCount++;
      } else {
        u.selected = false;
      }
    }
    
    console.log(`Double-click: selected ${selectedCount} ${unitType} units`);
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
        // Decide which unit is the builder:
        const selectedUnits = getSelectedUnits();
        const builder =
          selectedUnits.find((u) => u.role === 'gatherer') || selectedUnits[0];

        if (!builder) {
          console.log('No builder selected; cannot start construction.');
          constructionState.mode = 'idle';
          constructionState.preview = null;
          return;
        }

        startConstructionJob({
          x: pos.x,
          y: pos.y,
          builder,
        });

        constructionState.preview = null;
        constructionState.mode = 'idle';

        console.log('Placed barracks ghost at', pos.x, pos.y);
        return;
      }

      // ATTACK-MOVE CLICK
      if (isAttackMoveMode) {
        const selectedUnits = getSelectedUnits();
        const militaryUnits = selectedUnits.filter(
          (u) => u.attackDamage > 0 && u.attackRange > 0
        );

        for (const u of militaryUnits) {
          u.attackMoveDest = { x: pos.x, y: pos.y };
          u.tx = pos.x;
          u.ty = pos.y;
          u.moving = true;
          u.isAttackMoving = true;
        }

        isAttackMoveMode = false;
        console.log('Attack-move destination set at', pos.x, pos.y);
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
        barracksList.forEach((b) => (b.selected = false));
        clickedBarracks.selected = true;
        refinery.selected = false;
        units.forEach((u) => (u.selected = false));
        somethingSelected = true;
        isDragging = false;
      } else if (isPointInRefinery(refinery, pos.x, pos.y)) {
        refinery.selected = true;
        barracksList.forEach((b) => (b.selected = false));
        units.forEach((u) => (u.selected = false));
        somethingSelected = true;
        isDragging = false;
      } else {
        let clickedUnit = null;
        for (const u of units) {
          if (u.ownerId !== localPlayerId) continue;
          if (isPointInUnit(pos.x, pos.y, u)) {
            clickedUnit = u;
            break;
          }
        }
        if (clickedUnit) {
          refinery.selected = false;
          barracksList.forEach((b) => (b.selected = false));
          
          const now = Date.now();
          const timeSinceLastClick = now - lastClickTime;
          
          // Check for double-click on same unit type
          if (
            timeSinceLastClick < DOUBLE_CLICK_THRESHOLD &&
            lastClickedUnit &&
            lastClickedUnit.type === clickedUnit.type
          ) {
            // DOUBLE-CLICK: Select all visible units of this type
            selectAllVisibleUnitsOfType(clickedUnit.type);
            lastClickedUnit = null; // Reset to prevent triple-click
          } else {
            // SINGLE CLICK: Select just this unit
            units.forEach((u) => (u.selected = false));
            clickedUnit.selected = true;
            lastClickedUnit = clickedUnit;
          }
          
          lastClickTime = now;
          somethingSelected = true;
          isDragging = false;
        }
      }

      if (!somethingSelected) {
        refinery.selected = false;
        barracksList.forEach((b) => (b.selected = false));
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
        barracksList.forEach((b) => (b.selected = false));
      }
      refreshUI();
    }
  });

  // Attack-move and Stop hotkeys
  window.addEventListener('keydown', (e) => {
    const selectedUnits = getSelectedUnits();
    
    if (e.key === 'a' || e.key === 'A') {
      const militaryUnits = selectedUnits.filter(
        (u) => u.attackDamage > 0 && u.attackRange > 0
      );
      
      if (militaryUnits.length > 0) {
        isAttackMoveMode = true;
        console.log('Attack-move mode activated. Click to set destination.');
      }
    } else if (e.key === 's' || e.key === 'S') {
      if (selectedUnits.length > 0) {
        for (const u of selectedUnits) {
          // Cancel movement
          u.moving = false;
          u.tx = u.x;
          u.ty = u.y;
          
          // Cancel attack-move
          u.isAttackMoving = false;
          u.attackMoveDest = null;
          u.inCombat = false;
          
          // Cancel gathering (if gatherer)
          if (u.role === 'gatherer') {
            u.mining = false;
            u.miningTimer = 0;
            u.mode = 'idle';
            u.homeNode = null;
          }
        }
        
        console.log(`Stopped ${selectedUnits.length} unit(s)`);
      }
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
    selectIdleWorker, // now in scope
    getAttackMoveMode: () => isAttackMoveMode,
  };
}