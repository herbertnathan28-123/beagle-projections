
// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE GLOBAL — ALLIANCE PROJECTIONS SERVICE — v25
// Deploy: node server.js
// Env vars: PROJECTIONS_SECRET, PORT
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = process.env.PORT || 3000;
const SECRET       = process.env.PROJECTIONS_SECRET || 'changeme';
const N8N_TOKEN    = 'bgln8n-proj-2026'; // dedicated n8n push token

app.use(cors());
app.use(express.json());

// ── DEFAULT DATA (Jun 6 2026 · 15:20 AWST snapshot) ──────────────────────
const DEFAULT_DATA = {
  timestamp:  '2026-06-06T15:20:00+08:00',
  uploader:   'atlas.4693',
  beagleSV:   2925.94,
  beaglePace: 4.627,
  beagleRank: 19,
  alliances: [
    { rank:1,  name:"Dokdo",            sv:8159.61, pace:null  },
    { rank:2,  name:"Valiant Air",      sv:7128.06, pace:7.134 },
    { rank:3,  name:"Free Flying",      sv:5545.54, pace:6.924 },
    { rank:4,  name:"Grizzly Group",    sv:5544.73, pace:4.218 },
    { rank:5,  name:"Per Aspera",       sv:5307.07, pace:5.277 },
    { rank:6,  name:"Indonesia Unity",  sv:4528.89, pace:3.802 },
    { rank:7,  name:"GERMAN ALLIANCE",  sv:4361.71, pace:3.947 },
    { rank:8,  name:"Happy Skies 2.0",  sv:3940.63, pace:3.918 },
    { rank:9,  name:"STARFLEET",        sv:3538.79, pace:3.219 },
    { rank:10, name:"Russian Wings",    sv:3514.17, pace:2.997 },
    { rank:11, name:"CODESHARE",        sv:3503.27, pace:3.641 },
    { rank:12, name:"SpaceX",           sv:3310.05, pace:4.310 },
    { rank:13, name:"ClearSky Group",   sv:3095.65, pace:2.783 },
    { rank:14, name:"JetSTAR",          sv:3083.87, pace:2.372 },
    { rank:15, name:"BRASIL GT",        sv:3046.57, pace:3.292 },
    { rank:16, name:"Mixer World",      sv:3045.30, pace:1.633 },
    { rank:17, name:"Sky Wings",        sv:3025.06, pace:3.725 },
    { rank:18, name:"Alpha Vikings",    sv:2963.43, pace:3.766 },
    { rank:20, name:"Star Alliance",    sv:2831.89, pace:3.413 },
  ]
};

let liveData = { ...DEFAULT_DATA };

// ── VISITOR LOG ────────────────────────────────────────────────────────────
const visitorLog = [];
function logVisit(req) {
  const ip   = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const ua   = req.headers['user-agent'] || 'unknown';
  const time = new Date().toISOString();
  const device = ua.includes('Mobile') ? '📱 Mobile'
               : ua.includes('iPad')   ? '📱 iPad'
               : ua.includes('Mac')    ? '💻 Mac'
               : ua.includes('Windows')? '🖥 PC'
               : '❓ Unknown';
  visitorLog.unshift({ time, ip, device, ua: ua.slice(0,80) });
  if (visitorLog.length > 200) visitorLog.pop();
  console.log(`[VISIT] ${device} ${ip} ${time}`);
}

// ── API ────────────────────────────────────────────────────────────────────
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
    beagleSV:   beagleSV   ?? liveData.beagleSV,
    beaglePace: (beaglePace != null && !isNaN(beaglePace)) ? beaglePace : liveData.beaglePace,
    beagleRank: beagleRank ?? liveData.beagleRank,
    alliances:  merged.length ? merged : liveData.alliances,
  };
  console.log(`[${new Date().toISOString()}] Updated by ${uploader}`);
  res.json({ ok: true });
});

// ── HTML ───────────────────────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=5.0,user-scalable=yes"/>
<title>Beagle Global — Alliance Projections v25</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',Calibri,sans-serif;overflow-x:hidden}
button{font-family:inherit}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:#040C18}
::-webkit-scrollbar-thumb{background:#1E3A5F;border-radius:2px}
select option{background:#040C18;color:#E2EAF4}
select optgroup{background:#030B17;color:#4A7090}
.svg-chart{cursor:grab;user-select:none;touch-action:none}
.svg-chart.dragging{cursor:grabbing}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useMemo,useRef,useCallback}=React;

// Period definitions
const PERIOD_OPTS=[
  {label:'1MO', days:30.4,  group:'MONTHS'},
  {label:'2MO', days:60.8,  group:'MONTHS'},
  {label:'3MO', days:91.3,  group:'MONTHS'},
  {label:'4MO', days:121.7, group:'MONTHS'},
  {label:'5MO', days:152.1, group:'MONTHS'},
  {label:'6MO', days:182.6, group:'MONTHS'},
  {label:'7MO', days:213.0, group:'MONTHS'},
  {label:'8MO', days:243.3, group:'MONTHS'},
  {label:'9MO', days:273.9, group:'MONTHS'},
  {label:'10MO',days:304.3, group:'MONTHS'},
  {label:'11MO',days:334.6, group:'MONTHS'},
  {label:'12MO',days:365,   group:'MONTHS'},
  {label:'15MO',days:456.3, group:'MONTHS'},
  {label:'18MO',days:547.5, group:'MONTHS'},
  {label:'21MO',days:638.8, group:'MONTHS'},
  {label:'24MO',days:730,   group:'MONTHS'},
  {label:'3Y',  days:1095,  group:'YEARS'},
  {label:'4Y',  days:1460,  group:'YEARS'},
  {label:'5Y',  days:1825,  group:'YEARS'},
  {label:'6Y',  days:2190,  group:'YEARS'},
  {label:'7Y',  days:2555,  group:'YEARS'},
  {label:'8Y',  days:2920,  group:'YEARS'},
  {label:'9Y',  days:3285,  group:'YEARS'},
  {label:'10Y', days:3650,  group:'YEARS'},
  {label:'15Y', days:5475,  group:'YEARS'},
  {label:'20Y', days:7300,  group:'YEARS'},
  {label:'25Y', days:9125,  group:'YEARS'},
  {label:'50Y', days:18250, group:'YEARS'},
  {label:'MAX', days:null,  group:'AUTO'},
];
const MTD_MAP={1:30.4,3:91.3,6:182.6,12:365};

function getXTicks(totalDays,visStart,visDays){
  const visEnd=visStart+visDays;
  let ticks=[];
  if(totalDays<=182.6)ticks=[30.4,91.3,182.6];
  else if(totalDays<=365)ticks=[91.3,182.6,365];
  else if(totalDays<=730)ticks=[182.6,365,547.5,730];
  else if(totalDays<=1825)ticks=[365,730,1095,1460,1825];
  else if(totalDays<=3650)ticks=[365,730,1825,2555,3650];
  else{const step=Math.ceil(totalDays/5/365)*365;for(let d=step;d<=totalDays;d+=step)ticks.push(d);}
  return ticks.filter(d=>d>=visStart&&d<=visEnd);
}
function xTickLabel(d){
  if(d<365)return Math.round(d/30.4)+'MO';
  const y=d/365;
  return(Number.isInteger(y)?y:y.toFixed(1))+'Y';
}
function lineColor(a){
  if(a.isBeagle)return"#E8B84B";
  if(a.passed)return"#E74C3C";
  if(!a.catchable)return"#3A6090";
  if(a.daysTo<100)return"#00E676";
  if(a.daysTo<400)return"#69F0AE";
  if(a.daysTo<800)return"#F9A825";
  return"#F57F17";
}
function fmtDate(d){
  if(!d)return null;
  const mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return d.getDate()+" "+mo[d.getMonth()]+" "+d.getFullYear();
}
function fmtAWST(ts){
  if(!ts)return null;
  const d=new Date(ts),awst=new Date(d.getTime()+8*3600000);
  const mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const pad=n=>String(n).padStart(2,"0");
  return awst.getUTCDate()+" "+mo[awst.getUTCMonth()]+" "+awst.getUTCFullYear()+" \xb7 "+pad(awst.getUTCHours())+":"+pad(awst.getUTCMinutes())+" AWST";
}
function buildAlliances(data){
  const B_SV=data.beagleSV,B_PACE=data.beaglePace;
  const beagle={rank:data.beagleRank,name:"Beagle Global",sv:B_SV,pace:B_PACE,isBeagle:true};
  const all=[...data.alliances,beagle].map(a=>{
    const gap=+(a.sv-B_SV).toFixed(2);
    const closure=a.pace!=null?+(B_PACE-a.pace).toFixed(4):null;
    const daysTo=closure>0&&gap>0?gap/closure:null;
    const overtakeDate=daysTo?new Date(Date.now()+daysTo*86400000):null;
    return{...a,gap,closure,daysTo,overtakeDate,catchable:closure>0,passed:gap<0};
  });
  return{all,beagle:{...beagle,gap:0,closure:0,catchable:false,passed:false},B_SV,B_PACE};
}
function projRanking(all,beagle,days){
  const known=all.filter(a=>a.pace!=null&&!a.isBeagle).map(a=>({...a,pSV:a.sv+a.pace*days}));
  const unknown=all.filter(a=>a.pace==null&&!a.isBeagle).map(a=>({...a,pSV:null,noPace:true}));
  const bp={...beagle,pSV:beagle.sv+beagle.pace*days};
  const sorted=[...known,bp].sort((a,b)=>b.pSV-a.pSV);
  const result=[...sorted];
  unknown.forEach(u=>{const at=Math.min(u.rank-1,result.length);result.splice(at,0,{...u,projRank:u.rank});});
  return result.map((a,i)=>({...a,projRank:a.noPace?a.rank:i+1}));
}

function App(){
  const[apiData,setApiData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[periodKey,setPeriodKey]=useState('6MO');
  const[chartMode,setChartMode]=useState('SV');
  const[activatedTeams,setActivatedTeams]=useState(new Set());
  const[focusTeam,setFocusTeam]=useState(null);
  const[fullField,setFullField]=useState(true);
  const[showRank,setShowRank]=useState(true);
  const[yZoom,setYZoom]=useState(1);
  const[yPan,setYPan]=useState(0);
  const[xZoom,setXZoom]=useState(1);
  const[xPan,setXPan]=useState(0);
  const isDragging=useRef(false);
  const dragStart=useRef({x:0,y:0,yp:0,xp:0});
  const lastPinch=useRef(null);
  const svgRef=useRef(null);

  const toggleActivate=useCallback(name=>{
    setActivatedTeams(prev=>{
      const n=new Set(prev);
      if(n.has(name)){
        n.delete(name);
        setFocusTeam(fp=>fp===name?([...n].pop()||null):fp);
      } else {
        n.add(name);
        setFocusTeam(name);
      }
      return n;
    });
  },[]);

  useEffect(()=>{
    fetch("/api/data").then(r=>r.json()).then(d=>{setApiData(d);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  const{all,beagle,B_SV,B_PACE}=useMemo(()=>{
    if(!apiData)return{all:[],beagle:{sv:0,pace:0,rank:19},B_SV:0,B_PACE:0};
    return buildAlliances(apiData);
  },[apiData]);

  const maxCatchDays=all.filter(a=>!a.isBeagle&&a.catchable&&a.daysTo).reduce((mx,a)=>Math.max(mx,a.daysTo),365);
  const MAX_DAYS=Math.ceil(maxCatchDays*1.2/30)*30;
  const pOpt=PERIOD_OPTS.find(p=>p.label===periodKey)||PERIOD_OPTS[2];
  const days=pOpt.days??MAX_DAYS;
  const pool=fullField?all.filter(a=>!a.isBeagle):all.filter(a=>!a.isBeagle&&(a.passed||a.gap<800));
  const selA=focusTeam?all.find(a=>a.name===focusTeam):null;
  const ranking=useMemo(()=>all.length?projRanking(all,beagle,days):[], [all,beagle,days]);
  const beagleRank=ranking.find(a=>a.isBeagle);
  const rankChange=beagle.rank?(beagle.rank-(beagleRank?.projRank??beagle.rank)):0;

  // Chart geometry
  const W=1200,H=320,ml=72,mr=20,mt=20,mb=44,cw=W-ml-mr,ch=H-mt-mb;
  const _vis=pool.filter(a=>Math.abs(a.gap)<2500);
  const _src=_vis.length?_vis:[...pool];
  const yMinBase=Math.min(..._src.map(a=>a.sv),B_SV)*0.97;
  const yMaxBase=Math.max(..._src.map(a=>a.sv+(a.pace||0)*days),B_SV+B_PACE*days)*1.03;
  const yRangeFull=yMaxBase-yMinBase;
  const yRangeZ=yRangeFull/yZoom;
  const yMid=(yMinBase+yMaxBase)/2-yPan;
  const yMinZ=yMid-yRangeZ/2;
  const yMaxZ=yMid+yRangeZ/2;
  const ys=v=>mt+ch-((v-yMinZ)/(yMaxZ-yMinZ))*ch;

  // X axis with zoom/pan
  const xVisDays=days/xZoom;
  const xStart=Math.max(0,Math.min(xPan,days-xVisDays));
  const xEnd=xStart+xVisDays;
  const xs=d=>ml+((d-xStart)/xVisDays)*cw;

  const yStep=yRangeFull>5000?1000:yRangeFull>2000?500:yRangeFull>800?200:100;
  const yTicks=[];
  for(let v=Math.ceil(yMinZ/yStep)*yStep;v<=yMaxZ;v+=yStep)yTicks.push(v);
  const xTicks=getXTicks(days,xStart,xVisDays);

  const crossDay=a=>{
    if(!a.catchable||a.gap<=0||!a.pace||!B_PACE)return null;
    const t=a.gap/(B_PACE-a.pace);
    return t>0&&t<=days?t:null;
  };
  const col=a=>lineColor(a);

  const resetZoom=()=>{setYZoom(1);setYPan(0);setXZoom(1);setXPan(0);};

  // Wheel zoom — both axes
  useEffect(()=>{
    const svg=svgRef.current;if(!svg)return;
    const onWheel=e=>{
      e.preventDefault();
      const f=e.deltaY<0?1.18:0.85;
      setYZoom(z=>Math.max(1,Math.min(25,z*f)));
      setXZoom(z=>Math.max(1,Math.min(25,z*f)));
    };
    // Touch pinch
    const onTouchStart=e=>{
      if(e.touches.length===2){
        lastPinch.current=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);
      }
    };
    const onTouchMove=e=>{
      if(e.touches.length===2&&lastPinch.current){
        e.preventDefault();
        const d=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);
        const f=d/lastPinch.current;
        setYZoom(z=>Math.max(1,Math.min(25,z*f)));
        setXZoom(z=>Math.max(1,Math.min(25,z*f)));
        lastPinch.current=d;
      }
    };
    const onTouchEnd=()=>{lastPinch.current=null;};
    svg.addEventListener('wheel',onWheel,{passive:false});
    svg.addEventListener('touchstart',onTouchStart,{passive:false});
    svg.addEventListener('touchmove',onTouchMove,{passive:false});
    svg.addEventListener('touchend',onTouchEnd);
    return()=>{
      svg.removeEventListener('wheel',onWheel);
      svg.removeEventListener('touchstart',onTouchStart);
      svg.removeEventListener('touchmove',onTouchMove);
      svg.removeEventListener('touchend',onTouchEnd);
    };
  },[]);

  // Drag pan — both axes
  const onMouseDown=useCallback(e=>{
    isDragging.current=true;
    dragStart.current={x:e.clientX,y:e.clientY,yp:yPan,xp:xPan};
    svgRef.current?.classList.add('dragging');
  },[yPan,xPan]);
  const onMouseMove=useCallback(e=>{
    if(!isDragging.current)return;
    const dy=e.clientY-dragStart.current.y;
    const dx=e.clientX-dragStart.current.x;
    const rect=svgRef.current?.getBoundingClientRect();
    const svgH=rect?.height||H;const svgW=rect?.width||1200;
    setYPan(dragStart.current.yp+(dy/svgH)*yRangeZ);
    const xd=days/xZoom;
    setXPan(p=>Math.max(0,Math.min(dragStart.current.xp-(dx/svgW)*xd,days-xd)));
  },[yRangeZ,days,xZoom]);
  const onMouseUp=useCallback(()=>{
    isDragging.current=false;
    svgRef.current?.classList.remove('dragging');
  },[]);
  useEffect(()=>{
    window.addEventListener('mouseup',onMouseUp);
    window.addEventListener('mousemove',onMouseMove);
    return()=>{window.removeEventListener('mouseup',onMouseUp);window.removeEventListener('mousemove',onMouseMove);};
  },[onMouseMove,onMouseUp]);

  const detailProj=selA?[1,3,6,12].map(mo=>({mo,sv:selA.sv+(selA.pace||0)*MTD_MAP[mo],rank:projRanking(all,beagle,MTD_MAP[mo]).findIndex(a=>a.isBeagle)+1})):[];

  const bb={borderRadius:3,fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:1,fontFamily:"inherit",padding:"5px 12px"};
  const btn=active=>({...bb,background:active?"#C4920A":"transparent",border:"1px solid "+(active?"#C4920A":"#162030"),color:active?"#030B17":"#6A9AB5"});
  const btn2=active=>({...bb,background:active?"#1A3050":"transparent",border:"1px solid "+(active?"#4A80B0":"#162030"),color:active?"#E8B84B":"#6A9AB5"});

  if(loading)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16}}><div style={{fontSize:35,color:"#E8B84B"}}>&#9672;</div><div style={{fontSize:18,color:"#5A8AAB",letterSpacing:2}}>LOADING PROJECTIONS...</div></div>);

  const ts=apiData?.timestamp,uploader=apiData?.uploader;
  const hasActivated=activatedTeams.size>0;
  const zoomed=yZoom>1||xZoom>1;

  const renderRow=a=>{
    const isB=a.isBeagle;
    const change=a.rank-(a.projRank??a.rank);
    const c=isB?"#E8B84B":col(a);
    const isActive=activatedTeams.has(a.name);
    return(<div key={a.name}
      onClick={()=>!isB&&toggleActivate(a.name)}
      style={{display:"flex",alignItems:"center",gap:4,padding:"5px 8px",
        background:isB?"#1A1000":isActive?c+"18":"transparent",
        borderRadius:3,
        borderLeft:isActive?"3px solid "+c:"3px solid transparent",
        cursor:isB?"default":"pointer",transition:"all 0.1s"}}>
      <span style={{fontSize:16,fontWeight:700,color:a.noPace?"#4A7090":c,minWidth:30}}>#{a.projRank}</span>
      <span style={{fontSize:16,color:isB?c:isActive?"#E2EAF4":a.noPace?"#4A7090":"#8AAABB",flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:isActive?600:400}}>{a.name}</span>
      <span style={{fontSize:15,fontWeight:600,minWidth:24,textAlign:"right",color:a.noPace?"#4A7090":change>0?"#00E676":change<0?"#E74C3C":"#4A7090"}}>{a.noPace?"?":change>0?"\u25b2"+change:change<0?"\u25bc"+Math.abs(change):isB?"\u2605":"\u2014"}</span>
    </div>);
  };

  // SV mode line renderer
  const renderSVLine=a=>{
    const isActive=activatedTeams.has(a.name);
    const dimmed=hasActivated&&!isActive;
    const c=col(a);
    const cd=crossDay(a);
    const svEnd=a.sv+(a.pace||0)*days;
    const nameShort=a.name.length>15?a.name.slice(0,14)+'\u2026':a.name;
    const yEnd=ys(svEnd);
    const labelVisible=isActive&&yEnd>=mt&&yEnd<=mt+ch;
    return(<g key={a.name}>
      {/* Invisible wide hit area */}
      <line x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(svEnd)} stroke="transparent" strokeWidth="20" style={{cursor:"pointer"}} onClick={()=>toggleActivate(a.name)}/>
      {/* Visual line */}
      <line x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(svEnd)} stroke={c} strokeWidth={isActive?2.8:dimmed?1:1.6} opacity={dimmed?0.12:0.88} strokeLinecap="round" strokeDasharray={!a.catchable&&!a.passed?"4,3":"none"}/>
      {cd&&!dimmed&&<circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="3" fill={c} opacity="0.9"/>}
      {/* Name label at line end */}
      {labelVisible&&<text x={xs(days)+5} y={yEnd+4} fill={c} fontSize="11" fontWeight="700" opacity="0.95">{nameShort}</text>}
    </g>);
  };

  return(<div style={{background:"#030B17",minHeight:"100vh",display:"flex",flexDirection:"column"}}>

    {/* HEADER */}
    <div style={{background:"linear-gradient(90deg,#04101E,#0A1C32)",borderBottom:"2px solid #C4920A",padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:4}}>
      <div>
        <div style={{fontSize:20,fontWeight:700,color:"#E8B84B",letterSpacing:2}}>&#9672; BEAGLE GLOBAL \u2014 ALLIANCE PROJECTIONS</div>
        <div style={{fontSize:14,color:"#8AAABB",marginTop:2,letterSpacing:1}}>
          10-MO RECENT PACE \xb7 RANK #{beagle.rank}
          {ts&&<span style={{marginLeft:12,color:"#5A8AAB"}}>UPDATED {fmtAWST(ts)}{uploader?" \xb7 "+uploader:""}</span>}
          {!ts&&<span style={{marginLeft:12,color:"#5A8AAB"}}>DEFAULT DATA \xb7 UPLOAD TO REFRESH</span>}
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:22,fontWeight:700,color:"#E8B84B"}}>{"$"+B_SV.toLocaleString("en",{minimumFractionDigits:2})+"M"}</div>
        <div style={{fontSize:14,color:"#8AAABB",letterSpacing:1}}>{B_PACE.toFixed(3)} $M/DAY</div>
      </div>
    </div>

    {/* CONTROLS */}
    <div style={{display:"flex",gap:5,padding:"5px 10px",background:"#040C18",borderBottom:"1px solid #0A1E30",alignItems:"center",flexWrap:"nowrap",overflowX:"auto"}}>
      <span style={{fontSize:11,color:"#6A9AB5",letterSpacing:1,marginRight:3}}>PERIOD</span>
      <select value={periodKey} onChange={e=>setPeriodKey(e.target.value)} style={{background:"#040C18",color:"#E8B84B",border:"1px solid #C4920A",borderRadius:3,padding:"3px 8px",fontSize:12,fontWeight:700,letterSpacing:1,cursor:"pointer",fontFamily:"inherit",outline:"none"}}>
        <optgroup label="\u2500\u2500 MONTHS \u2500\u2500">
          {PERIOD_OPTS.filter(p=>p.group==='MONTHS').map(p=><option key={p.label} value={p.label}>{p.label}</option>)}
        </optgroup>
        <optgroup label="\u2500\u2500 YEARS \u2500\u2500">
          {PERIOD_OPTS.filter(p=>p.group==='YEARS').map(p=><option key={p.label} value={p.label}>{p.label}</option>)}
        </optgroup>
        <optgroup label="\u2500\u2500 AUTO \u2500\u2500">
          <option value="MAX">MAX \u2014 furthest overtake</option>
        </optgroup>
      </select>
      <div style={{width:1,height:16,background:"#162030",margin:"0 3px"}}/>
      <button onClick={()=>setFullField(f=>!f)} style={btn2(fullField)}>{fullField?"CLOSE PACK":"ALL LINES"}</button>
      {hasActivated&&<button onClick={()=>{setActivatedTeams(new Set());setFocusTeam(null);}} style={{...bb,background:"#0A1E30",border:"1px solid #2C4A6E",color:"#8AAABB"}}>CLEAR ({activatedTeams.size})</button>}
      <div style={{width:1,height:16,background:"#162030",margin:"0 3px"}}/>
      {[['SV','SV LINES'],['GAP','SV GAP'],['RANK','RANK']].map(([mode,label])=>(
        <button key={mode} onClick={()=>setChartMode(mode)} style={{...bb,background:chartMode===mode?"#1A3050":"transparent",border:"1px solid "+(chartMode===mode?"#4A80B0":"#162030"),color:chartMode===mode?"#E8B84B":"#6A9AB5"}}>{label}</button>
      ))}
      <div style={{width:1,height:16,background:"#162030",margin:"0 3px"}}/>
      <button onClick={()=>setShowRank(r=>!r)} style={{...bb,background:showRank?"#0D2240":"transparent",border:"1px solid #162030",color:showRank?"#7FAACC":"#4A7090"}}>{showRank?"HIDE RANKING":"SHOW RANKING"}</button>
      {zoomed&&<button onClick={resetZoom} style={{...bb,background:"#1A0A00",border:"1px solid #C4920A60",color:"#E8B84B",fontSize:11}}>RESET ZOOM</button>}
      <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"#3A6080"}}>scroll/pinch=zoom \xb7 drag=pan \xb7 tap line/row=select</span>
        {[["#E8B84B","Beagle"],["#00E676","&lt;100d"],["#69F0AE","catching"],["#3A6090","away"],["#E74C3C","passed"]].map(([c,l])=>(
          <span key={l} style={{display:"flex",alignItems:"center",gap:3}}>
            <span style={{width:l==="Beagle"?18:14,height:l==="Beagle"?3:2,background:c,display:"inline-block",borderRadius:2}}/>
            <span style={{fontSize:10,color:"#8AAABB"}} dangerouslySetInnerHTML={{__html:l}}/>
          </span>
        ))}
      </div>
    </div>

    {/* CHART */}
    <div style={{padding:"2px 4px 4px",flexShrink:0}}>
      <svg ref={svgRef} className="svg-chart" viewBox={"0 0 "+W+" "+H} style={{width:"100%",maxHeight:"52vh",display:"block"}} onMouseDown={onMouseDown}>
        <defs>
          <filter id="fg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="fl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <clipPath id="cc"><rect x={ml} y={mt} width={cw} height={ch}/></clipPath>
          <style>{"@keyframes pu{0%,100%{r:5;opacity:1}50%{r:9;opacity:0.4}} .pd{animation:pu 1.8s ease-in-out infinite}"}</style>
        </defs>
        <rect x={ml} y={mt} width={cw} height={ch} fill="#030810" rx="2"/>
        {yTicks.map(v=>(<g key={v}>
          <line x1={ml} x2={ml+cw} y1={ys(v)} y2={ys(v)} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
          <text x={ml-6} y={ys(v)+3.5} textAnchor="end" fill="#4A7090" fontSize="13">{v>=1000?(v/1000).toFixed(1)+"k":v<=-1000?(v/1000).toFixed(1)+"k":v}</text>
        </g>))}
        {xTicks.map(d=>(<g key={d}>
          <line x1={xs(d)} x2={xs(d)} y1={mt} y2={mt+ch} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
          <text x={xs(d)} y={mt+ch+18} textAnchor="middle" fill="#4A7090" fontSize="13" fontWeight="600">{xTickLabel(d)}</text>
        </g>))}

        {/* SV LINES */}
        {chartMode==='SV'&&(<g clipPath="url(#cc)">
          {pool.map(a=>renderSVLine(a))}
          {/* Beagle */}
          <line x1={xs(0)} y1={ys(B_SV)} x2={xs(days)} y2={ys(B_SV+B_PACE*days)} stroke="#E8B84B" strokeWidth="10" opacity="0.15" strokeLinecap="round"/>
          <line x1={xs(0)} y1={ys(B_SV)} x2={xs(days)} y2={ys(B_SV+B_PACE*days)} stroke="#E8B84B" strokeWidth="3.5" strokeLinecap="round" filter="url(#fg)"/>
          <circle cx={xs(0)} cy={ys(B_SV)} r="5" fill="#E8B84B" filter="url(#fg)"/>
          <circle cx={xs(days)} cy={ys(B_SV+B_PACE*days)} r="4" fill="#E8B84B" opacity="0.7"/>
          {/* Selected alliance detail highlight */}
          {selA&&!selA.isBeagle&&(()=>{
            const c=col(selA),cd=crossDay(selA);
            return(<g>
              {cd&&(<g>
                <circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="8" fill="none" stroke={c} strokeWidth="1.5" className="pd" filter="url(#fl)"/>
                <circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="3.5" fill={c}/>
                <rect x={xs(cd)-44} y={ys(B_SV+B_PACE*cd)-62} width={88} height={22} fill="#040C18" rx="3" stroke={c} strokeWidth="0.8"/>
                <text x={xs(cd)} y={ys(B_SV+B_PACE*cd)-47} textAnchor="middle" fill={c} fontSize="13" fontWeight="700">{fmtDate(selA.overtakeDate)}</text>
              </g>)}
            </g>);
          })()}
        </g>)}
        {chartMode==='SV'&&<text x={ml-6} y={ys(B_SV)+3.5} textAnchor="end" fill="#E8B84B" fontSize="12" fontWeight="700">\u2605{beagle.rank}</text>}

        {/* SV GAP */}
        {chartMode==='GAP'&&(()=>{
          const gapMin=Math.min(...pool.map(a=>a.sv-B_SV+(((a.pace||0)-B_PACE)*days)),-200)*1.05;
          const gapMax=Math.max(...pool.map(a=>a.sv-B_SV),200)*1.05;
          const gRange=gapMax-gapMin;
          const yg=v=>mt+ch-((v-gapMin)/gRange)*ch;
          const gStep=gRange>5000?1000:gRange>2000?500:gRange>800?200:100;
          const gTicks=[];for(let v=Math.ceil(gapMin/gStep)*gStep;v<=gapMax;v+=gStep)gTicks.push(v);
          return(<g>
            {gTicks.map(v=>(<g key={v}>
              <line x1={ml} x2={ml+cw} y1={yg(v)} y2={yg(v)} stroke={v===0?"#E8B84B":"#1E3A5F"} strokeWidth={v===0?"1":"0.6"} strokeDasharray={v===0?"none":"4,6"} opacity={v===0?0.6:1}/>
              <text x={ml-6} y={yg(v)+4} textAnchor="end" fill={v===0?"#E8B84B":"#4A7090"} fontSize="12" fontWeight={v===0?"700":"400"}>{v>=1000?(v/1000).toFixed(1)+"k":v<=-1000?(v/1000).toFixed(1)+"k":v}</text>
            </g>))}
            {yg(0)>mt&&yg(0)<mt+ch&&<text x={ml+8} y={yg(0)-6} fill="#E8B84B" fontSize="11" fontWeight="700">BEAGLE</text>}
            <g clipPath="url(#cc)">
              {pool.map(a=>{
                const isActive=activatedTeams.has(a.name);
                const dimmed=hasActivated&&!isActive;
                const g0=a.sv-B_SV;
                const g1=(a.sv+(a.pace||0)*days)-(B_SV+B_PACE*days);
                const c=col(a);
                const crossX=g0!==g1?(-g0/(g1-g0)):null;
                const crossD=crossX!=null&&crossX>0&&crossX<1?crossX*days:null;
                const nameShort=a.name.length>15?a.name.slice(0,14)+'\u2026':a.name;
                const yEnd=yg(g1);
                const labelVisible=isActive&&yEnd>=mt&&yEnd<=mt+ch;
                return(<g key={a.name} opacity={dimmed?0.12:0.9}>
                  <line x1={xs(0)} y1={yg(g0)} x2={xs(days)} y2={yg(g1)} stroke="transparent" strokeWidth="20" style={{cursor:"pointer"}} onClick={()=>toggleActivate(a.name)}/>
                  <line x1={xs(0)} y1={yg(g0)} x2={xs(days)} y2={yg(g1)} stroke={c} strokeWidth={isActive?2.8:1.5} strokeLinecap="round"/>
                  {crossD&&<circle cx={xs(crossD)} cy={yg(0)} r="4" fill={c}/>}
                  {crossD&&<text x={xs(crossD)} y={yg(0)-10} textAnchor="middle" fill={c} fontSize="11" fontWeight="700">{fmtDate(new Date(Date.now()+crossD*86400000))}</text>}
                  {labelVisible&&<text x={xs(days)+5} y={yEnd+4} fill={c} fontSize="11" fontWeight="700">{nameShort}</text>}
                </g>);
              })}
            </g>
            <text x={ml-6} y={yg(0)+4} textAnchor="end" fill="#E8B84B" fontSize="12" fontWeight="700">0</text>
          </g>);
        })()}

        {/* RANK */}
        {chartMode==='RANK'&&(()=>{
          const yr=v=>mt+((v-1)/(20-1))*ch;
          return(<g>
            {[1,5,10,15,20].map(r=>(<g key={r}>
              <line x1={ml} x2={ml+cw} y1={yr(r)} y2={yr(r)} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
              <text x={ml-6} y={yr(r)+4} textAnchor="end" fill="#4A7090" fontSize="12">#{r}</text>
            </g>))}
            <g clipPath="url(#cc)">
              {[...pool,beagle].map(a=>{
                const isB=a.isBeagle;
                const isActive=activatedTeams.has(a.name);
                const dimmed=hasActivated&&!isActive&&!isB;
                const c=col(a);
                const snapDays=[0,days/4,days/2,(3*days)/4,days];
                const pts=snapDays.map(d=>{
                  const proj=projRanking(all,beagle,d);
                  const entry=proj.find(r=>r.name===a.name);
                  return{d,r:entry?.projRank??a.rank};
                });
                const pathD=pts.map((p,i)=>(i===0?'M':'L')+xs(p.d).toFixed(1)+','+yr(p.r).toFixed(1)).join(' ');
                const endPt=pts[pts.length-1];
                const labelVisible=(isActive||isB)&&yr(endPt.r)>=mt&&yr(endPt.r)<=mt+ch;
                const nameShort=a.name.length>12?a.name.slice(0,11)+'\u2026':a.name;
                return(<g key={a.name} onClick={()=>!isB&&toggleActivate(a.name)} style={{cursor:isB?"default":"pointer"}}>
                  <path d={pathD} stroke="transparent" strokeWidth="16" fill="none"/>
                  <path d={pathD} stroke={c} strokeWidth={isB?3.5:isActive?2.5:1} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={dimmed?0.1:isB?1:0.85} filter={isB?"url(#fg)":undefined}/>
                  {labelVisible&&<text x={xs(days)+5} y={yr(endPt.r)+4} fill={c} fontSize="11" fontWeight="700">{nameShort}</text>}
                </g>);
              })}
            </g>
          </g>);
        })()}

        <line x1={ml} y1={mt} x2={ml} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
        <line x1={ml} y1={mt+ch} x2={ml+cw} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
        <text x="10" y={mt+ch/2} textAnchor="middle" fill="#3A6080" fontSize="11" fontWeight="600" letterSpacing="0.8" transform={"rotate(-90,10,"+(mt+ch/2)+")"}>{chartMode==='SV'?'Share Value':chartMode==='GAP'?'SV Gap':'Rank'}</text>
        {zoomed&&<text x={ml+cw-4} y={mt+14} textAnchor="end" fill="#E8B84B" fontSize="12" fontWeight="700" opacity="0.7">{"x"+xZoom.toFixed(1)+" zoom"}</text>}
      </svg>
    </div>

    {/* RANKING PANEL */}
    {showRank&&ranking.length>0&&(<div style={{margin:"0 8px 4px",background:"#050D1A",border:"1px solid #0A1E30",borderTop:"2px solid #C4920A",borderRadius:4,padding:"8px 12px",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div>
          <span style={{fontSize:14,color:"#8AAABB",letterSpacing:1}}>PROJECTED RANKING AT </span>
          <span style={{fontSize:14,color:"#E8B84B",fontWeight:700,letterSpacing:1}}>{periodKey}</span>
          <span style={{fontSize:12,color:"#4A7090",marginLeft:10}}>\u2014 tap to toggle</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:14,color:"#8AAABB"}}>Beagle</span>
          <span style={{fontSize:16,fontWeight:700,color:"#E8B84B"}}>#{beagle.rank}</span>
          <span style={{fontSize:16,color:"#5A8AAB"}}>\u2192</span>
          <span style={{fontSize:18,fontWeight:700,color:rankChange>0?"#00E676":"#E8B84B"}}>#{beagleRank?.projRank}</span>
          {rankChange>0&&<span style={{fontSize:15,fontWeight:700,color:"#00E676"}}>\u25b2{rankChange}</span>}
          {rankChange<0&&<span style={{fontSize:15,fontWeight:700,color:"#E74C3C"}}>\u25bc{Math.abs(rankChange)}</span>}
          {selA&&!selA.isBeagle&&(()=>{
            const sp=ranking.find(r=>r.name===selA.name),sc=selA.rank-(sp?.projRank??selA.rank),c=col(selA);
            return(<span style={{display:"flex",alignItems:"center",gap:6,marginLeft:12,paddingLeft:12,borderLeft:"1px solid #162030"}}>
              <span style={{fontSize:12,color:c,fontWeight:600}}>{selA.name}</span>
              <span style={{fontSize:13,fontWeight:700,color:c}}>#{selA.rank}</span>
              <span style={{fontSize:13,color:"#5A8AAB"}}>\u2192</span>
              <span style={{fontSize:14,fontWeight:700,color:sc>0?"#00E676":sc<0?"#E74C3C":c}}>#{sp?.projRank}</span>
              {sc!==0&&<span style={{fontSize:12,fontWeight:700,color:sc>0?"#00E676":"#E74C3C"}}>{sc>0?"\u25b2"+sc:"\u25bc"+Math.abs(sc)}</span>}
            </span>);
          })()}
        </div>
      </div>
      <div style={{display:"flex",gap:16,width:"100%"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,color:"#8AAABB",fontWeight:600,letterSpacing:1,padding:"0 6px 4px",borderBottom:"1px solid #0A1E30",marginBottom:3}}>1 \u2014 10</div>
          {ranking.slice(0,10).map(renderRow)}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,color:"#8AAABB",fontWeight:600,letterSpacing:1,padding:"0 6px 4px",borderBottom:"1px solid #0A1E30",marginBottom:3}}>11 \u2014 20</div>
          {ranking.slice(10,20).map(renderRow)}
        </div>
      </div>
    </div>)}

    {/* DETAIL PANEL */}
    {selA&&!selA.isBeagle&&(<div style={{margin:"0 8px 8px",background:"#050D1A",border:"1px solid "+col(selA)+"30",borderLeft:"3px solid "+col(selA),borderRadius:4,padding:"12px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:"#E2EAF4"}}>#{selA.rank} {selA.name}</div>
          <div style={{fontSize:14,color:"#8AAABB",marginTop:3}}>{"SV $"+selA.sv.toLocaleString("en",{minimumFractionDigits:2})+"M \xb7 Pace "}{selA.pace?.toFixed(3)??"\u2014"}/day \xb7 Gap {selA.gap>0?"+":""}{selA.gap.toFixed(0)}M</div>
        </div>
        {selA.catchable?(<div style={{background:"#04120A",border:"1px solid "+col(selA),borderRadius:4,padding:"4px 10px",textAlign:"right"}}>
          <div style={{fontSize:11,color:col(selA),letterSpacing:1}}>BEAGLE OVERTAKES</div>
          <div style={{fontSize:14,fontWeight:700,color:col(selA)}}>{fmtDate(selA.overtakeDate)}</div>
          <div style={{fontSize:11,color:"#8AAABB"}}>in {Math.round(selA.daysTo)} days</div>
        </div>):selA.passed?(<div style={{background:"#1C0606",border:"1px solid #E74C3C",borderRadius:4,padding:"4px 10px",textAlign:"right"}}>
          <div style={{fontSize:11,color:"#E74C3C",letterSpacing:1}}>STATUS</div>
          <div style={{fontSize:14,fontWeight:700,color:"#E74C3C"}}>\u2713 OVERTAKEN</div>
        </div>):(<div style={{background:"#06101C",border:"1px solid #3A6090",borderRadius:4,padding:"4px 10px",textAlign:"right"}}>
          <div style={{fontSize:11,color:"#3A6090",letterSpacing:1}}>STATUS</div>
          <div style={{fontSize:13,fontWeight:700,color:"#3A6090"}}>PULLING AWAY</div>
        </div>)}
      </div>
      <div style={{display:"flex",gap:5,marginBottom:8}}>
        {detailProj.map(({mo,sv,rank})=>{const ahead=sv-(B_SV+B_PACE*MTD_MAP[mo]),c=ahead<=0?"#00E676":ahead<100?"#69F0AE":"#3A6090";return(<div key={mo} style={{flex:1,background:"#030B17",borderRadius:4,padding:"6px 5px",textAlign:"center",border:"1px solid #0A1E30"}}>
          <div style={{fontSize:11,color:"#8AAABB",fontWeight:600,letterSpacing:1,marginBottom:2}}>{mo}MO</div>
          <div style={{fontSize:13,fontWeight:700,color:"#C0CCD8"}}>{"$"+sv.toFixed(0)+"M"}</div>
          <div style={{fontSize:11,color:c,marginTop:2,fontWeight:600}}>{ahead<=0?"\u2713 BEHIND":"+$"+ahead.toFixed(0)+"M"}</div>
          <div style={{fontSize:11,color:"#5A8AAB",marginTop:1}}>Beagle #{rank}</div>
        </div>);})}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:20,borderTop:"1px solid #0A1E30",paddingTop:8,flexWrap:"wrap"}}>
        <div><div style={{fontSize:11,color:"#8AAABB",letterSpacing:1}}>DAILY CLOSURE</div><div style={{fontSize:13,fontWeight:700,color:selA.catchable?col(selA):"#3A6090"}}>{selA.closure!=null?(selA.closure>0?"+":"")+"$"+selA.closure.toFixed(3)+"M/day":"unknown"}</div></div>
        <div><div style={{fontSize:11,color:"#8AAABB",letterSpacing:1}}>THEIR PACE</div><div style={{fontSize:13,fontWeight:700,color:"#E2EAF4"}}>{selA.pace?.toFixed(3)??"\u2014"} $M/day</div></div>
        <div><div style={{fontSize:11,color:"#8AAABB",letterSpacing:1}}>BEAGLE PACE</div><div style={{fontSize:13,fontWeight:700,color:"#E8B84B"}}>{B_PACE.toFixed(3)} $M/day</div></div>
        <div style={{marginLeft:"auto",fontSize:13,fontWeight:700,color:selA.catchable?"#69F0AE":selA.passed?"#00E676":"#3A6090"}}>{selA.catchable?"\u2193 CONVERGING":selA.passed?"\u2713 CLEAR":"\u2191 DIVERGING"}</div>
      </div>
    </div>)}

  </div>);
}
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
</script>
</body>
</html>`;

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) logVisit(req);
  res.type('html').send(HTML);
});

app.listen(PORT, () => console.log(`Beagle Projections live on port ${PORT}`));

