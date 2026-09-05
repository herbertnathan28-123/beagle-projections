const { AIRCRAFT_DATA, CALC_TIMES } = require('../config');

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
  :root { --bg:#040A14; --panel:#071426; --line:#12294A; --ink:#E6F0FF; --dim:#7F9BC0; --gold:#FFC422; --mag:#FF00CE; --cyan:#0DC1E8; --lime:#1AFF00; }
  body { background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 13px; min-height: 100vh; }
  .top-bar { background: linear-gradient(90deg,#071426 0%,#0B1E3A 60%,#071426 100%); border-bottom: 1px solid var(--line); padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 52px; position: sticky; top: 0; z-index: 100; }
  .top-bar::after { content:''; position:absolute; left:0; right:0; bottom:-2px; height:2px; background: linear-gradient(90deg,#1AFF00,#FFFF00,#FEA900,#F11501,#FF00CE); }
  .logo-block { display: flex; align-items: center; gap: 12px; }
  .logo-text { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink); }
  .logo-sep { color: var(--dim); }
  .page-title { font-size: 14px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; background: linear-gradient(90deg,#1AFF00,#FFFF00,#FEA900,#F11501); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .control-bar { background: var(--panel); border-bottom: 1px solid var(--line); padding: 10px 24px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; position: sticky; top: 52px; z-index: 99; }
  .control-group { display: flex; align-items: center; gap: 10px; }
  .control-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); white-space: nowrap; }
  select { background: #0A1E30; border: 1px solid #2C4A6E; color: var(--ink); padding: 6px 28px 6px 10px; border-radius: 4px; font-size: 13px; font-family: inherit; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%230DC1E8'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; min-width: 160px; }
  .mode-toggle { display: flex; border-radius: 4px; overflow: hidden; border: 1px solid #2C4A6E; }
  .mode-btn { padding: 6px 16px; background: #0A1E30; border: none; color: var(--dim); font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; letter-spacing: 0.05em; }
  .mode-btn.active { background: linear-gradient(90deg,#1AFF00,#FFC422); color: #000; }
  .mode-btn:not(:last-child) { border-right: 1px solid #2C4A6E; }
  .speed-display { font-size: 11px; color: var(--dim); white-space: nowrap; }
  .speed-display span { color: var(--ink); font-weight: 700; }
  .status-msg { margin-left: auto; font-size: 11px; color: var(--cyan); font-weight: 600; white-space: nowrap; letter-spacing: .08em; }
  /* Optimizer */
  .optimizer-bar { background: var(--panel); border-bottom: 1px solid var(--line); padding: 12px 24px; display: flex; align-items: flex-start; gap: 40px; flex-wrap: wrap; }
  .opt-section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--dim); margin-bottom: 8px; }
  .best-cards { display: flex; gap: 10px; flex-wrap: wrap; }
  .bcard { position: relative; background: #06121E; border: 1px solid #1A3A5A; border-radius: 6px; padding: 8px 14px; min-width: 170px; cursor: pointer; transition: transform .12s, box-shadow .12s; }
  .bcard:hover { transform: translateY(-2px); box-shadow: 0 0 18px rgba(13,193,232,.35); }
  #insp-card:hover { transform:none; box-shadow:none; }
  td.sel { box-shadow: inset 0 0 0 3px #FFF, 0 0 16px #FFF !important; z-index: 4; position: relative; }
  td.cell.num { cursor: pointer; }
  #pop { position: fixed; z-index: 300; display: none; min-width: 210px; background: rgba(6,18,30,.92); backdrop-filter: blur(6px); border: 1px solid #2C4A6E; border-radius: 6px; padding: 8px 12px; box-shadow: 0 0 22px rgba(13,193,232,.35); pointer-events: none; }
  #pop.gold { border-color: transparent; background: linear-gradient(rgba(6,18,30,.92),rgba(6,18,30,.92)) padding-box, linear-gradient(135deg,#FFC422,#FF2910,#FF00CE) border-box; }
  #pop .r { font-size: 9px; color: var(--gold); font-weight: 700; letter-spacing: .12em; }
  #pop .h { font-size: 15px; font-weight: 800; color: #FFF; margin: 2px 0; }
  #pop .m { font-size: 11px; color: var(--dim); }
  #pop .t { font-size: 13px; font-weight: 800; color: var(--lime); margin-top: 4px; text-shadow: 0 0 8px rgba(26,255,0,.5); }
  .bcard.gold { border-color: transparent; background: linear-gradient(#06121E,#06121E) padding-box, linear-gradient(135deg,#FFC422,#FF2910,#FF00CE) border-box; box-shadow: 0 0 16px rgba(255,196,34,.25); }
  .bcard-rank { font-size: 9px; color: var(--gold); font-weight: 700; letter-spacing: 0.12em; margin-bottom: 3px; }
  .bcard-time { font-size: 20px; font-weight: 800; color: #FFF; letter-spacing: 0.02em; }
  .bcard-meta { font-size: 11px; color: var(--dim); margin-top: 2px; }
  .bcard-total { font-size: 13px; font-weight: 800; color: var(--lime); margin-top: 5px; text-shadow: 0 0 8px rgba(26,255,0,.5); }
  .manual-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .maint-btn { padding: 5px 14px; border-radius: 4px; border: 1px solid #2C4A6E; background: #06121E; color: var(--dim); font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .maint-btn.on { background: #0E2818; border-color: var(--lime); color: var(--lime); }
  #opt-dd { min-width: 320px; background: #0A1E30; color: var(--ink); border: 1px solid #2C4A6E; border-radius: 4px; padding: 6px 10px; font-size: 12px; font-family: 'Consolas', monospace; }
  .opt-result { font-size: 13px; color: var(--gold); font-weight: 700; white-space: nowrap; }
  /* Mini-map */
  .mini-wrap { background: var(--panel); border-bottom: 1px solid var(--line); padding: 10px 24px; display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
  #mini { image-rendering: pixelated; border: 1px solid #2C4A6E; border-radius: 4px; cursor: crosshair; box-shadow: 0 0 20px rgba(13,193,232,.15); }
  .mini-note { font-size: 10px; color: var(--dim); letter-spacing: .08em; text-transform: uppercase; max-width: 260px; line-height: 1.5; }
  /* Heat map */
  .hmap-header { background: var(--panel); padding: 7px 24px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .hmap-title { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); }
  .hmap-sub { font-size: 10px; color: var(--dim); }
  .table-wrap { overflow: auto; background: var(--bg); }
  table { border-collapse: separate; border-spacing: 0; white-space: nowrap; width: 100%; table-layout: fixed; font-size: clamp(9px, 0.62vw, 12px); }
  thead th { background: #0B1E3A; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 6px 2px; text-align: center; font-weight: 700; font-size: clamp(8px, 0.55vw, 10px); overflow: hidden; letter-spacing: 0.06em; color: var(--ink); position: sticky; top: 0; z-index: 50; }
  thead th:first-child { position: sticky; left: 0; z-index: 60; background: #0B1E3A; width: 70px; font-size: 9px; }
  th.dz { color: var(--dim) !important; }
  td.tlbl { position: sticky; left: 0; z-index: 10; background: #0B1E3A; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 4px 6px; width: 70px; font-size: clamp(8px, 0.55vw, 10.5px); font-weight: 600; color: var(--ink); text-align: right; }
  td.tlbl.opt { background: #1F1A00 !important; border-left: 3px solid var(--gold) !important; color: var(--gold) !important; text-shadow: 0 0 6px rgba(255,196,34,.6); }
  td.cell { border-right: 1px solid rgba(255,255,255,.06); border-bottom: 1px solid rgba(255,255,255,.06); padding: 4px 3px; text-align: center; font-size: inherit; font-weight: 500; color: #000; overflow: hidden; }
  td.cell:hover { filter: brightness(1.25); cursor: default; }
  td.lt { color: #FFF; }
  td.vx  { background: #2A0A12; color: #7A2A3A; font-weight: 700; }
  td.vng { background: #3A0A1A; color: #FF6E8A; font-weight: 600; }
  td.vem { background: #071426; }
  td.hot { font-weight: 700; }
  td.zpeak { outline: 2px solid #FFF; outline-offset: -2px; font-weight: 800; }
  td.b6, th.b6 { border-left: 2px solid #FFFFFF !important; }
  td.b10, th.b10 { border-left: 2px solid #FFFFFF !important; }
  td.opt-cell { box-shadow: inset 0 -1px 0 rgba(255,196,34,.55), inset 0 1px 0 rgba(255,196,34,.55); }
  td.blob { box-shadow: inset 0 0 0 2px rgba(255,0,206,.55); }
  td.blob2 { box-shadow: inset 0 0 0 3px var(--mag), 0 0 14px var(--mag); font-weight: 800; z-index: 2; position: relative; }
  td.top3 { background: linear-gradient(135deg,#9F00D0,#FF00CE) !important; color: #FFF !important; font-weight: 800; position: relative; box-shadow: 0 0 12px rgba(255,0,206,.6); z-index: 2; }
  td.top3::after { content: attr(data-rank); position: absolute; top: -1px; left: 2px; font-size: 10px; font-weight: 900; color: #FFF; text-shadow: 0 0 4px #000; }
  .grad-bar { display: inline-block; width: 240px; height: 12px; border-radius: 3px; border: 1px solid #2C4A6E; vertical-align: middle; background: linear-gradient(90deg,#ECFCEC 0%,#96FF78 30%,#1AFF00 55%,#FFFF00 75%,#FEA900 88%,#F11501 100%); }
  .footer { padding: 14px 24px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; color: var(--dim); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; flex-wrap: wrap; gap: 8px; background: var(--panel); }
  .lg { padding:2px 8px; border-radius:3px; font-size:10px; font-weight:700; }
  #lov { position: fixed; inset: 0; background: rgba(4,10,20,0.85); display: none; align-items: center; justify-content: center; z-index: 200; font-size: 13px; letter-spacing: 0.2em; color: var(--cyan); }
  @keyframes flash { 0%,100%{ box-shadow: inset 0 0 0 3px #FFF, 0 0 22px #FFF; } 50%{ box-shadow: none; } }
  td.flash { animation: flash 0.6s ease-in-out 4; position: relative; z-index: 3; }
  @media print { body { display: none !important; } }
</style>
</head>
<body>
<div id="lov">CALCULATING...</div>
<div id="pop"><div class="r" id="pop-rank"></div><div class="h" id="pop-head"></div><div class="m" id="pop-l1"></div><div class="m" id="pop-l2"></div><div class="t" id="pop-total"></div></div>
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
  <div id="insp" style="min-width:300px;">
    <div class="opt-section-label">◎ CELL INSPECTOR — click any number on the chart</div>
    <div class="bcard" id="insp-card" style="cursor:default;border-color:#2C4A6E;">
      <div class="bcard-rank" id="insp-rank">—</div>
      <div class="bcard-time" id="insp-head">Select a cell</div>
      <div class="bcard-meta" id="insp-l1">&nbsp;</div>
      <div class="bcard-meta" id="insp-l2">&nbsp;</div>
      <div class="bcard-total" id="insp-total">&nbsp;</div>
    </div>
  </div>
</div>

<div class="mini-wrap">
  <canvas id="mini" width="400" height="188"></canvas>
  <div class="mini-note">Thermal overview — every flight time × every distance. Three heat circles — best sub-6,000, best 10,000+ (by contribution), best overall 1·2·3 (by 48-hour total). Dead zone stays cold. Magenta = your hot zones. Click anywhere to jump to that cell.</div>
</div>

<div class="hmap-header">
  <span class="hmap-title">CONTRIBUTION HEAT MAP</span>
  <span class="hmap-sub" id="hm1sub">—</span>
</div>
<div class="table-wrap">
  <table><thead><tr id="s-head"><th>FLIGHT TIME</th></tr></thead><tbody id="s-body"></tbody></table>
</div>

<div class="footer">
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-weight:700;">COLD</span><span class="grad-bar"></span><span style="font-weight:700;">HOT</span>
    <span class="lg" style="box-shadow:inset 0 0 0 2px #FF00CE,0 0 10px #FF00CE;color:#FF00CE;">SHORT STRATEGY — BEST SUB-6,000 · LONG STRATEGY — BEST 10,000+</span>
    <span class="lg" style="background:linear-gradient(135deg,#9F00D0,#FF00CE);color:#FFF;">1 2 3 — BEST OVERALL</span>
        <span class="lg" style="background:#3A0A1A;color:#FF6E8A;">NEGATIVE</span>
    <span class="lg" style="background:#2A0A12;color:#7A2A3A;">CI &gt; 200</span>
    <span class="lg" style="border-left:3px solid #FFC422;color:#FFC422;">★ OPTIMAL ROW</span>
  </div>
  <span>BROWSER USE ONLY — NOT FOR DOWNLOAD OR DISTRIBUTION</span>
</div>

<script>
const ACD = ${JSON.stringify(AIRCRAFT_DATA.map(a => ({n:a.name,r:a.realism,e:a.easy,mx:a.maxRange})))};
const ACM = Object.fromEntries(ACD.map(a=>[a.n,a]));
const TMS = ${JSON.stringify(CALC_TIMES)};
const KEY = '${key}';
let cMode = 'Realism', maint = true, optIdx = -1;
let sGrid = null, sDists = null, gGrid=null, gDists=null, sScale=null, vScale=null, sPeak=null, vPeak=null, topMap={};

// Flights that fit in 48h at flight time t (hours) with Nathan's buffers: 3 min per flight, 30 min maintenance (if on), 26 min human buffer.
function flightsIn48(t){ return Math.max(0,Math.floor((2880-(maint?30:0)-26)/(t*60+3))); }
// Rank table: every valid cell's 48h total (dead zone excluded), sorted high→low.
let rankList=[];
function buildRank(grid,dists){
  rankList=[]; grid.forEach((row,ti)=>row.forEach((v,di)=>{ if(typeof v==='number'&&v>0&&!isDZ(dists[di])){ const n=flightsIn48(TMS[ti]); rankList.push({ti,di,t48:v*n}); } }));
  rankList.sort((a,b)=>b.t48-a.t48);
}
function inspect(ti,di){
  const v=gGrid[ti][di], d=gDists[di], t=TMS[ti];
  document.querySelectorAll('td.sel').forEach(x=>x.classList.remove('sel'));
  const td=document.getElementById('c-'+ti+'-'+di); if(td)td.classList.add('sel');
  const n=flightsIn48(t), t48=(typeof v==='number')?v*n:0;
  const idx=rankList.findIndex(r=>r.ti===ti&&r.di===di);
  document.getElementById('insp-head').textContent=tl(t)+' × '+d.toLocaleString()+'km';
  document.getElementById('insp-l1').textContent=(typeof v==='number'?fval(v)+' per flight':'No valid flight (CI > 200)');
  document.getElementById('insp-l2').textContent=n+' flights in 48hrs'+(maint?' (maint on)':' (maint off)')+(isDZ(d)?' · DEAD ZONE':'');
  document.getElementById('insp-total').textContent=(typeof v==='number'?fval(t48)+' /48hrs':'—');
  document.getElementById('insp-rank').textContent=idx>=0?('RANKED #'+(idx+1)+' OF '+rankList.length+' ON THIS CHART'):(isDZ(d)?'DEAD ZONE — NOT RANKED':'NOT RANKED');
  const card=document.getElementById('insp-card'); card.className='bcard'+(idx===0?' gold':'');
  // Floating copy next to the cell
  const pop=document.getElementById('pop');
  ['rank','head','l1','l2','total'].forEach(k=>document.getElementById('pop-'+k).textContent=document.getElementById('insp-'+k).textContent);
  pop.className=idx===0?'gold':'';
  if(td){ const r=td.getBoundingClientRect(); pop.style.display='block';
    const pw=pop.offsetWidth||220, ph=pop.offsetHeight||90;
    let x=r.right+10, y=r.top-ph/2+r.height/2;
    if(x+pw>window.innerWidth-8) x=r.left-pw-10;
    y=Math.max(8,Math.min(window.innerHeight-ph-8,y));
    pop.style.left=x+'px'; pop.style.top=y+'px'; }
}
function hidePop(){ const p=document.getElementById('pop'); if(p)p.style.display='none'; document.querySelectorAll('td.sel').forEach(x=>x.classList.remove('sel')); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape')hidePop(); });
document.addEventListener('click',e=>{ if(!e.target.closest('td.cell')&&!e.target.closest('.bcard')&&e.target.id!=='mini')hidePop(); });
document.querySelectorAll('.table-wrap').forEach(w=>w.addEventListener('scroll',()=>{ const sel=document.querySelector('td.sel'); if(sel){ const [_,ti,di]=sel.id.split('-'); inspect(+ti,+di); } }));
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

function toggleMaint(){ maint=!maint; const b=document.getElementById('mbt'); b.textContent=maint?'YES':'NO'; b.className='maint-btn'+(maint?' on':''); if(sGrid){buildRank(sGrid,sDists);populateDD(sGrid,sDists);onDDChange();} }

// ── HEAT GRADIENT ─────────────────────────────────────────────────────────
// Continuous hue: white (cold) → greens → yellow → orange → red (hot).
// Colour = percentile rank of the cell within its zone (single-leg or stopover).
// Dead zone (6,001–9,999km) is coloured on the same gradient as every other cell.
const STOPS=[[0,[236,252,236]],[0.30,[150,255,120]],[0.55,[26,255,0]],[0.75,[255,255,0]],[0.88,[254,169,0]],[1,[241,21,1]]];
// HEAT MODEL (Nathan, 5 Sep): colour is centred on the picks and blends outward.
//   base  = cell's value rank across the whole table (one continuous scale, no zone cut)
//   glow  = closeness to a heat centre — the selected row's PEAK sub-6,000, PEAK 10,000+ and TOP 3,
//           plus the two whole-table zone peaks (weighted lower so the picks dominate when a row is chosen)
//   heat  = max(glow, base*0.75)  → centres are red, falling through orange → yellow → green with distance
const SIG_R=5.5, SIG_C=5.5;  // blend radius in rows / columns
function glowAt(ti,di,centres){
  let g=0; for(const c of centres){ const dr=(ti-c.ti)/SIG_R, dc=(di-c.di)/SIG_C; g=Math.max(g,c.w*Math.exp(-(dr*dr+dc*dc)/2)); } return g;
}
function heatP(base,glow){ return Math.max(glow, base*0.75); }
const DZ_CAP=0.42;  // dead zone (6,001–9,999km) is capped at green — never orange or red, never a heat centre
function heatArr(p){
  p=Math.max(0,Math.min(1,p));
  for(let i=1;i<STOPS.length;i++){ if(p<=STOPS[i][0]){ const [p0,c0]=STOPS[i-1],[p1,c1]=STOPS[i]; const t=(p-p0)/(p1-p0);
    return c0.map((c,k)=>Math.round(c+(c1[k]-c)*t)); } }
  return [241,21,1];
}
function heatRGB(p){ const a=heatArr(p); return 'rgb('+a.join(',')+')'; }
function isDark(p){ const a=heatArr(p); return (0.299*a[0]+0.587*a[1]+0.114*a[2])<140; }
// Sorted positive values of a column range → percentile lookup (binary search).
function zoneScale(g,dists,pred){
  const n=[]; g.forEach(row=>row.forEach((v,di)=>{ if(typeof v==='number'&&v>0&&pred(dists[di]))n.push(v); })); n.sort((a,b)=>a-b);
  return { n, pct(v){ if(!n.length)return 0; let lo=0,hi=n.length; while(lo<hi){const m=(lo+hi)>>1; if(n[m]<v)lo=m+1; else hi=m;} return n.length>1?lo/(n.length-1):1; } };
}
// Zone peak (best cell in column range, DZ excluded for single-leg) and global top-3 (both zones, DZ excluded).
function zonePeak(g,dists,pred){ let b=-Infinity,at=null; g.forEach((row,ti)=>row.forEach((v,di)=>{ if(typeof v==='number'&&v>b&&pred(dists[di])&&!isDZ(dists[di])){b=v;at=ti+':'+di;} })); return at; }
// TOP 3 across the SELECTED flight-time row only (dead zone excluded) — 21 Jun spec.
function rowTop3(g,ti,dists){
  const m={}; if(ti<0||!g[ti])return m; const all=[];
  g[ti].forEach((v,di)=>{ if(typeof v==='number'&&v>0&&!isDZ(dists[di]))all.push({v,di}); });
  all.sort((a,b)=>b.v-a.v); all.slice(0,3).forEach((x,i)=>m[ti+':'+x.di]=i+1); return m;
}
function rowBestRange(g,ti,dists,pred){ let b=-Infinity,at=-1; if(!g[ti])return -1; g[ti].forEach((v,di)=>{ if(typeof v==='number'&&v>b&&pred(dists[di])){b=v;at=di;} }); return at; }

function isDZ(d){ return d>6000&&d<10000; }
function isSV(d){ return d>=10000; }
function buildHead(dists){
  const tr=document.getElementById('s-head');
  while(tr.children.length>1)tr.removeChild(tr.lastChild);
  dists.forEach(d=>{
    const th=document.createElement('th');
    th.textContent=d.toLocaleString();
    if(d===6500)th.classList.add('b6'); if(d===10000)th.classList.add('b10');
    if(isDZ(d)){ th.classList.add('dz'); th.title='Dead zone 6,001–9,999km — restricted, shown on same heat scale'; }
    tr.appendChild(th);
  });
}

function buildBody(grid,dists,sScale,vScale,optRowIdx,sPeak,vPeak,topMap){
  if(optRowIdx<0)topMap={};
  const rbS=optRowIdx>=0?rowBestRange(grid,optRowIdx,dists,d=>d<=6000):-1;
  const rbV=optRowIdx>=0?rowBestRange(grid,optRowIdx,dists,d=>d>=10000):-1;
  // Three heat circles (Nathan, 5 Sep): SHORT strategy = best sub-6,000 · LONG strategy = best 10,000+ · best OVERALL.
  // Scoped to the selected flight-time row when one is chosen; whole table otherwise. Dead zone never qualifies.
  const centres=[];
  const pk=k=>{ if(!k)return null; const [a,b]=k.split(':').map(Number); return {ti:a,di:b}; };
  if(optRowIdx>=0){
    if(rbS>=0)centres.push({ti:optRowIdx,di:rbS,w:1});
    if(rbV>=0)centres.push({ti:optRowIdx,di:rbV,w:1});
    Object.keys(topMap).forEach(k=>{ const c=pk(k); centres.push({ti:c.ti,di:c.di,w:topMap[k]===1?1:0.85}); });
  } else {
    // No row selected: SHORT + LONG by contribution, BEST OVERALL = top 3 by 48-hour total across the chart.
    const zp1=pk(sPeak), zp2=pk(vPeak);
    if(zp1)centres.push({ti:zp1.ti,di:zp1.di,w:1}); if(zp2)centres.push({ti:zp2.ti,di:zp2.di,w:1});
    rankList.slice(0,3).forEach((r,i)=>{ centres.push({ti:r.ti,di:r.di,w:i===0?1:0.85}); topMap[r.ti+':'+r.di]=i+1; });
  }
  let html='';
  TMS.forEach((t,ti)=>{
    const isOpt=ti===optRowIdx; const dr=Math.abs(ti-optRowIdx);
    html+='<tr><td class="tlbl'+(isOpt?' opt':'')+'">'+tl(t)+'</td>';
    dists.forEach((d,di)=>{
      const v=grid[ti][di]; const sv=isSV(d); let cls='',sty='',txt='',attr='';
      if(v==='X'){cls+=' vx';txt='X';}
      else if(typeof v==='number'){
        txt=v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
        if(v<0){cls+=' vng';}
        else{ let p=heatP(sScale.pct(v),glowAt(ti,di,centres)); if(isDZ(d))p=Math.min(p,DZ_CAP); sty=' style="background:'+heatRGB(p)+'"'; if(p>=0.85)cls+=' hot'; if(isDark(p))cls+=' lt'; }
        if(isOpt)cls+=' opt-cell';
        // Hot-zone blob: peak cell of the selected row ±2 cols, ±1 row (yellow); peak itself bright yellow.
        if(!isDZ(d)){
          if(optRowIdx>=0){ const rb=sv?rbV:rbS; if(rb>=0&&Math.abs(di-rb)<=2&&dr<=1){ cls+=(isOpt&&di===rb)?' blob2':' blob'; } }
          else { const zp=sv?vPeak:sPeak; if(zp){ const [zt,zd]=zp.split(':').map(Number); if(Math.abs(di-zd)<=2&&Math.abs(ti-zt)<=1){ cls+=(ti===zt&&di===zd)?' blob2':' blob'; } } }
        }
        const r=topMap[ti+':'+di]; if(r){cls+=' top3';attr=' data-rank="'+r+'"';}
      }
      else{cls+=' vem';}
      html+='<td id="c-'+ti+'-'+di+'" class="cell'+cls+(typeof v==='number'?' num':'')+'"'+sty+attr+' onclick="inspect('+ti+','+di+')">'+txt+'</td>';
    });
    html+='</tr>';
  });
  document.getElementById('s-body').innerHTML=html;
  drawMini(grid,dists,sScale,centres,optRowIdx,rbS,rbV,topMap);
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
    let bd='—'; let bv=0; let bdi=-1;
    if(sg&&r.ri<sg.length){sg[r.ri].forEach((v,di)=>{if(typeof v==='number'&&v>bv&&!isDZ(sd[di])){bv=v;bd=sd[di];bdi=di;}});}
    const d=document.createElement('div'); d.className='bcard'+(i===0?' gold':'');
    d.title='Click to jump to this cell on the chart';
    d.innerHTML='<div class="bcard-rank">'+(i===0?'#1 BEST':i===1?'#2':'#3')+'</div>'+
      '<div class="bcard-time">'+fmins(r.om)+'</div>'+
      '<div class="bcard-meta">'+r.fpd+' flt/day · '+r.fpd*2+' in 48hrs</div>'+
      (bd!=='—'?'<div class="bcard-meta">Best dist: '+bd.toLocaleString()+'km</div>':'')+
      '<div class="bcard-total">'+fval(r.t48)+' /48hrs</div>';
    d.onclick=()=>jumpTo(r.fpd,r.ri,bdi);
    c.appendChild(d);
  });
}

// Thermal mini-map: one pixel block per cell, magenta glow on hot zones, gold line on optimal row.
function drawMini(grid,dists,sScale,centres,optRowIdx,rbS,rbV,topMap){
  const cv=document.getElementById('mini'); if(!cv)return; const ctx=cv.getContext&&cv.getContext('2d'); if(!ctx)return;
  const W=cv.width,H=cv.height,nc=dists.length,nr=grid.length,cw=W/nc,ch=H/nr;
  ctx.fillStyle='#0B1E3A'; ctx.fillRect(0,0,W,H);
  grid.forEach((row,ti)=>row.forEach((v,di)=>{
    if(typeof v==='number'&&v>0){ let p=heatP(sScale.pct(v),glowAt(ti,di,centres)); if(isDZ(dists[di]))p=Math.min(p,DZ_CAP); ctx.fillStyle=heatRGB(p); ctx.fillRect(di*cw,ti*ch,Math.ceil(cw),Math.ceil(ch)); }
    else if(v==='X'){ ctx.fillStyle='#2A0A12'; ctx.fillRect(di*cw,ti*ch,Math.ceil(cw),Math.ceil(ch)); }
  }));
  // zone rules
  ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1;
  [dists.indexOf(6500),dists.indexOf(10000)].forEach(i=>{ if(i>0){ ctx.beginPath(); ctx.moveTo(i*cw,0); ctx.lineTo(i*cw,H); ctx.stroke(); } });
  if(optRowIdx>=0){
    ctx.fillStyle='rgba(255,196,34,.35)'; ctx.fillRect(0,optRowIdx*ch,W,Math.ceil(ch));
    [rbS,rbV].forEach(di=>{ if(di>=0){ ctx.shadowColor='#FF00CE'; ctx.shadowBlur=10; ctx.strokeStyle='#FF00CE'; ctx.lineWidth=2; ctx.strokeRect(di*cw-2,optRowIdx*ch-2,cw+4,ch+4); ctx.shadowBlur=0; } });
    Object.keys(topMap).forEach(k=>{ const [ti,di]=k.split(':').map(Number); ctx.fillStyle='#FFF'; ctx.fillRect(di*cw+cw/2-1.5,ti*ch+ch/2-1.5,3,3); });
  }
  cv.onclick=e=>{ const r=cv.getBoundingClientRect(); const di=Math.floor((e.clientX-r.left)/r.width*nc), ti=Math.floor((e.clientY-r.top)/r.height*nr);
    const td=document.getElementById('c-'+ti+'-'+di); if(td){ td.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}); td.classList.remove('flash'); void td.offsetWidth; td.classList.add('flash'); inspect(ti,di); } };
}

// Best-card click: select that flights/day, highlight its row, scroll to and flash the best cell.
function jumpTo(fpd,ri,di){
  const sel=document.getElementById('opt-dd'); sel.value=String(fpd); onDDChange();
  const td=document.getElementById('c-'+ri+'-'+di); if(!td)return;
  td.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
  td.classList.remove('flash'); void td.offsetWidth; td.classList.add('flash');
  inspect(ri,di);
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
  if(!gGrid)return;
  topMap=rowTop3(gGrid,optIdx,gDists);
  buildBody(gGrid,gDists,sScale,vScale,optIdx,sPeak,vPeak,topMap);
}

async function loadGrid(ac,mode){
  document.getElementById('lov').style.display='flex';
  document.getElementById('smsg').textContent='LOADING...';
  try{
    const r=await fetch('/api/calc?k='+encodeURIComponent(KEY)+'&aircraft='+encodeURIComponent(ac)+'&mode='+encodeURIComponent(mode));
    const D=await r.json();
    const grid=D.grid, dists=D.dists, mx=D.maxRange;
    sGrid=grid; sDists=dists; gGrid=grid; gDists=dists;
    populateDD(grid,dists);
    const fpd=parseInt(document.getElementById('opt-dd').value)||0;
    optIdx=fpd?closestRow(optMins(fpd,maint)):-1;
    buildRank(grid,dists);
    sScale=zoneScale(grid,dists,d=>true); vScale=sScale;  // one continuous value scale — no zone cut in the colour
    sPeak=zonePeak(grid,dists,d=>d<=6000); vPeak=zonePeak(grid,dists,d=>d>=10000);
    topMap=rowTop3(grid,optIdx,dists);
    buildHead(dists);
    buildBody(grid,dists,sScale,vScale,optIdx,sPeak,vPeak,topMap);
    document.getElementById('hm1sub').textContent='500 – 6,000km · 6,001 – 9,999km dead zone · 10,000 – 20,000km · max range '+mx.toLocaleString()+'km';
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

module.exports = { buildCalcPage };
