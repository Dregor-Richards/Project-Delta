export function createUIController({
  LOCAL_PLAYER_ID,
  // DOM elements
  scrapsAmountEl,
  popAmountEl,
  popCapEl,
  buildBarracksBtn,
  buildingUi,
  trainBtn,
  trainProgress,
  trainProgressFill,
  trainTimeLabel,
  // Game state / data
  units,
  barracksList,
  refinery,
  // Costs
  MELEE_COST,
  GATHERER_COST,
  BARRACKS_COST,
  // Functions provided by main/population/etc.
  getPlayerUnitCount,
  getPopulationCap,
  spawnUnitFromBuilding,
  // Scraps accessors so UI can read/write without owning the variable
  getScraps,
  setScraps,
}) {
  // --- Internal helpers ---

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

    // --- Panel visibility ---
    if (anyBuildingSelected || anyGathererSelected) {
      buildingUi.classList.remove('hidden');
    } else {
      buildingUi.classList.add('hidden');
    }

    // --- Train button visibility ---
    if (trainBtn) {
      if (anyBuildingSelected) {
        trainBtn.classList.remove('hidden');
      } else {
        trainBtn.classList.add('hidden');
      }
    }

    // --- Build Barracks button visibility ---
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
    if (!trainBtn) return;

    const selectedBarracks = getSelectedBarracks();
    const anyBarracksSelected = !!selectedBarracks;

    // No building selected — keep train disabled and progress hidden
    if (!refinery.selected && !anyBarracksSelected) {
      trainBtn.disabled = true;
      trainBtn.textContent = 'Train Unit';
      if (trainTimeLabel) {
        trainTimeLabel.textContent = '';
      }
      if (trainProgress && trainProgressFill) {
        trainProgress.classList.add('hidden');
        trainProgressFill.style.width = '0%';
      }
      return;
    }

    // -------- Refinery selected: Train Gatherer --------
    if (refinery.selected && !anyBarracksSelected) {
      const cap = getPopulationCap(refinery.ownerId);
      const atCap = getPlayerUnitCount(refinery.ownerId) >= cap;
      const trainingActive = refinery.training;

      trainBtn.disabled = atCap || trainingActive;
      trainBtn.textContent = `Train Gatherer (${GATHERER_COST} Scraps)`;

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

    // -------- Barracks selected: Train Melee --------
    if (anyBarracksSelected) {
      const b = selectedBarracks;
      const cap = getPopulationCap(b.ownerId);
      const atCap = getPlayerUnitCount(b.ownerId) >= cap;
      const trainingActive = b.training;

      trainBtn.disabled = atCap || trainingActive;
      trainBtn.textContent = `Train Melee (${MELEE_COST} Scraps)`;

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

  if (trainBtn) {
    trainBtn.addEventListener('click', () => {
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

        console.log(`Barracks started training melee (cost ${MELEE_COST}).`);
        refreshUI();
        return;
      }

      // No building selected; do nothing
    });
  }

  if (buildBarracksBtn) {
    buildBarracksBtn.addEventListener('click', () => {
      const scraps = getScraps();
      const builder = units.find(u => u.selected && u.role === 'gatherer');
      if (!builder) return;

      if (scraps < BARRACKS_COST) {
        console.log(
          `Not enough Scraps to build barracks. Need ${BARRACKS_COST}, have ${scraps}.`
        );
        return;
      }

      setScraps(scraps - BARRACKS_COST);
      refreshResources();

      // Construction mode will be handled by main.js / construction system
      // We just flip the state flags; main.js owns constructionState.
      // This function does not know constructionState directly by design.
    });
  }

  return {
    refreshResources,
    refreshPopulation,
    refreshUI,
    updateTrainControls, // exposed in case you need it explicitly
  };
}