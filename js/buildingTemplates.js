// buildingTemplates.js
// Similar idea to unitTemplates, but for buildings

const BUILDING_TEMPLATES = {
  // ----- Foldari Buildings -----
  'foldari_refinery': {
    type: 'refinery',
    maxHp: 1000,
    size: 70,
    trainingDuration: 3,
  },
  'foldari_barracks': {
    type: 'barracks',
    maxHp: 800,
    width: 80,
    height: 60,
    topInset: 20,
    trainingDuration: 5,
  },

  // ----- Malachordith Buildings -----
  'malachordith_refinery': {
    type: 'refinery',
    maxHp: 1000,
    size: 70,
    trainingDuration: 3,
  },
  'malachordith_barracks': {
    type: 'barracks',
    maxHp: 900,
    width: 80,
    height: 60,
    topInset: 20,
    trainingDuration: 5,
  },

  // ----- Shiervale Buildings -----
  'shiervale_refinery': {
    type: 'refinery',
    maxHp: 1000,
    size: 70,
    trainingDuration: 3,
  },
  'shiervale_barracks': {
    type: 'barracks',
    maxHp: 750,
    width: 80,
    height: 60,
    topInset: 20,
    trainingDuration: 5,
  },
};

export function createBuildingFromTemplate(templateKey, overrides = {}) {
  const template = BUILDING_TEMPLATES[templateKey];
  if (!template) {
    console.warn(`Unknown building template: ${templateKey}`);
    return null;
  }

  return {
    type: template.type,
    maxHp: template.maxHp,
    hp: template.maxHp,
    size: template.size ?? 0,
    width: template.width ?? 0,
    height: template.height ?? 0,
    topInset: template.topInset ?? 0,
    trainingDuration: template.trainingDuration ?? 0,

    // runtime fields
    x: 0,
    y: 0,
    selected: false,
    training: false,
    trainingTime: 0,
    rallyX: 0,
    rallyY: 0,

    ownerId: overrides.ownerId ?? 1,

    ...overrides,
  };
}