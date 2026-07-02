// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE — STORAGE / PERSISTENCE / DISCORD IO
// Single generic JSON read/write + one Discord POST helper replace the ~8
// duplicated load/save pairs and the duplicated webhook functions.
// ═══════════════════════════════════════════════════════════════════════════
const fs    = require('fs');
const https = require('https');
const cfg   = require('../config');

function ensureDataDir() {
  try { if (!fs.existsSync('/data')) fs.mkdirSync('/data', { recursive: true }); } catch (_) {}
}

// Generic disk JSON — replaces loadState/loadHqState/loadSnapshotHistory/... bodies
function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.error('[LOAD] ' + file + ':', e.message); }
  return fallback;
}
function writeJSON(file, data, pretty) {
  try {
    ensureDataDir();
    fs.writeFileSync(file, JSON.stringify(data, null, pretty ? 2 : 0), 'utf8');
  } catch (e) { console.error('[SAVE] ' + file + ':', e.message); }
}

// Single Discord webhook POST — replaces notifyDiscord + notifyPlayerStats
function postDiscord(url, content, label) {
  if (!url) { console.log('[DISCORD] ' + (label || '') + ' webhook not set'); return; }
  try {
    const body = JSON.stringify({ content });
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    });
    req.on('error', e => console.error('[DISCORD] ' + (label || '') + ' error:', e.message));
    req.write(body);
    req.end();
  } catch (e) { console.error('[DISCORD] ' + (label || '') + ' failed:', e.message); }
}

// ── Projections state (with beaglePace baseline recalculation) ──────────────
function calcPaceFromBaseline(sv, ts) {
  const base = cfg.DEFAULT_DATA;
  if (!sv || !ts || !base.beagleSV || !base.timestamp) return null;
  const mins = (new Date(ts) - new Date(base.timestamp)) / 60000;
  if (mins < 1) return null;
  const pace = ((sv - base.beagleSV) / mins) * 1440;
  return pace >= 0.5 ? Math.round(pace * 1000) / 1000 : null;
}

function loadState() {
  const saved = readJSON(cfg.STATE_FILE, null);
  if (saved) {
    const calcPace = calcPaceFromBaseline(saved.beagleSV, saved.timestamp);
    if (calcPace != null) {
      console.log('[STARTUP] Recalculated beaglePace from baseline: ' + calcPace + ' (was ' + saved.beaglePace + ')');
      saved.beaglePace = calcPace;
    } else if (!saved.beaglePace || saved.beaglePace < 1.0) {
      console.log('[STARTUP] beaglePace corrupted (' + saved.beaglePace + ') — resetting to DEFAULT ' + cfg.DEFAULT_DATA.beaglePace);
      saved.beaglePace = cfg.DEFAULT_DATA.beaglePace;
    }
    console.log('[STARTUP] Loaded projections state from disk — ' + saved.timestamp);
    return saved;
  }
  console.log('[STARTUP] No saved state — using DEFAULT_DATA');
  return { ...cfg.DEFAULT_DATA };
}
function saveState(data) { writeJSON(cfg.STATE_FILE, data); }

// ── Beagle HQ state ─────────────────────────────────────────────────────────
function loadHqState() {
  const saved = readJSON(cfg.HQ_STATE_FILE, null);
  if (saved) {
    console.log('[STARTUP] Loaded HQ state from disk — ' + (saved.players?.length ?? 0) + ' players');
    return saved;
  }
  return { timestamp: null, uploader: null, alliancePace: null, airlines: 0, players: [], history: [] };
}
function saveHqState(data) { writeJSON(cfg.HQ_STATE_FILE, data); }

// ── Player snapshot history (trend analysis) ────────────────────────────────
function loadSnapshotHistory() {
  const data = readJSON(cfg.SNAPSHOT_HISTORY_FILE, null);
  if (data) {
    console.log('[STARTUP] Loaded snapshot history — ' + (data.snapshots?.length ?? 0) + ' snapshots');
    return data;
  }
  return { snapshots: [] };
}
function saveSnapshotHistory(data) { writeJSON(cfg.SNAPSHOT_HISTORY_FILE, data); }

// Append a player-level snapshot, trimmed to the rolling window.
function addSnapshot(snapshotHistory, players, timestamp) {
  const snap = {
    timestamp: timestamp || new Date().toISOString(),
    players: players.map(p => ({
      name: p.name,
      sv: p.sv,
      lastContrib: p.lastContrib,
      allianceContrib: p.allianceContrib,
      flights: p.flights || 0,
      lastSeenMins: p.lastSeenMins,
    })),
  };
  snapshotHistory.snapshots.push(snap);
  if (snapshotHistory.snapshots.length > cfg.SNAPSHOT_LIMIT) {
    snapshotHistory.snapshots = snapshotHistory.snapshots.slice(-cfg.SNAPSHOT_LIMIT);
  }
  saveSnapshotHistory(snapshotHistory);
}

// ── Manual per-player stat overrides ────────────────────────────────────────
function loadManualOverrides() { return readJSON(cfg.MANUAL_OVERRIDES_FILE, {}); }
function saveManualOverrides(data) { writeJSON(cfg.MANUAL_OVERRIDES_FILE, data, true); }

module.exports = {
  ensureDataDir, readJSON, writeJSON, postDiscord,
  calcPaceFromBaseline, loadState, saveState, loadHqState, saveHqState,
  loadSnapshotHistory, saveSnapshotHistory, addSnapshot,
  loadManualOverrides, saveManualOverrides,
};
