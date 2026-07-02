// HQ pace-upload text parser — one row per airline.
function parsePaceLine(line) {
  const contrib = line.match(/\$(\d[\d,]*)\s*$/);
  if (!contrib) return null;
  const lastContrib = parseInt(contrib[1].replace(/,/g, ''));
  const lastSeen = line.match(/(\d+)\s+(hours?|mins?|secs?)\s+ago\s+\$[\d,]+\s*$/);
  let lastSeenStr = '?';
  let lastSeenMins = 9999;
  if (lastSeen) {
    const n = parseInt(lastSeen[1]);
    const u = lastSeen[2];
    if (u.startsWith('sec')) { lastSeenStr = n+'s ago'; lastSeenMins = n/60; }
    else if (u.startsWith('min')) { lastSeenStr = n+'m ago'; lastSeenMins = n; }
    else { lastSeenStr = n+'h ago'; lastSeenMins = n*60; }
  }
  const flightsMatch = line.match(/(\d[\d,]*)\s+\d+\s+(hours?|mins?|secs?)\s+ago\s+\$/);
  const flights = flightsMatch ? parseInt(flightsMatch[1].replace(/,/g, '')) : 0;
  const dollars = [...line.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)].map(m => parseFloat(m[1].replace(/,/g,'')));
  const sv = dollars[0] || 0;
  const allianceContrib = dollars[2] || 0;
  const name = line.split('$')[0].trim().replace(/\s+$/, '');
  return { name, sv, allianceContrib, lastContrib, lastSeenStr, lastSeenMins, flights };
}

function parsePaceUpload(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const players = [];
  for (const line of lines) {
    if (!line.includes('$')) continue;
    if (line === '!' || line.startsWith('!')) continue;
    const p = parsePaceLine(line);
    if (p && p.name && p.name.length > 0 && p.name.length < 60) players.push(p);
  }
  return players;
}

module.exports = { parsePaceLine, parsePaceUpload };
