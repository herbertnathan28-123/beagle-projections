const { N8N_TOKEN, AIRCRAFT_REVENUE, AIRCRAFT_BURN_HOUR, FUEL_SCHEDULE } = require('../config');

function buildFuelDashboard(discordId, editDid) {
  // editDid = the real Discord ID for the Edit Profile link (may differ from the URL key)
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const monthName = MONTHS[now.getUTCMonth()];
  const year = now.getUTCFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>Beagle Fuel Dashboard</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',Calibri,sans-serif;min-height:100vh}
::-webkit-scrollbar{width:4px;background:#040C18}
::-webkit-scrollbar-thumb{background:#1A3050;border-radius:2px}
.hdr{background:linear-gradient(90deg,#04101E,#0A1C32);border-bottom:2px solid #C4920A;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.brand{font-size:20px;font-weight:700;color:#E8B84B;letter-spacing:2px}
.brand-sub{font-size:10px;color:#5A8AAB;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.hdr-right{text-align:right;display:flex;align-items:center;gap:12px}
.hdr-month{font-size:14px;font-weight:700;color:#E8B84B;letter-spacing:1px}
.hdr-id{font-size:10px;color:#3A6080;margin-top:2px;letter-spacing:1px}
.edit-btn{padding:8px 16px;background:transparent;border:1px solid #C4920A;color:#C4920A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:4px;transition:all .2s}
.edit-btn:hover{background:#C4920A;color:#030B17}
.loading{display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:16px}
.loading-icon{font-size:36px;color:#E8B84B}
.loading-text{font-size:16px;color:#5A8AAB;letter-spacing:2px}
.error-msg{text-align:center;padding:40px;color:#E74C3C;font-size:14px}
.section{margin:16px;border:1px solid #0A1E30;border-radius:4px;overflow:hidden}
.sec-title{font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#3A6080;padding:10px 16px;background:#04101E;border-bottom:1px solid #0A1E30}

/* TANK STATUS BAR */
.tank-bar{display:flex;gap:16px;padding:14px 16px;flex-wrap:wrap}
.tank-item{flex:1;min-width:200px;background:#06121E;border:1px solid #1A3050;border-radius:4px;padding:14px 16px}
.tank-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.tank-label.green{color:#00D68F}
.tank-label.amber{color:#F9A825}
.tank-label.red{color:#E74C3C}
.tank-value{font-size:24px;font-weight:900;letter-spacing:1px;font-family:'Consolas',monospace}
.tank-value.green{color:#00D68F}
.tank-value.amber{color:#F9A825}
.tank-value.red{color:#E74C3C}
.tank-status{font-size:11px;font-weight:700;letter-spacing:1px;margin-top:6px}
.tank-status.green{color:#00D68F}
.tank-status.amber{color:#F9A825}
.tank-status.red{color:#E74C3C}

/* TODAY PANEL */
.today-panel{padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:600px){.today-panel{grid-template-columns:1fr}}
.today-card{background:#06121E;border:1px solid #1A3050;border-radius:4px;padding:16px}
.today-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5A8AAB;margin-bottom:8px}
.today-price{font-size:32px;font-weight:900;letter-spacing:1px}
.today-price.green{color:#00D68F}
.today-price.amber{color:#F9A825}
.today-price.red{color:#E74C3C}
.today-slot{font-size:12px;color:#8AAABB;margin-top:4px}
.today-countdown{font-size:14px;font-weight:700;color:#E8B84B;margin-top:8px;letter-spacing:1px}
.today-note{font-size:11px;color:#F9A825;margin-top:6px;font-style:italic}
.buy-soon{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#00D68F;margin-top:6px}
.pulse-dot{width:8px;height:8px;border-radius:50%;background:#00D68F;animation:pulse 1.5s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(0,214,143,.6)}70%{box-shadow:0 0 0 8px rgba(0,214,143,0)}100%{box-shadow:0 0 0 0 rgba(0,214,143,0)}}

/* SAVINGS */
.savings-panel{padding:16px;display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start}
.savings-block{min-width:160px}
.savings-num{font-size:28px;font-weight:900;color:#E8B84B;letter-spacing:1px}
.savings-label{font-size:10px;color:#5A8AAB;letter-spacing:1px;margin-top:4px}
.savings-note{font-size:11px;color:#3A6080;margin-top:12px;line-height:1.6;padding:0 16px 14px}

/* MAINTENANCE */
.maint-panel{padding:16px}
.maint-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #0A1E30;flex-wrap:wrap}
.maint-row:last-child{border-bottom:none}
.maint-type{font-size:14px;font-weight:700;color:#E2EAF4;min-width:140px}
.maint-count{font-size:13px;color:#F9A825;min-width:80px}
.maint-btn{padding:6px 14px;border:1px solid #1A3050;border-radius:3px;background:#06121E;color:#5A8AAB;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;font-family:inherit;transition:all .12s}
.maint-btn:hover{border-color:#3A6A8A;color:#E2EAF4}
.maint-btn.active{border-color:#F9A825;color:#F9A825}
.maint-input{display:none;align-items:center;gap:8px;margin-top:8px;width:100%}
.maint-input.show{display:flex}
.maint-input input{width:80px;padding:6px 10px;font-size:14px}
.maint-input select{width:160px;padding:6px 10px;font-size:14px}
.maint-confirm{padding:6px 16px;background:#C4920A;color:#000;border:none;border-radius:3px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit}
.maint-summary{font-size:12px;color:#5A8AAB;margin-top:12px;padding-top:12px;border-top:1px solid #0A1E30}
.maint-empty{font-size:13px;color:#3A6080;padding:8px 0;font-style:italic}

/* CALENDAR */
.cal-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{background:#04101E;color:#3A6080;font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:8px 6px;text-align:left;border-bottom:1px solid #0A1E30;position:sticky;top:0;z-index:10;white-space:nowrap}
tbody tr{border-bottom:1px solid #0A1E30;transition:background .1s}
tbody tr:hover{background:rgba(255,255,255,.015)}
tbody td{padding:8px 6px;vertical-align:middle;white-space:nowrap}
tr.today-row{border-left:3px solid #E8B84B;background:rgba(232,184,75,.04)}
tr.past-row{opacity:.4}
tr.future-row td{color:#E2EAF4}
.today-badge{display:inline-block;background:#E8B84B;color:#000;font-size:8px;font-weight:900;padding:2px 6px;border-radius:2px;letter-spacing:1px;margin-left:6px}
.rating-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}
.dot-green{background:#00D68F}
.dot-amber{background:#F9A825}
.dot-red{background:#E74C3C}
.forced-buy{font-size:10px;color:#F9A825;font-weight:600}
.forced-icon{font-size:12px}
.forced-sub{font-size:10px;padding:4px 6px 4px 30px;color:#5A8AAB}
.forced-sub.warn{color:#F9A825}
.forced-sub.alt{color:#3A6080}
.price-cell{font-family:'Consolas',monospace;font-weight:600}

/* DEPARTURE PLANNER */
.planner-panel{padding:16px}
.planner-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-bottom:16px}
.planner-controls .field{display:flex;flex-direction:column;gap:4px}
.planner-controls .field label{font-size:11px;font-weight:600;color:#5A8AAB}
.planner-controls select,.planner-controls input{background:#06121E;border:1px solid #1A2840;color:#E2EAF4;padding:8px 10px;border-radius:2px;font-family:inherit;font-size:14px;outline:none}
.planner-controls select:focus,.planner-controls input:focus{border-color:#2A5080}
.planner-result{margin-top:8px}

.no-profile{text-align:center;padding:40px 20px}
.no-profile h3{font-size:14px;color:#E8B84B;margin-bottom:12px;letter-spacing:1px}
.no-profile p{font-size:12px;color:#5A8AAB;line-height:1.8}
.footer{text-align:center;padding:16px;font-size:9px;color:#1A3050;letter-spacing:2px;text-transform:uppercase}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div class="brand">&#9670; BEAGLE FUEL</div>
    <div class="brand-sub">Stepping Stone Dashboard</div>
  </div>
  <div class="hdr-right">
    <a href="/fuel-setup?did=${editDid || discordId}&edit=1" class="edit-btn">Edit Profile</a>
    <div>
      <div class="hdr-month">${monthName} ${year}</div>
      <div class="hdr-id" id="user-id"></div>
    </div>
  </div>
</div>
<div id="app">
  <div class="loading" id="loader">
    <div class="loading-icon">&#9670;</div>
    <div class="loading-text">LOADING FUEL PATH...</div>
  </div>
</div>
<script>
const DID='${discordId}';
const TOKEN='${N8N_TOKEN}';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const AIRCRAFT_REV=${JSON.stringify(AIRCRAFT_REVENUE)};
const AIRCRAFT_BURN=${JSON.stringify(AIRCRAFT_BURN_HOUR)};

document.getElementById('user-id').textContent='ID: '+DID;

function fmtNum(n){return Math.round(n).toLocaleString('en-US');}
function fmtDollar(n){return '$'+fmtNum(n);}

let maintenanceData={};
let profileData=null;
let fuelPathData=null;

async function init(){
  const app=document.getElementById('app');
  const loader=document.getElementById('loader');
  try{
    const[fpRes,prRes,mtRes]=await Promise.all([
      fetch('/api/fuel-path'),
      fetch('/api/fuel-profile?discord_id='+DID+'&token='+encodeURIComponent(TOKEN)),
      fetch('/api/maintenance/'+DID).catch(()=>({ok:false}))
    ]);
    fuelPathData=await fpRes.json();
    const prData=await prRes.json();
    if(mtRes.ok) try{maintenanceData=await mtRes.json();}catch(e){}
    loader.style.display='none';
    if(!fuelPathData||!fuelPathData.days){
      app.innerHTML='<div class="error-msg">Fuel path data unavailable.</div>';
      return;
    }
    profileData=prData.found?prData.profile:null;
    renderDashboard(fuelPathData,profileData);
  }catch(e){
    loader.style.display='none';
    app.innerHTML='<div class="error-msg">Failed to load data: '+e.message+'</div>';
  }
}

function getActiveFleet(profile){
  const fleet=(profile.fleet||[]).map(f=>({...f}));
  const maint=maintenanceData.aircraft||{};
  return fleet.map(f=>{
    const inMaint=maint[f.type]||0;
    const active=Math.max(0,(f.total_aircraft||f.count||0)-inMaint);
    return {...f,total_aircraft:active,original_total:(f.total_aircraft||f.count||0),in_maintenance:inMaint};
  });
}

function calcDailyBurn(activeFleet){
  let total=0;
  for(const f of activeFleet){
    const burnPerHr=AIRCRAFT_BURN[f.type]||10000;
    const hrs=f.flight_hours||12;
    const cyclesPerDay=24/hrs;
    total+=(f.total_aircraft||0)*burnPerHr*hrs*cyclesPerDay;
  }
  return total;
}

function calcDailyRevenue(activeFleet){
  let total=0;
  for(const f of activeFleet){
    total+=(AIRCRAFT_REV[f.type]||50000)*(f.total_aircraft||0);
  }
  return total;
}

function getTzOffset(tzStr){
  if(!tzStr) return 0;
  const m=tzStr.match(/UTC([+-]?\d+\.?\d*)/);
  return m?parseFloat(m[1]):0;
}

function utcToLocal(utcSlot,tzOffset){
  const[h,m]=utcSlot.split(':').map(Number);
  let totalMin=h*60+m+tzOffset*60;
  while(totalMin<0)totalMin+=1440;
  totalMin=totalMin%1440;
  const lh=Math.floor(totalMin/60);
  const lm=Math.round(totalMin%60);
  return String(lh).padStart(2,'0')+':'+String(lm).padStart(2,'0');
}

function utcToDenmark(utcSlot){
  return utcToLocal(utcSlot,2);
}

function renderDashboard(fp,profile){
  const app=document.getElementById('app');
  const now=new Date();
  const todayUTC=now.getUTCDate();
  const curHour=now.getUTCHours();
  const curMin=now.getUTCMinutes();
  const today=fp.days.find(d=>d.day===todayUTC);
  const tzOffset=profile?getTzOffset(profile.timezone):0;
  const reserveBuffer=profile?Number(profile.reserve_buffer)||10000:10000;
  let html='';
  if(profile){
    html+=renderTankStatus(profile,reserveBuffer);
  }
  html+=renderTodayPanel(today,todayUTC,curHour,curMin,fp,tzOffset);
  if(profile){
    html+=renderSavings(fp,profile,reserveBuffer);
    html+=renderMaintenance(profile);
  }else{
    html+='<div class="section"><div class="sec-title">YOUR MONTHLY SAVING</div>';
    html+='<div class="no-profile"><h3>No Profile Found</h3>';
    html+='<p>Post in the fuel upload channel to create your profile.<br>Your fleet data is needed to calculate personal savings.</p></div></div>';
  }
  html+=renderCalendar(fp,todayUTC,profile,tzOffset,reserveBuffer);
  html+=renderDeparturePlanner(fp,profile,tzOffset);
  html+='<div class="footer">BEAGLE GLOBAL &middot; FUEL STEPPING STONE DASHBOARD &middot; '+fp.year+'-'+String(fp.month).padStart(2,'0')+'</div>';
  app.innerHTML=html;
  startCountdowns(today,todayUTC,curHour,curMin,fp);
  bindMaintenance();
  bindPlanner(fp,profile,tzOffset);
}

function renderTankStatus(profile,reserveBuffer){
  const fuelReserves=Number(profile.fuel_reserves)||0;
  const co2Reserves=Number(profile.co2_reserves)||0;
  const fuelTank=Number(profile.fuel_tank_capacity)||0;
  const co2Tank=Number(profile.co2_tank_capacity)||0;
  const activeFleet=getActiveFleet(profile);
  const dailyBurn=calcDailyBurn(activeFleet);
  const fleetCount=activeFleet.reduce((s,f)=>s+(f.total_aircraft||0),0);
  const avgCycleHrs=activeFleet.length>0?activeFleet.reduce((s,f)=>s+(f.flight_hours||12)*(f.total_aircraft||0),0)/Math.max(1,fleetCount):12;
  const fuelPerCycle=dailyBurn>0?dailyBurn*(avgCycleHrs/24):0;
  const co2PerCycle=fuelPerCycle*0.017;
  const fuelAboveReserve=Math.max(0,fuelReserves-reserveBuffer);
  const co2AboveReserve=Math.max(0,co2Reserves-reserveBuffer);
  const fuelCycles=fuelPerCycle>0?fuelAboveReserve/fuelPerCycle:99;
  const co2Cycles=co2PerCycle>0?co2AboveReserve/co2PerCycle:99;
  const fuelColor=fuelCycles>=3?'green':fuelCycles>=1?'amber':'red';
  const co2Color=co2Cycles>=3?'green':co2Cycles>=1?'amber':'red';
  const fuelStatus=fuelColor==='green'?'OK':fuelColor==='amber'?'ATTENTION \u2014 BUY SOON':'CRITICAL \u2014 BUY NOW';
  const co2Status=co2Color==='green'?'OK':co2Color==='amber'?'ATTENTION \u2014 BUY SOON':'CRITICAL \u2014 BUY NOW';
  let html='<div class="section"><div class="sec-title">TANK STATUS</div>';
  html+='<div class="tank-bar">';
  html+='<div class="tank-item"><div class="tank-label '+fuelColor+'">FUEL RESERVES</div>';
  html+='<div class="tank-value '+fuelColor+'">'+fmtNum(fuelReserves)+' lbs</div>';
  html+='<div class="tank-status '+fuelColor+'">'+fuelStatus+'</div></div>';
  html+='<div class="tank-item"><div class="tank-label '+co2Color+'">CO2 RESERVES</div>';
  html+='<div class="tank-value '+co2Color+'">'+fmtNum(co2Reserves)+' quotas</div>';
  html+='<div class="tank-status '+co2Color+'">'+co2Status+'</div></div>';
  html+='</div></div>';
  return html;
}

function findNextCheapWindow(fp,todayUTC,curHour,curMin,type){
  // FIX: scan ALL slots in FUEL_SCHEDULE_CLIENT within the 16h window (not just one per day).
  // Old version only checked fp.days[day].slot (cheapest per day) — if that slot passed, it jumped
  // to the next day ignoring all remaining cheap slots today. WO-FUEL-CALC-BUG-FIXES.
  const now=new Date();
  const nowMs=now.getTime();
  const windowMs=16*3600*1000;
  let best=null;
  // Scan today and tomorrow to cover any 16h window crossing midnight
  for(let dayOffset=0;dayOffset<=1;dayOffset++){
    const checkDay=todayUTC+dayOffset;
    if(checkDay>31)continue;
    const daySchedule=FUEL_SCHEDULE_CLIENT[String(checkDay)];
    if(!daySchedule)continue;
    for(const [slotStr,prices] of Object.entries(daySchedule)){
      const price=type==='fuel'?prices[0]:prices[1];
      const [slotH,slotM]=slotStr.split(':').map(Number);
      const slotMs=Date.UTC(fp.year,fp.month-1,checkDay,slotH,slotM);
      if(slotMs<=nowMs)continue;          // past slot
      if(slotMs-nowMs>windowMs)continue;  // beyond 16h window
      const rating=type==='fuel'?(price<500?'green':price<=900?'amber':'red'):(price<120?'green':price<=160?'amber':'red');
      if(!best||price<best.price){
        best={day:checkDay,slot:slotStr,price,rating,timeMs:slotMs};
      }
    }
  }
  return best;
}

function renderTodayPanel(today,todayUTC,curHour,curMin,fp,tzOffset){
  let html='<div class="section"><div class="sec-title">TODAY \u2014 '+todayUTC+' '+MONTHS[fp.month-1]+' '+fp.year+'</div>';
  html+='<div class="today-panel">';
  const nextFuel=findNextCheapWindow(fp,todayUTC,curHour,curMin,'fuel');
  const nextCo2=findNextCheapWindow(fp,todayUTC,curHour,curMin,'co2');
  html+='<div class="today-card"><div class="today-label">NEXT CHEAP FUEL</div>';
  if(nextFuel){
    const priceClass=nextFuel.rating;
    html+='<div class="today-price '+priceClass+'">'+fmtDollar(nextFuel.price)+'</div>';
    html+='<div class="today-slot">Day '+nextFuel.day+' at '+utcToDenmark(nextFuel.slot)+' Denmark / '+utcToLocal(nextFuel.slot,tzOffset)+' local</div>';
    html+='<div class="today-countdown" id="fuel-cd">--:--:--</div>';
    if(nextFuel.price>900){
      html+='<div class="today-note">Necessity buy \u2014 cheapest available. Best option given current market.</div>';
    }
    const diffMs=nextFuel.timeMs-Date.now();
    if(diffMs<2*3600*1000){
      html+='<div class="buy-soon"><div class="pulse-dot"></div>BUY SOON</div>';
    }
  }else{
    html+='<div class="today-price amber">NO WINDOW</div>';
    html+='<div class="today-slot">No cheap fuel slot within 16 hours</div>';
  }
  html+='</div>';
  html+='<div class="today-card"><div class="today-label">NEXT CHEAP CO2</div>';
  if(nextCo2){
    const priceClass=nextCo2.rating;
    html+='<div class="today-price '+priceClass+'">'+fmtDollar(nextCo2.price)+'</div>';
    html+='<div class="today-slot">Day '+nextCo2.day+' at '+utcToDenmark(nextCo2.slot)+' Denmark / '+utcToLocal(nextCo2.slot,tzOffset)+' local</div>';
    html+='<div class="today-countdown" id="co2-cd">--:--:--</div>';
    if(nextCo2.price>160){
      html+='<div class="today-note">Necessity buy \u2014 cheapest available. Best option given current market.</div>';
    }
    const diffMs=nextCo2.timeMs-Date.now();
    if(diffMs<2*3600*1000){
      html+='<div class="buy-soon"><div class="pulse-dot"></div>BUY SOON</div>';
    }
  }else{
    html+='<div class="today-price amber">NO WINDOW</div>';
    html+='<div class="today-slot">No cheap CO2 slot within 16 hours</div>';
  }
  html+='</div></div></div>';
  return html;
}

function renderSavings(fp,profile,reserveBuffer){
  const activeFleet=getActiveFleet(profile);
  const fleetCount=activeFleet.reduce((s,f)=>s+(f.total_aircraft||0),0);
  const dailyBurn=calcDailyBurn(activeFleet);
  const dailyRev=calcDailyRevenue(activeFleet);
  let totalOptimalPrice=0;
  for(const day of fp.days){if(day.fuel)totalOptimalPrice+=day.fuel.price;}
  const sched=FUEL_SCHEDULE_CLIENT;
  let allPricesSum=0,allPricesCount=0;
  for(const dk of Object.keys(sched)){
    for(const slot of Object.keys(sched[dk])){
      allPricesSum+=sched[dk][slot][0];
      allPricesCount++;
    }
  }
  const avgRandomPrice=allPricesCount>0?allPricesSum/allPricesCount:1300;
  const avgOptPerDay=totalOptimalPrice/fp.days.length/1000;
  const avgRndPerDay=avgRandomPrice/1000;
  const burnLbs=dailyBurn>0?dailyBurn:(Number(profile.fuel_tank_capacity)||880597000)*0.3;
  const optCostMonth=burnLbs*avgOptPerDay*fp.days.length;
  const rndCostMonth=burnLbs*avgRndPerDay*fp.days.length;
  const dollarSaving=Math.max(0,rndCostMonth-optCostMonth);
  const flyingDays=dailyRev>0?dollarSaving/dailyRev:0;
  let html='<div class="section"><div class="sec-title">FLEET SAVING SUMMARY</div>';
  html+='<div class="savings-panel">';
  html+='<div class="savings-block"><div class="savings-num">'+fmtDollar(optCostMonth)+'</div><div class="savings-label">TOTAL COST \u2014 OPTIMAL PATH</div></div>';
  html+='<div class="savings-block"><div class="savings-num">'+fmtDollar(dollarSaving)+'</div><div class="savings-label">TOTAL SAVING VS RANDOM BUYING</div></div>';
  if(dailyRev>0){
    html+='<div class="savings-block"><div class="savings-num">'+flyingDays.toFixed(1)+' DAYS</div><div class="savings-label">EQUIVALENT FLEET FLYING DAYS</div></div>';
  }
  html+='</div>';
  html+='<div class="savings-note">Based on your active fleet of '+fmtNum(fleetCount)+' aircraft, buying optimally vs randomly across '+fp.days.length+' days. Active fleet excludes aircraft in maintenance.</div>';
  html+='</div>';
  return html;
}

function renderMaintenance(profile){
  const fleet=profile.fleet||[];
  const maint=maintenanceData.aircraft||{};
  let html='<div class="section"><div class="sec-title">MAINTENANCE TRACKER</div>';
  html+='<div class="maint-panel">';
  const typesInMaint=Object.keys(maint).filter(t=>maint[t]>0);
  if(typesInMaint.length>0){
    for(const t of typesInMaint){
      html+='<div class="maint-row">';
      html+='<span class="maint-type">'+t+'</span>';
      html+='<span class="maint-count">'+maint[t]+' in maintenance</span>';
      html+='<button class="maint-btn" data-action="return" data-type="'+t+'">RETURN FROM MAINTENANCE</button>';
      html+='</div>';
    }
  }else{
    html+='<div class="maint-empty">No aircraft currently in maintenance.</div>';
  }
  html+='<div style="margin-top:14px;padding-top:14px;border-top:1px solid #0A1E30">';
  html+='<button class="maint-btn" id="maint-add-btn" style="margin-bottom:10px">ADD TO MAINTENANCE</button>';
  html+='<div class="maint-input" id="maint-add-form">';
  html+='<select id="maint-type-sel">';
  const acTypes=['A380-800','A380F','A330-900neo','A330-800neo','A330-300','A330-200','B747-8','B747-8F','B747SP','B787-10','B787-9','B787-8','A350-900ULR','DC-10','MC-21-400','Concorde','A320neo','B737 MAX 8','Spacejet M100'];
  for(const t of acTypes){html+='<option>'+t+'</option>';}
  html+='</select>';
  html+='<input type="number" id="maint-qty" min="1" value="1" placeholder="Qty">';
  html+='<button class="maint-confirm" id="maint-confirm-btn">CONFIRM</button>';
  html+='</div></div>';
  const activeFleet=getActiveFleet(profile);
  const activeCount=activeFleet.reduce((s,f)=>s+(f.total_aircraft||0),0);
  const totalCount=fleet.reduce((s,f)=>s+(f.total_aircraft||f.count||0),0);
  const maintCount=totalCount-activeCount;
  html+='<div class="maint-summary">Active fleet: '+fmtNum(activeCount)+' aircraft &middot; In maintenance: '+fmtNum(maintCount)+'</div>';
  html+='</div></div>';
  return html;
}

function renderCalendar(fp,todayUTC,profile,tzOffset,reserveBuffer){
  let html='<div class="section"><div class="sec-title">STEPPING STONE PATH \u2014 FULL MONTH</div>';
  html+='<div class="cal-wrap"><table><thead><tr>';
  html+='<th>DATE</th><th>FUEL PRICE</th><th>DENMARK</th><th>LOCAL</th><th>FUEL</th>';
  html+='<th>CO2 PRICE</th><th>DENMARK</th><th>LOCAL</th><th>CO2</th>';
  html+='</tr></thead><tbody>';
  const activeFleet=profile?getActiveFleet(profile):[];
  const dailyBurn=profile?calcDailyBurn(activeFleet):0;
  const dailyRev=profile?calcDailyRevenue(activeFleet):0;
  for(const day of fp.days){
    const isToday=day.day===todayUTC;
    const isPast=day.day<todayUTC;
    const rowClass=isToday?'today-row':isPast?'past-row':'future-row';
    html+='<tr class="'+rowClass+'">';
    html+='<td style="font-weight:700">'+day.day+' '+MONTHS[fp.month-1]+(isToday?' <span class="today-badge">TODAY</span>':'')+'</td>';
    if(day.fuel){
      const fRating=day.fuel.rating;
      const isForcedFuel=fRating==='red'||fRating==='amber';
      html+='<td class="price-cell">'+fmtDollar(day.fuel.price)+'</td>';
      html+='<td>'+utcToDenmark(day.fuel.slot)+'</td>';
      html+='<td>'+utcToLocal(day.fuel.slot,tzOffset)+'</td>';
      html+='<td><span class="rating-dot dot-'+fRating+'"></span></td>';
      if(day.co2){
        const cRating=day.co2.rating;
        html+='<td class="price-cell">'+fmtDollar(day.co2.price)+'</td>';
        html+='<td>'+utcToDenmark(day.co2.slot)+'</td>';
        html+='<td>'+utcToLocal(day.co2.slot,tzOffset)+'</td>';
        html+='<td><span class="rating-dot dot-'+cRating+'"></span></td>';
      }else{
        html+='<td>\u2014</td><td>\u2014</td><td>\u2014</td><td></td>';
      }
    }else{
      html+='<td colspan="8" style="color:#3A6080">No schedule data</td>';
    }
    html+='</tr>';
    if(day.fuel&&(day.fuel.rating==='red'||day.fuel.rating==='amber')&&!isPast){
      html+='<tr class="'+rowClass+'"><td></td><td colspan="8">';
      html+='<div class="forced-sub warn">&#9888; NECESSITY BUY \u2014 LEAST DAMAGING OPTION \u2014 Best available: '+fmtDollar(day.fuel.price)+'</div>';
      if(profile&&dailyBurn>0&&dailyRev>0){
        let nextGreenDay=null;
        for(const nd of fp.days){
          if(nd.day>day.day&&nd.fuel&&nd.fuel.rating==='green'){nextGreenDay=nd;break;}
        }
        if(nextGreenDay){
          const daysToGreen=nextGreenDay.day-day.day;
          const fuelNeeded=dailyBurn*daysToGreen;
          const fleetCount=activeFleet.reduce((s,f)=>s+(f.total_aircraft||0),0);
          const acPerDay=fleetCount>0?dailyBurn/fleetCount:0;
          const groundCount=acPerDay>0?Math.ceil(fuelNeeded*0.3/acPerDay/daysToGreen):0;
          const groundType=activeFleet.length>0?activeFleet.reduce((a,b)=>(AIRCRAFT_BURN[a.type]||0)>(AIRCRAFT_BURN[b.type]||0)?a:b).type:'';
          const svCostGround=groundCount*(AIRCRAFT_REV[groundType]||50000)*daysToGreen;
          const svCostBuy=(day.fuel.price/1000)*fuelNeeded;
          const recommended=svCostGround<svCostBuy;
          html+='<div class="forced-sub alt">ALTERNATIVE \u2014 GROUND '+groundCount+' '+groundType+' for '+daysToGreen+' days \u2014 SV cost: '+fmtDollar(svCostGround)+' vs buy cost: '+fmtDollar(svCostBuy)+' \u2014 '+(recommended?'RECOMMENDED':'NOT RECOMMENDED')+'</div>';
        }
      }
      html+='</td></tr>';
    }
  }
  html+='</tbody></table></div></div>';
  return html;
}

function renderDeparturePlanner(fp,profile,tzOffset){
  let html='<div class="section"><div class="sec-title">DEPARTURE PLANNER</div>';
  html+='<div class="planner-panel">';
  html+='<div class="planner-controls">';
  html+='<div class="field"><label>Timezone</label><select id="planner-tz">';
  const tzList=[
    ['UTC-12','UTC-12'],['UTC-11','UTC-11 (Samoa)'],['UTC-10','UTC-10 (Hawaii)'],['UTC-9','UTC-9 (Alaska)'],
    ['UTC-8','UTC-8 (Los Angeles)'],['UTC-7','UTC-7 (Denver)'],['UTC-6','UTC-6 (Chicago)'],['UTC-5','UTC-5 (New York)'],
    ['UTC-4','UTC-4 (Atlantic)'],['UTC-3','UTC-3 (Sao Paulo)'],['UTC-2','UTC-2'],['UTC-1','UTC-1 (Azores)'],
    ['UTC+0','UTC+0 (London)'],['UTC+1','UTC+1 (Paris / CET)'],['UTC+2','UTC+2 (Game Time)'],
    ['UTC+3','UTC+3 (Moscow)'],['UTC+4','UTC+4 (Dubai)'],['UTC+5','UTC+5 (Karachi)'],
    ['UTC+5.5','UTC+5:30 (India)'],['UTC+6','UTC+6 (Dhaka)'],['UTC+7','UTC+7 (Bangkok)'],
    ['UTC+8','UTC+8 (Perth / Singapore)'],['UTC+9','UTC+9 (Tokyo)'],['UTC+10','UTC+10 (Sydney)'],
    ['UTC+11','UTC+11'],['UTC+12','UTC+12 (Auckland)'],['UTC+13','UTC+13'],['UTC+14','UTC+14']
  ];
  const profileTz=profile?profile.timezone:'UTC+8';
  for(const[val,label] of tzList){
    html+='<option value="'+val+'"'+(val===profileTz?' selected':'')+'>'+label+'</option>';
  }
  html+='</select></div>';
  html+='<div class="field"><label>Start Date</label><input type="date" id="planner-date"></div>';
  html+='<div class="field"><label>Start Time</label><select id="planner-time">';
  for(let h=0;h<24;h++){
    for(let m=0;m<60;m+=30){
      const t=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
      html+='<option>'+t+'</option>';
    }
  }
  html+='</select></div>';
  html+='</div>';
  html+='<div class="planner-result" id="planner-result"></div>';
  html+='</div></div>';
  return html;
}

function startCountdowns(today,todayUTC,curHour,curMin,fp){
  const nextFuel=findNextCheapWindow(fp,todayUTC,curHour,curMin,'fuel');
  const nextCo2=findNextCheapWindow(fp,todayUTC,curHour,curMin,'co2');
  function update(){
    const now=Date.now();
    if(nextFuel){
      const el=document.getElementById('fuel-cd');
      if(el){
        const diff=nextFuel.timeMs-now;
        if(diff>0){
          const h=Math.floor(diff/3600000);
          const m=Math.floor((diff%3600000)/60000);
          const s=Math.floor((diff%60000)/1000);
          el.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
        }else{
          el.textContent='NOW';el.style.color='#00D68F';
        }
      }
    }
    if(nextCo2){
      const el=document.getElementById('co2-cd');
      if(el){
        const diff=nextCo2.timeMs-now;
        if(diff>0){
          const h=Math.floor(diff/3600000);
          const m=Math.floor((diff%3600000)/60000);
          const s=Math.floor((diff%60000)/1000);
          el.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
        }else{
          el.textContent='NOW';el.style.color='#00D68F';
        }
      }
    }
  }
  update();
  setInterval(update,1000);
}

function bindMaintenance(){
  const addBtn=document.getElementById('maint-add-btn');
  const form=document.getElementById('maint-add-form');
  if(addBtn&&form){
    addBtn.addEventListener('click',()=>{form.classList.toggle('show');});
  }
  const confirmBtn=document.getElementById('maint-confirm-btn');
  if(confirmBtn){
    confirmBtn.addEventListener('click',async()=>{
      const type=document.getElementById('maint-type-sel').value;
      const qty=parseInt(document.getElementById('maint-qty').value)||1;
      if(!maintenanceData.aircraft) maintenanceData.aircraft={};
      maintenanceData.aircraft[type]=(maintenanceData.aircraft[type]||0)+qty;
      await saveMaintenance();
      renderDashboard(fuelPathData,profileData);
    });
  }
  document.querySelectorAll('.maint-btn[data-action="return"]').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const type=btn.dataset.type;
      if(maintenanceData.aircraft&&maintenanceData.aircraft[type]){
        const qty=Math.min(maintenanceData.aircraft[type],1);
        maintenanceData.aircraft[type]-=qty;
        if(maintenanceData.aircraft[type]<=0) delete maintenanceData.aircraft[type];
        await saveMaintenance();
        renderDashboard(fuelPathData,profileData);
      }
    });
  });
}

async function saveMaintenance(){
  try{
    await fetch('/api/maintenance/'+DID,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(maintenanceData)
    });
  }catch(e){console.error('Maintenance save error:',e);}
}

function bindPlanner(fp,profile,defaultTzOffset){
  const dateInput=document.getElementById('planner-date');
  const timeSelect=document.getElementById('planner-time');
  const tzSelect=document.getElementById('planner-tz');
  const result=document.getElementById('planner-result');
  if(!dateInput||!result)return;
  const now=new Date();
  dateInput.value=now.getUTCFullYear()+'-'+String(now.getUTCMonth()+1).padStart(2,'0')+'-'+String(now.getUTCDate()).padStart(2,'0');
  function updatePlanner(){
    const selectedDate=dateInput.value;
    if(!selectedDate){result.innerHTML='';return;}
    const parts=selectedDate.split('-');
    const startDay=parseInt(parts[2]);
    const planTzOffset=getTzOffset(tzSelect.value);
    const startTime=timeSelect.value||'00:00';
    let html='<div class="cal-wrap"><table><thead><tr>';
    html+='<th>DATE</th><th>FUEL PRICE</th><th>LOCAL TIME</th><th>FUEL</th><th>CO2 PRICE</th><th>LOCAL TIME</th><th>CO2</th>';
    html+='</tr></thead><tbody>';
    for(const day of fp.days){
      if(day.day<startDay)continue;
      const isStart=day.day===startDay;
      html+='<tr'+(isStart?' class="today-row"':'')+'>';
      html+='<td style="font-weight:700">'+day.day+' '+MONTHS[fp.month-1]+(isStart?' <span class="today-badge">START</span>':'')+'</td>';
      if(day.fuel){
        html+='<td class="price-cell">'+fmtDollar(day.fuel.price)+'</td>';
        html+='<td>'+utcToLocal(day.fuel.slot,planTzOffset)+'</td>';
        html+='<td><span class="rating-dot dot-'+day.fuel.rating+'"></span></td>';
      }else{html+='<td>\u2014</td><td>\u2014</td><td></td>';}
      if(day.co2){
        html+='<td class="price-cell">'+fmtDollar(day.co2.price)+'</td>';
        html+='<td>'+utcToLocal(day.co2.slot,planTzOffset)+'</td>';
        html+='<td><span class="rating-dot dot-'+day.co2.rating+'"></span></td>';
      }else{html+='<td>\u2014</td><td>\u2014</td><td></td>';}
      html+='</tr>';
    }
    html+='</tbody></table></div>';
    result.innerHTML=html;
  }
  dateInput.addEventListener('change',updatePlanner);
  timeSelect.addEventListener('change',updatePlanner);
  tzSelect.addEventListener('change',updatePlanner);
}

const FUEL_SCHEDULE_CLIENT=${JSON.stringify(FUEL_SCHEDULE)};

init();
</script>
</body>
</html>`;
}

module.exports = { buildFuelDashboard };
