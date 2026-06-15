// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE GLOBAL — ALLIANCE PROJECTIONS SERVICE — v44
// Deploy: node server.js
// Env vars: PROJECTIONS_SECRET, ACCESS_KEY, CONTRIBUTIONS_LOG_IN, PORT
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const esbuild = require('esbuild');
const fs      = require('fs');
const app     = express();
const PORT    = process.env.PORT || 3000;
const SECRET       = process.env.PROJECTIONS_SECRET || 'changeme';
const N8N_TOKEN    = 'bgln8n-proj-2026';

// ── PERSISTENT DISK STATE ─────────────────────────────────────────────────
const STATE_FILE    = '/data/state.json';
const HQ_STATE_FILE = '/data/hq-state.json';

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      console.log('[STARTUP] Loaded projections state from disk — ' + saved.timestamp);
      return saved;
    }
  } catch (e) { console.error('[STARTUP] Failed to load state:', e.message); }
  console.log('[STARTUP] No saved state — using DEFAULT_DATA');
  return { ...DEFAULT_DATA };
}

function saveState(data) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(data), 'utf8'); }
  catch (e) { console.error('[SAVE] Failed to write projections state:', e.message); }
}

function loadHqState() {
  try {
    if (fs.existsSync(HQ_STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(HQ_STATE_FILE, 'utf8'));
      console.log('[STARTUP] Loaded HQ state from disk — ' + (saved.players?.length ?? 0) + ' players');
      return saved;
    }
  } catch (e) { console.error('[STARTUP] Failed to load HQ state:', e.message); }
  return { timestamp: null, uploader: null, alliancePace: null, airlines: 0, players: [], history: [] };
}

function saveHqState(data) {
  try { fs.writeFileSync(HQ_STATE_FILE, JSON.stringify(data), 'utf8'); }
  catch (e) { console.error('[SAVE] Failed to write HQ state:', e.message); }
}


app.use(cors());
app.use(express.json());

// ── DEFAULT DATA ──────────────────────────────────────────────────────────
const DEFAULT_DATA = {
  timestamp:  '2026-06-07T07:22:00Z',
  uploader:   'atlas.4693',
  beagleSV:   2929.83,
  beaglePace: 5.312,
  beagleRank: 19,
  alliances: [
    { rank:1,  name:"Dokdo",            sv:8164.14, pace:7.842 },
    { rank:2,  name:"Valiant Air",      sv:7133.09, pace:7.395 },
    { rank:3,  name:"Free Flying",      sv:5550.95, pace:8.134 },
    { rank:4,  name:"Grizzly Group",    sv:5547.41, pace:4.281 },
    { rank:5,  name:"Per Aspera",       sv:5309.77, pace:4.456 },
    { rank:6,  name:"Indonesia Unity",  sv:4531.24, pace:3.814 },
    { rank:7,  name:"GERMAN ALLIANCE",  sv:4364.19, pace:3.600 },
    { rank:8,  name:"Happy Skies 2.0",  sv:3942.91, pace:3.483 },
    { rank:9,  name:"STARFLEET",        sv:3541.02, pace:3.464 },
    { rank:10, name:"Russian Wings",    sv:3515.59, pace:2.121 },
    { rank:11, name:"CODESHARE",        sv:3505.56, pace:3.522 },
    { rank:12, name:"SpaceX",           sv:3312.59, pace:3.736 },
    { rank:13, name:"ClearSky Group",   sv:3097.31, pace:2.530 },
    { rank:14, name:"JetSTAR",          sv:3085.56, pace:2.530 },
    { rank:15, name:"BRASIL GT",        sv:3048.67, pace:3.289 },
    { rank:16, name:"Mixer World",      sv:3046.26, pace:1.518 },
    { rank:17, name:"Sky Wings",        sv:3027.74, pace:4.106 },
    { rank:18, name:"Alpha Vikings",    sv:2965.52, pace:3.055 },
    { rank:20, name:"Star Alliance",    sv:2833.68, pace:2.977 },
  ]
};

let liveData = loadState();

// ── BEAGLE HQ — IN-MEMORY STORE ───────────────────────────────────────────
let hqData = loadHqState();

// ── AM4 CONTRIBUTION CALCULATOR — DATA & FUNCTIONS ───────────────────────
// base speeds from game × 1.1 = realism, × 1.65 = easy
const AIRCRAFT_DATA = [
  { name: 'Superjet 100-95LR', maxRange: 4578,  realism: 1086, easy: 1629 },
  { name: 'A220-300',          maxRange: 6110,  realism: 958,  easy: 1437 },
  { name: 'A318-100',          maxRange: 6020,  realism: 858,  easy: 1287 },
  { name: 'A319-200',          maxRange: 7000,  realism: 858,  easy: 1287 },
  { name: 'A319NEO',           maxRange: 6950,  realism: 941,  easy: 1411 },
  { name: 'A320-200',          maxRange: 5700,  realism: 905,  easy: 1358 },
  { name: 'A320-NEO',          maxRange: 7000,  realism: 935,  easy: 1403 },
  { name: 'A321-200',          maxRange: 6000,  realism: 858,  easy: 1287 },
  { name: 'A321-NEO',          maxRange: 7250,  realism: 935,  easy: 1403 },
  { name: 'B737-700ER',        maxRange: 10200, realism: 911,  easy: 1366 },
  { name: 'B737-800',          maxRange: 7000,  realism: 858,  easy: 1287 },
  { name: 'B737-900',          maxRange: 3815,  realism: 911,  easy: 1366 },
  { name: 'B737-900ER',        maxRange: 5925,  realism: 905,  easy: 1358 },
  { name: 'B737 MAX 8',        maxRange: 6500,  realism: 923,  easy: 1384 },
  { name: 'A330-200',          maxRange: 12500, realism: 958,  easy: 1437 },
  { name: 'A330-300',          maxRange: 10000, realism: 958,  easy: 1437 },
  { name: 'A330-900neo',       maxRange: 12130, realism: 968,  easy: 1452 },
  { name: 'A340-300',          maxRange: 14000, realism: 986,  easy: 1478 },
  { name: 'A340-600',          maxRange: 14630, realism: 998,  easy: 1497 },
  { name: 'A350-900',          maxRange: 14500, realism: 1040, easy: 1559 },
  { name: 'A350-900R',         maxRange: 14500, realism: 1040, easy: 1559 },
  { name: 'B777-200',          maxRange: 9695,  realism: 996,  easy: 1493 },
  { name: 'B787-8',            maxRange: 14500, realism: 993,  easy: 1490 },
  { name: 'B787-9',            maxRange: 14500, realism: 993,  easy: 1490 },
  { name: 'B787-10',           maxRange: 12000, realism: 1040, easy: 1559 },
];

function _m(d) {
  if (d <= 6000) return 0.0044;
  if (d <= 10000) return 0.0044 + (0.00355 - 0.0044) * (d - 6000) / 4000;
  return 0.00355 + (0.00349 - 0.00355) * (d - 10000) / 10000;
}

function _calc(dist, th, speed, mode) {
  const ef = mode === 'Easy' ? 1 / 1.5 : 1;
  const ci = (2000 / 7) * (dist / (speed * th)) - (600 / 6.9);
  if (ci > 200) return 'X';
  return Math.round((1 + (200 - ci) * 0.01) * _m(dist) * dist * ef * 100) / 100;
}

// All valid distances (500-20000 in 500 steps, continuous — includes dead zone 6001-9999)
const ALL_DISTANCES = [];
for (let d = 500; d <= 20000; d += 500) ALL_DISTANCES.push(d);

const CALC_DISTANCES = ALL_DISTANCES; // backward compat

const CALC_TIMES = [];
for (let h = 1; h <= 24; h += 0.5) CALC_TIMES.push(h);

function timeLabel(h) {
  const hr = Math.floor(h);
  return hr + 'h ' + (h % 1 === 0 ? '00m' : '30m');
}

// ── HQ PARSER ─────────────────────────────────────────────────────────────
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

// ── VISITOR LOG ────────────────────────────────────────────────────────────
const visitorLog = [];
function logVisit(req) {
  const ip   = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const ua   = req.headers['user-agent'] || 'unknown';
  const time = new Date().toISOString();
  const device = ua.includes('Mobile') ? '📱 Mobile'
               : ua.includes('iPad')   ? '📱 iPad'
               : ua.includes('Mac')    ? '💻 Mac'
               : ua.includes('Windows')? '🖥 PC'
               : '❓ Unknown';
  visitorLog.unshift({ time, ip, device, ua: ua.slice(0,80) });
  if (visitorLog.length > 200) visitorLog.pop();
  console.log(`[VISIT] ${device} ${ip} ${time}`);
}

// ── buildCalcPage ──────────────────────────────────────────────────────────
function buildCalcPage(key) {
  const acOptions = AIRCRAFT_DATA.map(a =>
    '<option value="' + a.name + '">' + a.name + '</option>'
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AM4 Contribution Calculator — Beagle Global</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #FFFFFF; color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 13px; min-height: 100vh; }
  .top-bar { background: #1A2744; border-bottom: 2px solid #2A3A6A; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 52px; position: sticky; top: 0; z-index: 100; }
  .logo-block { display: flex; align-items: center; gap: 12px; }
  .logo-text { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #FFFFFF; }
  .logo-sep { color: #8899BB; }
  .page-title { font-size: 14px; font-weight: 700; letter-spacing: 0.08em; color: #FFFFFF; text-transform: uppercase; }
  .control-bar { background: #E8EBF0; border-bottom: 2px solid #CCCCCC; padding: 10px 24px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; position: sticky; top: 52px; z-index: 99; }
  .control-group { display: flex; align-items: center; gap: 10px; }
  .control-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #333333; white-space: nowrap; }
  select { background: #FFFFFF; border: 1px solid #BBBBBB; color: #000000; padding: 6px 28px 6px 10px; border-radius: 4px; font-size: 13px; font-family: inherit; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234E6080'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; min-width: 160px; }
  .mode-toggle { display: flex; border-radius: 4px; overflow: hidden; border: 1px solid #BBBBBB; }
  .mode-btn { padding: 6px 16px; background: #D0D5E0; border: none; color: #000000; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; letter-spacing: 0.05em; }
  .mode-btn.active { background: #1A72BB; color: #fff; }
  .mode-btn:not(:last-child) { border-right: 1px solid #BBBBBB; }
  .speed-display { font-size: 11px; color: #333333; white-space: nowrap; }
  .speed-display span { color: #000000; font-weight: 700; }
  .status-msg { margin-left: auto; font-size: 11px; color: #333333; font-weight: 600; white-space: nowrap; }
  /* Optimizer */
  .optimizer-bar { background: #0D1A2E; border-bottom: 2px solid #1A3A5A; padding: 12px 24px; display: flex; align-items: flex-start; gap: 40px; flex-wrap: wrap; }
  .opt-section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #8AAABB; margin-bottom: 8px; }
  .best-cards { display: flex; gap: 10px; flex-wrap: wrap; }
  .bcard { background: #06121E; border: 1px solid #1A3A5A; border-radius: 5px; padding: 8px 14px; min-width: 165px; }
  .bcard.gold { border-color: #C4920A; }
  .bcard-rank { font-size: 9px; color: #C4920A; font-weight: 700; letter-spacing: 0.12em; margin-bottom: 3px; }
  .bcard-time { font-size: 19px; font-weight: 700; color: #E8B84B; letter-spacing: 0.02em; }
  .bcard-meta { font-size: 11px; color: #8AAABB; margin-top: 2px; }
  .bcard-total { font-size: 13px; font-weight: 700; color: #23A55A; margin-top: 5px; }
  .manual-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .maint-btn { padding: 5px 14px; border-radius: 4px; border: 1px solid #2C4A6E; background: #06121E; color: #8AAABB; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .maint-btn.on { background: #0E2818; border-color: #23A55A; color: #23A55A; }
  #opt-dd { min-width: 320px; background: #0A1E30; color: #E2EAF4; border: 1px solid #2C4A6E; border-radius: 4px; padding: 6px 10px; font-size: 12px; font-family: 'Consolas', monospace; }
  .opt-result { font-size: 13px; color: #E8B84B; font-weight: 600; white-space: nowrap; }
  /* Heat maps */
  .hmap-header { background: #1A2744; padding: 7px 24px; display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #2A3A6A; }
  .hmap-title { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #FFFFFF; }
  .hmap-sub { font-size: 10px; color: #8899BB; }
  .table-wrap { overflow: auto; }
  table { border-collapse: collapse; white-space: nowrap; font-size: 11.5px; }
  thead th { background: #1A2744; border: 1px solid #2A3A6A; padding: 6px 8px; text-align: center; font-weight: 700; font-size: 10px; letter-spacing: 0.06em; color: #FFFFFF; position: sticky; top: 0; z-index: 50; }
  thead th:first-child { position: sticky; left: 0; z-index: 60; background: #1A2744; min-width: 68px; font-size: 9px; }
  th.dz-col { background: #888888 !important; color: #FFFFFF !important; border-color: #666666 !important; font-size: 9px; min-width: 90px; padding: 4px 8px; }
  th.dz-col span { font-size: 8px; display: block; margin-top: 2px; }
  th.dz { background: #AAAAAA !important; color: #000000 !important; border-color: #999999 !important; }
  td.tlbl { position: sticky; left: 0; z-index: 10; background: #1A2744; border: 1px solid #2A3A6A; padding: 4px 10px 4px 8px; font-size: 10.5px; font-weight: 600; color: #FFFFFF; text-align: right; }
  td.tlbl.opt { background: #1A3A1A !important; border-left: 3px solid #FFD700 !important; color: #FFD700 !important; }
  td.cell { border: 1px solid #AAAAAA; padding: 4px 7px; text-align: right; min-width: 52px; font-size: 11px; font-weight: 500; }
  td.cell:hover { filter: brightness(1.3); cursor: default; }
  td.dz { background: #D9D9D9; color: #000000; border-color: #BBBBBB; }
  td.vx  { background: #FF8080; color: #000000; font-weight: 700; }
  td.vt1 { background: #1B5E20; color: #000000; font-weight: 700; }
  td.vt2 { background: #2E7D32; color: #000000; font-weight: 600; }
  td.vt3 { background: #43A047; color: #000000; }
  td.vt4 { background: #81C784; color: #000000; }
  td.vt5 { background: #C8E6C9; color: #000000; }
  td.vlo { background: #FFFFFF; color: #000000; }
  td.vng { background: #FFCDD2; color: #B71C1C; font-weight: 600; }
  td.vem { background: #F5F5F5; }
  td.opt-cell { outline: 2px solid #FFD700; outline-offset: -2px; }
  .footer { padding: 14px 24px; border-top: 1px solid #AAAAAA; display: flex; align-items: center; justify-content: space-between; color: #555; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; flex-wrap: wrap; gap: 8px; }
  #lov { position: fixed; inset: 0; background: rgba(7,9,15,0.85); display: none; align-items: center; justify-content: center; z-index: 200; font-size: 13px; letter-spacing: 0.1em; color: #FFFFFF; }
  @media print { body { display: none !important; } }
</style>
</head>
<body>
<div id="lov">CALCULATING...</div>
<div class="top-bar">
  <div class="logo-block">
    <span class="logo-text">ATLAS FX</span><span class="logo-sep">|</span><span class="logo-text">BEAGLE GLOBAL</span>
  </div>
  <span class="page-title">AM4 CONTRIBUTION CALCULATOR</span>
  <span style="width:160px"></span>
</div>
<div class="control-bar">
  <div class="control-group">
    <span class="control-label">Aircraft</span>
    <select id="ac-sel">${acOptions}</select>
  </div>
  <div class="control-group">
    <span class="control-label">Mode</span>
    <div class="mode-toggle">
      <button class="mode-btn active" id="btn-r" onclick="setMode('Realism')">REALISM</button>
      <button class="mode-btn" id="btn-e" onclick="setMode('Easy')">EASY</button>
    </div>
  </div>
  <div class="speed-display">Speed: <span id="spd">—</span> km/h</div>
  <div class="status-msg" id="smsg">SELECT AIRCRAFT</div>
</div>

<div class="optimizer-bar">
  <div>
    <div class="opt-section-label">⚡ BEST SETUP — 48hr optimised</div>
    <div class="best-cards" id="best-cards">
      <div class="bcard" style="color:#3A6080;font-size:12px;padding:12px 16px;">Select aircraft to calculate</div>
    </div>
  </div>
  <div>
    <div class="opt-section-label">MANUAL — flights per day</div>
    <div class="manual-row">
      <div class="control-group">
        <span class="control-label" style="color:#8AAABB;">Maintenance</span>
        <button class="maint-btn on" id="mbt" onclick="toggleMaint()">YES</button>
      </div>
      <div class="control-group">
        <span class="control-label" style="color:#8AAABB;">Select</span>
        <select id="opt-dd" onchange="onDDChange()">
          <option value="">— select aircraft first —</option>
        </select>
      </div>
      <div class="opt-result" id="ores">—</div>
    </div>
  </div>
</div>

<div class="hmap-header">
  <span class="hmap-title">SINGLE LEG</span>
  <span class="hmap-sub" id="hm1sub">—</span>
</div>
<div class="table-wrap">
  <table><thead><tr id="s-head"><th>FLIGHT TIME</th></tr></thead><tbody id="s-body"></tbody></table>
</div>

<div class="hmap-header">
  <span class="hmap-title">STOPOVER</span>
  <span class="hmap-sub" id="hm2sub">—</span>
</div>
<div class="table-wrap" id="sv-wrap">
  <table><thead><tr id="sv-head"><th>FLIGHT TIME</th></tr></thead><tbody id="sv-body"></tbody></table>
</div>

<div class="footer">
  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
    <span style="background:#1B5E20;color:#000;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">PEAK #1</span>
    <span style="background:#2E7D32;color:#000;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">TOP 9</span>
    <span style="background:#43A047;color:#000;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">TOP 25</span>
    <span style="background:#81C784;color:#000;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">TOP 60</span>
    <span style="background:#C8E6C9;color:#000;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">TOP 120</span>
    <span style="background:#FFCDD2;color:#B71C1C;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">NEGATIVE</span>
    <span style="background:#FF8080;color:#000;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">CI &gt; 200</span>
    <span style="background:#D9D9D9;color:#000;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">DEAD ZONE</span>
    <span style="outline:2px solid #FFD700;outline-offset:1px;background:#1A3A1A;color:#FFD700;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">★ OPTIMAL ROW</span>
  </div>
  <span>BROWSER USE ONLY — NOT FOR DOWNLOAD OR DISTRIBUTION</span>
</div>

<script>
const ACD = ${JSON.stringify(AIRCRAFT_DATA.map(a => ({n:a.name,r:a.realism,e:a.easy,mx:a.maxRange})))};
const ACM = Object.fromEntries(ACD.map(a=>[a.n,a]));
const TMS = ${JSON.stringify(CALC_TIMES)};
const KEY = '${key}';
let cMode = 'Realism', maint = true, optIdx = -1;
let sGrid = null, sDists = null;

function tl(h){ const hr=Math.floor(h); return hr+'h '+(h%1===0?'00m':'30m'); }
function fmins(m){ const h=Math.floor(m/60),mn=Math.round(m%60); return h+'h '+String(mn).padStart(2,'0')+'m'; }
function fval(v){ return typeof v==='number'?'$'+v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):String(v); }

function optMins(fpd,mt){ const f=fpd*2; return (2880-(f*3)-(mt?30:0)-26)/f; }
function closestRow(om){ let b=0,bd=Infinity; TMS.forEach((t,i)=>{const d=Math.abs(t-om/60);if(d<bd){bd=d;b=i;}}); return b; }
function peakRow(g,ri,ds){ if(!g||ri<0||ri>=g.length)return 0; return Math.max(0,...g[ri].filter((v,di)=>typeof v==='number'&&!(ds&&isDZ(ds[di])))); }

function setMode(m){
  cMode=m;
  document.getElementById('btn-r').classList.toggle('active',m==='Realism');
  document.getElementById('btn-e').classList.toggle('active',m==='Easy');
  const ac=document.getElementById('ac-sel').value;
  if(ac){ const sp=ACM[ac]; document.getElementById('spd').textContent=(m==='Easy'?sp.e:sp.r).toLocaleString(); loadGrid(ac,m); }
}

function toggleMaint(){ maint=!maint; const b=document.getElementById('mbt'); b.textContent=maint?'YES':'NO'; b.className='maint-btn'+(maint?' on':''); if(sGrid){populateDD(sGrid,sDists);onDDChange();} }

function thresholds(g,dists){
  const n=[]; g.forEach(row=>row.forEach((v,di)=>{if(typeof v==='number'&&v>0&&!(dists&&isDZ(dists[di])))n.push(v);})); n.sort((a,b)=>b-a);
  return[n[0]||0,n[Math.min(8,n.length-1)]||0,n[Math.min(24,n.length-1)]||0,n[Math.min(59,n.length-1)]||0,n[Math.min(119,n.length-1)]||0];
}

function tier(v,th){
  if(v<0)return'vng';
  if(v>=th[0])return'vt1'; if(v>=th[1])return'vt2'; if(v>=th[2])return'vt3';
  if(v>=th[3])return'vt4'; if(v>=th[4])return'vt5'; return'vlo';
}

function isDZ(d){ return d>6000&&d<10000; }
function buildHead(dists,headId,isSV){
  const tr=document.getElementById(headId);
  while(tr.children.length>1)tr.removeChild(tr.lastChild);
  dists.forEach((d,i)=>{
    const th=document.createElement('th');
    th.textContent=d.toLocaleString();
    if(!isSV&&isDZ(d)) th.className='dz';
    tr.appendChild(th);
  });
}

function buildBody(grid,dists,bodyId,th,isSV,optRowIdx){
  let html='';
  TMS.forEach((t,ti)=>{
    const isOpt=ti===optRowIdx;
    html+='<tr><td class="tlbl'+(isOpt?' opt':'')+'">'+tl(t)+'</td>';
    dists.forEach((d,di)=>{
      const v=grid[ti][di]; let cls,txt;
      if(!isSV&&isDZ(d)){
        if(v==='X'){cls='dz';txt='X';}
        else if(typeof v==='number'){cls='dz';txt=v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
        else{cls='dz';txt='';}
      } else if(v==='X'){cls='vx';txt='X';}
      else if(typeof v==='number'){cls=tier(v,th)+(isOpt?' opt-cell':'');txt=v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
      else{cls='vem';txt='';}
      html+='<td class="cell '+cls+'">'+txt+'</td>';
    });
    html+='</tr>';
  });
  document.getElementById(bodyId).innerHTML=html;
}

function populateDD(sg,sd){
  const sel=document.getElementById('opt-dd'); sel.innerHTML='';
  const res=[];
  for(let fpd=1;fpd<=10;fpd++){
    const om=optMins(fpd,maint); if(om<=0)continue;
    const ri=closestRow(om); const pk=peakRow(sg,ri,sd); const t48=pk*fpd*2;
    const lbl=fmins(om)+' = '+fpd*2+' flights | '+fval(t48)+' /48hrs';
    const opt=document.createElement('option'); opt.value=fpd; opt.textContent=lbl; sel.appendChild(opt);
    res.push({fpd,om,ri,pk,t48,lbl});
  }
  buildBestCards(res,sg,sd);
  return res;
}

function buildBestCards(res,sg,sd){
  const top=[...res].sort((a,b)=>b.t48-a.t48).slice(0,3);
  const c=document.getElementById('best-cards'); c.innerHTML='';
  top.forEach((r,i)=>{
    let bd='—'; let bv=0;
    if(sg&&r.ri<sg.length){sg[r.ri].forEach((v,di)=>{if(typeof v==='number'&&v>bv&&!isDZ(sd[di])){bv=v;bd=sd[di];}});}
    const d=document.createElement('div'); d.className='bcard'+(i===0?' gold':'');
    d.innerHTML='<div class="bcard-rank">'+(i===0?'#1 BEST':i===1?'#2':'#3')+'</div>'+
      '<div class="bcard-time">'+fmins(r.om)+'</div>'+
      '<div class="bcard-meta">'+r.fpd+' flt/day · '+r.fpd*2+' in 48hrs</div>'+
      (bd!=='—'?'<div class="bcard-meta">Best dist: '+bd.toLocaleString()+'km</div>':'')+
      '<div class="bcard-total">'+fval(r.t48)+' /48hrs</div>';
    c.appendChild(d);
  });
}

function onDDChange(){
  const fpd=parseInt(document.getElementById('opt-dd').value)||0;
  const el=document.getElementById('ores');
  if(!fpd||!sGrid){el.textContent='—';optIdx=-1;reOpt();return;}
  const om=optMins(fpd,maint); optIdx=closestRow(om);
  const pk=peakRow(sGrid,optIdx,sDists); el.textContent=fmins(om)+' · '+fval(pk*fpd*2)+' /48hrs';
  reOpt();
}

function reOpt(){
  document.querySelectorAll('.tlbl').forEach(td=>td.classList.remove('opt'));
  document.querySelectorAll('.opt-cell').forEach(td=>td.classList.remove('opt-cell'));
  if(optIdx<0)return;
  const rows=document.getElementById('s-body').querySelectorAll('tr');
  if(rows[optIdx]){
    const cells=rows[optIdx].querySelectorAll('td');
    cells[0].classList.add('opt');
    for(let i=1;i<cells.length;i++)cells[i].classList.add('opt-cell');
  }
}

async function loadGrid(ac,mode){
  document.getElementById('lov').style.display='flex';
  document.getElementById('smsg').textContent='LOADING...';
  try{
    const r=await fetch('/api/calc?k='+encodeURIComponent(KEY)+'&aircraft='+encodeURIComponent(ac)+'&mode='+encodeURIComponent(mode));
    const D=await r.json();
    const{singleGrid:sg,singleDists:sd,stopoverGrid:vg,stopoverDists:vd,maxRange:mx,stopoverMax:vmx}=D;
    sGrid=sg; sDists=sd;
    populateDD(sg,sd);
    const fpd=parseInt(document.getElementById('opt-dd').value)||0;
    optIdx=fpd?closestRow(optMins(fpd,maint)):-1;
    const sth=thresholds(sg,sd);
    buildHead(sd,'s-head',false);
    buildBody(sg,sd,'s-body',sth,false,optIdx);
    document.getElementById('hm1sub').textContent='500 – '+mx.toLocaleString()+'km';
    if(vd.length>0){
      const vth=thresholds(vg);
      buildHead(vd,'sv-head',true);
      buildBody(vg,vd,'sv-body',vth,true,-1);
      document.getElementById('hm2sub').textContent=mx.toLocaleString()+' – '+vmx.toLocaleString()+'km · contribution shown per leg (total ÷ 2)';
      document.getElementById('sv-wrap').style.display='';
    } else {
      document.getElementById('sv-body').innerHTML='<tr><td colspan="2" style="padding:16px;color:#888;font-size:12px;">No stopover range available for this aircraft.</td></tr>';
      document.getElementById('hm2sub').textContent='Not available';
    }
    document.getElementById('smsg').textContent=ac.toUpperCase()+' — '+mode.toUpperCase();
    onDDChange();
  }catch(e){ document.getElementById('smsg').textContent='ERROR — RELOAD PAGE'; }
  finally{ document.getElementById('lov').style.display='none'; }
}

document.getElementById('ac-sel').addEventListener('change',function(){
  const sp=ACM[this.value];
  document.getElementById('spd').textContent=(cMode==='Easy'?sp.e:sp.r).toLocaleString();
  loadGrid(this.value,cMode);
});

window.addEventListener('DOMContentLoaded',()=>{
  const sel=document.getElementById('ac-sel');
  if(sel.options.length){ const a=sel.options[0].value; document.getElementById('spd').textContent=ACM[a].r.toLocaleString(); loadGrid(a,cMode); }
});
document.addEventListener('contextmenu',e=>e.preventDefault());
</script>
</body>
</html>`;
}


// ── HQ HTML ────────────────────────────────────────────────────────────────
const HQ_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<title>Beagle HQ</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{height:-webkit-fill-available}
body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',Calibri,sans-serif;min-height:100vh;min-height:-webkit-fill-available}
::-webkit-scrollbar{width:4px;background:#040C18}
::-webkit-scrollbar-thumb{background:#1A3050;border-radius:2px}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.umd.min.js"></script>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const{useState,useEffect,useRef}=React;
function ContribBar({pct,color}){return(<div style={{width:'100%',height:4,background:'#0A1E30',borderRadius:2,marginTop:3}}><div style={{width:pct+'%',height:'100%',background:color,borderRadius:2,transition:'width 0.4s'}}/></div>);}
function App(){
  const[data,setData]=useState(null);
  const[sort,setSort]=useState('contrib');
  const[filter,setFilter]=useState('all');
  const[search,setSearch]=useState('');
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    const load=async()=>{
      try{const r=await fetch('/api/hq-data');if(r.ok){const d=await r.json();setData(d);}}catch(e){}
      setLoading(false);
    };
    load();const t=setInterval(load,30000);return()=>clearInterval(t);
  },[]);
  if(loading)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}><div style={{fontSize:36,color:'#E8B84B'}}>&#9672;</div><div style={{fontSize:18,color:'#5A8AAB',letterSpacing:2}}>LOADING BEAGLE HQ...</div></div>);
  if(!data||!data.players||data.players.length===0)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}><div style={{fontSize:36,color:'#E8B84B'}}>&#9672;</div><div style={{fontSize:20,color:'#E8B84B',fontWeight:700,letterSpacing:2}}>BEAGLE HQ</div><div style={{fontSize:15,color:'#5A8AAB',marginTop:8}}>No pace data yet.</div><div style={{fontSize:13,color:'#2C4A6E',marginTop:4}}>Upload player data in the alliance-pace channel to populate.</div></div>);
  const players=[...data.players];
  const maxContrib=Math.max(...players.map(p=>p.lastContrib),1);
  let filtered=players.filter(p=>{if(filter==='active')return p.lastSeenMins<180;if(filter==='low')return p.lastContrib>0&&p.lastContrib<40000;if(filter==='zero')return p.lastContrib===0;return true;});
  if(search)filtered=filtered.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
  filtered.sort((a,b)=>{if(sort==='contrib')return b.lastContrib-a.lastContrib;if(sort==='sv')return b.sv-a.sv;if(sort==='lastseen')return a.lastSeenMins-b.lastSeenMins;if(sort==='name')return a.name.localeCompare(b.name);return 0;});
  const totalContrib=players.reduce((s,p)=>s+p.lastContrib,0);
  const activeCount=players.filter(p=>p.lastSeenMins<180).length;
  const zeroCount=players.filter(p=>p.lastContrib===0).length;
  const lowCount=players.filter(p=>p.lastContrib>0&&p.lastContrib<40000).length;
  const avgContrib=players.length?Math.round(totalContrib/players.length):0;
  const fmt=n=>n>=1000000?(n/1000000).toFixed(2)+'M':n>=1000?(n/1000).toFixed(1)+'k':n.toString();
  const contribColor=c=>c===0?'#E74C3C':c<40000?'#E8B84B':c<80000?'#00E676':'#69F0AE';
  const activeColor=m=>m<60?'#69F0AE':m<180?'#00E676':m<360?'#E8B84B':'#E74C3C';
  const ts=data.timestamp?new Date(data.timestamp).toUTCString().replace(/.*?(\d+:\d+:\d+).*/,'$1')+' UTC':'—';
  const BB={border:'none',borderRadius:3,cursor:'pointer',padding:'4px 10px',fontFamily:'inherit',fontWeight:600,fontSize:13,letterSpacing:0.5};
  const SB=(s)=>({...BB,background:sort===s?'#1A3050':'transparent',border:'1px solid '+(sort===s?'#4A80B0':'#162030'),color:sort===s?'#E8B84B':'#5A8AAB'});
  const FB=(f,col)=>({...BB,background:filter===f?'#0A1E30':'transparent',border:'1px solid '+(filter===f?col:'#162030'),color:filter===f?col:'#4A7090'});
  return(<div style={{background:'#030B17',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
    <div style={{background:'linear-gradient(90deg,#04101E,#0A1C32)',borderBottom:'2px solid #C4920A',padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:4}}>
      <div><div style={{fontSize:22,fontWeight:700,color:'#E8B84B',letterSpacing:2}}>&#9672; BEAGLE HQ</div><div style={{fontSize:13,color:'#5A8AAB',marginTop:2,letterSpacing:1}}>PLAYER PACE MONITOR &nbsp;&#183;&nbsp; UPDATED {ts} &nbsp;&#183;&nbsp; {data.uploader||'—'}</div></div>
      <div style={{textAlign:'right'}}><div style={{fontSize:22,fontWeight:700,color:'#E8B84B'}}>{data.alliancePace||'—'}</div><div style={{fontSize:13,color:'#8AAABB',letterSpacing:1}}>{data.airlines||0} AIRLINES</div></div>
    </div>
    <div style={{display:'flex',gap:8,padding:'8px 12px',background:'#040C18',borderBottom:'1px solid #0A1E30',flexWrap:'wrap'}}>
      {[{label:'TOTAL CONTRIB',value:'$'+fmt(totalContrib),color:'#E8B84B'},{label:'AVG PER PLAYER',value:'$'+fmt(avgContrib),color:'#8AAABB'},{label:'ACTIVE (<3h)',value:activeCount+'/'+players.length,color:'#00E676'},{label:'LOW CONTRIB',value:lowCount,color:'#E8B84B'},{label:'ZERO CONTRIB',value:zeroCount,color:zeroCount>0?'#E74C3C':'#4A7090'}].map(c=>(<div key={c.label} style={{background:'#06121E',border:'1px solid #0A1E30',borderRadius:4,padding:'5px 12px',minWidth:100}}><div style={{fontSize:10,color:'#3A6080',letterSpacing:1,marginBottom:2}}>{c.label}</div><div style={{fontSize:18,fontWeight:700,color:c.color}}>{c.value}</div></div>))}
    </div>
    <div style={{display:'flex',gap:6,padding:'6px 12px',background:'#040C18',borderBottom:'1px solid #0A1E30',alignItems:'center',flexWrap:'wrap',rowGap:4}}>
      <span style={{fontSize:12,color:'#3A6080',letterSpacing:1,marginRight:4}}>SORT</span>
      {[['contrib','CONTRIB'],['sv','SV'],['lastseen','LAST SEEN'],['name','NAME']].map(([k,l])=>(<button key={k} onClick={()=>setSort(k)} style={SB(k)}>{l}</button>))}
      <div style={{width:1,height:16,background:'#162030',margin:'0 4px'}}/>
      <button onClick={()=>setFilter('all')} style={FB('all','#8AAABB')}>ALL ({players.length})</button>
      <button onClick={()=>setFilter('active')} style={FB('active','#00E676')}>ACTIVE ({activeCount})</button>
      <button onClick={()=>setFilter('low')} style={FB('low','#E8B84B')}>LOW ({lowCount})</button>
      <button onClick={()=>setFilter('zero')} style={FB('zero','#E74C3C')}>ZERO ({zeroCount})</button>
      <div style={{marginLeft:'auto'}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search player..." style={{background:'#06121E',border:'1px solid #1A3050',borderRadius:3,color:'#E2EAF4',padding:'4px 8px',fontSize:13,fontFamily:'inherit',outline:'none',width:160}}/></div>
    </div>
    <div style={{flex:1,overflowY:'auto',padding:'8px 12px'}}>
      <div style={{display:'grid',gridTemplateColumns:'32px 1fr 90px 90px 90px 70px',gap:8,padding:'4px 8px',marginBottom:4,borderBottom:'1px solid #0A1E30'}}>
        {['#','PLAYER','CONTRIB','SV','ALLIANCE','LAST SEEN'].map(h=>(<div key={h} style={{fontSize:11,color:'#3A6080',letterSpacing:1,fontWeight:600}}>{h}</div>))}
      </div>
      {filtered.map((p,i)=>{
        const c=contribColor(p.lastContrib);
        const pct=maxContrib>0?Math.round(p.lastContrib/maxContrib*100):0;
        const globalRank=players.indexOf(p)+1;
        return(<div key={p.name} style={{display:'grid',gridTemplateColumns:'32px 1fr 90px 90px 90px 70px',gap:8,padding:'6px 8px',borderRadius:4,marginBottom:2,background:p.lastContrib===0?'#0A0510':p.lastContrib<40000?'#0A0E10':'transparent',borderLeft:'3px solid '+(p.lastContrib===0?'#3A0A0A':p.lastContrib<40000?'#3A3000':'transparent')}}>
          <div style={{fontSize:13,color:'#3A6080',fontWeight:600,paddingTop:2}}>#{globalRank}</div>
          <div><div style={{fontSize:15,fontWeight:600,color:p.lastContrib===0?'#5A3A3A':p.lastContrib<40000?'#9A8A40':'#E2EAF4',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div><ContribBar pct={pct} color={c}/></div>
          <div style={{fontSize:14,fontWeight:700,color:c,paddingTop:2}}>{'$'+fmt(p.lastContrib)}</div>
          <div style={{fontSize:13,color:'#5A8AAB',paddingTop:2}}>{'$'+p.sv.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div style={{fontSize:13,color:'#4A7090',paddingTop:2}}>{'$'+fmt(p.allianceContrib)}</div>
          <div style={{fontSize:13,color:activeColor(p.lastSeenMins),paddingTop:2}}>{p.lastSeenStr}</div>
        </div>);
      })}
      {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:'#2C4A68',fontSize:15}}>No players match this filter.</div>}
    </div>
  </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
</script>
</body>
</html>`;

// ── MAIN HTML (Alliance Projections) ──────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<title>Beagle Global \u2014 Alliance Projections v44</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',Calibri,sans-serif;font-size:16px;overflow-x:hidden;overscroll-behavior:none}
button{font-family:inherit}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:#040C18}
::-webkit-scrollbar-thumb{background:#1E3A5F;border-radius:2px}
select option{background:#040C18;color:#E2EAF4}
select optgroup{background:#030B17;color:#4A7090}
.svg-chart{cursor:crosshair;user-select:none;touch-action:none;-webkit-user-select:none;-ms-touch-action:none}
.svg-chart.zoomed{cursor:grab}
.svg-chart.dragging{cursor:grabbing!important}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useMemo,useRef,useCallback}=React;
const PERIOD_OPTS=[{label:'1MO',days:30.4,g:'M'},{label:'2MO',days:60.8,g:'M'},{label:'3MO',days:91.3,g:'M'},{label:'4MO',days:121.7,g:'M'},{label:'5MO',days:152.1,g:'M'},{label:'6MO',days:182.6,g:'M'},{label:'7MO',days:213.0,g:'M'},{label:'8MO',days:243.3,g:'M'},{label:'9MO',days:273.9,g:'M'},{label:'10MO',days:304.3,g:'M'},{label:'11MO',days:334.6,g:'M'},{label:'12MO',days:365,g:'M'},{label:'15MO',days:456.3,g:'M'},{label:'18MO',days:547.5,g:'M'},{label:'21MO',days:638.8,g:'M'},{label:'24MO',days:730,g:'M'},{label:'3Y',days:1095,g:'Y'},{label:'4Y',days:1460,g:'Y'},{label:'5Y',days:1825,g:'Y'},{label:'6Y',days:2190,g:'Y'},{label:'7Y',days:2555,g:'Y'},{label:'8Y',days:2920,g:'Y'},{label:'9Y',days:3285,g:'Y'},{label:'10Y',days:3650,g:'Y'},{label:'15Y',days:5475,g:'Y'},{label:'20Y',days:7300,g:'Y'},{label:'25Y',days:9125,g:'Y'},{label:'50Y',days:18250,g:'Y'},{label:'MAX',days:null,g:'A'}];
const MTD={1:30.4,3:91.3,6:182.6,12:365};
function getXTicks(total,visStart,visDays){const e=visStart+visDays;let t=[];if(total<=182.6)t=[30.4,91.3,182.6];else if(total<=365)t=[91.3,182.6,365];else if(total<=730)t=[182.6,365,547.5,730];else if(total<=1825)t=[365,730,1095,1460,1825];else if(total<=3650)t=[365,730,1825,2555,3650];else{const s=Math.ceil(total/5/365)*365;for(let d=s;d<=total;d+=s)t.push(d);}return t.filter(d=>d>=visStart&&d<=e);}
function xlbl(d){if(d<365)return Math.round(d/30.4)+'MO';const y=d/365;return(Number.isInteger(y)?y:y.toFixed(1))+'Y';}
function lc(a){if(a.isBeagle)return'#E8B84B';if(a.passed)return'#E74C3C';if(!a.catchable)return'#3A6090';if(a.daysTo<100)return'#00E676';if(a.daysTo<400)return'#69F0AE';if(a.daysTo<800)return'#F9A825';return'#F57F17';}
function fmtD(d){if(!d)return null;const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return d.getDate()+' '+m[d.getMonth()]+' '+d.getFullYear();}
function fmtAxis(v){return v>=1000?(v/1000).toFixed(1)+'k':v<=-1000?(v/1000).toFixed(1)+'k':String(v);}
function fmtAWST(ts){if(!ts)return null;const d=new Date(ts),a=new Date(d.getTime()+8*3600000);const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];const p=n=>String(n).padStart(2,'0');return a.getUTCDate()+' '+m[a.getUTCMonth()]+' '+a.getUTCFullYear()+' \xb7 '+p(a.getUTCHours())+':'+p(a.getUTCMinutes())+' AWST';}
function build(data){const BS=data.beagleSV,BP=data.beaglePace;const bg={rank:data.beagleRank,name:'Beagle Global',sv:BS,pace:BP,isBeagle:true};const all=[...data.alliances,bg].map(a=>{const gap=+(a.sv-BS).toFixed(2);const cl=a.pace!=null?+(BP-a.pace).toFixed(4):null;const dt=cl>0&&gap>0?gap/cl:null;const od=dt?new Date(Date.now()+dt*86400000):null;return{...a,gap,closure:cl,daysTo:dt,overtakeDate:od,catchable:cl>0,passed:gap<0};});return{all,beagle:{...bg,gap:0,closure:0,catchable:false,passed:false},BS,BP};}
function projR(all,beagle,days){const kn=all.filter(a=>a.pace!=null&&!a.isBeagle).map(a=>({...a,pSV:a.sv+a.pace*days}));const un=all.filter(a=>a.pace==null&&!a.isBeagle).map(a=>({...a,pSV:null,noPace:true}));const bp={...beagle,pSV:beagle.sv+beagle.pace*days};const sorted=[...kn,bp].sort((a,b)=>b.pSV-a.pSV);const res=[...sorted];un.forEach(u=>{const at=Math.min(u.rank-1,res.length);res.splice(at,0,{...u,projRank:u.rank});});return res.map((a,i)=>({...a,projRank:a.noPace?a.rank:i+1}));}
function App(){
  const[apiData,setApiData]=useState(null);const[loading,setLoading]=useState(true);const[pk,setPk]=useState('6MO');const[mode,setMode]=useState('SV');const[act,setAct]=useState(new Set());
  const[,forceLayout]=useState(0);
  useEffect(()=>{let t;const onResize=()=>{clearTimeout(t);t=setTimeout(()=>forceLayout(n=>n+1),200);};window.addEventListener('resize',onResize);window.addEventListener('orientationchange',onResize);return()=>{clearTimeout(t);window.removeEventListener('resize',onResize);window.removeEventListener('orientationchange',onResize);};},[]);
  const[focus,setFocus]=useState(null);const[full,setFull]=useState(true);const[showR,setShowR]=useState(true);const[yZ,setYZ]=useState(1);const[yP,setYP]=useState(0);const[xZ,setXZ]=useState(1);const[xP,setXP]=useState(0);
  const svgRef=useRef(null);const pinchDist=useRef(null);const drag=useRef({active:false,x:0,y:0,yp:0,xp:0});const lv=useRef({yP:0,xP:0,days:182.6,yRZ:0,xZ:1});const gapCvs=useRef(null);const gapChart=useRef(null);
  const toggle=useCallback(name=>{setAct(prev=>{const n=new Set(prev);if(n.has(name)){n.delete(name);setFocus(f=>f===name?([...n].pop()||null):f);}else{n.add(name);setFocus(name);}return n;});},[]);
  useEffect(()=>{fetch('/api/data').then(r=>r.json()).then(d=>{setApiData(d);setLoading(false);}).catch(()=>setLoading(false));},[]);
  const{all,beagle,BS,BP}=useMemo(()=>{if(!apiData)return{all:[],beagle:{sv:0,pace:0,rank:19},BS:0,BP:0};return build(apiData);},[apiData]);
  const maxCD=all.filter(a=>!a.isBeagle&&a.catchable&&a.daysTo).reduce((m,a)=>Math.max(m,a.daysTo),365);
  const MAX_D=Math.ceil(maxCD*1.2/30)*30;
  const pOpt=PERIOD_OPTS.find(p=>p.label===pk)||PERIOD_OPTS[5];
  const days=pOpt.days??MAX_D;
  const pool=full?all.filter(a=>!a.isBeagle):all.filter(a=>!a.isBeagle&&(a.passed||a.gap<800));
  const selA=focus?all.find(a=>a.name===focus):null;
  const ranking=useMemo(()=>all.length?projR(all,beagle,days):[],[all,beagle,days]);
  const paceRanks=useMemo(()=>{const withPace=all.filter(a=>a.pace!=null).sort((a,b)=>b.pace-a.pace);const m=new Map();withPace.forEach((a,i)=>m.set(a.name,i+1));return m;},[all]);
  const bRank=ranking.find(a=>a.isBeagle);
  const mob=typeof window!=='undefined'&&window.innerWidth<700;
  const W2=typeof window!=='undefined'?window.innerWidth:1200;
  const sz=(mn,mx,sc)=>mob?mn:Math.round(Math.min(mx,Math.max(mn+2,W2*sc)));
  const rChg=beagle.rank?(beagle.rank-(bRank?.projRank??beagle.rank)):0;
  const crossovers=useMemo(()=>{const activeA=[...act].map(n=>all.find(a=>a.name===n)).filter(a=>a&&!a.isBeagle&&a.pace!=null);const pairs=[];for(let i=0;i<activeA.length;i++){for(let j=i+1;j<activeA.length;j++){const a=activeA[i],b=activeA[j];const paceDiff=a.pace-b.pace;const svDiff=a.sv-b.sv;if(paceDiff!==0){const t=-svDiff/paceDiff;if(t>0){const ahead=svDiff>0?a:b;const behind=svDiff>0?b:a;const xDate=new Date(Date.now()+t*86400000);pairs.push({ahead:ahead.name,behind:behind.name,daysTo:Math.round(t),date:xDate,crossDay:t,aColor:lc(a),bColor:lc(b),aName:a.name,bName:b.name});}}}}return pairs;},[act,all]);
  const W=1380,H=280,ml=72,mr=170,mt=18,mb=42,cw=W-ml-mr,ch=H-mt-mb;
  const _vis=pool.filter(a=>Math.abs(a.gap)<2500);const _src=_vis.length?_vis:[...pool];
  const yMnB=Math.min(..._src.map(a=>a.sv),BS)*0.97;const yMxB=Math.max(..._src.map(a=>a.sv+(a.pace||0)*days),BS+BP*days)*1.03;
  const yRF=yMxB-yMnB;const yRZ=yRF/yZ;const yMid=(yMnB+yMxB)/2-yP;const yMnZ=yMid-yRZ/2,yMxZ=yMid+yRZ/2;
  const ys=v=>mt+ch-((v-yMnZ)/(yMxZ-yMnZ))*ch;
  const xVD=days/xZ;const xSt=Math.max(0,Math.min(xP,days-xVD));const xs=d=>ml+((d-xSt)/xVD)*cw;
  const yStep=yRF>5000?1000:yRF>2000?500:yRF>800?200:100;
  const yTks=[];for(let v=Math.ceil(yMnZ/yStep)*yStep;v<=yMxZ;v+=yStep)yTks.push(v);
  const xTks=getXTicks(days,xSt,xVD);
  const crossD=a=>{if(!a.catchable||a.gap<=0||!a.pace||!BP)return null;const t=a.gap/(BP-a.pace);return t>0&&t<=days?t:null;};
  const resetZoom=()=>{setYZ(1);setYP(0);setXZ(1);setXP(0);};const zoomed=yZ>1||xZ>1;
  useEffect(()=>{lv.current={yP,xP,days,yRZ,xZ};},[yP,xP,days,yRZ,xZ]);
  const onMouseDown=useCallback(e=>{drag.current={active:true,x:e.clientX,y:e.clientY,yp:lv.current.yP,xp:lv.current.xP};svgRef.current?.classList.add('dragging');},[]);
  useEffect(()=>{const mm=e=>{if(!drag.current.active)return;const rect=svgRef.current?.getBoundingClientRect();const svgH=rect?.height||280,svgW=rect?.width||1200;const dy=e.clientY-drag.current.y,dx=e.clientX-drag.current.x;setYP(drag.current.yp-(dy/svgH)*lv.current.yRZ);const xd=lv.current.days/lv.current.xZ;setXP(Math.max(0,Math.min(drag.current.xp-(dx/svgW)*xd,lv.current.days-xd)));};const mu=()=>{drag.current.active=false;svgRef.current?.classList.remove('dragging');};window.addEventListener('mousemove',mm);window.addEventListener('mouseup',mu);return()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu);};},[]);
  useEffect(()=>{const svg=svgRef.current;if(!svg)return;const ts=e=>{e.preventDefault();setZHint(false);if(e.touches.length===1){drag.current={active:true,x:e.touches[0].clientX,y:e.touches[0].clientY,yp:lv.current.yP,xp:lv.current.xP};}else if(e.touches.length===2){drag.current.active=false;pinchDist.current=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);}};const tm=e=>{e.preventDefault();const rect=svg.getBoundingClientRect();const svgH=rect.height||280,svgW=rect.width||1200;if(e.touches.length===1&&drag.current.active){const dx=e.touches[0].clientX-drag.current.x;const dy=e.touches[0].clientY-drag.current.y;setYP(drag.current.yp-(dy/svgH)*lv.current.yRZ);const xd=lv.current.days/lv.current.xZ;setXP(Math.max(0,Math.min(drag.current.xp-(dx/svgW)*xd,lv.current.days-xd)));}else if(e.touches.length===2&&pinchDist.current!=null){const d=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);const f=d/pinchDist.current;const midX=(e.touches[0].clientX+e.touches[1].clientX)/2;const midY=(e.touches[0].clientY+e.touches[1].clientY)/2;const mx=(midX-rect.left)/(svgW);const my=(midY-rect.top)/(svgH);const clampX=Math.max(0,Math.min(1,mx)),clampY=Math.max(0,Math.min(1,my));setYZ(prev=>{const nz=Math.max(1,Math.min(30,prev*f));const oldR=lv.current.yRZ,newR=(yMxB-yMnB)/nz;setYP(p=>p+(oldR-newR)*(0.5-clampY));return nz;});setXZ(prev=>{const nz=Math.max(1,Math.min(30,prev*f));const oldVD=lv.current.days/lv.current.xZ,newVD=lv.current.days/nz;setXP(p=>Math.max(0,Math.min(p+(oldVD-newVD)*clampX,lv.current.days-newVD)));return nz;});pinchDist.current=d;}};const te=e=>{if(e.touches.length===0)drag.current.active=false;if(e.touches.length<2)pinchDist.current=null;};svg.addEventListener('touchstart',ts,{passive:false});svg.addEventListener('touchmove',tm,{passive:false});svg.addEventListener('touchend',te);return()=>{svg.removeEventListener('touchstart',ts);svg.removeEventListener('touchmove',tm);svg.removeEventListener('touchend',te);};},[yMnB,yMxB]);
  const[zHint,setZHint]=useState(true);
  useEffect(()=>{if(zHint){const t=setTimeout(()=>setZHint(false),4000);return()=>clearTimeout(t);}},[zHint]);
  useEffect(()=>{const handler=e=>{const svg=svgRef.current;if(!svg)return;const r=svg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;e.preventDefault();setZHint(false);const zIn=e.deltaY<0;const f=zIn?1.5:0.667;const mx=(e.clientX-r.left-ml*(r.width/W))/(cw*(r.width/W));const my=(e.clientY-r.top-mt*(r.height/H))/(ch*(r.height/H));const clampX=Math.max(0,Math.min(1,mx)),clampY=Math.max(0,Math.min(1,my));setYZ(prev=>{const nz=Math.max(1,Math.min(30,prev*f));const oldR=lv.current.yRZ,newR=(yMxB-yMnB)/nz;setYP(p=>p+(oldR-newR)*(0.5-clampY));return nz;});setXZ(prev=>{const nz=Math.max(1,Math.min(30,prev*f));const oldVD=lv.current.days/lv.current.xZ,newVD=lv.current.days/nz;setXP(p=>Math.max(0,Math.min(p+(oldVD-newVD)*clampX,lv.current.days-newVD)));return nz;});};window.addEventListener('wheel',handler,{passive:false});return()=>window.removeEventListener('wheel',handler);},[yMnB,yMxB]);

  const GAP_COLS=['#FF1744','#FF6D00','#FF9100','#FFD600','#FFEA00','#AEEA00','#76FF03','#00E676','#00E5FF','#C6FF00'];
  const FF2='-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
  const rgba2=(h,a)=>{const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';};
  useEffect(()=>{
    if(mode!=='GAP'){if(gapChart.current){gapChart.current.destroy();gapChart.current=null;}return;}
    if(!gapCvs.current||typeof Chart==='undefined')return;
    if(gapChart.current){gapChart.current.destroy();gapChart.current=null;}
    const above=all.filter(a=>!a.isBeagle&&a.gap>0).sort((x,y)=>y.gap-x.gap);
    const maxDay=Math.max(days,above.filter(a=>a.daysTo).reduce((m,a)=>Math.max(m,a.daysTo),260)*1.15);
    const maxGap=above.reduce((m,a)=>Math.max(m,a.gap),200)*1.1;
    const GDS=above.map((a,i)=>{
      const c=GAP_COLS[i%GAP_COLS.length];
      if(!a.catchable||!a.daysTo)return{label:a.name,data:[{x:0,y:a.gap},{x:maxDay,y:a.gap}],borderColor:rgba2(c,.35),borderWidth:1,pointRadius:0,showLine:true,tension:0,fill:false,_c:c};
      const cr=a.gap/a.daysTo,pts=[];
      for(let d=0;d<=maxDay;d+=Math.max(2,Math.floor(maxDay/130)))pts.push({x:d,y:a.gap-cr*d});
      return{label:a.name,data:pts,borderColor:c,borderWidth:1.1,pointRadius:0,showLine:true,tension:0,fill:false,_c:c};
    });
    GDS.push({label:'Beagle',data:[{x:0,y:0},{x:maxDay,y:0}],borderColor:'#E8B84B',borderWidth:2,pointRadius:0,showLine:true,tension:0,fill:false});
    let selG=null;
    const bgP2={id:'bg2',beforeDraw(c){const x=c.ctx;x.save();x.fillStyle='#020B16';x.fillRect(0,0,c.width,c.height);x.restore();}};
    const lblP2={id:'lbl2',afterDraw(ch){
      const ctx=ch.ctx,xs=ch.scales.x,ys=ch.scales.y,ca=ch.chartArea;
      ctx.save();
      const rawY=above.map(a=>ys.getPixelForValue(a.gap));
      const adjY=[...rawY];
      for(let i=1;i<adjY.length;i++)for(let j=0;j<i;j++)if(Math.abs(adjY[i]-adjY[j])<15)adjY[i]=adjY[j]+16;
      above.forEach((a,i)=>{
        const c=GAP_COLS[i%GAP_COLS.length];
        const isSel=selG===i,hasSel=selG!==null,dim=hasSel&&!isSel;
        const inView=rawY[i]>=ca.top-30&&rawY[i]<=ca.bottom+30;
        ctx.globalAlpha=dim?.1:1;
        if(inView){
          ctx.fillStyle=c;ctx.font=(isSel?'500':'300')+' 13px '+FF2;
          ctx.textAlign='right';
          ctx.fillText('#'+a.rank+'  '+(a.name.length>18?a.name.slice(0,17)+'…':a.name),ca.left-10,adjY[i]+4.5);
          ctx.beginPath();ctx.arc(ca.left,rawY[i],isSel?3.5:2,0,Math.PI*2);ctx.fill();
        }
        if(a.catchable&&a.daysTo&&a.daysTo<=maxDay){
          const cx=xs.getPixelForValue(a.daysTo),cy=ys.getPixelForValue(0);
          const inPlot=cx>=ca.left&&cx<=ca.right&&cy>=ca.top&&cy<=ca.bottom;
          if(inPlot){
            ctx.strokeStyle=c;ctx.lineWidth=isSel?2:1;
            ctx.beginPath();ctx.arc(cx,cy,isSel?10:5.5,0,Math.PI*2);ctx.stroke();
            ctx.beginPath();ctx.arc(cx,cy,isSel?4:2.5,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();
            if(isSel){
              ctx.globalAlpha=1;ctx.font='500 12px '+FF2;ctx.textAlign='center';ctx.fillStyle=c;
              ctx.fillText(fmtD(a.overtakeDate),cx,cy-17);
              ctx.font='300 10px '+FF2;ctx.fillStyle=rgba2(c,.7);
              ctx.fillText(Math.round(a.daysTo)+'d',cx,cy+22);
            }
          }
        }
      });
      ctx.globalAlpha=1;
      const zy=ys.getPixelForValue(0);
      if(zy>=ca.top&&zy<=ca.bottom){
        ctx.font='400 12px '+FF2;ctx.textAlign='left';ctx.fillStyle='#E8B84B';
        ctx.fillText('⧆  BEAGLE #'+beagle.rank+'  —  $'+BS.toFixed(2)+'M',ca.left+10,zy-10);
      }
      ctx.restore();
    }};
    gapChart.current=new Chart(gapCvs.current,{
      type:'scatter',data:{datasets:GDS},plugins:[bgP2,lblP2],
      options:{
        responsive:true,maintainAspectRatio:false,animation:{duration:600},
        plugins:{
          legend:{display:false},tooltip:{enabled:false},
          zoom:{zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'xy'},pan:{enabled:true,mode:'xy',threshold:6}}
        },
        scales:{
          x:{type:'linear',min:0,max:maxDay,grid:{color:'#0B1A28',lineWidth:.8},border:{color:'#1A324A'},
            ticks:{color:'#2A4A6A',font:{family:FF2,size:11,weight:'300'},
              callback:v=>v===0?'NOW':v<60?Math.round(v)+'d':Math.round(v/30.4)+'MO'}},
          y:{min:-Math.max(BS*0.04,80),max:maxGap,grid:{color:'#0B1A28',lineWidth:.8},border:{color:'#1A324A'},
            ticks:{color:'#2A4A6A',font:{family:FF2,size:11,weight:'300'},
              callback:v=>v===0?'':v<0?'▼$'+Math.abs(v).toFixed(0)+'M':'$'+v.toFixed(0)+'M'}}
        },
        layout:{padding:{left:158,right:20,top:20,bottom:8}},
        onClick(e){
          const ca=gapChart.current.chartArea,xs=gapChart.current.scales.x,ys=gapChart.current.scales.y;
          const mx=e.native.offsetX,my=e.native.offsetY;
          if(mx<ca.left||mx>ca.right||my<ca.top||my>ca.bottom)return;
          let near=null,minD=20;
          above.forEach((a,i)=>{
            if(!a.catchable||!a.daysTo)return;
            const cr=a.gap/a.daysTo,day=xs.getValueForPixel(mx);
            const ly=ys.getPixelForValue(a.gap-cr*day);
            if(Math.abs(my-ly)<minD){minD=Math.abs(my-ly);near=i;}
          });
          selG=(near===selG)?null:near;
          above.forEach((a,i)=>{
            const c=GAP_COLS[i%GAP_COLS.length];
            const isSel=selG===i,dim=selG!==null&&!isSel;
            GDS[i].borderColor=dim?rgba2(c,.08):c;GDS[i].borderWidth=isSel?2.5:1.1;
          });
          gapChart.current.update('none');
          setFocus(selG!==null?above[selG].name:null);
        }
      }
    });
    return()=>{if(gapChart.current){gapChart.current.destroy();gapChart.current=null;}};
  },[mode,all,BS,BP,beagle,days]);
  const onDblClick=useCallback(e=>{const svg=svgRef.current;if(!svg)return;setZHint(false);const r=svg.getBoundingClientRect();const mx=(e.clientX-r.left-ml*(r.width/W))/(cw*(r.width/W));const my=(e.clientY-r.top-mt*(r.height/H))/(ch*(r.height/H));const clampX=Math.max(0,Math.min(1,mx)),clampY=Math.max(0,Math.min(1,my));const f=2;setYZ(prev=>{const nz=Math.max(1,Math.min(30,prev*f));const oldR=lv.current.yRZ,newR=(yMxB-yMnB)/nz;setYP(p=>p+(oldR-newR)*(0.5-clampY));return nz;});setXZ(prev=>{const nz=Math.max(1,Math.min(30,prev*f));const oldVD=lv.current.days/lv.current.xZ,newVD=lv.current.days/nz;setXP(p=>Math.max(0,Math.min(p+(oldVD-newVD)*clampX,lv.current.days-newVD)));return nz;});},[yMnB,yMxB]);
  const detP=selA?[1,3,6,12].map(mo=>({mo,sv:selA.sv+(selA.pace||0)*MTD[mo],rank:projR(all,beagle,MTD[mo]).findIndex(a=>a.isBeagle)+1})):[];
  const BB={borderRadius:3,fontSize:14,fontWeight:700,cursor:'pointer',letterSpacing:1,fontFamily:'inherit',padding:'5px 12px'};
  const btn=on=>({...BB,background:on?'#C4920A':'transparent',border:'1px solid '+(on?'#C4920A':'#162030'),color:on?'#030B17':'#6A9AB5'});
  const btn2=on=>({...BB,background:on?'#1A3050':'transparent',border:'1px solid '+(on?'#4A80B0':'#162030'),color:on?'#E8B84B':'#6A9AB5'});
  if(loading)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}><div style={{fontSize:40,color:'#E8B84B'}}>&#9672;</div><div style={{fontSize:20,color:'#5A8AAB',letterSpacing:2}}>LOADING PROJECTIONS...</div></div>);
  const ts2=apiData?.timestamp,upl=apiData?.uploader;const hasAct=act.size>0;
  const CHEATERS=new Set(['Dokdo']);
  const paceColor=(pr,total)=>{if(total<=1)return'#00E676';const t=(pr-1)/(total-1);const r=Math.round(0+(58-0)*t),g=Math.round(230+(144-230)*t),b=Math.round(118+(110-118)*t);return'rgb('+r+','+g+','+b+')';};
  const renderRow=a=>{const isB=a.isBeagle,chg=a.rank-(a.projRank??a.rank),c=isB?'#E8B84B':lc(a),isAct=act.has(a.name),pr=paceRanks.get(a.name),isCheater=CHEATERS.has(a.name),totalPaced=paceRanks.size,pc=pr!=null?paceColor(pr,totalPaced):'#3A6090';return(<div key={a.name} onClick={()=>!isB&&toggle(a.name)} style={{display:'flex',alignItems:'center',gap:8,padding:W2>=1600?'10px 14px':'7px 10px',background:isB?'#1A1000':isAct?c+'22':'transparent',borderRadius:3,borderLeft:isAct?'3px solid '+c:'3px solid transparent',cursor:isB?'default':'pointer',transition:'all 0.1s',opacity:isCheater?0.35:1}}><span style={{fontSize:sz(18,34,0.017),fontWeight:700,color:a.noPace?'#4A7090':isCheater?'#4A5060':c,minWidth:36}}>#{a.projRank}</span><span style={{fontSize:sz(18,30,0.016),color:isB?c:isCheater?'#4A5060':isAct?'#E2EAF4':a.noPace?'#4A7090':'#9AAABB',flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:isAct?600:400}}>{a.name}</span>{pr!=null&&<span style={{fontSize:sz(12,20,0.011),fontWeight:700,color:isCheater?'#4A5060':pc,minWidth:26,textAlign:'center',borderRadius:3,padding:'1px 4px',letterSpacing:0.5}}>{pr}</span>}<span style={{fontSize:sz(13,24,0.013),color:isB?'#C4920A':a.noPace?'#2C4A68':isCheater?'#4A5060':pc,fontWeight:pr!=null&&pr<=3?700:400,minWidth:52,textAlign:'right',whiteSpace:'nowrap',marginRight:4}}>{a.pace!=null?'$'+a.pace.toFixed(2):''}</span><span style={{fontSize:sz(16,28,0.015),fontWeight:600,minWidth:30,textAlign:'right',color:a.noPace?'#4A7090':chg>0?'#00E676':chg<0?'#E74C3C':'#4A7090'}}>{a.noPace?'?':chg>0?'\u25b2'+chg:chg<0?'\u25bc'+Math.abs(chg):isB?'\u2605':'\u2014'}</span></div>);};
  const nameTag=(name,c)=>name.length>18?name.slice(0,17)+'\u2026':name;
  const renderGAP=()=>{
    const above=[...all].filter(a=>!a.isBeagle&&a.gap>0).sort((x,y)=>y.gap-x.gap);
    const below=[...all].filter(a=>!a.isBeagle&&a.gap<0).sort((x,y)=>{
      const xr=(x.pace||0)-BP,yr=(y.pace||0)-BP;return yr-xr;
    });
    const aboveShow=above.slice(0,8),belowShow=below.slice(0,4);
    const maxGap=Math.max(...aboveShow.map(a=>a.gap),...belowShow.map(a=>Math.abs(a.gap)),50);
    const nameW=230,barStart=ml+nameW,barMaxW=cw-nameW-220,labelX=barStart+barMaxW+10;
    const totalRows=aboveShow.length+belowShow.length+4;
    const rowH=Math.max(Math.floor(ch/Math.max(totalRows,6)),14);
    const trimN=(n,mx)=>n.length>mx?n.slice(0,mx-1)+'…':n;
    const aboveColor=(a)=>{if(!a.catchable)return'#2A3A5A';if(a.daysTo<200)return'#00E676';if(a.daysTo<500)return'#69F0AE';if(a.daysTo<1200)return'#F9A825';return'#D84315';};
    const belowColor=(a)=>{const cr=(a.pace||0)-BP;if(cr<=0)return'#2E7D52';const t=Math.abs(a.gap)/cr;if(t<200)return'#E74C3C';if(t<600)return'#FF7043';return'#F9A825';};
    const yy=mt+4;
    const divY=yy+24+(aboveShow.length*rowH)+rowH*0.3;
    return(<g>
      <text x={ml+2} y={yy+10} fill="#4A6A8A" fontSize="11" fontWeight="700" letterSpacing="2">CHASING — ALLIANCES AHEAD OF BEAGLE</text>
      {aboveShow.map((a,i)=>{
        const ry=yy+20+(i*rowH)+rowH/2;
        const barLen=Math.min((a.gap/maxGap)*barMaxW,barMaxW);
        const c=aboveColor(a);const isAct=act.has(a.name);
        const etaTxt=a.catchable&&a.daysTo?Math.round(a.daysTo)+'d':'away';
        const closeTxt=a.catchable&&a.closure?(' — closing $'+a.closure.toFixed(2)+'/d'):'';
        return(<g key={a.name} style={{cursor:'pointer'}} onClick={()=>toggle(a.name)}>
          <rect x={ml} y={ry-rowH/2+1} width={cw} height={rowH-2} fill={isAct?'#081828':'transparent'} rx="2"/>
          <text x={barStart-8} y={ry+4} textAnchor="end" fill={c} fontSize="12" fontWeight={isAct?'700':'400'}>#{a.rank}  {trimN(a.name,21)}</text>
          <rect x={barStart} y={ry-rowH/2+3} width={Math.max(barLen,3)} height={rowH-6} fill={c} opacity={isAct?0.9:0.65} rx="2"/>
          <text x={labelX} y={ry+4} fill={c} fontSize="11" fontWeight={isAct?'700':'400'}>{'$'+a.gap.toFixed(1)+'M  |  '}{etaTxt}{isAct?closeTxt:''}</text>
        </g>);
      })}
      <line x1={ml} x2={ml+cw} y1={divY} y2={divY} stroke="#E8B84B" strokeWidth="2" opacity="0.7"/>
      <rect x={ml+cw/2-80} y={divY-10} width={160} height={20} fill="#0D0A00" rx="4" stroke="#C4920A" strokeWidth="1"/>
      <text x={ml+cw/2} y={divY+5} textAnchor="middle" fill="#E8B84B" fontSize="13" fontWeight="700">{'BEAGLE #'+beagle.rank+'  \u2014  $'+BS.toFixed(0)+'M'}</text>
      <text x={ml+2} y={divY+rowH*0.7} fill="#4A6A8A" fontSize="11" fontWeight="700" letterSpacing="2">WATCHING — ALLIANCES BEHIND BEAGLE</text>
      {belowShow.map((a,j)=>{
        const ry=divY+rowH+(j*rowH)+rowH/2;
        const gap=Math.abs(a.gap);
        const barLen=Math.min((gap/maxGap)*barMaxW,barMaxW);
        const c=belowColor(a);const isAct=act.has(a.name);
        const cr=(a.pace||0)-BP;
        const etaTxt=cr>0?Math.round(gap/cr)+'d to catch':'Beagle clear';
        return(<g key={a.name} style={{cursor:'pointer'}} onClick={()=>toggle(a.name)}>
          <rect x={ml} y={ry-rowH/2+1} width={cw} height={rowH-2} fill={isAct?'#180808':'transparent'} rx="2"/>
          <text x={barStart-8} y={ry+4} textAnchor="end" fill={c} fontSize="12" fontWeight={isAct?'700':'400'}>#{a.rank}  {trimN(a.name,21)}</text>
          <rect x={barStart} y={ry-rowH/2+3} width={Math.max(barLen,3)} height={rowH-6} fill={c} opacity={isAct?0.85:0.55} rx="2"/>
          <text x={labelX} y={ry+4} fill={c} fontSize="11" fontWeight={isAct?'700':'400'}>{'$'+gap.toFixed(1)+'M behind  |  '}{etaTxt}</text>
        </g>);
      })}
      <line x1={ml} y1={mt+ch} x2={ml+cw} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
    </g>);
  };

  const renderRANK=()=>{
    const yr=v=>mt+((v-1)/19)*ch;
    const gridR=[1,5,10,15,20].map(r=>({r,y:yr(r)}));
    const lines=[...pool,beagle].map(a=>{
      const isB=a.isBeagle,isAct=act.has(a.name),dim=hasAct&&!isAct&&!isB,c=lc(a);
      const pts=[0,days/4,days/2,3*days/4,days].map(d=>{const pr=projR(all,beagle,d),e=pr.find(r=>r.name===a.name);return{d,r:e?.projRank??a.rank};});
      const pd=pts.map((p,i)=>(i===0?'M':'L')+xs(p.d).toFixed(1)+','+yr(p.r).toFixed(1)).join(' ');
      const ep=pts[pts.length-1];
      const epy=yr(ep.r);
      return {name:a.name,isB,isAct,dim,c,pd,epy,showLbl:(isAct||isB)&&epy>=mt&&epy<=mt+ch};
    });
    return(<g>{gridR.map(g=>(<g key={g.r}><line x1={ml} x2={ml+cw} y1={g.y} y2={g.y} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/><text x={ml-6} y={g.y+4} textAnchor="end" fill="#5A8AAB" fontSize="13">#{g.r}</text></g>))}<g clipPath="url(#cc)">{lines.map(d=>(<g key={d.name} onClick={()=>!d.isB&&toggle(d.name)} style={{cursor:d.isB?'default':'pointer'}}><path d={d.pd} stroke="transparent" strokeWidth="18" fill="none"/><path d={d.pd} stroke={d.c} strokeWidth={d.isB?3.5:d.isAct?2.5:1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={d.dim?0.08:d.isB?1:0.85} filter={d.isB?'url(#fg)':undefined}/>{d.showLbl&&<text x={xs(days)+8} y={d.epy+5} fill={d.c} fontSize="14" fontWeight="700">{d.isB?'Beagle':nameTag(d.name)}</text>}</g>))}</g></g>);
  };
  return(<div style={{background:'#030B17',height:'100%',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
    <div style={{background:'linear-gradient(90deg,#04101E,#0A1C32)',borderBottom:'2px solid #C4920A',padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:4}}>
      <div><div style={{fontSize:sz(22,38,0.020),fontWeight:700,color:'#E8B84B',letterSpacing:2}}>&#9672; BEAGLE GLOBAL \u2014 ALLIANCE PROJECTIONS</div><div style={{fontSize:sz(13,20,0.011),color:'#8AAABB',marginTop:3,letterSpacing:1}}>10-MO RECENT PACE \xb7 RANK #{beagle.rank}{ts2&&<span style={{marginLeft:12,color:'#5A8AAB'}}>UPDATED {fmtAWST(ts2)}{upl?' \xb7 '+upl:''}</span>}{!ts2&&<span style={{marginLeft:12,color:'#5A8AAB'}}>DEFAULT DATA \xb7 UPLOAD TO REFRESH</span>}</div></div>
      <div style={{textAlign:'right'}}><div style={{fontSize:sz(22,42,0.022),fontWeight:700,color:'#E8B84B'}}>{'$'+BS.toLocaleString('en',{minimumFractionDigits:2})+'M'}</div><div style={{fontSize:sz(13,20,0.011),color:'#8AAABB',letterSpacing:1}}>{BP.toFixed(3)}/DAY</div></div>
    </div>
    <div style={{display:'flex',gap:4,padding:'5px 8px',background:'#040C18',borderBottom:'1px solid #0A1E30',alignItems:'center',flexWrap:'wrap',rowGap:4}}>
      <span style={{fontSize:13,color:'#6A9AB5',letterSpacing:1,marginRight:3,flexShrink:0}}>PERIOD</span>
      <select value={pk} onChange={e=>setPk(e.target.value)} style={{background:'#040C18',color:'#E8B84B',border:'1px solid #C4920A',borderRadius:3,padding:'4px 8px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',outline:'none',flexShrink:0}}>
        <optgroup label='\u2500 MONTHS \u2500'>{PERIOD_OPTS.filter(p=>p.g==='M').map(p=><option key={p.label} value={p.label}>{p.label}</option>)}</optgroup>
        <optgroup label='\u2500 YEARS \u2500'>{PERIOD_OPTS.filter(p=>p.g==='Y').map(p=><option key={p.label} value={p.label}>{p.label}</option>)}</optgroup>
        <optgroup label='\u2500 AUTO \u2500'><option value="MAX">MAX \u2014 furthest overtake</option></optgroup>
      </select>
      <div style={{width:1,height:18,background:'#162030',margin:'0 3px',flexShrink:0}}/>
      <button onClick={()=>setFull(f=>!f)} style={btn2(full)}>{full?'CLOSE PACK':'ALL LINES'}</button>
      {hasAct&&<button onClick={()=>{setAct(new Set());setFocus(null);}} style={{...BB,background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB'}}>CLEAR ({act.size})</button>}
      <div style={{width:1,height:18,background:'#162030',margin:'0 3px',flexShrink:0}}/>
      {[['SV','SV LINES'],['GAP','OVERTAKE'],['RANK','RANK']].map(([m,l])=>{const lbl=mob?m:l;return(<button key={m} onClick={()=>setMode(m)} style={{...BB,background:mode===m?'#1A3050':'transparent',border:'1px solid '+(mode===m?'#4A80B0':'#162030'),color:mode===m?'#E8B84B':'#6A9AB5'}}>{lbl}</button>);})}
      <div style={{width:1,height:18,background:'#162030',margin:'0 3px',flexShrink:0}}/>
      <button onClick={()=>setShowR(r=>!r)} style={{...BB,background:showR?'#0D2240':'transparent',border:'1px solid #162030',color:showR?'#7FAACC':'#4A7090'}}>{showR?(mob?'HIDE':'HIDE RANKING'):(mob?'SHOW':'SHOW RANKING')}</button>
      <div style={{display:'flex',alignItems:'center',gap:3,marginLeft:'auto'}}>
        <button onClick={()=>{if(mode==='GAP')gapChart.current?.zoom(1.35);else{setYZ(z=>Math.min(30,z*1.25));setXZ(z=>Math.min(30,z*1.25));}}} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:16,fontWeight:700}} title="Zoom in">+</button>
        <span style={{fontSize:12,color:zoomed?'#E8B84B':'#3A6080',minWidth:36,textAlign:'center'}}>{zoomed?('x'+Math.max(yZ,xZ).toFixed(1)):'1x'}</span>
        <button onClick={()=>{if(mode==='GAP')gapChart.current?.zoom(0.74);else{setYZ(z=>Math.max(1,z*0.8));setXZ(z=>Math.max(1,z*0.8));}}} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:16,fontWeight:700}} title="Zoom out">-</button>
        {!mob&&mode!=='GAP'&&<><div style={{width:1,height:16,background:'#162030',margin:'0 3px'}}/>
        <button onClick={()=>setXP(p=>Math.max(0,p-lv.current.days/lv.current.xZ*0.2))} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}}>◄</button>
        <button onClick={()=>setYP(p=>p+lv.current.yRZ*0.15)} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}}>▲</button>
        <button onClick={()=>setYP(p=>p-lv.current.yRZ*0.15)} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}}>▼</button>
        <button onClick={()=>setXP(p=>Math.max(0,Math.min(p+lv.current.days/lv.current.xZ*0.2,lv.current.days-lv.current.days/lv.current.xZ)))} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}}>►</button></>}
        {(mode==='GAP'||zoomed||yP!==0||xP!==0)&&<button onClick={()=>{if(mode==='GAP')gapChart.current?.resetZoom();else resetZoom();}} style={{...BB,background:'#1A0A00',border:'1px solid #C4920A60',color:'#E8B84B',fontSize:12,marginLeft:2}}>RESET</button>}
      </div>
      <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
        {[['#E8B84B','Beagle'],['#00E676','<100d'],['#69F0AE','catching'],['#3A6090','away'],['#E74C3C','passed']].map(([c,l])=>(<span key={l} style={{display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}><span style={{width:l==='Beagle'?20:15,height:l==='Beagle'?3:2,background:c,display:'inline-block',borderRadius:2}}/><span style={{fontSize:12,color:'#8AAABB'}}>{l}</span></span>))}
      </div>
    </div>
    <div style={{padding:'2px 4px 4px',flexShrink:0,touchAction:mode==='GAP'?'auto':'none'}}>
      {mode==='GAP'?(<div style={{width:'100%',height:'38vh',background:'#020B16',borderRadius:2}}><canvas ref={gapCvs} style={{width:'100%',height:'100%',display:'block'}}/></div>):(<svg ref={svgRef} className={'svg-chart'+(zoomed?' zoomed':'')} viewBox={'0 0 '+W+' '+H} style={{width:'100%',maxHeight:'38vh',display:'block',touchAction:'none'}} onMouseDown={onMouseDown} onDoubleClick={onDblClick}>
        <defs><filter id="fg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="fl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><clipPath id="cc"><rect x={ml} y={mt} width={cw} height={ch}/></clipPath><style>{'@keyframes pu{0%,100%{r:5;opacity:1}50%{r:9;opacity:0.4}} .pd{animation:pu 1.8s ease-in-out infinite}'}</style></defs>
        <rect x={ml} y={mt} width={cw} height={ch} fill="#030810" rx="2"/>
        {mode==='SV'&&yTks.map(v=>(<g key={v}><line x1={ml} x2={ml+cw} y1={ys(v)} y2={ys(v)} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/><text x={ml-6} y={ys(v)+4} textAnchor="end" fill="#5A8AAB" fontSize="14">{fmtAxis(v)}</text></g>))}
        {mode==='RANK'&&yTks.map(v=>(<g key={v}><line x1={ml} x2={ml+cw} y1={ys(v)} y2={ys(v)} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/></g>))}
        {mode!=='GAP'&&xTks.map(d=>(<g key={d}><line x1={xs(d)} x2={xs(d)} y1={mt} y2={mt+ch} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/><text x={xs(d)} y={mt+ch+18} textAnchor="middle" fill="#5A8AAB" fontSize="14" fontWeight="600">{xlbl(d)}</text></g>))}
        {mode==='SV'&&(<g><g clipPath="url(#cc)">{pool.map(a=>{const isAct=act.has(a.name),dim=hasAct&&!isAct,c=lc(a);const sv1=a.sv+(a.pace||0)*days;const cd=crossD(a);return(<g key={a.name}><line x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(sv1)} stroke="transparent" strokeWidth="22" style={{cursor:'pointer'}} onClick={()=>toggle(a.name)}/><line x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(sv1)} stroke={c} strokeWidth={isAct?3:dim?1:1.8} opacity={dim?0.1:0.88} strokeLinecap="round" strokeDasharray={!a.catchable&&!a.passed?'4,3':'none'}/>{cd&&!dim&&<circle cx={xs(cd)} cy={ys(BS+BP*cd)} r="3.5" fill={c} opacity="0.9"/>}</g>);})}
        {crossovers.map((co,i)=>{const ahead=pool.find(a=>a.name===co.ahead),behind=pool.find(a=>a.name===co.behind);if(!ahead||!behind)return null;const yCross=ys(ahead.sv+(ahead.pace||0)*co.crossDay);if(yCross<mt||yCross>mt+ch)return null;return(<g key={i}><circle cx={xs(co.crossDay)} cy={yCross} r="6" fill="none" stroke="#FFD700" strokeWidth="2" className="pd"/><circle cx={xs(co.crossDay)} cy={yCross} r="3" fill="#FFD700"/><rect x={xs(co.crossDay)-52} y={yCross-30} width={104} height={20} fill="#0A0800" rx="3" stroke="#C4920A" strokeWidth="1"/><text x={xs(co.crossDay)} y={yCross-17} textAnchor="middle" fill="#FFD700" fontSize="12" fontWeight="700">{fmtD(co.date)}</text></g>);})}
        <line x1={xs(0)} y1={ys(BS)} x2={xs(days)} y2={ys(BS+BP*days)} stroke="#E8B84B" strokeWidth="10" opacity="0.15" strokeLinecap="round"/><line x1={xs(0)} y1={ys(BS)} x2={xs(days)} y2={ys(BS+BP*days)} stroke="#E8B84B" strokeWidth="3.5" strokeLinecap="round" filter="url(#fg)"/><circle cx={xs(0)} cy={ys(BS)} r="5" fill="#E8B84B" filter="url(#fg)"/><circle cx={xs(days)} cy={ys(BS+BP*days)} r="4" fill="#E8B84B" opacity="0.7"/></g>
        {pool.filter(a=>act.has(a.name)).map(a=>{const yE=ys(a.sv+(a.pace||0)*days);if(yE<mt||yE>mt+ch)return null;return(<text key={a.name+'_l'} x={xs(days)+8} y={yE+5} fill={lc(a)} fontSize="14" fontWeight="700">{nameTag(a.name)}</text>);})}
        <text x={ml-6} y={ys(BS)+4} textAnchor="end" fill="#E8B84B" fontSize="14" fontWeight="700">\u2605{beagle.rank}</text></g>)}
        {mode==='RANK'&&renderRANK()}
        <line x1={ml} y1={mt} x2={ml} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/><line x1={ml} y1={mt+ch} x2={ml+cw} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/><line x1={ml+cw} y1={mt} x2={ml+cw} y2={mt+ch} stroke="#1A3050" strokeWidth="1" strokeDasharray="3,4"/>
        <text x="12" y={mt+ch/2} textAnchor="middle" fill="#3A6080" fontSize="13" fontWeight="600" transform={'rotate(-90,12,'+(mt+ch/2)+')'}>{mode==='SV'?'Share Value':mode==='GAP'?'SV Gap':'Rank'}</text>
        {zoomed&&<g><rect x={ml+cw-72} y={mt+3} width={68} height={22} rx="3" fill="#0A1020" opacity="0.85"/><text x={ml+cw-8} y={mt+18} textAnchor="end" fill="#E8B84B" fontSize="13" fontWeight="700">{'x'+Math.max(yZ,xZ).toFixed(1)+' zoom'}</text></g>}
        {zoomed&&<g style={{cursor:'pointer'}} onClick={resetZoom}><rect x={ml+4} y={mt+3} width={52} height={22} rx="3" fill="#1A3050" stroke="#4A80B0" strokeWidth="1"/><text x={ml+30} y={mt+18} textAnchor="middle" fill="#E8B84B" fontSize="12" fontWeight="700">RESET</text></g>}
        {!zoomed&&zHint&&<g style={{pointerEvents:'none'}}><rect x={ml+cw/2-90} y={mt+ch/2-14} width={180} height={28} rx="6" fill="#0A1020" opacity="0.85"/><text x={ml+cw/2} y={mt+ch/2+5} textAnchor="middle" fill="#5A8AAB" fontSize="13" fontWeight="600" opacity="0.9">Scroll or pinch to zoom</text></g>}
      </svg>)}
    </div>
    {crossovers.length>0&&(<div style={{margin:'0 8px 4px',background:'#0A0800',border:'1px solid #C4920A',borderLeft:'4px solid #FFD700',borderRadius:4,padding:'8px 14px'}}>{crossovers.map((co,i)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:i<crossovers.length-1?4:0}}><span style={{fontSize:13,color:'#FFD700',fontWeight:700,letterSpacing:1}}>&#9733; CROSSOVER</span><span style={{fontSize:15,fontWeight:700,color:lc(pool.find(a=>a.name===co.behind)||{})}}>{co.behind}</span><span style={{fontSize:13,color:'#8AAABB'}}>overtakes</span><span style={{fontSize:15,fontWeight:700,color:lc(pool.find(a=>a.name===co.ahead)||{})}}>{co.ahead}</span><span style={{fontSize:13,color:'#8AAABB'}}>on</span><span style={{fontSize:16,fontWeight:700,color:'#FFD700'}}>{fmtD(co.date)}</span><span style={{fontSize:13,color:'#5A8AAB'}}>({co.daysTo} days)</span></div>))}</div>)}
    {showR&&ranking.length>0&&(<div style={{margin:'0 8px 4px',background:'#050D1A',border:'1px solid #0A1E30',borderTop:'2px solid #C4920A',borderRadius:4,padding:'8px 12px',flex:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
        <div><span style={{fontSize:sz(15,24,0.013),color:'#8AAABB',letterSpacing:1}}>PROJECTED RANKING AT </span><span style={{fontSize:sz(15,24,0.013),color:'#E8B84B',fontWeight:700,letterSpacing:1}}>{pk}</span><span style={{fontSize:13,color:'#4A7090',marginLeft:10}}>\u2014 tap row or line to select</span></div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontSize:sz(14,22,0.012),color:'#8AAABB'}}>Beagle</span><span style={{fontSize:sz(17,30,0.016),fontWeight:700,color:'#E8B84B'}}>#{beagle.rank}</span><span style={{fontSize:sz(16,26,0.014),color:'#5A8AAB'}}>\u2192</span><span style={{fontSize:sz(20,34,0.018),fontWeight:700,color:rChg>0?'#00E676':'#E8B84B'}}>#{bRank?.projRank}</span>
          {rChg>0&&<span style={{fontSize:sz(16,28,0.015),fontWeight:700,color:'#00E676'}}>\u25b2{rChg}</span>}
          {rChg<0&&<span style={{fontSize:sz(16,28,0.015),fontWeight:700,color:'#E74C3C'}}>\u25bc{Math.abs(rChg)}</span>}
          {selA&&!selA.isBeagle&&(()=>{const sp=ranking.find(r=>r.name===selA.name),sc=selA.rank-(sp?.projRank??selA.rank),c=lc(selA);return(<span style={{display:'flex',alignItems:'center',gap:6,marginLeft:12,paddingLeft:12,borderLeft:'1px solid #162030'}}><span style={{fontSize:14,color:c,fontWeight:600}}>{selA.name}</span><span style={{fontSize:16,fontWeight:700,color:c}}>#{selA.rank}</span><span style={{fontSize:15,color:'#5A8AAB'}}>\u2192</span><span style={{fontSize:17,fontWeight:700,color:sc>0?'#00E676':sc<0?'#E74C3C':c}}>#{sp?.projRank}</span>{sc!==0&&<span style={{fontSize:14,fontWeight:700,color:sc>0?'#00E676':'#E74C3C'}}>{sc>0?'\u25b2'+sc:'\u25bc'+Math.abs(sc)}</span>}</span>);})()}
        </div>
      </div>
      <div style={{display:'flex',gap:16,width:'100%'}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:sz(13,20,0.012),color:'#8AAABB',fontWeight:600,letterSpacing:1,padding:'0 6px 5px',borderBottom:'1px solid #0A1E30',marginBottom:4}}>1 \u2014 10</div>{ranking.slice(0,10).map(renderRow)}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:sz(13,20,0.012),color:'#8AAABB',fontWeight:600,letterSpacing:1,padding:'0 6px 5px',borderBottom:'1px solid #0A1E30',marginBottom:4}}>11 \u2014 20</div>{ranking.slice(10,20).map(renderRow)}</div></div>
    </div>)}
    {selA&&!selA.isBeagle&&(<div style={{margin:'0 8px 8px',background:'#050D1A',border:'1px solid '+lc(selA)+'30',borderLeft:'4px solid '+lc(selA),borderRadius:4,padding:'12px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div><div style={{fontSize:18,fontWeight:700,color:'#E2EAF4'}}>#{selA.rank} {selA.name}</div><div style={{fontSize:14,color:'#8AAABB',marginTop:3}}>{'SV $'+selA.sv.toLocaleString('en',{minimumFractionDigits:2})+'M \xb7 Pace '}{selA.pace?.toFixed(3)??'\u2014'}/day \xb7 Gap {selA.gap>0?'+':''}{selA.gap.toFixed(0)}M</div></div>
        {selA.catchable?(<div style={{background:'#04120A',border:'1px solid '+lc(selA),borderRadius:4,padding:'6px 12px',textAlign:'right'}}><div style={{fontSize:12,color:lc(selA),letterSpacing:1}}>BEAGLE OVERTAKES</div><div style={{fontSize:16,fontWeight:700,color:lc(selA)}}>{fmtD(selA.overtakeDate)}</div><div style={{fontSize:12,color:'#8AAABB'}}>in {Math.round(selA.daysTo)} days</div></div>):selA.passed?(<div style={{background:'#1C0606',border:'1px solid #E74C3C',borderRadius:4,padding:'6px 12px',textAlign:'right'}}><div style={{fontSize:12,color:'#E74C3C',letterSpacing:1}}>STATUS</div><div style={{fontSize:16,fontWeight:700,color:'#E74C3C'}}>\u2713 OVERTAKEN</div></div>):(<div style={{background:'#06101C',border:'1px solid #3A6090',borderRadius:4,padding:'6px 12px',textAlign:'right'}}><div style={{fontSize:12,color:'#3A6090',letterSpacing:1}}>STATUS</div><div style={{fontSize:14,fontWeight:700,color:'#3A6090'}}>PULLING AWAY</div></div>)}
      </div>
      <div style={{display:'flex',gap:6,marginBottom:8}}>{detP.map(({mo,sv,rank})=>{const ah=sv-(BS+BP*MTD[mo]),c=ah<=0?'#00E676':ah<100?'#69F0AE':'#3A6090';return(<div key={mo} style={{flex:1,background:'#030B17',borderRadius:4,padding:'7px 5px',textAlign:'center',border:'1px solid #0A1E30'}}><div style={{fontSize:12,color:'#8AAABB',fontWeight:600,letterSpacing:1,marginBottom:2}}>{mo}MO</div><div style={{fontSize:15,fontWeight:700,color:'#C0CCD8'}}>{'$'+sv.toFixed(0)+'M'}</div><div style={{fontSize:12,color:c,marginTop:2,fontWeight:600}}>{ah<=0?'\u2713 BEHIND':'+$'+ah.toFixed(0)+'M'}</div><div style={{fontSize:12,color:'#5A8AAB',marginTop:1}}>Beagle #{rank}</div></div>);})}</div>
      <div style={{display:'flex',alignItems:'center',gap:20,borderTop:'1px solid #0A1E30',paddingTop:8,flexWrap:'wrap'}}>
        <div><div style={{fontSize:12,color:'#8AAABB',letterSpacing:1}}>DAILY CLOSURE</div><div style={{fontSize:15,fontWeight:700,color:selA.catchable?lc(selA):'#3A6090'}}>{selA.closure!=null?(selA.closure>0?'+':'')+'\$'+selA.closure.toFixed(3)+'M/day':'unknown'}</div></div>
        <div><div style={{fontSize:12,color:'#8AAABB',letterSpacing:1}}>THEIR PACE</div><div style={{fontSize:15,fontWeight:700,color:'#E2EAF4'}}>{selA.pace?.toFixed(3)??'\u2014'} $M/day</div></div>
        <div><div style={{fontSize:12,color:'#8AAABB',letterSpacing:1}}>BEAGLE PACE</div><div style={{fontSize:15,fontWeight:700,color:'#E8B84B'}}>{BP.toFixed(3)} $M/day</div></div>
        <div style={{marginLeft:'auto',fontSize:15,fontWeight:700,color:selA.catchable?'#69F0AE':selA.passed?'#00E676':'#3A6090'}}>{selA.catchable?'\u2193 CONVERGING':selA.passed?'\u2713 CLEAR':'\u2191 DIVERGING'}</div>
      </div>
    </div>)}
  </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
</script>
</body>
</html>`;

// ── Pre-compile JSX at startup (avoids in-browser Babel regex/division bug) ─
function precompileJSX(html) {
  return html.replace(
    /<script type="text\/babel">([\s\S]*?)<\/script>/g,
    (_, jsx) => {
      const result = esbuild.transformSync(jsx, {
        loader: 'jsx',
        jsx: 'transform',
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
        target: 'es2020',
      });
      return '<script>' + result.code + '<\/script>';
    }
  ).replace(
    /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]*"><\/script>\n?/g,
    ''
  );
}

const HTML_COMPILED = precompileJSX(HTML);

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
    const players = parsePaceUpload(rawText);
    if (players.length === 0) return res.status(400).json({ ok: false, error: 'no players parsed' });
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
    console.log('[HQ] updated — ' + players.length + ' players, pace ' + hqData.alliancePace);
    res.json({ ok: true, players: players.length });
  } catch (e) {
    console.error('[HQ] error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/hq-data', (req, res) => res.json(hqData));

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
  liveData = {
    timestamp, uploader,
    beagleSV:   beagleSV   ?? liveData.beagleSV,
    beaglePace: (beaglePace != null && !isNaN(beaglePace)) ? beaglePace : liveData.beaglePace,
    beagleRank: beagleRank ?? liveData.beagleRank,
    alliances:  merged.length ? merged : liveData.alliances,
  };
  console.log(`[${new Date().toISOString()}] Updated by ${uploader}`);
  saveState(liveData);
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

  // Single-leg: distances up to maxRange
  const singleDists = ALL_DISTANCES.filter(d => d <= maxRange);

  // Stopover: distances from maxRange+1 to stopoverMax
  // Contribution calculated for totalDist/2 (each leg of the stopover)
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

// ── WILDCARD — catches all other routes (Alliance Projections main page) ───
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).send('Not found');
  logVisit(req);
  const ACCESS_KEY = process.env.ACCESS_KEY || '';
  if (ACCESS_KEY && req.query.k !== ACCESS_KEY) {
    return res.status(403).type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access Expired</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}.card{max-width:420px}.icon{font-size:48px;color:#C4920A;margin-bottom:20px}.title{font-size:26px;font-weight:700;color:#E8B84B;letter-spacing:2px;margin-bottom:12px}.sub{font-size:16px;color:#5A8AAB;line-height:1.6;margin-bottom:24px}.note{font-size:13px;color:#2C4A6E;letter-spacing:1px}</style></head><body><div class="card"><div class="icon">&#9672;</div><div class="title">ACCESS EXPIRED</div><div class="sub">This link has expired.<br>Contact your alliance leader for the current month's access link.</div><div class="note">BEAGLE GLOBAL &mdash; ALLIANCE PROJECTIONS</div></div></body></html>`);
  }
  res.type('html').send(HTML_COMPILED);
});

app.listen(PORT, () => console.log(`Beagle Projections live on port ${PORT}`));
