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

module.exports = { buildCalcPage };
