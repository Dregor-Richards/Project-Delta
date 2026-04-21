// setup.js
window.addEventListener('DOMContentLoaded', () => {
  const factionCards = document.querySelectorAll('.faction-card');
  const startBtn = document.getElementById('start-game-btn');
  const aiSelect = document.getElementById('ai-count');

  const chooseMapBtn = document.getElementById('choose-map-btn');
  const mapModalOverlay = document.getElementById('map-modal-overlay');
  const mapModalClose = document.getElementById('map-modal-close');
  const mapModalCancel = document.getElementById('map-modal-cancel');
  const mapCards = document.querySelectorAll('.map-card');
  const selectedMapLabel = document.getElementById('selected-map-label');

  let selectedFaction = null;
  let selectedMapId = localStorage.getItem('moa_mapId') || 'map1';

  // Reflect saved map choice on load
  function updateSelectedMapLabel() {
    let label;
    switch (selectedMapId) {
      case 'map1':
        label = 'Fields Of Crystil';
        break;
      case 'map2':
        label = 'Institution Of Prismworth';
        break;
      case 'map3':
        label = 'Meeklan Shores';
        break;
      case 'map4':
        label = 'Kord Canyons';
        break;
      case 'map5':
        label = 'Map 5 – Coming Soon';
        break;
      case 'map6':
        label = 'Map 6 – Coming Soon';
        break;
      default:
        label = 'Fields Of Crystil';
        selectedMapId = 'map1';
        localStorage.setItem('moa_mapId', selectedMapId);
        break;
    }
    selectedMapLabel.textContent = 'Current Map: ' + label;
  }
  updateSelectedMapLabel();

  // Faction selection
  factionCards.forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('disabled')) {
        return; // ignore clicks on disabled factions
      }

      // Clear previous selection
      factionCards.forEach(c => c.classList.remove('selected'));

      // Mark this one selected
      card.classList.add('selected');
      selectedFaction = card.dataset.faction;

      // Enable Start button once a valid faction is chosen
      startBtn.disabled = !selectedFaction;
    });
  });

  // Map modal open/close helpers
  function openMapModal() {
    mapModalOverlay.hidden = false;
    mapModalOverlay.classList.add('open');
  }

  function closeMapModal() {
    mapModalOverlay.classList.remove('open');
    mapModalOverlay.hidden = true;
  }

  chooseMapBtn.addEventListener('click', () => {
    openMapModal();
  });

  mapModalClose.addEventListener('click', () => {
    closeMapModal();
  });

  mapModalCancel.addEventListener('click', () => {
    closeMapModal();
  });

  // Close modal on overlay click
  mapModalOverlay.addEventListener('click', (e) => {
    if (e.target === mapModalOverlay) {
      closeMapModal();
    }
  });

  // Close modal on Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mapModalOverlay.hidden) {
      closeMapModal();
    }
  });

  // Map choice click
  mapCards.forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('disabled') || card.disabled) {
        return;
      }
      selectedMapId = card.dataset.mapId;
      updateSelectedMapLabel();
      localStorage.setItem('moa_mapId', selectedMapId);
      closeMapModal();
    });
  });

  // Start game
  startBtn.addEventListener('click', () => {
    if (!selectedFaction) return;

    const aiCount = parseInt(aiSelect.value, 10) || 1;

    // Persist setup choices for level.html
    localStorage.setItem('moa_playerFaction', selectedFaction);
    localStorage.setItem('moa_aiCount', String(aiCount));
    localStorage.setItem('moa_mapId', selectedMapId);

    // Go to the level
    window.location.href = 'level.html';
  });
});