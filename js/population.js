// population.js
// Handles population caps and unit spawning.

import { CONTINENT_UNIT_KEYS } from './factions.js';
import { createUnitForPlayer } from './unitTemplates.js';
import { getPlayerById } from './players.js';
import { getUnitRadius } from './gameHelpers.js'; // currently unused, but handy later

export function getPlayerUnitCount(units, ownerId) {
  return units.filter(u => u.ownerId === ownerId).length;
}

export function getPopulationCap({
  playerId,
  refinery,
  enemyRefinery,
  REFINERY_SUPPLY,
}) {
  let cap = 0;

  if (refinery && refinery.ownerId === playerId && !refinery.destroyed) {
    cap += REFINERY_SUPPLY;
  }
  if (enemyRefinery && enemyRefinery.ownerId === playerId && !enemyRefinery.destroyed) {
    cap += REFINERY_SUPPLY;
  }

  return cap;
}

/**
 * Returns a spawn function bound to your current game state.
 * It will:
 *  - enforce pop cap
 *  - create the unit
 *  - push into `units`
 *  - call `onPopulationChanged` when a unit is successfully spawned
 */
export function createSpawnUnitFromBuilding({
  units,
  refinery,
  enemyRefinery,
  REFINERY_SUPPLY,
  onPopulationChanged,
}) {
  return function spawnUnitFromBuilding(type, building) {
    const ownerId = building.ownerId;
    const ownerUnitCount = getPlayerUnitCount(units, ownerId);
    const cap = getPopulationCap({
      playerId: ownerId,
      refinery,
      enemyRefinery,
      REFINERY_SUPPLY,
    });

    if (ownerUnitCount >= cap) {
      console.log(`Unit cap reached (${cap}) for player ${ownerId}.`);
      return null;
    }

    const owner = getPlayerById(ownerId);
    if (!owner) {
      console.warn(`No player found for ownerId ${ownerId}`);
      return null;
    }

    const factionUnits = CONTINENT_UNIT_KEYS[owner.faction];
    const templateKey = factionUnits?.[type];
    if (!templateKey) {
      console.warn(
        `No unit template for type '${type}' and faction '${owner.faction}'`
      );
      return null;
    }

    const spawnOffsetX = 50 + Math.random() * 20;
    const spawnOffsetY = (Math.random() - 0.5) * 30;
    const spawnX = building.x + spawnOffsetX;
    const spawnY = building.y + spawnOffsetY;

    const unit = createUnitForPlayer(templateKey, ownerId, {
      x: spawnX,
      y: spawnY,
      tx: building.rallyX,
      ty: building.rallyY,
      moving: true,
    });

    units.push(unit);

    console.log(
      `Spawned ${type} (${templateKey}) for player ${ownerId} from building. ` +
      `Total units for this player: ${getPlayerUnitCount(units, ownerId)}`
    );

    if (onPopulationChanged) {
      onPopulationChanged();
    }

    return unit;
  };
}