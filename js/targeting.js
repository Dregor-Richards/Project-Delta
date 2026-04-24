// Helpers for finding/selecting units like workers, enemies, etc.

export function isWorkerUnit(u, localPlayerId) {
  // Adjust this if your worker type/role changes later
  return u.ownerId === localPlayerId && u.type === 'gatherer';
}

export function isIdleWorker(u, localPlayerId) {
  // Adjust the idle conditions if needed (mode / moving flags)
  return isWorkerUnit(u, localPlayerId) && u.mode === 'idle' && !u.moving;
}

export function findIdleWorkers(units, localPlayerId) {
  return units.filter((u) => isIdleWorker(u, localPlayerId));
}

export function hasIdleWorker(units, localPlayerId) {
  return units.some((u) => isIdleWorker(u, localPlayerId));
}