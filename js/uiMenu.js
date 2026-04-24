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

    // Only unpause if settings isn’t open (so nested settings doesn’t resume the game)
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

    // If the main menu is still open, stay paused; otherwise resume
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
      // Close main menu, open settings
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
    // ESC: toggle menus / pause
    if (e.key === 'Escape') {
      if (settingsModal && !settingsModal.classList.contains('hidden')) {
        // If settings is open, close it first
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