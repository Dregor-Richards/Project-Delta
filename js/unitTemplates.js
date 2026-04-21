// Base utility to apply common fields that *every* unit has.
// This keeps spawn logic and initial spawns consistent.

// --- Template definitions ---

const UNIT_TEMPLATES = {
// -----   Malachordith Units   -----
    'malachordith_gatherer': {
        type: 'gatherer',
        role: 'gatherer',
        hp: 50,
        maxHp: 50,
        attackDamage: 0,
        attackInterval: 1.0,
        attackRange: 0,
        visionRange: 220,
        maxCarry: 5,
        designFaction: 'Malachordith',
    },
    'malachordith_melee': {
        type: 'merc',
        role: 'merc',
        hp: 100,
        maxHp: 100,
        attackDamage: 8,
        attackInterval: 1.0,
        attackRange: 25,
        visionRange: 260,
        maxCarry: 5,
        designFaction: 'Malachordith',
    },
    'malachordith_ranged': {
        type: 'ranged',
        role: 'ranged',
        hp: 80,
        maxHp: 80,
        attackDamage: 16,    // slow, heavy
        attackInterval: 1.6,
        attackRange: 120,
        visionRange: 280,
        maxCarry: 5,
        designFaction: 'Malachordith',
    },
    'malachordith_scout': {
        type: 'scout_cloak',
        role: 'scout',
        hp: 45,
        maxHp: 45,
        attackDamage: 0,
        attackInterval: 1.0,
        attackRange: 0,
        speed: 150,
        visionRange: 320,
        maxCarry: 0,
        cloaked: true,
        designFaction: 'Malachordith',
    },

// -----   Foldari Units   -----
    'foldari_gatherer': {
        type: 'gatherer',
        role: 'gatherer',
        hp: 50,
        maxHp: 50,
        attackDamage: 0,
        attackInterval: 1.0,
        attackRange: 0,
        visionRange: 220,
        maxCarry: 5,
        designFaction: 'Foldari',
    },
    'foldari_melee': {
        type: 'merc',
        role: 'merc',
        hp: 80,
        maxHp: 80,
        attackDamage: 10,
        attackInterval: 1.0,
        attackRange: 25,
        visionRange: 260,
        maxCarry: 5,
        designFaction: 'Foldari',
    },
    'foldari_ranged': {
        type: 'ranged',
        role: 'ranged',
        hp: 80,
        maxHp: 80,
        attackDamage: 10,    // mid, mid
        attackInterval: 1.0,
        attackRange: 120,
        visionRange: 280,
        maxCarry: 5,
        designFaction: 'Foldari',
    },
    'foldari_scout': {
        type: 'scout_fast',
        role: 'scout',
        hp: 50,
        maxHp: 50,
        attackDamage: 0,
        attackInterval: 1.0,
        attackRange: 0,
        speed: 220,
        visionRange: 320,
        maxCarry: 0,
        designFaction: 'Foldari',
    },

// -----   Shiervale Units   -----
    'shiervale_gatherer': {
        type: 'gatherer',
        role: 'gatherer',
        hp: 50,
        maxHp: 50,
        attackDamage: 0,
        attackInterval: 1.0,
        attackRange: 0,
        visionRange: 220,
        maxCarry: 5,
        designFaction: 'Shiervale',
    },
    'shiervale_melee': {
        type: 'merc',
        role: 'merc',
        hp: 60,
        maxHp: 60,
        attackDamage: 13,
        attackInterval: 1.0,
        attackRange: 25,
        visionRange: 260,
        maxCarry: 5,
        designFaction: 'Shiervale',
    },
    'shiervale_ranged': {
        type: 'ranged',
        role: 'ranged',
        hp: 80,
        maxHp: 80,
        attackDamage: 7,     // fast, light
        attackInterval: 0.7,
        attackRange: 120,
        visionRange: 280,
        maxCarry: 5,
        designFaction: 'Shiervale',
    },
    // NEW: Shiervale swarm scout (single body for now, later: spawn multiple)
    'shiervale_scout': {
        type: 'scout_swarm',
        role: 'scout',
        hp: 30,
        maxHp: 30,
        attackDamage: 0,
        attackInterval: 1.0,
        attackRange: 0,
        speed: 190,
        visionRange: 260,
        maxCarry: 0,
        swarmMember: true,
        designFaction: 'Shiervale',
    },
};

// Factory: create a unit instance from a template key
export function createUnitFromTemplate(templateKey, overrides = {}) {
    const template = UNIT_TEMPLATES[templateKey];
    if (!template) {
        console.warn(`Unknown unit template: ${templateKey}`);
        return null;
    }
    return {
        // template stats:
        type: template.type,
        role: template.role,
        hp: template.hp,
        maxHp: template.maxHp ?? template.hp,
        attackDamage: template.attackDamage ?? 0,
        attackInterval: template.attackInterval ?? 1.0,
        attackRange: template.attackRange ?? 0,
        maxCarry: template.maxCarry ?? 5,
        designFaction: template.designFaction,

        // common runtime fields:
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
        size: 20,
        speed: 150,
        moving: false,
        selected: false,
        mining: false,
        miningTimer: 0,
        carried: 0,
        mode: 'idle',
        homeNode: null,
        attackTimer: 0,

        // ownership:
        ownerId: overrides.ownerId ?? 1,  // default to player 1, but can be set

        // override last:
        ...overrides,
    };
}

// For convenience: specific helpers (optional)

export function createUnitForPlayer(templateKey, ownerId, overrides = {}) {
    return createUnitFromTemplate(templateKey, {
        ownerId,
        ...overrides,
    });
}