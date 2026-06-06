// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE GLOBAL — ALLIANCE PROJECTIONS SERVICE — v19
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
  const { token, timestamp, uploader, beagleSV, beagleRank, alliances } = req.body;
  if (token !== SECRET && token !== N8N_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  const merged = (alliances || []).map(a => {
    const existing = liveData.alliances.find(e =>
      e.name.toLowerCase().trim() === a.name.toLowerCase().trim());
    return { rank: a.rank, name: a.name, sv: a.sv, pace: existing?.pace ?? null };
  });
  liveData = {
    timestamp, uploader,
    beagleSV:   beagleSV   ?? liveData.beagleSV,
    beaglePace: liveData.beaglePace,
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
<title>Beagle Global — Alliance Projections v19</title>
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
.svg-chart{cursor:grab;user-select:none}
.svg-chart.dragging{cursor:grabbing}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useMemo,useRef,useCallback}=React;
const MTD={1:30.4,3:91.3,6:182.6,12:365};

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
  return awst.getUTCDate()+" "+mo[awst.getUTCMonth()]+" "+awst.getUTCFullYear()+" · "+pad(awst.getUTCHours())+":"+pad(awst.getUTCMinutes())+" AWST";
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
  const[period,setPeriod]=useState(6);
  const[selected,setSelected]=useState(null);
  const[fullField,setFullField]=useState(false);
  const[showRank,setShowRank]=useState(true);

  // ── Zoom / Pan state ──
  const[yZoom,setYZoom]=useState(1);
  const[yPan,setYPan]=useState(0);   // in raw SV units, positive = pan up
  const isDragging=useRef(false);
  const dragStart=useRef({y:0,pan:0});
  const svgRef=useRef(null);

  useEffect(()=>{
    fetch("/api/data").then(r=>r.json()).then(d=>{setApiData(d);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  const{all,beagle,B_SV,B_PACE}=useMemo(()=>{
    if(!apiData)return{all:[],beagle:{sv:0,pace:0,rank:19},B_SV:0,B_PACE:0};
    return buildAlliances(apiData);
  },[apiData]);

  const days=MTD[period];
  const CLOSE=all.filter(a=>!a.isBeagle&&(a.passed||a.gap<800));
  const FAR=all.filter(a=>!a.isBeagle&&!a.passed&&a.gap>=800);
  const pool=fullField?all.filter(a=>!a.isBeagle):CLOSE;
  const selA=selected?all.find(a=>a.name===selected):null;
  const ranking=useMemo(()=>all.length?projRanking(all,beagle,days):[], [all,beagle,days]);
  const beagleRank=ranking.find(a=>a.isBeagle);
  const rankChange=beagle.rank?(beagle.rank-(beagleRank?.projRank??beagle.rank)):0;

  // ── Chart geometry ──
  const W=1200,H=300,ml=70,mr=10,mt=20,mb=44,cw=W-ml-mr,ch=H-mt-mb;

  // Base y range from data
  const _visPool=pool.filter(a=>Math.abs(a.gap)<2500);
  const _src=_visPool.length?_visPool:[...pool];
  const yMinBase=Math.min(..._src.map(a=>a.sv),B_SV)*0.97;
  const yMaxBase=Math.max(..._src.map(a=>a.sv+(a.pace||0)*days),B_SV+B_PACE*days)*1.03;
  const yRangeFull=yMaxBase-yMinBase;

  // Zoomed y range
  const yRangeZ=yRangeFull/yZoom;
  const yMidBase=(yMinBase+yMaxBase)/2;
  const yMidZ=yMidBase-yPan;
  const yMinZ=yMidZ-yRangeZ/2;
  const yMaxZ=yMidZ+yRangeZ/2;

  const ys=v=>mt+ch-((v-yMinZ)/(yMaxZ-yMinZ))*ch;
  const xs=d=>ml+(d/days)*cw;

  const yStep=yRangeFull>5000?1000:yRangeFull>2000?500:yRangeFull>800?200:100;
  const yTicks=[];
  for(let v=Math.ceil(yMinZ/yStep)*yStep;v<=yMaxZ;v+=yStep)yTicks.push(v);
  const xTicks=Object.keys(MTD).map(Number).filter(p=>p<=period).map(p=>MTD[p]);
  const xLabels={30.4:"1MO",91.3:"3MO",182.6:"6MO",365:"12MO"};

  const crossDay=a=>{
    if(!a.catchable||a.gap<=0||!a.pace||!B_PACE)return null;
    const t=a.gap/(B_PACE-a.pace);
    return t>0&&t<=days?t:null;
  };
  const col=a=>lineColor(a);

  // ── Wheel zoom (non-passive) ──
  useEffect(()=>{
    const svg=svgRef.current;
    if(!svg)return;
    const onWheel=e=>{
      e.preventDefault();
      const factor=e.deltaY<0?1.18:0.85;
      setYZoom(z=>Math.max(1,Math.min(25,z*factor)));
    };
    svg.addEventListener('wheel',onWheel,{passive:false});
    return()=>svg.removeEventListener('wheel',onWheel);
  },[]);

  // ── Drag pan ──
  const onMouseDown=useCallback(e=>{
    isDragging.current=true;
    dragStart.current={y:e.clientY,pan:yPan};
    svgRef.current?.classList.add('dragging');
  },[yPan]);

  const onMouseMove=useCallback(e=>{
    if(!isDragging.current)return;
    const dy=e.clientY-dragStart.current.y;
    const svgH=svgRef.current?.getBoundingClientRect().height||H;
    const panDelta=(dy/svgH)*yRangeZ;
    setYPan(dragStart.current.pan+panDelta);
  },[yRangeZ]);

  const onMouseUp=useCallback(()=>{
    isDragging.current=false;
    svgRef.current?.classList.remove('dragging');
  },[]);

  useEffect(()=>{
    window.addEventListener('mouseup',onMouseUp);
    window.addEventListener('mousemove',onMouseMove);
    return()=>{
      window.removeEventListener('mouseup',onMouseUp);
      window.removeEventListener('mousemove',onMouseMove);
    };
  },[onMouseMove,onMouseUp]);

  const resetZoom=()=>{setYZoom(1);setYPan(0);};

  const detailProj=selA?[1,3,6,12].map(mo=>({mo,sv:selA.sv+(selA.pace||0)*MTD[mo],rank:projRanking(all,beagle,MTD[mo]).findIndex(a=>a.isBeagle)+1})):[];

  const bb={borderRadius:3,fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:1,fontFamily:"inherit",padding:"5px 12px"};
  const btn=active=>({...bb,background:active?"#C4920A":"transparent",border:"1px solid "+(active?"#C4920A":"#162030"),color:active?"#030B17":"#6A9AB5"});
  const btn2=active=>({...bb,background:active?"#1A3050":"transparent",border:"1px solid "+(active?"#4A80B0":"#162030"),color:active?"#E8B84B":"#6A9AB5"});

  if(loading)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16}}><div style={{fontSize:35,color:"#E8B84B"}}>◈</div><div style={{fontSize:18,color:"#5A8AAB",letterSpacing:2}}>LOADING PROJECTIONS...</div></div>);

  const ts=apiData?.timestamp,uploader=apiData?.uploader;

  const renderRow=a=>{
    const isB=a.isBeagle,change=a.rank-(a.projRank??a.rank),c=isB?"#E8B84B":col(a);
    const isSel=selected===a.name;
    return(<div key={a.name}
      onClick={()=>!isB&&setSelected(isSel?null:a.name)}
      style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",
        background:isB?"#1A1000":isSel?c+"22":"transparent",
        borderRadius:3,
        border:isB?"1px solid #C4920A30":isSel?"1px solid "+c+"60":"1px solid transparent",
        cursor:isB?"default":"pointer",transition:"background 0.1s"}}>
      <span style={{fontSize:14,fontWeight:700,color:a.noPace?"#4A7090":c,minWidth:28}}>#{a.projRank}</span>
      <span style={{fontSize:14,color:isB?c:a.noPace?"#4A7090":"#C0CCD8",flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.name}</span>
      <span style={{fontSize:13,fontWeight:600,minWidth:20,textAlign:"right",color:a.noPace?"#4A7090":change>0?"#00E676":change<0?"#E74C3C":"#4A7090"}}>{a.noPace?"?":change>0?"▲"+change:change<0?"▼"+Math.abs(change):isB?"★":"—"}</span>
    </div>);
  };

  return(<div style={{background:"#030B17",minHeight:"100vh",display:"flex",flexDirection:"column"}}>

    {/* ── HEADER ── */}
    <div style={{background:"linear-gradient(90deg,#04101E,#0A1C32)",borderBottom:"2px solid #C4920A",padding:"10px 18px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}>
      <div>
        <div style={{fontSize:16,fontWeight:700,color:"#E8B84B",letterSpacing:2}}>◈ BEAGLE GLOBAL — ALLIANCE PROJECTIONS</div>
        <div style={{fontSize:12,color:"#8AAABB",marginTop:2,letterSpacing:1}}>
          10-MO RECENT PACE · RANK #{beagle.rank}
          {ts&&<span style={{marginLeft:12,color:"#5A8AAB"}}>UPDATED {fmtAWST(ts)}{uploader?" · "+uploader:""}</span>}
          {!ts&&<span style={{marginLeft:12,color:"#5A8AAB"}}>DEFAULT DATA · UPLOAD TO REFRESH</span>}
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:18,fontWeight:700,color:"#E8B84B"}}>{"$"+B_SV.toLocaleString("en",{minimumFractionDigits:2})+"M"}</div>
        <div style={{fontSize:12,color:"#8AAABB",letterSpacing:1}}>{B_PACE.toFixed(3)} $M/DAY</div>
      </div>
    </div>

    {/* ── CONTROLS ── */}
    <div style={{display:"flex",gap:5,padding:"7px 18px",background:"#040C18",borderBottom:"1px solid #0A1E30",alignItems:"center",flexWrap:"wrap"}}>
      <span style={{fontSize:11,color:"#6A9AB5",letterSpacing:1,marginRight:4}}>PERIOD</span>
      {[1,3,6,12].map(p=><button key={p} onClick={()=>setPeriod(p)} style={btn(period===p)}>{p}MO</button>)}
      <div style={{width:1,height:18,background:"#162030",margin:"0 4px"}}/>
      <button onClick={()=>setFullField(f=>!f)} style={btn2(fullField)}>{fullField?"CLOSE PACK":"FULL FIELD"}</button>
      <button onClick={()=>setShowRank(r=>!r)} style={{...bb,background:showRank?"#0D2240":"transparent",border:"1px solid #162030",color:showRank?"#7FAACC":"#4A7090"}}>{showRank?"HIDE RANKING":"SHOW RANKING"}</button>
      {yZoom>1&&<button onClick={resetZoom} style={{...bb,background:"#1A0A00",border:"1px solid #C4920A60",color:"#E8B84B",fontSize:12}}>RESET ZOOM ×{yZoom.toFixed(1)}</button>}
      <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:"#4A7090",marginRight:4}}>scroll=zoom · drag=pan</span>
        {[["#E8B84B","Beagle"],["#00E676","< 100d"],["#69F0AE","catching"],["#3A6090","away"],["#E74C3C","passed"]].map(([c,l])=>(
          <span key={l} style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:l==="Beagle"?20:16,height:l==="Beagle"?3:2,background:c,display:"inline-block",borderRadius:2}}/>
            <span style={{fontSize:11,color:"#8AAABB"}}>{l}</span>
          </span>
        ))}
      </div>
    </div>

    {/* ── CHART ── */}
    <div style={{padding:"4px 6px 10px",flexShrink:0}}>
      <svg
        ref={svgRef}
        className="svg-chart"
        viewBox={"0 0 "+W+" "+H}
        style={{width:"100%",maxHeight:"42vh",display:"block"}}
        onMouseDown={onMouseDown}
      >
        <defs>
          <filter id="fg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="fl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <clipPath id="cc"><rect x={ml} y={mt} width={cw} height={ch}/></clipPath>
          <style>{"@keyframes pu{0%,100%{r:5;opacity:1}50%{r:9;opacity:0.4}} .pd{animation:pu 1.8s ease-in-out infinite}"}</style>
        </defs>
        <rect x={ml} y={mt} width={cw} height={ch} fill="#030810" rx="2"/>

        {/* Y grid + labels */}
        {yTicks.map(v=>(<g key={v}>
          <line x1={ml} x2={ml+cw} y1={ys(v)} y2={ys(v)} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
          <text x={ml-6} y={ys(v)+3.5} textAnchor="end" fill="#4A7090" fontSize="14">{v>=1000?(v/1000).toFixed(1)+"k":v}</text>
        </g>))}

        {/* X grid + labels */}
        {xTicks.map(d=>(<g key={d}>
          <line x1={xs(d)} x2={xs(d)} y1={mt} y2={mt+ch} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
          <text x={xs(d)} y={mt+ch+18} textAnchor="middle" fill="#4A7090" fontSize="14" fontWeight="600">{xLabels[d]}</text>
        </g>))}

        <g clipPath="url(#cc)">
          {/* Dimmed lines when something selected */}
          {selected&&pool.filter(a=>a.name!==selected).map(a=>(
            <line key={a.name} x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(a.sv+(a.pace||0)*days)} stroke={col(a)} strokeWidth="0.5" opacity="0.1"/>
          ))}

          {/* Normal lines */}
          {!selected&&pool.map(a=>{
            const cd=crossDay(a);
            return(<g key={a.name}>
              <line x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(a.sv+(a.pace||0)*days)} stroke={col(a)} strokeWidth="1.8" opacity="0.85" strokeLinecap="round" strokeDasharray={!a.catchable&&!a.passed?"4,3":"none"}/>
              {cd&&<circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="3" fill={col(a)} opacity="0.85"/>}
            </g>);
          })}

          {/* Selected alliance highlight */}
          {selA&&!selA.isBeagle&&(()=>{
            const c=col(selA),cd=crossDay(selA);
            return(<g>
              <line x1={xs(0)} y1={ys(selA.sv)} x2={xs(days)} y2={ys(selA.sv+(selA.pace||0)*days)} stroke={c} strokeWidth="7" opacity="0.12" strokeLinecap="round"/>
              <line x1={xs(0)} y1={ys(selA.sv)} x2={xs(days)} y2={ys(selA.sv+(selA.pace||0)*days)} stroke={c} strokeWidth="3.2" strokeLinecap="round" filter="url(#fl)"/>
              <circle cx={xs(0)} cy={ys(selA.sv)} r="4" fill={c} opacity="0.9"/>
              {cd&&(<g>
                <circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="8" fill="none" stroke={c} strokeWidth="1.5" className="pd" filter="url(#fl)"/>
                <circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="3.5" fill={c}/>
                <line x1={xs(cd)} x2={xs(cd)} y1={ys(B_SV+B_PACE*cd)-42} y2={ys(B_SV+B_PACE*cd)-14} stroke={c} strokeWidth="0.8" strokeDasharray="3,2" opacity="0.4"/>
                <rect x={xs(cd)-44} y={ys(B_SV+B_PACE*cd)-62} width={88} height={22} fill="#040C18" rx="3" stroke={c} strokeWidth="0.8"/>
                <text x={xs(cd)} y={ys(B_SV+B_PACE*cd)-47} textAnchor="middle" fill={c} fontSize="14" fontWeight="700">{fmtDate(selA.overtakeDate)}</text>
              </g>)}
            </g>);
          })()}

          {/* Beagle line */}
          <line x1={xs(0)} y1={ys(B_SV)} x2={xs(days)} y2={ys(B_SV+B_PACE*days)} stroke="#E8B84B" strokeWidth="10" opacity="0.15" strokeLinecap="round"/>
          <line x1={xs(0)} y1={ys(B_SV)} x2={xs(days)} y2={ys(B_SV+B_PACE*days)} stroke="#E8B84B" strokeWidth="3.5" strokeLinecap="round" filter="url(#fg)"/>
          <circle cx={xs(0)} cy={ys(B_SV)} r="5" fill="#E8B84B" filter="url(#fg)"/>
          <circle cx={xs(days)} cy={ys(B_SV+B_PACE*days)} r="4" fill="#E8B84B" opacity="0.7"/>
        </g>

        {/* Beagle rank label */}
        <text x={ml-6} y={ys(B_SV)+3.5} textAnchor="end" fill="#E8B84B" fontSize="13" fontWeight="700">★{beagle.rank}</text>

        {/* Axes */}
        <line x1={ml} y1={mt} x2={ml} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
        <line x1={ml} y1={mt+ch} x2={ml+cw} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
        <text x="10" y={mt+ch/2} textAnchor="middle" fill="#3A6080" fontSize="12" fontWeight="600" letterSpacing="0.8" transform={"rotate(-90,10,"+(mt+ch/2)+")"}>SV ($M)</text>

        {/* Zoom indicator */}
        {yZoom>1&&<text x={ml+cw-4} y={mt+14} textAnchor="end" fill="#E8B84B" fontSize="13" fontWeight="700" opacity="0.7">{"×"+yZoom.toFixed(1)+" zoom"}</text>}
      </svg>
    </div>

    {/* ── RANKING PANEL ── */}
    {showRank&&ranking.length>0&&(<div style={{margin:"0 10px 4px",background:"#050D1A",border:"1px solid #0A1E30",borderTop:"2px solid #C4920A",borderRadius:4,padding:"10px 14px",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div>
          <span style={{fontSize:12,color:"#8AAABB",letterSpacing:1}}>PROJECTED RANKING AT </span>
          <span style={{fontSize:12,color:"#E8B84B",fontWeight:700,letterSpacing:1}}>{period} MONTH{period>1?"S":""}</span>
          <span style={{fontSize:11,color:"#4A7090",marginLeft:10}}>— click any row to inspect</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#8AAABB"}}>Beagle</span>
          <span style={{fontSize:14,fontWeight:700,color:"#E8B84B"}}>#{beagle.rank}</span>
          <span style={{fontSize:14,color:"#5A8AAB"}}>→</span>
          <span style={{fontSize:16,fontWeight:700,color:rankChange>0?"#00E676":"#E8B84B"}}>#{beagleRank?.projRank}</span>
          {rankChange>0&&<span style={{fontSize:13,fontWeight:700,color:"#00E676"}}>▲{rankChange}</span>}
          {rankChange<0&&<span style={{fontSize:13,fontWeight:700,color:"#E74C3C"}}>▼{Math.abs(rankChange)}</span>}
          {selA&&!selA.isBeagle&&(()=>{
            const sp=ranking.find(r=>r.name===selA.name),sc=selA.rank-(sp?.projRank??selA.rank),c=col(selA);
            return(<span style={{display:"flex",alignItems:"center",gap:6,marginLeft:12,paddingLeft:12,borderLeft:"1px solid #162030"}}>
              <span style={{fontSize:12,color:c,fontWeight:600}}>{selA.name}</span>
              <span style={{fontSize:14,fontWeight:700,color:c}}>#{selA.rank}</span>
              <span style={{fontSize:14,color:"#5A8AAB"}}>→</span>
              <span style={{fontSize:15,fontWeight:700,color:sc>0?"#00E676":sc<0?"#E74C3C":c}}>#{sp?.projRank}</span>
              {sc!==0&&<span style={{fontSize:13,fontWeight:700,color:sc>0?"#00E676":"#E74C3C"}}>{sc>0?"▲"+sc:"▼"+Math.abs(sc)}</span>}
            </span>);
          })()}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:"0 20px"}}>
        <div>
          <div style={{fontSize:11,color:"#8AAABB",fontWeight:600,letterSpacing:1,padding:"0 6px 4px",borderBottom:"1px solid #0A1E30",marginBottom:2}}>1 — 10</div>
          {ranking.slice(0,10).map(renderRow)}
        </div>
        <div>
          <div style={{fontSize:11,color:"#8AAABB",fontWeight:600,letterSpacing:1,padding:"0 6px 4px",borderBottom:"1px solid #0A1E30",marginBottom:2}}>11 — 20</div>
          {ranking.slice(10,20).map(renderRow)}
        </div>
      </div>
    </div>)}

    {/* ── DETAIL PANEL ── */}
    {selA&&!selA.isBeagle&&(<div style={{margin:"0 10px 10px",background:"#050D1A",border:"1px solid "+col(selA)+"30",borderLeft:"3px solid "+col(selA),borderRadius:4,padding:"12px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:"#E2EAF4"}}>#{selA.rank} {selA.name}</div>
          <div style={{fontSize:12,color:"#8AAABB",marginTop:2}}>{"SV $"+selA.sv.toLocaleString("en",{minimumFractionDigits:2})+"M · Pace "}{selA.pace?.toFixed(3)??"—"}/day · Gap {selA.gap>0?"+":""}{selA.gap.toFixed(0)}M</div>
        </div>
        {selA.catchable?(<div style={{background:"#04120A",border:"1px solid "+col(selA),borderRadius:4,padding:"4px 10px",textAlign:"right"}}>
          <div style={{fontSize:11,color:col(selA),letterSpacing:1}}>BEAGLE OVERTAKES</div>
          <div style={{fontSize:14,fontWeight:700,color:col(selA)}}>{fmtDate(selA.overtakeDate)}</div>
          <div style={{fontSize:11,color:"#8AAABB"}}>in {Math.round(selA.daysTo)} days</div>
        </div>):selA.passed?(<div style={{background:"#1C0606",border:"1px solid #E74C3C",borderRadius:4,padding:"4px 10px",textAlign:"right"}}>
          <div style={{fontSize:11,color:"#E74C3C",letterSpacing:1}}>STATUS</div>
          <div style={{fontSize:14,fontWeight:700,color:"#E74C3C"}}>✓ OVERTAKEN</div>
        </div>):(<div style={{background:"#06101C",border:"1px solid #3A6090",borderRadius:4,padding:"4px 10px",textAlign:"right"}}>
          <div style={{fontSize:11,color:"#3A6090",letterSpacing:1}}>STATUS</div>
          <div style={{fontSize:13,fontWeight:700,color:"#3A6090"}}>PULLING AWAY</div>
        </div>)}
      </div>
      <div style={{display:"flex",gap:5,marginBottom:8}}>
        {detailProj.map(({mo,sv,rank})=>{const ahead=sv-(B_SV+B_PACE*MTD[mo]),c=ahead<=0?"#00E676":ahead<100?"#69F0AE":"#3A6090";return(<div key={mo} style={{flex:1,background:"#030B17",borderRadius:4,padding:"6px 5px",textAlign:"center",border:"1px solid #0A1E30"}}>
          <div style={{fontSize:11,color:"#8AAABB",fontWeight:600,letterSpacing:1,marginBottom:2}}>{mo}MO</div>
          <div style={{fontSize:13,fontWeight:700,color:"#C0CCD8"}}>{"$"+sv.toFixed(0)+"M"}</div>
          <div style={{fontSize:11,color:c,marginTop:2,fontWeight:600}}>{ahead<=0?"✓ BEHIND":"+$"+ahead.toFixed(0)+"M"}</div>
          <div style={{fontSize:11,color:"#5A8AAB",marginTop:1}}>Beagle #{rank}</div>
        </div>);})}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:20,borderTop:"1px solid #0A1E30",paddingTop:8,flexWrap:"wrap"}}>
        <div><div style={{fontSize:11,color:"#8AAABB",letterSpacing:1}}>DAILY CLOSURE</div><div style={{fontSize:13,fontWeight:700,color:selA.catchable?col(selA):"#3A6090"}}>{selA.closure!=null?(selA.closure>0?"+":"")+"$"+selA.closure.toFixed(3)+"M/day":"unknown"}</div></div>
        <div><div style={{fontSize:11,color:"#8AAABB",letterSpacing:1}}>THEIR PACE</div><div style={{fontSize:13,fontWeight:700,color:"#E2EAF4"}}>{selA.pace?.toFixed(3)??"—"} $M/day</div></div>
        <div><div style={{fontSize:11,color:"#8AAABB",letterSpacing:1}}>BEAGLE PACE</div><div style={{fontSize:13,fontWeight:700,color:"#E8B84B"}}>{B_PACE.toFixed(3)} $M/day</div></div>
        <div style={{marginLeft:"auto",fontSize:13,fontWeight:700,color:selA.catchable?"#69F0AE":selA.passed?"#00E676":"#3A6090"}}>{selA.catchable?"↓ CONVERGING":selA.passed?"✓ CLEAR":"↑ DIVERGING"}</div>
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


