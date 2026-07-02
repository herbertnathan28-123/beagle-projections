// Hunter Elite roster — returns the Set of tracked airline names (lowercase) so
// they can be scrubbed from player-facing HQ / stats surfaces. Handles both the
// disk-persisted (hunterData) and in-memory (hunterStore) shapes.
function getHunterTrackedNames(hunterData, hunterStore) {
  const names = new Set();
  if (hunterData && hunterData.players) {
    for (const p of hunterData.players) {
      if (p.airline_name) names.add(p.airline_name.toLowerCase().trim());
    }
  }
  if (hunterStore && hunterStore.players) {
    if (Array.isArray(hunterStore.players)) {
      for (const p of hunterStore.players) {
        if (p.airline_name) names.add(p.airline_name.toLowerCase().trim());
      }
    } else {
      for (const key of Object.keys(hunterStore.players)) {
        names.add(key.toLowerCase().trim());
        const p = hunterStore.players[key];
        if (p && p.airline_name) names.add(p.airline_name.toLowerCase().trim());
      }
    }
  }
  return names;
}

module.exports = { getHunterTrackedNames };
