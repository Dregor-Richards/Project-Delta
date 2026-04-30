// Handles game menu, settings modal, and pause state.

export function createMenuController({
  gameMenuButton,
  gameMenuModal,
  menuSettingsBtn,
  menuRestartBtn,
  menuMainMenuBtn,
  menuCloseBtn,
  settingsModal,
  settingsCloseBtn,
  resetTimer,  // NEW: callback to reset the game timer
}) {
  let paused = false;

  function isPaused() {
    return paused;
  }

  function setPaused(value) {
    paused = !!value;
  }

  function openGameMenu() {
    if (!gameMenuModal) return;
    gameMenuModal.classList.remove('hidden');
    setPaused(true);
  }

  function closeGameMenu() {
    if (!gameMenuModal) return;
    gameMenuModal.classList.add('hidden');

    if (settingsModal && settingsModal.classList.contains('hidden')) {
      setPaused(false);
    }
  }

  function openSettings() {
    if (!settingsModal) return;
    settingsModal.classList.remove('hidden');
    setPaused(true);
  }

  function closeSettings() {
    if (!settingsModal) return;
    settingsModal.classList.add('hidden');

    if (!gameMenuModal || gameMenuModal.classList.contains('hidden')) {
      setPaused(false);
    }
  }

  // --- Wire DOM events ---

  if (gameMenuButton) {
    gameMenuButton.addEventListener('click', () => {
      openGameMenu();
    });
  }

  if (menuCloseBtn) {
    menuCloseBtn.addEventListener('click', () => {
      closeGameMenu();
    });
  }

  if (menuSettingsBtn) {
    menuSettingsBtn.addEventListener('click', () => {
      closeGameMenu();
      openSettings();
    });
  }

  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', () => {
      closeSettings();
    });
  }

  if (menuRestartBtn) {
    menuRestartBtn.addEventListener('click', () => {
      // Reset timer before reloading
      if (resetTimer) {
        resetTimer();
      }
      window.location.reload();
    });
  }

  if (menuMainMenuBtn) {
    menuMainMenuBtn.addEventListener('click', () => {
      window.location.href = '../index.html';
    });
  }

  gameMenuModal?.addEventListener('click', (e) => {
    if (e.target === gameMenuModal || e.target.classList.contains('game-menu-backdrop')) {
      closeGameMenu();
    }
  });

  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal || e.target.classList.contains('game-menu-backdrop')) {
      closeSettings();
    }
  });

  // --- Keyboard helper for Escape handling ---

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (settingsModal && !settingsModal.classList.contains('hidden')) {
        closeSettings();
        return;
      }

      if (gameMenuModal && !gameMenuModal.classList.contains('hidden')) {
        closeGameMenu();
      } else {
        openGameMenu();
      }
    }
  }

  return {
    isPaused,
    setPaused,
    openGameMenu,
    closeGameMenu,
    openSettings,
    closeSettings,
    handleKeyDown,
  };
}