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
  .bcard { background: #06121E; border: 1px solid #1A3A5A; border-radius: 5px; padding: 8px 14px; min-width: 165px; cursor: pointer; }
  .bcard:hover { border-color: #E8B84B; }
  @keyframes flash { 0%,100%{ box-shadow: inset 0 0 0 3px #FF00CE; } 50%{ box-shadow: none; } }
  td.flash { animation: flash 0.6s ease-in-out 4; }
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
  th.dz { background: #1A2744 !important; color: #C9D3E6 !important; }
  th.sv { background: #14213A !important; color: #C9D3E6 !important; }
  th.sv span { display:block; font-size:8px; font-weight:400; opacity:.8; }
  td.tlbl { position: sticky; left: 0; z-index: 10; background: #1A2744; border: 1px solid #2A3A6A; padding: 4px 10px 4px 8px; font-size: 10.5px; font-weight: 600; color: #FFFFFF; text-align: right; }
  td.tlbl.opt { background: #1A3A1A !important; border-left: 3px solid #FFD700 !important; color: #FFD700 !important; }
  td.cell { border: 1px solid #C8C8C8; padding: 4px 7px; text-align: right; min-width: 52px; font-size: 11px; font-weight: 500; color: #000; }
  td.cell:hover { filter: brightness(1.12); cursor: default; }
  td.vx  { background: #FF8080; color: #000000; font-weight: 700; }
  td.vng { background: #FFCDD2; color: #B71C1C; font-weight: 600; }
  td.vem { background: #F5F5F5; }
  td.hot { font-weight: 700; }
  td.zpeak { outline: 2px solid #1A2744; outline-offset: -2px; font-weight: 700; }
  td.b6, th.b6 { border-left: 3px solid #1A2744 !important; }
  td.b10, th.b10 { border-left: 3px solid #1A2744 !important; }
  td.blob { background: #FFF176 !important; }
  td.blob2 { background: #FFFF00 !important; font-weight: 700; }
  td.top3 { background: #E9A08A !important; font-weight: 800; position: relative; }
  td.top3::after { content: attr(data-rank); position: absolute; top: -2px; left: 2px; font-size: 10px; font-weight: 800; color: #E00000; }
  .grad-bar { display: inline-block; width: 220px; height: 12px; border-radius: 3px; border: 1px solid #999; vertical-align: middle; background: linear-gradient(90deg,#FFFFFF 0%,#D9F5D9 30%,#8CF07A 55%,#33CC00 80%,#0E8A0E 95%,#0B5E0B 100%); }
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
  <span class="hmap-title">CONTRIBUTION HEAT MAP</span>
  <span class="hmap-sub" id="hm1sub">—</span>
</div>
<div class="table-wrap">
  <table><thead><tr id="s-head"><th>FLIGHT TIME</th></tr></thead><tbody id="s-body"></tbody></table>
</div>

<div class="footer">
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-size:10px;font-weight:700;">COLD</span><span class="grad-bar"></span><span style="font-size:10px;font-weight:700;">HOT</span>
    <span style="background:#FFFF00;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">HOT ZONE — PEAK SUB-6,000 / PEAK 10,000+</span>
    <span style="background:#E9A08A;color:#E00000;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:800;">1 2 3 — TOP 3 IN SELECTED ROW</span>
    <span style="outline:2px solid #1A2744;outline-offset:1px;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">ZONE PEAK (whole table)</span>
    <span style="background:#FFCDD2;color:#B71C1C;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">NEGATIVE</span>
    <span style="background:#FF8080;color:#000;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;">CI &gt; 200</span>
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
let sGrid = null, sDists = null, gGrid=null, gDists=null, sScale=null, vScale=null, sPeak=null, vPeak=null, topMap={};

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

// ── HEAT GRADIENT ─────────────────────────────────────────────────────────
// Continuous hue: white (cold) → greens → yellow → orange → red (hot).
// Colour = percentile rank of the cell within its zone (single-leg or stopover).
// Dead zone (6,001–9,999km) is coloured on the same gradient as every other cell.
const STOPS=[[0,[255,255,255]],[0.30,[217,245,217]],[0.55,[140,240,122]],[0.80,[51,204,0]],[0.95,[14,138,14]],[1,[11,94,11]]];
function heatRGB(p){
  p=Math.max(0,Math.min(1,p));
  for(let i=1;i<STOPS.length;i++){ if(p<=STOPS[i][0]){ const [p0,c0]=STOPS[i-1],[p1,c1]=STOPS[i]; const t=(p-p0)/(p1-p0);
    return 'rgb('+c0.map((c,k)=>Math.round(c+(c1[k]-c)*t)).join(',')+')'; } }
  return 'rgb(11,94,11)';
}
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
  const rbS=optRowIdx>=0?rowBestRange(grid,optRowIdx,dists,d=>d<=6000):-1;
  const rbV=optRowIdx>=0?rowBestRange(grid,optRowIdx,dists,d=>d>=10000):-1;
  let html='';
  TMS.forEach((t,ti)=>{
    const isOpt=ti===optRowIdx; const dr=Math.abs(ti-optRowIdx);
    html+='<tr><td class="tlbl'+(isOpt?' opt':'')+'">'+tl(t)+'</td>';
    dists.forEach((d,di)=>{
      const v=grid[ti][di]; const sv=isSV(d); let cls='',sty='',txt='',attr='';
      if(d===6500)cls+=' b6'; if(d===10000)cls+=' b10';
      if(v==='X'){cls+=' vx';txt='X';}
      else if(typeof v==='number'){
        txt=v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
        if(v<0){cls+=' vng';}
        else{ const p=(sv?vScale:sScale).pct(v); sty=' style="background:'+heatRGB(p)+'"'; if(p>=0.9)cls+=' hot'; }
        if(isOpt)cls+=' opt-cell';
        if((sv?vPeak:sPeak)===ti+':'+di)cls+=' zpeak';
        // Hot-zone blob: peak cell of the selected row ±2 cols, ±1 row (yellow); peak itself bright yellow.
        if(optRowIdx>=0&&!isDZ(d)){ const rb=sv?rbV:rbS; if(rb>=0&&Math.abs(di-rb)<=2&&dr<=1){ cls+=(isOpt&&di===rb)?' blob2':' blob'; } }
        const r=topMap[ti+':'+di]; if(r){cls+=' top3';attr=' data-rank="'+r+'"';}
      }
      else{cls+=' vem';}
      html+='<td id="c-'+ti+'-'+di+'" class="cell'+cls+'"'+sty+attr+'>'+txt+'</td>';
    });
    html+='</tr>';
  });
  document.getElementById('s-body').innerHTML=html;
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

// Best-card click: select that flights/day, highlight its row, scroll to and flash the best cell.
function jumpTo(fpd,ri,di){
  const sel=document.getElementById('opt-dd'); sel.value=String(fpd); onDDChange();
  const td=document.getElementById('c-'+ri+'-'+di); if(!td)return;
  td.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
  td.classList.remove('flash'); void td.offsetWidth; td.classList.add('flash');
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
    sScale=zoneScale(grid,dists,d=>true); vScale=sScale;  // one continuous scale across the whole table
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
