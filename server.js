// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE GLOBAL — ALLIANCE PROJECTIONS SERVICE
// Entry point: express wiring + route handlers. Constants live in config.js;
// projection engine in lib/engine.js; persistence/Discord IO in lib/storage.js;
// HTML views in views/*. Deploy: node server.js
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const webpush = require('web-push');

const cfg        = require('./config');
const storage    = require('./lib/storage');
const engine     = require('./lib/engine');
const parse      = require('./lib/parse');
const calculator = require('./lib/calculator');
const fuel       = require('./lib/fuel');
const fuelAlerts = require('./lib/fuelAlerts');
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
const PORT = process.env.PORT || 10000;

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

// Per-player buy plans pushed from the calculator (drive the 5-min alerts).
let fuelPlans = storage.readJSON(cfg.FUEL_PLANS_FILE, {});
if (Object.keys(fuelPlans).length) console.log('[STARTUP] Fuel plans loaded: ' + Object.keys(fuelPlans).length);
const saveFuelPlans = () => storage.writeJSON(cfg.FUEL_PLANS_FILE, fuelPlans);

// Per-player WEB-PUSH subscriptions — on-screen alerts on the player's device
// even when the calculator AND Discord are closed. VAPID keys are generated
// once and persisted to /data so subscriptions survive redeploys.
let fuelPushSubs = storage.readJSON(cfg.FUEL_PUSH_SUBS_FILE, {});
if (Object.keys(fuelPushSubs).length) console.log('[STARTUP] Push subscriptions loaded: ' + Object.keys(fuelPushSubs).length + ' player(s)');
const saveFuelPushSubs = () => storage.writeJSON(cfg.FUEL_PUSH_SUBS_FILE, fuelPushSubs);
let VAPID = storage.readJSON('/data/vapid.json', null);
try {
  if (!VAPID || !VAPID.publicKey || !VAPID.privateKey) {
    VAPID = webpush.generateVAPIDKeys();
    storage.writeJSON('/data/vapid.json', VAPID);
    console.log('[PUSH] Generated + persisted VAPID keys');
  }
  webpush.setVapidDetails('mailto:herbertnathan28@gmail.com', VAPID.publicKey, VAPID.privateKey);
} catch (e) { console.error('[PUSH] VAPID init failed — web push disabled:', e.message); VAPID = null; }
// Push a system notification to every device the player subscribed. Expired or
// revoked subscriptions (404/410) are pruned automatically.
function sendPushAlert(did, title, body) {
  if (!VAPID) return;
  for (const sub of (fuelPushSubs[did] || []).slice()) {
    webpush.sendNotification(sub, JSON.stringify({ title, body })).catch(err => {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) {
        fuelPushSubs[did] = (fuelPushSubs[did] || []).filter(s => s.endpoint !== sub.endpoint);
        saveFuelPushSubs();
      } else console.error('[PUSH] send failed (' + (code || err.message) + ')');
    });
  }
}

// Per-player plan-push credential: HMAC(did) injected ONLY into that player's
// personal calculator page. Discord IDs are semi-public, so without this any
// client could overwrite another player's alert plan and trigger false
// @mention buy warnings. Stateless — verified per request, nothing stored.
const fuelPlanToken = did => crypto.createHmac('sha256', SECRET).update('fuel-plan:' + did).digest('hex');
function fuelPlanTokenValid(did, tok) {
  const want = fuelPlanToken(did);
  const got = String(tok || '');
  return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

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
// Registered player's personal calculator link (/fuel-calculator?did=<id>): inject
// their stored profile (synced from n8n via POST /api/fuel-profile) so the page
// auto-populates. Must run BEFORE express.static, which would otherwise serve the
// blank fuel-calculator.html directly. No did / no profile → fall through to the
// static blank page, so nothing is exposed on the bare public URL.
// Never let the browser (or an edge cache) hold onto this page — a stale copy could show a
// different player's injected profile, or run pre-fix JS. Applies to BOTH the injected route
// below and the static-served fallback.
// Redirect /fuel-calculator.html?did=... to /fuel-calculator?did=... so the
// profile injection route fires correctly regardless of which URL form is shared.
app.get('/fuel-calculator.html', (req, res) => {
  const qs = [];
  if (req.query.did) qs.push('did=' + encodeURIComponent(req.query.did));
  if (req.query.qac) qs.push('qac=1');
  return res.redirect(301, '/fuel-calculator' + (qs.length ? '?' + qs.join('&') : ''));
});
app.use('/fuel-calculator', (req, res, next) => { res.set('Cache-Control', 'no-store, no-cache, must-revalidate'); next(); });
app.get('/fuel-calculator', (req, res, next) => {
  const did = String(req.query.did || '').replace(/[^0-9]/g, '');
  if (!did || !fuelProfiles[did]) return next();
  try {
    logVisit(req);
    let html = fs.readFileSync(path.join(__dirname, 'public', 'fuel-calculator.html'), 'utf8');
    const json = JSON.stringify(fuelProfiles[did]).replace(/</g, '\\u003c');   // prevent </script> breakout
    // __FUEL_PLAN_TOKEN__ authorises this player's plan pushes (/api/fuel-plan) — hex HMAC, injection-safe.
    // Manifest link makes the personal page installable to the Home Screen (iOS requires that for web push).
    html = html.replace('</head>',
      '<link rel="manifest" href="/fuel-manifest.json?did=' + did + '">\n' +
      '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
      '<script>window.__FUEL_PROFILE__=' + json + ';window.__FUEL_PLAN_TOKEN__="' + fuelPlanToken(did) + '";</script>\n</head>');
    logFuelAccess(did, fuelProfiles[did].discord_name || '', 'calc_view');
    // Never cache the per-player injected page — a cached copy could serve the wrong
    // player's profile (or a stale one) to a shared browser.
    res.set('Cache-Control', 'no-store');
    return res.type('html').send(html);
  } catch (e) {
    console.error('[FUEL-CALC] Profile inject failed:', e.message);
    return next();
  }
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Root: this service IS the Alliance Projections service, so the bare domain must serve
// the Alliance Projections page (same content the wildcard serves), NOT the fuel
// calculator. A previous version redirected "/" to /fuel-calculator, which leaked the
// player fuel calculator into the alliance/pace channels whose links point at the bare
// domain. The fuel calculator is reachable ONLY via its explicit routes (/fuel-calculator,
// /qac, /fuel/:did, /fuel-setup) — never from the domain root.
app.get('/', (req, res) => { logVisit(req); res.type('html').send(HTML_COMPILED); });

// QAC standalone: serve the calculator with the Quick Access panel auto-opened,
// so there is one engine/page to maintain rather than a duplicate optimizer.
app.get('/qac', (req, res) => res.redirect(302, '/fuel-calculator?qac=1'));

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
  // Deduplicate alliances by name — prevents double rows from repeat uploads
  const _seenAlliances = new Set();
  const dedupedMerged = merged.filter(a => {
    const k = (a.name || '').toLowerCase().trim();
    if (_seenAlliances.has(k)) return false;
    _seenAlliances.add(k);
    return true;
  });
  const newSV = beagleSV ?? liveData.beagleSV;
  const newTs = timestamp || liveData.timestamp;
  const serverPace = calcPaceFromBaseline(newSV, newTs);
  const finalPace = (beaglePace != null && !isNaN(beaglePace) && beaglePace >= 1.0) ? beaglePace : serverPace;
  console.log('[PACE] n8n=' + beaglePace + ' server=' + serverPace + ' final=' + finalPace);
  liveData = {
    timestamp, uploader,
    beagleSV:   newSV,
    beaglePace: finalPace,
    beagleRank: beagleRank ?? liveData.beagleRank,
    alliances:  dedupedMerged.length ? dedupedMerged : liveData.alliances,
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

// Explicit route for /fuel-calculator — belt-and-suspenders to ensure the static
// file is served even if express.static extensions resolution fails. (Profile
// injection for ?did links is handled by the pre-static route above.)
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

// ── FUEL BUY-ALERT PLAN PUSH ───────────────────────────────────────────────
// The registered player's calculator posts its own optimiser plan (per-slot
// suggested buys for fuel + CO2, sugAll layout) here. The server caches it per
// player and the 5-min scheduler fires #fuel-alert warnings from it — so
// alerts work even when the player's page is closed. No secret in this request;
// it only sets that player's own alert plan, and only for a registered id.
app.post('/api/fuel-plan', (req, res) => {
  const { discord_id, baseDay, fsug, csug, plan_token } = req.body || {};
  const did = String(discord_id || '').replace(/[^0-9]/g, '');
  if (!(/^\d{17,20}$/).test(did)) return res.status(400).json({ ok: false, error: 'Invalid Discord ID' });
  if (!fuelProfiles[did]) return res.status(403).json({ ok: false, error: 'Not a registered fuel profile' });
  // Only the player's own injected page holds this token — rejects spoofed pushes for someone else's id.
  if (!fuelPlanTokenValid(did, plan_token)) return res.status(403).json({ ok: false, error: 'Invalid plan token' });
  const day = parseInt(baseDay, 10);
  if (!(day >= 1 && day <= 31)) return res.status(400).json({ ok: false, error: 'Invalid baseDay' });
  if (!Array.isArray(fsug) || !Array.isArray(csug)) return res.status(400).json({ ok: false, error: 'fsug/csug must be arrays' });
  const MAX = 32 * 48;   // guard: at most a full month of 30-min slots
  if (fsug.length > MAX || csug.length > MAX) return res.status(400).json({ ok: false, error: 'plan too long' });
  // Coerce to finite non-negative numbers — never store junk that could mis-fire an alert.
  const clean = a => a.map(v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; });
  fuelPlans[did] = { baseDay: day, fsug: clean(fsug), csug: clean(csug), updated: new Date().toISOString() };
  saveFuelPlans();
  // Late-breaking cover: if the freshly pushed plan (e.g. DEP pressed at :29,
  // month reshuffled) contains a buy inside the 5-min window the :25/:55
  // scheduler can no longer warn about, alert immediately instead of never.
  try { fireImminentAlerts(did, fuelPlans[did], new Date()); }
  catch (e) { console.error('[FUEL-ALERT] imminent check error:', e.message); }
  res.json({ ok: true });
});

// ── WEB-PUSH SUBSCRIBE (on-screen alerts with the calculator closed) ────────
app.get('/api/fuel-push-key', (req, res) => res.json({ key: VAPID ? VAPID.publicKey : null }));
app.post('/api/fuel-push-subscribe', (req, res) => {
  const { discord_id, plan_token, subscription } = req.body || {};
  const did = String(discord_id || '').replace(/[^0-9]/g, '');
  if (!(/^\d{17,20}$/).test(did) || !fuelProfiles[did]) return res.status(403).json({ ok: false, error: 'Not a registered fuel profile' });
  if (!fuelPlanTokenValid(did, plan_token)) return res.status(403).json({ ok: false, error: 'Invalid plan token' });
  if (!subscription || typeof subscription.endpoint !== 'string') return res.status(400).json({ ok: false, error: 'Invalid subscription' });
  const list = fuelPushSubs[did] || (fuelPushSubs[did] = []);
  if (!list.some(s => s.endpoint === subscription.endpoint)) {
    list.push(subscription);
    if (list.length > 5) list.shift();   // keep the 5 most recent devices per player
    saveFuelPushSubs();
  }
  console.log('[PUSH] Subscribed device for ' + did + ' (' + list.length + ' device(s))');
  res.json({ ok: true, devices: list.length });
});

// Per-player web-app manifest: iOS only delivers web push to Home-Screen apps,
// and the installed app must reopen the player's OWN ?did link.
app.get('/fuel-manifest.json', (req, res) => {
  const did = String(req.query.did || '').replace(/[^0-9]/g, '');
  res.json({
    name: 'Beagle Fuel Calculator', short_name: 'Fuel Calc', display: 'standalone',
    start_url: '/fuel-calculator' + (did ? '?did=' + did : ''),
    background_color: '#050b12', theme_color: '#050b12',
  });
});

// ── FUEL BUY-ALERT TEST FIRE ───────────────────────────────────────────────
// Fire one dummy warning to the #fuel-alert webhook on demand, to prove the
// webhook + @mention work without waiting for a real buy window. Token-gated
// (same tokens as the other API routes). Optional did= mentions that player;
// otherwise it posts without a mention. Browser-friendly:
//   GET /api/fuel-alert-test?token=...&did=690861328507731978
app.get('/api/fuel-alert-test', (req, res) => {
  if (req.query.token !== N8N_TOKEN && req.query.token !== SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!cfg.FUEL_ALERT_WEBHOOK) {
    return res.status(503).json({ ok: false, error: 'FUEL_CALCULATOR_WEBHOOK not set on the server' });
  }
  const did = String(req.query.did || '').replace(/[^0-9]/g, '');
  const now = new Date();
  const target = fuelAlerts.upcomingBuyTarget(now);
  const tag = did ? '<@' + did + '> ' : '';
  const foot = '\n_(dummy test — real alerts fire per commodity, only when your schedule has an upcoming buy)_';
  // Two SEPARATE posts, mirroring production: fuel and CO2 are never combined.
  storage.postDiscord(cfg.FUEL_ALERT_WEBHOOK,
    tag + '🧪 **TEST — FUEL buy alert** · next slot ' + target.label + '\n⛽ Fuel: buy **12,345,678** Lbs' + foot,
    'fuel-alert-test');
  storage.postDiscord(cfg.FUEL_ALERT_WEBHOOK,
    tag + '🧪 **TEST — CO2 buy alert** · next slot ' + target.label + '\n🌿 CO2: buy **9,999** quotas' + foot,
    'fuel-alert-test');
  // Also exercise the on-screen web-push path for this player's subscribed devices.
  if (did) {
    sendPushAlert(did, '🧪 TEST — FUEL buy alert · ' + target.label, 'Buy 12,345,678 Lbs (dummy test)');
    sendPushAlert(did, '🧪 TEST — CO2 buy alert · ' + target.label, 'Buy 9,999 quotas (dummy test)');
  }
  const pushDevices = did ? (fuelPushSubs[did] || []).length : 0;
  console.log('[FUEL-ALERT] Test fire (fuel + co2, separate posts)' + (did ? ' for ' + did + ', push devices: ' + pushDevices : ''));
  res.json({ ok: true, mentioned: did || null, slot: target.label, posts: ['fuel', 'co2'], push_devices: pushDevices });
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
// Two modes:
//  - Single-player check:  ?discord_id=<id>        → { discord_id, enrolled }
//  - Roster (n8n, token):  ?token=<N8N_TOKEN>       → { members:[...], count }
// n8n polls this on a 30-min schedule with the token (no discord_id), so the
// token path must return the enrolled roster rather than 400.
app.get('/api/fuel-enrolled', (req, res) => {
  const did = String(req.query.discord_id || '').replace(/[^0-9]/g, '');
  if (did) {
    const enrolled = !!(fuelProfiles[did] && fuelProfiles[did].setup_complete);
    return res.json({ discord_id: did, enrolled });
  }
  if (req.query.token === N8N_TOKEN || req.query.token === SECRET) {
    const members = [];
    for (const [key, profile] of Object.entries(fuelProfiles)) {
      if (!profile || !profile.setup_complete) continue;   // registered players only
      members.push({
        discord_id: String(profile.discord_id || key),
        discord_name: profile.discord_name || '',
        enrolled: true,
      });
    }
    return res.json({ members, count: members.length });
  }
  return res.status(400).json({ error: 'discord_id or valid token required' });
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

// ── NOTIFICATION ENDPOINT — for the n8n :25/:55 schedule trigger ───────────
// Fires ~5min before the SHARED cheapest buy slot (getFuelPath). Returns one
// row per registered player per due window; fuel and CO2 are SEPARATE rows so
// the workflow sends them as separate clean DMs. Game clock = UTC; each row also
// carries the player's local time for display only.
//
// Response: { members: [ { discord_id, kind:'fuel'|'co2', price, rating,
//   quantity, unit, window_utc, window_local, minutes_until, dashboard_url } ] }
app.get('/api/fuel-notifications', (req, res) => {
  if (req.query.token !== N8N_TOKEN && req.query.token !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const fp = getFuelPath();                 // shared cheapest-slot schedule
    const now = new Date();
    const nowMs = now.getTime();
    const WINDOW_MS = 16 * 60 * 1000;         // ~5 min ahead (trigger runs at :25/:55)
    const todayUTC = now.getUTCDate();
    const members = [];

    for (const [did, profile] of Object.entries(fuelProfiles)) {
      if (!profile || !profile.setup_complete) continue;   // registered players only
      const tzStr = profile.timezone || 'UTC+0';
      const tzMatch = tzStr.match(/UTC([+-]?\d+\.?\d*)/);
      const tzOffset = tzMatch ? parseFloat(tzMatch[1]) : 0;

      // Check today and tomorrow so a slot just after midnight still alerts.
      for (let dayOff = 0; dayOff <= 1; dayOff++) {
        const checkDay = todayUTC + dayOff;
        const dayData = fp.days.find(d => d.day === checkDay);
        if (!dayData) continue;

        for (const kind of ['fuel', 'co2']) {
          const slotInfo = dayData[kind];
          if (!slotInfo || !slotInfo.slot) continue;
          const [slotH, slotM] = slotInfo.slot.split(':').map(Number);
          const slotDate = new Date(Date.UTC(fp.year, fp.month - 1, checkDay, slotH, slotM));
          const diff = slotDate.getTime() - nowMs;
          if (diff <= 0 || diff > WINDOW_MS) continue;      // only ~5 min before the slot

          // Suggested top-up to full tank (per-player figure, no simulation).
          const tankCap  = Number(kind === 'fuel' ? profile.fuel_tank_capacity : profile.co2_tank_capacity) || 0;
          const reserves = Number(kind === 'fuel' ? profile.fuel_reserves      : profile.co2_reserves) || 0;
          const quantity = Math.max(0, tankCap - reserves);

          // Slot is game time (UTC) -> player local for display only.
          const localMin = (slotH * 60 + slotM) + tzOffset * 60;
          const lh = Math.floor((((localMin % 1440) + 1440) % 1440) / 60);
          const lm = ((localMin % 60) + 60) % 60;
          const window_local = String(lh).padStart(2, '0') + ':' + String(lm).padStart(2, '0');

          members.push({
            discord_id: did,
            kind,                                 // 'fuel' | 'co2' -> separate DMs
            price: slotInfo.price,
            rating: slotInfo.rating,
            quantity,
            unit: kind === 'fuel' ? 'lbs' : 'quotas',
            window_utc: slotInfo.slot,            // game time (UTC)
            window_local,
            minutes_until: Math.round(diff / 60000),
            dashboard_url: 'https://beagle-projections.onrender.com/fuel/' + did
          });
        }
      }
    }

    res.json({ members, count: members.length, checked_at: now.toISOString() });
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

// ── FUEL BUY-ALERT SCHEDULER ───────────────────────────────────────────────
// Every minute, on the :25 and :55 marks, fire a 5-min buy warning to
// #fuel-alert for each registered player whose pushed plan has a buy in the
// upcoming slot. Game time = UTC. Each (player, day, slot) fires at most once
// (firedKey guard), and plans older than 3 days are skipped as stale.
const FUEL_ALERT_MAX_AGE_DAYS = 3;
const _firedAlertKeys = new Set();
let _lastAlertMinuteKey = '';
function runFuelAlertPass(now) {
  const minuteKey = now.getUTCFullYear() + '-' + now.getUTCMonth() + '-' + now.getUTCDate() +
                    'T' + now.getUTCHours() + ':' + now.getUTCMinutes();
  if (minuteKey === _lastAlertMinuteKey) return;   // don't repeat within the same minute
  if (!fuelAlerts.isWarningMinute(now)) return;
  _lastAlertMinuteKey = minuteKey;
  if (!cfg.FUEL_ALERT_WEBHOOK) { console.log('[FUEL-ALERT] Skipped — FUEL_CALCULATOR_WEBHOOK not set'); return; }
  const due = fuelAlerts.dueAlerts(fuelPlans, now, FUEL_ALERT_MAX_AGE_DAYS);
  for (const a of due) {
    const key = fuelAlerts.firedKey(now, a);
    if (_firedAlertKeys.has(key)) continue;   // already fired this (player, day, slot)
    _firedAlertKeys.add(key);
    storage.postDiscord(cfg.FUEL_ALERT_WEBHOOK, a.message, 'fuel-alert');
    sendPushAlert(a.discordId,
      (a.type === 'fuel' ? '⛽ FUEL' : '🌿 CO2') + ' buy in 5 min · ' + a.label,
      'Buy ' + fuelAlerts.fmt(a.qty) + (a.type === 'fuel' ? ' Lbs' : ' quotas'));
    console.log('[FUEL-ALERT] ' + a.discordId + ' @ ' + a.label + ' ' + a.type + '=' + a.qty);
  }
  if (_firedAlertKeys.size > 5000) _firedAlertKeys.clear();   // bound the dedup set (rolls over daily anyway)
}
setInterval(() => { try { runFuelAlertPass(new Date()); } catch (e) { console.error('[FUEL-ALERT] pass error:', e.message); } }, 60000);

// Immediate alert for buys a fresh plan push placed inside the 5-min window
// (the normal warning minute for that slot has already passed). Same
// per-(player, day, slot) dedup as the scheduler, so a buy that was already
// warned at :25/:55 never fires twice.
function fireImminentAlerts(did, plan, now) {
  if (!cfg.FUEL_ALERT_WEBHOOK) return;
  for (const t of fuelAlerts.imminentBuys(plan, now)) {   // one entry per type — fuel and CO2 post separately
    const a = { discordId: did, slot: t.slot, label: t.label, type: t.type, qty: t.qty };
    const key = fuelAlerts.firedKey(now, a);
    if (_firedAlertKeys.has(key)) continue;
    _firedAlertKeys.add(key);
    const lead = t.minsLeft <= 0 ? 'NOW — window open' : 'in ' + t.minsLeft + ' min';
    storage.postDiscord(cfg.FUEL_ALERT_WEBHOOK, fuelAlerts.buildAlertMessage(did, t.label, t.type, t.qty, lead), 'fuel-alert-imminent');
    sendPushAlert(did,
      (t.type === 'fuel' ? '⛽ FUEL' : '🌿 CO2') + ' buy ' + lead + ' · ' + t.label,
      'Buy ' + fuelAlerts.fmt(t.qty) + (t.type === 'fuel' ? ' Lbs' : ' quotas'));
    console.log('[FUEL-ALERT] Imminent ' + did + ' @ ' + t.label + ' (' + lead + ') ' + t.type + '=' + t.qty);
  }
}

storage.checkPersistence();
app.listen(PORT, () => console.log(`Beagle Projections live on port ${PORT}`));
