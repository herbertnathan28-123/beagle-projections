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

// Startup self-check: prove /data is actually writable. On Render the container
// root is read-only outside a mounted disk, so this fires loudly when the
// persistent disk is missing — instead of silently losing all state on redeploy.
function checkPersistence() {
  try {
    ensureDataDir();
    const probe = '/data/.persist_check';
    fs.writeFileSync(probe, String(Date.now()));
    fs.unlinkSync(probe);
    console.log('[STARTUP] Persistence OK — /data is writable');
    return true;
  } catch (e) {
    console.error('══════════════════════════════════════════════════════════');
    console.error('[STARTUP] ⚠️  PERSISTENCE DEGRADED — /data is NOT writable: ' + e.message);
    console.error('[STARTUP] ⚠️  Projections, HQ, snapshots, fuel profiles & approved');
    console.error('[STARTUP] ⚠️  users will RESET on every redeploy.');
    console.error('[STARTUP] ⚠️  Fix: attach a Render disk mounted at /data.');
    console.error('══════════════════════════════════════════════════════════');
    return false;
  }
}

// Generic disk JSON — replaces loadState/loadHqState/loadSnapshotHistory/... bodies
function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.error('[LOAD] ' + file + ':', e.message); }
  return fallback;
}
// Atomic write: serialise to a temp file, snapshot the previous good copy to
// <file>.bak, then rename into place. A crash mid-write can no longer truncate
// the live file, and .bak gives one-level recovery.
function writeJSON(file, data, pretty) {
  try {
    ensureDataDir();
    const json = JSON.stringify(data, null, pretty ? 2 : 0);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, json, 'utf8');
    try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch (_) {}
    fs.renameSync(tmp, file);
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

// ── Beagle SV snapshot history (used for per-interval pace) ───────────────
function loadSVHistory() { return readJSON(cfg.SV_HISTORY_FILE, { snapshots: [] }); }
function saveSVHistory(data) { writeJSON(cfg.SV_HISTORY_FILE, data); }
function addSVSnapshot(svHistory, sv, ts) {
  const s = { sv, timestamp: ts };
  const existing = svHistory.snapshots.findIndex(x => x.timestamp === ts);
  if (existing !== -1) svHistory.snapshots[existing] = s;
  else svHistory.snapshots.push(s);
  // keep last 90 days of snapshots relative to the data timestamp, trimmed to a sensible cap
  const cutoff = new Date(new Date(ts).getTime() - 90 * 86400000).toISOString();
  svHistory.snapshots = svHistory.snapshots.filter(x => x.timestamp >= cutoff);
  if (svHistory.snapshots.length > 500) {
    svHistory.snapshots = svHistory.snapshots.slice(-500);
  }
  saveSVHistory(svHistory);
  return svHistory;
}
function calcPaceFromHistory(svHistory, sv, ts, maxAgeDays = 2, minAgeHours = 20, targetHours = 24) {
  if (!svHistory?.snapshots?.length) return null;
  const currentTs = new Date(ts).getTime();
  const maxAgeMs = maxAgeDays * 86400000;
  const minAgeMs = minAgeHours * 3600000;
  const targetMs = targetHours * 3600000;
  // Find a snapshot that is at least minAgeHours old (to avoid noisy 15-minute intervals)
  // and at most maxAgeDays old, preferring the one closest to targetHours (default 24h).
  let best = null;
  let bestDiff = Infinity;
  for (const snap of svHistory.snapshots) {
    const t = new Date(snap.timestamp).getTime();
    if (t >= currentTs) continue;
    const age = currentTs - t;
    if (age > maxAgeMs || age < minAgeMs) continue;
    const diff = Math.abs(age - targetMs);
    if (!best || diff < bestDiff) { best = snap; bestDiff = diff; }
  }
  if (!best) return null;
  const mins = (currentTs - new Date(best.timestamp).getTime()) / 60000;
  if (mins < 1) return null;
  const pace = ((sv - best.sv) / mins) * 1440;
  return pace >= 0.5 ? Math.round(pace * 1000) / 1000 : null;
}

// ── Per-alliance SV history (same interval-based pace logic) ─────────────────
function loadAllianceSVHistory() { return readJSON(cfg.ALLIANCE_SV_HISTORY_FILE, {}); }
function saveAllianceSVHistory(data) { writeJSON(cfg.ALLIANCE_SV_HISTORY_FILE, data); }
function _normAllianceName(name) {
  const base = (name || '').toLowerCase().trim();
  // Use the English name inside parentheses when present (e.g. "도(Dokdo)" -> "dokdo").
  const paren = base.match(/\(([^)]+)\)/);
  return paren ? paren[1].trim() : base;
}
function addAllianceSVSnapshot(allianceHistory, name, sv, ts) {
  const key = _normAllianceName(name);
  if (!key) return allianceHistory;
  if (!allianceHistory[key]) allianceHistory[key] = { snapshots: [] };
  const snaps = allianceHistory[key].snapshots;
  const s = { sv, timestamp: ts };
  const existing = snaps.findIndex(x => x.timestamp === ts);
  if (existing !== -1) snaps[existing] = s;
  else snaps.push(s);
  const cutoff = new Date(new Date(ts).getTime() - 90 * 86400000).toISOString();
  allianceHistory[key].snapshots = snaps.filter(x => x.timestamp >= cutoff);
  if (allianceHistory[key].snapshots.length > 500) {
    allianceHistory[key].snapshots = allianceHistory[key].snapshots.slice(-500);
  }
  saveAllianceSVHistory(allianceHistory);
  return allianceHistory;
}
function calcAlliancePaceFromHistory(allianceHistory, name, sv, ts, maxAgeDays = 2) {
  const key = _normAllianceName(name);
  if (!key || !allianceHistory?.[key]?.snapshots?.length) return null;
  return calcPaceFromHistory(allianceHistory[key], sv, ts, maxAgeDays);
}
function recalcAlliancePaces(liveData, allianceHistory) {
  if (!liveData?.alliances || !allianceHistory) return;
  for (const a of liveData.alliances) {
    // Only fill missing/invalid paces from history; never overwrite an already-supplied value
    // (those come from n8n / the verified saved state and are more reliable than a sparse history).
    if (a.pace != null && !isNaN(a.pace) && a.pace >= 0.5) continue;
    const pace = calcAlliancePaceFromHistory(allianceHistory, a.name, a.sv, liveData.timestamp, 2);
    if (pace != null) {
      console.log('[STARTUP] Recalculated pace for ' + a.name + ': ' + pace + ' (was ' + a.pace + ')');
      a.pace = pace;
    } else {
      console.log('[STARTUP] Preserved/unknown pace for ' + a.name + ': ' + a.pace);
    }
  }
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
    const svHistory = loadSVHistory();
    const historyPace = calcPaceFromHistory(svHistory, saved.beagleSV, saved.timestamp, 2);
    // Preserve a verified stored pace first; only derive from history/baseline when the saved value is missing or invalid.
    if (saved.beaglePace != null && !isNaN(saved.beaglePace) && saved.beaglePace >= 1.0) {
      console.log('[STARTUP] Preserved saved beaglePace: ' + saved.beaglePace + ' (historyPace=' + historyPace + ')');
    } else if (historyPace != null) {
      console.log('[STARTUP] Recalculated beaglePace from recent snapshot: ' + historyPace + ' (was ' + saved.beaglePace + ')');
      saved.beaglePace = historyPace;
    } else {
      const baselinePace = calcPaceFromBaseline(saved.beagleSV, saved.timestamp);
      if (baselinePace != null) {
        console.log('[STARTUP] Recalculated beaglePace from baseline: ' + baselinePace + ' (was ' + saved.beaglePace + ')');
        saved.beaglePace = baselinePace;
      } else {
        console.log('[STARTUP] beaglePace corrupted (' + saved.beaglePace + ') — resetting to DEFAULT ' + cfg.DEFAULT_DATA.beaglePace);
        saved.beaglePace = cfg.DEFAULT_DATA.beaglePace;
      }
    }
    const allianceHistory = loadAllianceSVHistory();
    recalcAlliancePaces(saved, allianceHistory);
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
  ensureDataDir, checkPersistence, readJSON, writeJSON, postDiscord,
  calcPaceFromBaseline, calcPaceFromHistory,
  loadAllianceSVHistory, saveAllianceSVHistory, addAllianceSVSnapshot,
  calcAlliancePaceFromHistory, recalcAlliancePaces, normAllianceName: _normAllianceName,
  loadState, saveState, loadHqState, saveHqState,
  loadSVHistory, saveSVHistory, addSVSnapshot,
  loadSnapshotHistory, saveSnapshotHistory, addSnapshot,
  loadManualOverrides, saveManualOverrides,
};
