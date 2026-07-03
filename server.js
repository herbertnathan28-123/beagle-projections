// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE GLOBAL — ALLIANCE PROJECTIONS SERVICE
// Entry point: express wiring + route handlers. Constants live in config.js;
// projection engine in lib/engine.js; persistence/Discord IO in lib/storage.js;
// HTML views in views/*. Deploy: node server.js
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');

const cfg        = require('./config');
const storage    = require('./lib/storage');
const engine     = require('./lib/engine');
const parse      = require('./lib/parse');
const calculator = require('./lib/calculator');
const fuel       = require('./lib/fuel');
const hunter     = require('./lib/hunter');
const { buildCalcPage }      = require('./views/calc');
const { HQ_HTML }            = require('./views/hq');
const { HTML_COMPILED }      = require('./views/projections');
const { HUNTER_HTML }        = require('./views/hunter');
const { FUEL_SETUP_HTML }    = require('./views/fuelSetup');
const { buildFuelDashboard } = require('./views/fuelDashboard');

const {
  SECRET, N8N_TOKEN, AIRCRAFT_DATA, ALL_DISTANCES, CALC_TIMES,
  FUEL_SCHEDULE, AIRCRAFT_BURN_HOUR, FUEL_SCREENSHOT_UPLOAD_WEBHOOK,
  HUNTER_DATA_FILE, FUEL_ACCESS_LOG_FILE,
} = cfg;

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Engine / view aliases (keep route bodies unchanged) ────────────────────
const { analyseAllPlayers, calcMostImproved, _nk } = engine;
const { parsePaceUpload } = parse;
const { _calc } = calculator;
const getFuelPath = fuel.getFuelPath;
const { saveState, saveHqState, saveManualOverrides, calcPaceFromBaseline } = storage;

// ── Discord notifications (single POST helper under the hood) ───────────────
const notifyDiscord     = msg => storage.postDiscord(cfg.ALLIANCE_UPLOAD_WEBHOOK, msg, 'notify');
const notifyPlayerStats = msg => storage.postDiscord(cfg.PLAYER_STATS_WEBHOOK, msg, 'player stats');

function awstStamp(iso) {
  try {
    return new Date(iso).toLocaleString('en-AU', {
      timeZone: 'Australia/Perth', hour12: false,
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch (e) { return iso || '?'; }
}

// ── In-memory + persisted state ─────────────────────────────────────────────
let liveData        = storage.loadState();
let hqData          = storage.loadHqState();
let snapshotHistory = storage.loadSnapshotHistory();
let manualOverrides = storage.loadManualOverrides();

let fuelProfiles = storage.readJSON(cfg.FUEL_PROFILES_FILE, {});
if (Object.keys(fuelProfiles).length) console.log('[STARTUP] Fuel profiles loaded: ' + Object.keys(fuelProfiles).length);
let fuelApprovedUsers = storage.readJSON(cfg.FUEL_APPROVED_USERS_FILE, {});
if (Object.keys(fuelApprovedUsers).length) console.log('[STARTUP] Fuel approved users loaded: ' + Object.keys(fuelApprovedUsers).length);
let hunterData = storage.readJSON(cfg.HUNTER_DATA_FILE, null);
if (hunterData) console.log('[HUNTER] Loaded persisted data from disk');

const saveFuelProfiles     = () => storage.writeJSON(cfg.FUEL_PROFILES_FILE, fuelProfiles);
const saveFuelApprovedUsers = () => storage.writeJSON(cfg.FUEL_APPROVED_USERS_FILE, fuelApprovedUsers);

function logFuelAccess(did, name, action) {
  const log = storage.readJSON(FUEL_ACCESS_LOG_FILE, []);
  log.push({ discord_id: did || 'unknown', discord_name: name || '', action, timestamp: new Date().toISOString() });
  storage.writeJSON(FUEL_ACCESS_LOG_FILE, log.length > 5000 ? log.slice(-5000) : log);
}

// Hunter in-memory store (project-local ./data, distinct from /data hunterData)
const HUNTER_FILE = path.join(__dirname, 'data', 'hunter-data.json');
let hunterStore = { lastUpdated: null, players: {}, alliances: [], individuals: [] };
try {
  if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  if (fs.existsSync(HUNTER_FILE)) hunterStore = JSON.parse(fs.readFileSync(HUNTER_FILE, 'utf8'));
} catch (e) { console.error('Hunter load error:', e); }

const getHunterTrackedNames = () => hunter.getHunterTrackedNames(hunterData, hunterStore);
const addSnapshot = (players, timestamp) => storage.addSnapshot(snapshotHistory, players, timestamp);

// ── Visitor log ─────────────────────────────────────────────────────────────
const visitorLog = [];
function logVisit(req) {
  const ip   = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  // Skip internal health-check / keep-alive traffic (private IPs) — not real visitors.
  const bare = String(ip).replace(/^::ffff:/, '').trim();
  if (/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|^::1$/.test(bare)) return;
  const ua   = req.headers['user-agent'] || 'unknown';
  const time = new Date().toISOString();
  const device = ua.includes('Mobile') ? '📱 Mobile'
               : ua.includes('iPad')   ? '📱 iPad'
               : ua.includes('Mac')    ? '💻 Mac'
               : ua.includes('Windows')? '🖥 PC'
               : '❓ Unknown';
  visitorLog.unshift({ time, ip, device, ua: ua.slice(0, 80) });
  if (visitorLog.length > 200) visitorLog.pop();
  console.log(`[VISIT] ${device} ${ip} ${time}`);
}

app.use(cors());
app.use(express.json());
// Static files MUST be served BEFORE all route handlers.
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — specific routes MUST come before the wildcard app.get('*')
// ═══════════════════════════════════════════════════════════════════════════

// ── HQ ROUTES ─────────────────────────────────────────────────────────────
app.post('/api/hq-update', (req, res) => {
  try {
    const body = req.body || {};
    const token = body.token || '';
    const N8N_TOKEN = 'bgln8n-hq-2026';
    if (token !== N8N_TOKEN && token !== process.env.PROJECTIONS_SECRET) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const rawText = body.rawText || '';
    const allParsed = parsePaceUpload(rawText);
    // Filter out any Hunter-tracked players — they must never appear in HQ data
    const hunterNames = getHunterTrackedNames();
    const players = allParsed.filter(p => {
      const name = (p.name || p.airline_name || '').toLowerCase().trim();
      return !hunterNames.has(name);
    });
    if (players.length === 0) {
      notifyDiscord('⚠️ **HQ DATA NOT RECEIVED** — No players could be parsed from the upload. Data has NOT been logged. Contact Atlas.');
      return res.status(400).json({ ok: false, error: 'no players parsed' });
    }
    if (hqData.alliancePace) {
      hqData.history = [...(hqData.history || []).slice(-23), {
        timestamp: hqData.timestamp,
        alliancePace: hqData.alliancePace,
        airlines: hqData.airlines
      }];
    }
    hqData.timestamp = body.timestamp || new Date().toISOString();
    hqData.uploader = body.uploader || 'unknown';
    hqData.alliancePace = body.alliancePace || null;
    hqData.airlines = body.airlines || players.length;
    hqData.players = players.sort((a, b) => b.lastContrib - a.lastContrib);
    saveHqState(hqData);
    // Record snapshot for trend analysis (momentum, consistency, most improved)
    addSnapshot(players, hqData.timestamp);
    console.log('[HQ] updated — ' + players.length + ' players, pace ' + hqData.alliancePace + ' · snapshot #' + snapshotHistory.snapshots.length);
    const paceStr = hqData.alliancePace ? '$' + parseFloat(hqData.alliancePace).toFixed(2) + '/day' : 'not available';
    notifyDiscord('✅ **HQ DATA RECEIVED & LOGGED** — Alliance Pace: **' + paceStr + '** · ' + players.length + ' players · as of ' + awstStamp(hqData.timestamp) + ' AWST · uploaded by ' + hqData.uploader);
    // Post full player statistics to player stats channel
    try {
      const header = '📊 **BEAGLE ALLIANCE — PLAYER STATISTICS**\n' +
        'Alliance Pace: **' + paceStr + '** · ' + players.length + ' members · ' + awstStamp(hqData.timestamp) + ' AWST\n' +
        '─────────────────────────────────\n';
      const playerLines = players.map((p, i) => {
        const sv = p.sv ? '$' + p.sv.toLocaleString() : '—';
        const contrib = p.lastContrib ? '$' + p.lastContrib.toLocaleString() : '—';
        const flights = p.flights ? p.flights.toLocaleString() : '—';
        const seen = p.lastSeenStr || '?';
        return (i + 1) + '. **' + p.name + '** — SV: ' + sv + ' · Contrib: ' + contrib + ' · Flights: ' + flights + ' · Last: ' + seen;
      });
      // Split into chunks under 2000 chars (Discord limit)
      let chunk = header;
      for (const line of playerLines) {
        if ((chunk + line + '\n').length > 1900) {
          notifyPlayerStats(chunk);
          chunk = '';
        }
        chunk += line + '\n';
      }
      if (chunk.trim()) notifyPlayerStats(chunk);
    } catch (psErr) { console.error('[HQ] Player stats notify error:', psErr.message); }
    res.json({ ok: true, players: players.length });
  } catch (e) {
    console.error('[HQ] error:', e.message);
    notifyDiscord('⚠️ **HQ DATA NOT RECEIVED** — System error during save: ' + e.message + '. Data may NOT be current. Contact Atlas.');
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/hq-data', (req, res) => {
  // Strip any Hunter-tracked players from the response
  const hunterNames = getHunterTrackedNames();
  const filtered = { ...hqData };
  if (filtered.players && Array.isArray(filtered.players)) {
    filtered.players = filtered.players.filter(p => {
      const name = (p.name || p.airline_name || '').toLowerCase().trim();
      return !hunterNames.has(name);
    });
  }
  // Also scrub history entries
  if (filtered.history && Array.isArray(filtered.history)) {
    filtered.history = filtered.history.map(h => {
      if (!h.players) return h;
      return { ...h, players: h.players.filter(p => {
        const name = (p.name || p.airline_name || '').toLowerCase().trim();
        return !hunterNames.has(name);
      })};
    });
  }
  res.json(filtered);
});

app.get('/hq', (req, res) => {
  logVisit(req);
  res.type('html').send(HQ_HTML);
});

// ── PROJECTIONS API ────────────────────────────────────────────────────────
app.get('/api/visitors', (req, res) => {
  if (req.query.token !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ total: visitorLog.length, log: visitorLog });
});

app.get('/api/data', (req, res) => res.json(liveData));

app.post('/api/update', (req, res) => {
  const { token, timestamp, uploader, beagleSV, beagleRank, beaglePace, alliances } = req.body;
  if (token !== SECRET && token !== N8N_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  const merged = (alliances || []).map(a => {
    const existing = liveData.alliances.find(e =>
      e.name.toLowerCase().trim() === a.name.toLowerCase().trim());
    const incomingPace = (a.pace != null && !isNaN(a.pace)) ? a.pace : null;
    return { rank: a.rank, name: a.name, sv: a.sv, pace: incomingPace ?? existing?.pace ?? null };
  });
  const newSV = beagleSV ?? liveData.beagleSV;
  const newTs = timestamp || liveData.timestamp;
  const serverPace = calcPaceFromBaseline(newSV, newTs);
  const finalPace = serverPace ?? ((beaglePace != null && !isNaN(beaglePace) && beaglePace >= 1.0) ? beaglePace : liveData.beaglePace);
  console.log('[PACE] n8n=' + beaglePace + ' server=' + serverPace + ' final=' + finalPace);
  liveData = {
    timestamp, uploader,
    beagleSV:   newSV,
    beaglePace: finalPace,
    beagleRank: beagleRank ?? liveData.beagleRank,
    alliances:  merged.length ? merged : liveData.alliances,
  };
  console.log(`[${new Date().toISOString()}] Updated by ${uploader}`);
  saveState(liveData);
  notifyDiscord(
    '✅ **PROJECTIONS DATA RECEIVED & LOGGED**' +
    ' — Beagle Pace: **$' + (liveData.beaglePace || 0).toFixed(2) + '/day**' +
    ' · SV: ' + (liveData.beagleSV || 0).toLocaleString() +
    ' · Rank: #' + (liveData.beagleRank || '?') +
    ' · as of ' + awstStamp(liveData.timestamp) + ' AWST' +
    ' · uploaded by ' + uploader
  );
  res.json({ ok: true });
});

// ── CALCULATOR API — must be before wildcard ───────────────────────────────
app.get('/api/calc', (req, res) => {
  if (req.query.k !== process.env.CONTRIBUTIONS_LOG_IN) return res.status(403).json({ error: 'Denied' });
  const ac = AIRCRAFT_DATA.find(a => a.name === req.query.aircraft);
  if (!ac) return res.status(400).json({ error: 'Unknown aircraft' });
  const mode = req.query.mode === 'Easy' ? 'Easy' : 'Realism';
  const speed = mode === 'Easy' ? ac.easy : ac.realism;
  const maxRange = ac.maxRange;
  const stopoverMax = Math.min(maxRange * 2, 20000);

  const singleDists = ALL_DISTANCES.filter(d => d <= maxRange);
  const stopoverDists = ALL_DISTANCES.filter(d => d > maxRange && d <= stopoverMax);

  const singleGrid = CALC_TIMES.map(t => singleDists.map(d => _calc(d, t, speed, mode)));
  const stopoverGrid = CALC_TIMES.map(t => stopoverDists.map(d => _calc(d / 2, t, speed, mode)));

  res.json({ singleGrid, singleDists, stopoverGrid, stopoverDists, maxRange, stopoverMax });
});

// ── CALCULATOR PAGE — must be before wildcard ──────────────────────────────
app.get('/calculator', (req, res) => {
  if (req.query.k !== process.env.CONTRIBUTIONS_LOG_IN) return res.status(403).send('Access denied.');
  res.send(buildCalcPage(req.query.k));
});

// ── HUNTER ELITE ROUTES ────────────────────────────────────────────────────
// ALL Hunter routes require HUNTER_KEY or PROJECTIONS_SECRET for access.
// No hunter data is served without authentication.
const HUNTER_AUTH = (req, res, next) => {
  const key = req.query.key || req.headers['x-hunter-key'] || '';
  const validKey = (process.env.HUNTER_KEY || 'A11').toUpperCase();
  if (key.toUpperCase() === validKey || key === SECRET) return next();
  return res.status(403).type('text').send('Access denied');
};

app.get('/hunter', HUNTER_AUTH, (req, res) => {
  const key = (process.env.HUNTER_KEY || 'A11').toUpperCase();
  const html = HUNTER_HTML.replace('</head>',
    '<script>window._HUNTER_KEY="' + key + '";</script></head>'
  );
  res.type('html').send(html);
});

app.post('/api/hunter-update', (req, res) => {
  const authKey = req.body?.key || req.headers['x-hunter-key'] || '';
  const validKey = (process.env.HUNTER_KEY || 'A11').toUpperCase();
  if (authKey.toUpperCase() !== validKey && authKey !== SECRET && authKey !== N8N_TOKEN) {
    return res.status(403).json({ ok: false, error: 'Access denied' });
  }
  try {
    const incoming = req.body;
    const incomingPlayers = incoming?.players || [];

    // Load existing data from disk (or memory) to merge with
    let existing = {};
    if (fs.existsSync(HUNTER_DATA_FILE)) {
      try { existing = JSON.parse(fs.readFileSync(HUNTER_DATA_FILE, 'utf8')); } catch (_) {}
    }
    const existingPlayers = existing?.players || [];

    // Merge: start from existing, update/add incoming by airline_name
    const merged = [...existingPlayers];
    for (const player of incomingPlayers) {
      const idx = merged.findIndex(p => p.airline_name === player.airline_name);
      if (idx >= 0) {
        merged[idx] = player;
      } else {
        merged.push(player);
      }
    }

    hunterData = { ...incoming, players: merged };
    const total = merged.length;

    // Persist to disk
    if (!fs.existsSync('/data')) {
      fs.mkdirSync('/data', { recursive: true });
    }
    fs.writeFileSync(HUNTER_DATA_FILE, JSON.stringify(hunterData), 'utf8');
    console.log('[HUNTER] Data merged and persisted — ' + total + ' players (' + incomingPlayers.length + ' incoming)');
    res.json({ ok: true, total });
  } catch (e) {
    console.error('[HUNTER] Update error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/hunter-data', HUNTER_AUTH, (req, res) => {
  // Load from disk as fallback if not in memory
  if (!hunterData && fs.existsSync(HUNTER_DATA_FILE)) {
    try {
      hunterData = JSON.parse(fs.readFileSync(HUNTER_DATA_FILE, 'utf8'));
    } catch (e) {
      return res.status(500).json({ error: 'Failed to load hunter data' });
    }
  }
  if (!hunterData) {
    return res.status(404).json({ error: 'No hunter data yet' });
  }
  try {
    const all = hunterData.players || [];
    const allianceMap = {};
    const individuals = [];
    for (const p of all) {
      const aName = p.alliance_name;
      const isInd = !aName || aName === 'UNKNOWN' || aName === 'INDIVIDUAL' || aName === 'UNAFFILIATED';
      if (isInd) {
        individuals.push(p);
      } else {
        if (!allianceMap[aName])
          allianceMap[aName] = { allianceName: aName, players: [], departed: [] };
        if (p.roster_status === 'DEPARTED')
          allianceMap[aName].departed.push(p.airline_name);
        else
          allianceMap[aName].players.push(p);
      }
    }
    for (const name of (hunterData.departed || [])) {
      for (const key of Object.keys(allianceMap)) {
        const idx = allianceMap[key].players.findIndex(p => p.airline_name === name);
        if (idx !== -1) {
          allianceMap[key].players.splice(idx, 1);
          allianceMap[key].departed.push(name);
        }
      }
    }
    const alliances = Object.values(allianceMap).sort((a, b) => {
      const ar = a.players.filter(p => p.level === 'RED').length;
      const br = b.players.filter(p => p.level === 'RED').length;
      return br - ar;
    });
    res.json({
      lastUpdated: hunterData.lastUpdated,
      totalPlayers: all.filter(p => p.roster_status !== 'DEPARTED').length,
      alliances,
      individuals,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load hunter data' });
  }
});
// ── FUEL DASHBOARD ROUTES ──────────────────────────────────────────────────
app.get('/api/fuel-schedule', (req, res) => {
  res.json(FUEL_SCHEDULE);
});

app.get('/api/fuel-path', (req, res) => {
  try {
    const fp = getFuelPath();
    res.json(fp);
  } catch (e) {
    console.error('[FUEL-PATH] Error:', e.message);
    res.status(500).json({ error: 'Failed to generate fuel path' });
  }
});

app.get('/fuel/:discordId', (req, res) => {
  const key = String(req.params.discordId || '').replace(/[^0-9a-zA-Z._-]/g, '');
  if (!key) return res.status(400).send('Invalid Discord ID');
  logVisit(req);
  // Resolve the real Discord ID for the Edit Profile link
  let editDid = key;
  let resolvedProfile = fuelProfiles[key] || null;
  if (resolvedProfile && resolvedProfile.discord_id && /^\d{17,19}$/.test(String(resolvedProfile.discord_id))) {
    editDid = String(resolvedProfile.discord_id);
  } else {
    // Search all profiles for one whose discord_id matches this key
    for (const [k, p] of Object.entries(fuelProfiles)) {
      if (p && (String(p.discord_id || '') === key || k === key)) {
        resolvedProfile = p;
        if (p.discord_id && /^\d{17,19}$/.test(String(p.discord_id))) {
          editDid = String(p.discord_id);
        }
        break;
      }
    }
  }
  // Gate: members with no profile must complete setup first
  if (!resolvedProfile) {
    logFuelAccess(key, '', 'dashboard_redirect_no_profile');
    return res.redirect('/fuel-setup?did=' + encodeURIComponent(key));
  }
  logFuelAccess(editDid, '', 'dashboard_view');
  res.type('html').send(buildFuelDashboard(key, editDid));
});

app.get('/fuel-setup', (req, res) => {
  const did = req.query.did || '';
  logVisit(req);
  if (did) logFuelAccess(did, '', 'setup_view');
  res.type('html').send(FUEL_SETUP_HTML);
});

// Explicit route for /fuel-calculator — belt-and-suspenders to ensure static file
// is always served even if express.static extensions resolution fails.
app.get('/fuel-calculator', (req, res) => {
  logVisit(req);
  res.sendFile(path.join(__dirname, 'public', 'fuel-calculator.html'));
});

// Check if a fuel profile exists for a Discord ID
// Also searches profiles saved under usernames for a matching discord_id field
// and auto-migrates them to the numeric ID key
app.get('/api/fuel-check', (req, res) => {
  const did = String(req.query.did || '').replace(/[^0-9]/g, '');
  if (!did) return res.json({ exists: false });
  // Direct lookup by numeric ID
  if (fuelProfiles[did]) {
    return res.json({ exists: true, discord_id: did, discord_name: fuelProfiles[did].discord_name || '' });
  }
  // Search all profiles for a matching discord_id field (saved under username key)
  for (const [key, profile] of Object.entries(fuelProfiles)) {
    if (profile && String(profile.discord_id || '') === did) {
      // Auto-migrate: copy to numeric ID key
      fuelProfiles[did] = { ...profile, discord_id: did };
      saveFuelProfiles();
      console.log('[FUEL-CHECK] Migrated profile from key=' + key + ' to key=' + did);
      return res.json({ exists: true, discord_id: did, discord_name: profile.discord_name || '', migrated: true });
    }
  }
  res.json({ exists: false, discord_id: did });
});
 
app.post('/api/fuel-setup', (req, res) => {
  try {
    const p = req.body;
    const did = p.discord_id ? String(p.discord_id) : null;
    const key = did || p.discord_name || ('anon-' + Date.now());
    fuelProfiles[key] = { ...p, last_updated: new Date().toISOString() };
    saveFuelProfiles();
    console.log('[FUEL-SETUP] Profile saved: ' + p.discord_name + ' (key=' + key + ')');
    logFuelAccess(did, p.discord_name, 'profile_save');
    res.json({ ok: true, key: key });
  } catch(e) {
    console.error('[FUEL-SETUP] Error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});
 
app.post('/api/fuel-profile', (req, res) => {
  const { token, discord_id, ...rest } = req.body || {};
  if (token !== N8N_TOKEN && token !== SECRET) {
    return res.status(403).json({ saved: false, error: 'Unauthorized' });
  }
  const did = String(discord_id || '').replace(/[^0-9]/g, '');
  if (!(/^\d{17,19}$/).test(did)) {
    return res.status(400).json({ saved: false, error: 'Invalid Discord ID' });
  }
  try {
    const profile = { discord_id: did, ...rest, last_updated: new Date().toISOString() };
    fuelProfiles[did] = profile;
    saveFuelProfiles();
    try {
      const dir = '/data/fuel-profiles';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(dir + '/' + did + '.json', JSON.stringify(profile), 'utf8');
    } catch (fe) { console.warn('[FUEL-PROFILE] Per-file save skipped:', fe.message); }
    // Post personal dashboard link to fuel screenshot upload channel, auto-delete after 30s
    try {
      if (!FUEL_SCREENSHOT_UPLOAD_WEBHOOK) throw new Error('FUEL_CO2_SCREENSHOOT_UPLOAD not set');
      const linkMsg = 'Your fuel dashboard is ready. Your personal link is beagle-projections.onrender.com/fuel/' + did + ' \u2014 copy this link now. This message disappears in 30 seconds.';
      const body = JSON.stringify({ content: linkMsg });
      const u = new URL(FUEL_SCREENSHOT_UPLOAD_WEBHOOK);
      const whReq = https.request({
        hostname: u.hostname, path: u.pathname + '?wait=true', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      });
      whReq.on('response', (whRes) => {
        let data = '';
        whRes.on('data', chunk => { data += chunk; });
        whRes.on('end', () => {
          try {
            const msg = JSON.parse(data);
            if (msg.id) {
              setTimeout(() => {
                const delReq = https.request({
                  hostname: u.hostname,
                  path: u.pathname + '/messages/' + msg.id,
                  method: 'DELETE'
                });
                delReq.on('error', e => console.error('[FUEL-PROFILE] Delete error:', e.message));
                delReq.end();
              }, 30000);
            }
          } catch (pe) { console.error('[FUEL-PROFILE] Parse webhook response error:', pe.message); }
        });
      });
      whReq.on('error', e => console.error('[FUEL-PROFILE] Webhook error:', e.message));
      whReq.write(body);
      whReq.end();
    } catch (we) { console.error('[FUEL-PROFILE] Webhook failed:', we.message); }
    console.log('[FUEL-PROFILE] Saved: ' + did);
    res.json({ saved: true });
  } catch (e) {
    console.error('[FUEL-PROFILE] Error:', e.message);
    res.status(500).json({ saved: false, error: e.message });
  }
});

app.get('/api/fuel-profile', (req, res) => {
  if (req.query.token !== N8N_TOKEN && req.query.token !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const did = String(req.query.discord_id || '');
  if (!did) return res.status(400).json({ error: 'discord_id required' });
  const profile = fuelProfiles[did];
  if (!profile) return res.json({ found: false, profile: null });
  res.json({ found: true, profile });
});

// ── MAINTENANCE TRACKER ROUTES ────────────────────────────────────────────
app.get('/api/maintenance/:discordId', (req, res) => {
  const did = String(req.params.discordId || '').replace(/[^0-9]/g, '');
  if (!did) return res.status(400).json({ error: 'Invalid Discord ID' });
  try {
    const mFile = '/data/maintenance/' + did + '.json';
    if (fs.existsSync(mFile)) {
      const data = JSON.parse(fs.readFileSync(mFile, 'utf8'));
      return res.json(data);
    }
    res.json({ aircraft: {} });
  } catch (e) {
    res.json({ aircraft: {} });
  }
});

app.post('/api/maintenance/:discordId', (req, res) => {
  const did = String(req.params.discordId || '').replace(/[^0-9]/g, '');
  if (!did) return res.status(400).json({ error: 'Invalid Discord ID' });
  try {
    const dir = '/data/maintenance';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = { ...req.body, last_updated: new Date().toISOString() };
    fs.writeFileSync(dir + '/' + did + '.json', JSON.stringify(data), 'utf8');
    console.log('[MAINTENANCE] Saved for ' + did);
    res.json({ saved: true });
  } catch (e) {
    console.error('[MAINTENANCE] Error:', e.message);
    res.status(500).json({ saved: false, error: e.message });
  }
});


// ── ENROLLMENT CHECK — for generic alert workflow exclusion ────────────────
// Part 6: n8n generic fuel alert workflow checks this before sending alerts.
// If enrolled === true, skip the member (they get Stepping Stone DMs instead).
app.get('/api/fuel-enrolled', (req, res) => {
  const did = String(req.query.discord_id || '');
  if (!did) return res.status(400).json({ error: 'discord_id required' });
  const enrolled = !!fuelProfiles[did];
  res.json({ discord_id: did, enrolled });
});

// ── FUEL APPROVED USERS MANAGEMENT ─────────────────────────────────────────
// Nathan can add/remove approved Discord IDs for fuel system access
app.get('/api/fuel-approved-users', (req, res) => {
  if (req.query.token !== N8N_TOKEN && req.query.token !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ users: fuelApprovedUsers, count: Object.keys(fuelApprovedUsers).length });
});

app.post('/api/fuel-approved-users', (req, res) => {
  const { token, discord_id, name, action } = req.body || {};
  if (token !== N8N_TOKEN && token !== SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const did = String(discord_id || '').replace(/[^0-9]/g, '');
  if (!did) return res.status(400).json({ error: 'discord_id required' });
  if (action === 'remove') {
    delete fuelApprovedUsers[did];
    saveFuelApprovedUsers();
    return res.json({ ok: true, action: 'removed', discord_id: did });
  }
  fuelApprovedUsers[did] = { name: name || '', added_at: new Date().toISOString() };
  saveFuelApprovedUsers();
  res.json({ ok: true, action: 'added', discord_id: did, name: name || '' });
});

// ── FUEL ACCESS LOG — view who has accessed fuel pages ─────────────────────
app.get('/api/fuel-access-log', (req, res) => {
  if (req.query.token !== N8N_TOKEN && req.query.token !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    let log = [];
    try { log = JSON.parse(fs.readFileSync(FUEL_ACCESS_LOG_FILE, 'utf8')); } catch(e) {}
    const limit = parseInt(req.query.limit) || 100;
    res.json({ entries: log.slice(-limit), total: log.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── NOTIFICATION ENDPOINT — for n8n 30-minute schedule trigger ────────────
// Part 5: Returns members who have an optimal buy window within 15 minutes.
// n8n calls this every 30 min and sends Discord DMs to returned members.
app.get('/api/fuel-notifications', (req, res) => {
  if (req.query.token !== N8N_TOKEN && req.query.token !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const fp = getFuelPath();
    const now = new Date();
    const nowMs = now.getTime();
    const window15 = 15 * 60 * 1000;
    const todayUTC = now.getUTCDate();
    const notifications = [];

    for (const [did, profile] of Object.entries(fuelProfiles)) {
      if (!profile || !profile.setup_complete) continue;
      const tzStr = profile.timezone || 'UTC+0';
      const tzMatch = tzStr.match(/UTC([+-]?\d+\.?\d*)/);
      const tzOffset = tzMatch ? parseFloat(tzMatch[1]) : 0;

      // Check fuel and co2 windows for today and tomorrow
      for (let dayOff = 0; dayOff <= 1; dayOff++) {
        const checkDay = todayUTC + dayOff;
        const dayData = fp.days.find(d => d.day === checkDay);
        if (!dayData) continue;

        for (const type of ['fuel', 'co2']) {
          if (!dayData[type]) continue;
          const [slotH, slotM] = dayData[type].slot.split(':').map(Number);
          const slotDate = new Date(Date.UTC(fp.year, fp.month - 1, checkDay, slotH, slotM));
          const slotMs = slotDate.getTime();
          const diff = slotMs - nowMs;

          if (diff > 0 && diff <= window15) {
            // Calculate quantities based on fleet
            const fleet = profile.fleet || [];
            const reserveBuffer = Number(profile.reserve_buffer) || 10000;
            const tankCap = Number(profile.fuel_tank_capacity) || 0;
            const co2Tank = Number(profile.co2_tank_capacity) || 0;
            let dailyBurn = 0;
            for (const f of fleet) {
              const burnPerHr = AIRCRAFT_BURN_HOUR[f.type] || 10000;
              const hrs = f.flight_hours || 12;
              dailyBurn += (f.total_aircraft || 0) * burnPerHr * hrs * (24 / hrs);
            }
            const buyQtyFuel = Math.max(0, (tankCap - reserveBuffer) - (Number(profile.fuel_reserves) || 0));
            const buyQtyCo2 = Math.max(0, (co2Tank - reserveBuffer) - (Number(profile.co2_reserves) || 0));

            // Local time for the member
            const localTotalMin = (slotH * 60 + slotM) + (tzOffset * 60);
            const localH = Math.floor(((localTotalMin % 1440) + 1440) % 1440 / 60);
            const localM = Math.round(((localTotalMin % 1440) + 1440) % 1440 % 60);
            const localTime = String(localH).padStart(2, '0') + ':' + String(localM).padStart(2, '0');
            const dkTotalMin = (slotH * 60 + slotM) + 120;
            const dkH = Math.floor(((dkTotalMin % 1440) + 1440) % 1440 / 60);
            const dkM = Math.round(((dkTotalMin % 1440) + 1440) % 1440 % 60);
            const dkTime = String(dkH).padStart(2, '0') + ':' + String(dkM).padStart(2, '0');

            notifications.push({
              discord_id: did,
              type,
              day: checkDay,
              price: dayData[type].price,
              slot_utc: dayData[type].slot,
              slot_denmark: dkTime,
              slot_local: localTime,
              buy_qty_fuel: type === 'fuel' ? buyQtyFuel : 0,
              buy_qty_co2: type === 'co2' ? buyQtyCo2 : 0,
              minutes_until: Math.round(diff / 60000)
            });
          }
        }
      }
    }

    res.json({ notifications, count: notifications.length, checked_at: now.toISOString() });
  } catch (e) {
    console.error('[FUEL-NOTIFICATIONS] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PLAYER STATISTICS API ─────────────────────────────────────────────────

app.get('/api/player-stats', (req, res) => {
  try {
    const hunterNames = getHunterTrackedNames();
    const rawPlayers = (hqData.players || []).filter(p => {
      const name = (p.name || '').toLowerCase().trim();
      return !hunterNames.has(name);
    });
    // Apply manual overrides
    const players = rawPlayers.map(p => {
      const key = _nk(p.name);
      const ov = manualOverrides[key];
      if (!ov) return p;
      const merged = { ...p };
      if (ov.sv != null) merged.sv = ov.sv;
      if (ov.lastContrib != null) merged.lastContrib = ov.lastContrib;
      if (ov.allianceContrib != null) merged.allianceContrib = ov.allianceContrib;
      if (ov.flights != null) merged.flights = ov.flights;
      return merged;
    });
    const snapshots = snapshotHistory.snapshots || [];
    const analysed = analyseAllPlayers(players, snapshots);
    res.json({
      timestamp: hqData.timestamp,
      uploader: hqData.uploader,
      alliancePace: hqData.alliancePace,
      airlines: hqData.airlines,
      snapshotCount: snapshots.length,
      players: analysed,
    });
  } catch (e) {
    console.error('[PLAYER-STATS] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/most-improved', (req, res) => {
  try {
    const snapshots = snapshotHistory.snapshots || [];
    const improved = calcMostImproved(snapshots);
    res.json(improved);
  } catch (e) {
    console.error('[MOST-IMPROVED] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/player-manual-entry', (req, res) => {
  try {
    const { player, field, value } = req.body || {};
    if (!player || !field || value == null) {
      return res.status(400).json({ ok: false, error: 'Missing player, field, or value' });
    }
    const validFields = ['sv', 'lastContrib', 'allianceContrib', 'flights'];
    if (!validFields.includes(field)) {
      return res.status(400).json({ ok: false, error: 'Invalid field: ' + field });
    }
    const key = _nk(player);
    if (!manualOverrides[key]) manualOverrides[key] = { player, updatedAt: new Date().toISOString() };
    manualOverrides[key][field] = parseFloat(value);
    manualOverrides[key].updatedAt = new Date().toISOString();
    saveManualOverrides(manualOverrides);
    console.log('[MANUAL-ENTRY] ' + player + ' ' + field + ' = ' + value);
    res.json({ ok: true, player, field, value: parseFloat(value) });
  } catch (e) {
    console.error('[MANUAL-ENTRY] error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── WILDCARD — catches all other routes (Alliance Projections main page) ───
// Health check — point the Render health-check path here so a hung/unresponsive
// instance is detected and restarted.
app.get('/healthz', (req, res) => res.status(200).type('text').send('OK'));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).send('Not found');
  logVisit(req);
  res.type('html').send(HTML_COMPILED);
});

storage.checkPersistence();
app.listen(PORT, () => console.log(`Beagle Projections live on port ${PORT}`));
