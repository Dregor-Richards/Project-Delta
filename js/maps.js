// maps.js
import { createMap1 } from './map1.js';
// import { createMap2 } from './map2.js';
// import { createMap3 } from './map3.js';
// import { createMap4 } from './map4.js';

export function createSelectedMap({
  mapId,
  canvas,
  localPlayerId,
  enemyPlayerId,
  localFaction,
  enemyFaction,
}) {
  switch (mapId) {
    case 'map1':
      return createMap1({
        canvas,
        localPlayerId,
        enemyPlayerId,
        localFaction,
        enemyFaction,
      });

    // case 'map2':
    //   return createMap2({ canvas, localPlayerId, enemyPlayerId, localFaction, enemyFaction });
    // case 'map3':
    //   return createMap3({ canvas, localPlayerId, enemyPlayerId, localFaction, enemyFaction });
    // case 'map4':
    //   return createMap4({ canvas, localPlayerId, enemyPlayerId, localFaction, enemyFaction });

    default:
      console.warn(`Unknown mapId '${mapId}', falling back to map1.`);
      return createMap1({
        canvas,
        localPlayerId,
        enemyPlayerId,
        localFaction,
        enemyFaction,
      });
  }
}