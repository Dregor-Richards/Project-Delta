export function getGameDomRefs() {
  return {
    canvas: document.getElementById('gameCanvas'),

    // Resources & pop
    scrapsAmountEl: document.getElementById('scraps-amount'),
    popAmountEl: document.getElementById('pop-amount'),
    popCapEl: document.getElementById('pop-cap'),
    olivesAmountEl: document.getElementById('olives-amount'),
    prismsAmountEl: document.getElementById('prisms-amount'),

    // Idle worker warning
    idleWorkerWarningEl: document.getElementById('idle-worker-warning'),

    // Building / training UI
    buildBarracksBtn: document.getElementById('build-barracks-btn'),
    buildingUi: document.getElementById('building-ui'),
    trainBtn: document.getElementById('train-unit-btn'),
    trainMeleeBtn: document.getElementById('train-melee-btn'),
    trainRangedBtn: document.getElementById('train-ranged-btn'),
    trainProgress: document.getElementById('train-progress'),
    trainProgressFill: document.getElementById('train-progress-fill'),
    trainTimeLabel: document.getElementById('train-time-label'),

    // Menu / settings
    gameMenuButton: document.getElementById('game-menu-button'),
    gameMenuModal: document.getElementById('game-menu-modal'),
    menuSettingsBtn: document.getElementById('menu-settings-btn'),
    menuRestartBtn: document.getElementById('menu-restart-btn'),
    menuMainMenuBtn: document.getElementById('menu-main-menu-btn'),
    menuCloseBtn: document.getElementById('menu-close-btn'),
    settingsModal: document.getElementById('settings-modal'),
    settingsCloseBtn: document.getElementById('settings-close-btn'),
  };
}