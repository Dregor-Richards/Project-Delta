import { hasIdleWorker } from './targeting.js';

export function createUIController({
  LOCAL_PLAYER_ID,
  // DOM elements
  scrapsAmountEl,
  popAmountEl,
  popCapEl,
  buildBarracksBtn,
  buildingUi,
  trainBtn,
  trainMeleeBtn,
  trainRangedBtn,
  trainProgress,
  trainProgressFill,
  trainTimeLabel,
  idleWorkerWarningEl,   // NEW
  // Game state / data
  units,
  barracksList,
  refinery,
  // Costs
  MELEE_COST,
  RANGED_COST,
  GATHERER_COST,
  BARRACKS_COST,
  // Functions...
  getPlayerUnitCount,
  getPopulationCap,
  spawnUnitFromBuilding,
  getScraps,
  setScraps,
  constructionState,
}) {
  // --- Internal helpers ---

  function updateIdleWorkerWarning() {
    if (!idleWorkerWarningEl) return;

    const idle = hasIdleWorker(units, LOCAL_PLAYER_ID);
    if (idle) {
      idleWorkerWarningEl.classList.remove('hidden');
    } else {
      idleWorkerWarningEl.classList.add('hidden');
    }
  }

  function refreshResources() {
    if (!scrapsAmountEl) return;
    const scraps = getScraps();
    scrapsAmountEl.textContent = scraps.toString();
  }

  function refreshPopulation() {
    if (!popAmountEl || !popCapEl) return;
    const current = getPlayerUnitCount(LOCAL_PLAYER_ID);
    const cap = getPopulationCap(LOCAL_PLAYER_ID);
    popAmountEl.textContent = current.toString();
    popCapEl.textContent = cap.toString();
  }

  function getSelectedBarracks() {
    return barracksList.find(b => b.selected) || null;
  }

  function refreshUI() {
    if (!buildingUi) return;

    const selectedBarracks = getSelectedBarracks();
    const anyBarracksSelected = !!selectedBarracks;
    const anyGathererSelected = units.some(u => u.selected && u.role === 'gatherer');
    const anyBuildingSelected = refinery.selected || anyBarracksSelected;

    // Panel visibility
    if (anyBuildingSelected || anyGathererSelected) {
      buildingUi.classList.remove('hidden');
    } else {
      buildingUi.classList.add('hidden');
    }

    // Train button visibility
    if (trainBtn) {
      trainBtn.classList.add('hidden');
    }

    if (trainMeleeBtn) {
      if (anyBarracksSelected || refinery.selected) {
        trainMeleeBtn.classList.remove('hidden');
      } else {
        trainMeleeBtn.classList.add('hidden');
      }
    }

    if (trainRangedBtn) {
      if (anyBarracksSelected) {
        trainRangedBtn.classList.remove('hidden');
      } else {
        trainRangedBtn.classList.add('hidden');
      }
    }

    // Build Barracks button visibility
    if (buildBarracksBtn) {
      buildBarracksBtn.textContent = `Build Barracks (${BARRACKS_COST} Scraps)`;
      if (anyGathererSelected && !anyBuildingSelected) {
        buildBarracksBtn.classList.remove('hidden');
      } else {
        buildBarracksBtn.classList.add('hidden');
      }
    }

    updateTrainControls();
  }

  function updateTrainControls() {
    const selectedBarracks = getSelectedBarracks();
    const anyBarracksSelected = !!selectedBarracks;

    const meleeBtn = trainMeleeBtn || trainBtn;
    const rangedBtn = trainRangedBtn;

    // No building selected — disable both and hide progress
    if (!refinery.selected && !anyBarracksSelected) {
      if (meleeBtn) {
        meleeBtn.disabled = true;
        meleeBtn.textContent = 'Train Unit';
      }
      if (rangedBtn) {
        rangedBtn.disabled = true;
        rangedBtn.textContent = 'Train Ranged';
      }
      if (trainTimeLabel) {
        trainTimeLabel.textContent = '';
      }
      if (trainProgress && trainProgressFill) {
        trainProgress.classList.add('hidden');
        trainProgressFill.style.width = '0%';
      }
      return;
    }

    // -------- Refinery selected: Train Gatherer via melee button --------
    if (refinery.selected && !anyBarracksSelected) {
      const ownerId = refinery.ownerId;
      const cap = getPopulationCap(ownerId);
      const atCap = getPlayerUnitCount(ownerId) >= cap;
      const trainingActive = refinery.training;

      if (meleeBtn) {
        meleeBtn.disabled = atCap || trainingActive;
        meleeBtn.textContent = `Train Gatherer (${GATHERER_COST} Scraps)`;
      }
      if (rangedBtn) {
        rangedBtn.disabled = true;
        rangedBtn.textContent = 'Train Ranged';
      }

      if (trainTimeLabel) {
        trainTimeLabel.textContent =
          `Build time: ${refinery.trainingDuration.toFixed(1)}s`;
      }

      if (trainProgress && trainProgressFill) {
        if (refinery.training) {
          trainProgress.classList.remove('hidden');
          const ratio = Math.min(
            refinery.trainingTime / refinery.trainingDuration,
            1
          );
          trainProgressFill.style.width = (ratio * 100).toFixed(1) + '%';
        } else {
          trainProgress.classList.add('hidden');
          trainProgressFill.style.width = '0%';
        }
      }

      return;
    }

    // -------- Barracks selected: Train Melee or Ranged --------
    if (anyBarracksSelected) {
      const b = selectedBarracks;
      const cap = getPopulationCap(b.ownerId);
      const atCap = getPlayerUnitCount(b.ownerId) >= cap;
      const trainingActive = b.training;

      if (meleeBtn) {
        meleeBtn.disabled = atCap || trainingActive;
        meleeBtn.textContent = `Train Melee (${MELEE_COST} Scraps)`;
      }
      if (rangedBtn) {
        rangedBtn.disabled = atCap || trainingActive;
        rangedBtn.textContent = `Train Ranged (${RANGED_COST} Scraps)`;
      }

      if (trainTimeLabel) {
        trainTimeLabel.textContent =
          `Build time: ${b.trainingDuration.toFixed(1)}s`;
      }

      if (trainProgress && trainProgressFill) {
        if (b.training) {
          trainProgress.classList.remove('hidden');
          const ratio = Math.min(
            b.trainingTime / b.trainingDuration,
            1
          );
          trainProgressFill.style.width = (ratio * 100).toFixed(1) + '%';
        } else {
          trainProgress.classList.add('hidden');
          trainProgressFill.style.width = '0%';
        }
      }

      return;
    }
  }

  // --- Button wiring ---

  const meleeBtn = trainMeleeBtn || trainBtn;
  const rangedBtn = trainRangedBtn;

  // Melee / gatherer button
  if (meleeBtn) {
    meleeBtn.addEventListener('click', () => {
      const scraps = getScraps();
      const selectedBarracks = getSelectedBarracks();
      const anyBarracksSelected = !!selectedBarracks;

      // --- Refinery: Train Gatherer ---
      if (refinery.selected && !anyBarracksSelected) {
        const ownerId = refinery.ownerId;
        const cap = getPopulationCap(ownerId);
        if (getPlayerUnitCount(ownerId) >= cap) {
          console.log(`Unit cap reached (${cap}) for player ${ownerId}.`);
          return;
        }

        if (refinery.training) {
          console.log('Refinery already training a unit.');
          return;
        }
        if (scraps < GATHERER_COST) {
          console.log(
            `Not enough Scraps for gatherer. Need ${GATHERER_COST}, have ${scraps}.`
          );
          return;
        }

        setScraps(scraps - GATHERER_COST);
        refreshResources();
        refinery.training = true;
        refinery.trainingTime = 0;

        console.log(`Refinery started training gatherer (cost ${GATHERER_COST}).`);
        refreshUI();
        return;
      }

      // --- Barracks: Train Melee ---
      if (anyBarracksSelected) {
        const b = selectedBarracks;
        const ownerId = b.ownerId;
        const cap = getPopulationCap(ownerId);
        if (getPlayerUnitCount(ownerId) >= cap) {
          console.log(`Unit cap reached (${cap}) for player ${ownerId}.`);
          return;
        }

        if (b.training) {
          console.log('Barracks already training a unit.');
          return;
        }
        if (scraps < MELEE_COST) {
          console.log(
            `Not enough Scraps for melee. Need ${MELEE_COST}, have ${scraps}.`
          );
          return;
        }

        setScraps(scraps - MELEE_COST);
        refreshResources();
        b.training = true;
        b.trainingTime = 0;
        b.trainingType = 'melee'; // NEW: track what we’re building

        console.log(`Barracks started training melee (cost ${MELEE_COST}).`);
        refreshUI();
        return;
      }

      // No building selected; do nothing
    });
  }

  // Ranged button
  if (rangedBtn) {
    rangedBtn.addEventListener('click', () => {
      const scraps = getScraps();
      const selectedBarracks = getSelectedBarracks();
      const anyBarracksSelected = !!selectedBarracks;

      if (!anyBarracksSelected) {
        return;
      }

      const b = selectedBarracks;
      const ownerId = b.ownerId;
      const cap = getPopulationCap(ownerId);
      if (getPlayerUnitCount(ownerId) >= cap) {
        console.log(`Unit cap reached (${cap}) for player ${ownerId}.`);
        return;
      }

      if (b.training) {
        console.log('Barracks already training a unit.');
        return;
      }
      if (scraps < RANGED_COST) {
        console.log(
          `Not enough Scraps for ranged. Need ${RANGED_COST}, have ${scraps}.`
        );
        return;
      }

      setScraps(scraps - RANGED_COST);
      refreshResources();
      b.training = true;
      b.trainingTime = 0;
      b.trainingType = 'ranged'; // NEW: identify build type

      console.log(`Barracks started training ranged (cost ${RANGED_COST}).`);
      refreshUI();
    });
  }

  if (buildBarracksBtn) {
    buildBarracksBtn.addEventListener('click', () => {
      const scraps = getScraps();
      const builder = units.find(u => u.selected && u.role === 'gatherer');
      if (!builder) {
        console.log('No gatherer selected to build barracks.');
        return;
      }

      if (scraps < BARRACKS_COST) {
        console.log(
          `Not enough Scraps to build barracks. Need ${BARRACKS_COST}, have ${scraps}.`
        );
        return;
      }

      setScraps(scraps - BARRACKS_COST);
      refreshResources();

      // ENTER PLACING MODE
      constructionState.mode = 'placing';
      constructionState.builder = builder;
      constructionState.preview = null;
      constructionState.ghost = null;
      constructionState.buildTimer = 0;
      constructionState.completed = false;

      console.log('Entered barracks placement mode. Left-click to place ghost.');
      refreshUI();
    });
  }

  return {
    refreshResources,
    refreshPopulation,
    refreshUI,
    updateTrainControls,
    updateIdleWorkerWarning,
  };
}