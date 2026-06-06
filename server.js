// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE GLOBAL — ALLIANCE PROJECTIONS SERVICE
// Deploy as new Render web service: beagle-projections
// Start command: node server.js
// Env vars needed: PROJECTIONS_SECRET, PORT (auto-set by Render)
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = process.env.PORT || 3000;
const SECRET  = process.env.PROJECTIONS_SECRET || 'changeme';

app.use(cors());
app.use(express.json());

// ── DEFAULT DATA (Jun 2026 snapshot · 10-month recent paces) ───────────────
const DEFAULT_DATA = {
  timestamp:  '2026-06-06T10:45:00+08:00',
  uploader:   'atlas.4693',
  beagleSV:   2925.08,
  beaglePace: 4.627,
  beagleRank: 19,
  alliances: [
    { rank:1,  name:"Dokdo",            sv:8157.92, pace:null  },
    { rank:2,  name:"Valiant Air",      sv:7126.52, pace:7.134 },
    { rank:3,  name:"Free Flying",      sv:5544.02, pace:6.924 },
    { rank:4,  name:"Grizzly Group",    sv:5543.80, pace:4.218 },
    { rank:5,  name:"Per Aspera",       sv:5306.19, pace:5.277 },
    { rank:6,  name:"Indonesia Unity",  sv:4527.80, pace:3.802 },
    { rank:7,  name:"GERMAN ALLIANCE",  sv:4361.05, pace:3.947 },
    { rank:8,  name:"Happy Skies 2.0",  sv:3939.90, pace:3.918 },
    { rank:9,  name:"STARFLEET",        sv:3538.11, pace:3.219 },
    { rank:10, name:"Russian Wings",    sv:3513.81, pace:2.997 },
    { rank:11, name:"CODESHARE",        sv:3502.37, pace:3.641 },
    { rank:12, name:"SpaceX",           sv:3309.25, pace:4.310 },
    { rank:13, name:"ClearSky Group",   sv:3094.99, pace:2.783 },
    { rank:14, name:"JetSTAR",          sv:3083.44, pace:2.372 },
    { rank:15, name:"BRASIL GT",        sv:3045.63, pace:3.292 },
    { rank:16, name:"Mixer World",      sv:3045.00, pace:1.633 },
    { rank:17, name:"Sky Wings",        sv:3024.46, pace:3.725 },
    { rank:18, name:"Alpha Vikings",    sv:2962.65, pace:3.766 },
    { rank:20, name:"Star Alliance",    sv:2831.37, pace:3.413 },
  ]
};

let liveData = { ...DEFAULT_DATA };

// ── API ────────────────────────────────────────────────────────────────────
app.get('/api/data', (req, res) => res.json(liveData));

app.post('/api/update', (req, res) => {
  const { token, timestamp, uploader, beagleSV, beagleRank, alliances } = req.body;
  if (token !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
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

// ── CHART HTML (self-contained) ───────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1800"/>
<title>Beagle Global — Alliance Projections</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',Calibri,sans-serif;zoom:0.55}
button{font-family:inherit}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:#040C18}
::-webkit-scrollbar-thumb{background:#1E3A5F;border-radius:2px}
@media(max-width:768px){
  .rank-grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
  .stat-row{flex-wrap:wrap !important;gap:10px !important}
  .legend-row{display:none !important}
  .header-right{text-align:left !important}
}
@media(max-width:480px){
  .ctrl-btn{padding:4px 8px !important;font-size:12px !important}
}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useMemo}=React;
const MTD={1:30.4,3:91.3,6:182.6,12:365};

function getEmoji(p){
  if(p<3.5)return'😵';if(p<4.5)return'🥱';if(p<5)return'😎';
  if(p<5.5)return'🤗';if(p<6)return'😄';if(p<6.5)return'🤩';return'🏆';
}
function lineColor(a){
  if(a.isBeagle)return"#E8B84B";if(a.passed)return"#E74C3C";
  if(!a.catchable)return"#3A6090";if(a.daysTo<100)return"#00E676";
  if(a.daysTo<400)return"#69F0AE";if(a.daysTo<800)return"#F9A825";
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

  useEffect(()=>{
    fetch("/api/data").then(r=>r.json()).then(d=>{setApiData(d);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  const{all,beagle,B_SV,B_PACE}=useMemo(()=>{
    if(!apiData)return{all:[],beagle:{sv:0,pace:0,rank:19},B_SV:0,B_PACE:0};
    return buildAlliances(apiData);
  },[apiData]);

  const[winW,setWinW]=useState(typeof window!=='undefined'?window.innerWidth:1200);
  useEffect(()=>{
    const onResize=()=>setWinW(window.innerWidth);
    window.addEventListener('resize',onResize);
    return ()=>window.removeEventListener('resize',onResize);
  },[]);
  const isMobile=winW<768;
  const isTablet=winW<1024;

  const days=MTD[period];
  const CLOSE=all.filter(a=>!a.isBeagle&&(a.passed||a.gap<800));
  const FAR=all.filter(a=>!a.isBeagle&&!a.passed&&a.gap>=800);
  const pool=fullField?all.filter(a=>!a.isBeagle):CLOSE;
  const selA=selected?all.find(a=>a.name===selected):null;
  const ranking=useMemo(()=>all.length?projRanking(all,beagle,days):[], [all,beagle,days]);
  const beagleRank=ranking.find(a=>a.isBeagle);
  const rankChange=beagle.rank?(beagle.rank-(beagleRank?.projRank??beagle.rank)):0;

  const W=860,H=isMobile?240:320,ml=isMobile?58:70,mr=14,mt=24,mb=isMobile?34:40,cw=W-ml-mr,ch=H-mt-mb;
  const allAtEnd=[...pool,beagle].map(a=>a.sv+(a.pace||0)*days);
  // Y axis — clamp to alliances within 2500M of Beagle so far ones don't blow scale
  const _visPool=pool.filter(a=>Math.abs(a.gap)<2500);
  const _yMin=Math.min(...(_visPool.length?_visPool:[...pool]).map(a=>a.sv),B_SV)*0.97;
  const _yMax=Math.max(...(_visPool.length?_visPool:[...pool]).map(a=>a.sv+(a.pace||0)*days),B_SV+B_PACE*days)*1.03;
  const yMin=_yMin;
  const yMax=_yMax;
  const ys=v=>mt+ch-((v-yMin)/(yMax-yMin))*ch;
  const xs=d=>ml+(d/days)*cw;
  const yRange=yMax-yMin;
  const yStep=yRange>5000?1000:yRange>2000?500:yRange>800?200:100;
  const yTicks=[];
  for(let v=Math.ceil(yMin/yStep)*yStep;v<=yMax;v+=yStep)yTicks.push(v);
  const xTicks=Object.keys(MTD).map(Number).filter(p=>p<=period).map(p=>MTD[p]);
  const xLabels={30.4:"1MO",91.3:"3MO",182.6:"6MO",365:"12MO"};
  const getPath=a=>{const p0=a.sv,p1=a.sv+(a.pace||0)*days;return"M"+xs(0).toFixed(1)+","+ys(p0).toFixed(1)+" L"+xs(days).toFixed(1)+","+ys(p1).toFixed(1);};
  const crossDay=a=>{if(!a.catchable||a.gap<=0||!a.pace||!B_PACE)return null;const t=a.gap/(B_PACE-a.pace);return t>0&&t<=days?t:null;};
  const col=a=>lineColor(a);
  const detailProj=selA?[1,3,6,12].map(mo=>({mo,sv:selA.sv+(selA.pace||0)*MTD[mo],rank:projRanking(all,beagle,MTD[mo]).findIndex(a=>a.isBeagle)+1})):[];
  const bb={borderRadius:3,fontSize:16,fontWeight:700,cursor:"pointer",letterSpacing:1,fontFamily:"inherit",padding:"5px 12px"};
  const btn=active=>({...bb,background:active?"#C4920A":"transparent",border:"1px solid "+(active?"#C4920A":"#162030"),color:active?"#030B17":"#3A6080"});
  const btn2=active=>({...bb,background:active?"#1A3050":"transparent",border:"1px solid "+(active?"#4A80B0":"#162030"),color:active?"#E8B84B":"#3A6080"});

  if(loading)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16}}><div style={{fontSize:29,color:"#E8B84B"}}>◈</div><div style={{fontSize:19,color:"#2C4A68",letterSpacing:2}}>LOADING PROJECTIONS...</div></div>);

  const ts=apiData?.timestamp,uploader=apiData?.uploader;

  const renderRow=a=>{
    const isB=a.isBeagle,change=a.rank-(a.projRank??a.rank),c=isB?"#E8B84B":col(a);
    return(<div key={a.name} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 6px",background:isB?"#1A1000":"transparent",borderRadius:3,border:isB?"1px solid #C4920A30":"1px solid transparent"}}>
      <span style={{fontSize:14,fontWeight:700,color:a.noPace?"#3A6090":c,minWidth:22}}>#{a.projRank}</span>
      <span style={{fontSize:14,color:isB?c:a.noPace?"#2C4A68":"#8AAABB",flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.name}</span>
      <span style={{fontSize:13,fontWeight:600,minWidth:20,textAlign:"right",color:a.noPace?"#2C4A68":change>0?"#00E676":change<0?"#E74C3C":"#2C4A68"}}>{a.noPace?"?":change>0?"▲"+change:change<0?"▼"+Math.abs(change):isB?"★":"—"}</span>
    </div>);
  };

  return(<div style={{background:"#030B17",minHeight:"100vh",display:"flex",flexDirection:"column"}}>
    <div style={{background:"linear-gradient(90deg,#04101E,#0A1C32)",borderBottom:"2px solid #C4920A",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}>
      <div>
        <div style={{fontSize:20,fontWeight:700,color:"#E8B84B",letterSpacing:2}}>◈ BEAGLE GLOBAL — ALLIANCE PROJECTIONS</div>
        <div style={{fontSize:15,color:"#2C4A68",marginTop:2,letterSpacing:1}}>
          10-MO RECENT PACE · RANK #{beagle.rank}
          {ts&&<span style={{marginLeft:12,color:"#1E3A55"}}>UPDATED {fmtAWST(ts)}{uploader?" · "+uploader:""}</span>}
          {!ts&&<span style={{marginLeft:12,color:"#1E3A55"}}>DEFAULT DATA · UPLOAD TO REFRESH</span>}
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:22,fontWeight:700,color:"#E8B84B"}}>{"$"+B_SV.toLocaleString("en",{minimumFractionDigits:2})+"M"}</div>
        <div style={{fontSize:15,color:"#2C4A68",letterSpacing:1}}>{B_PACE.toFixed(3)} $M/DAY</div>
      </div>
    </div>

    <div style={{display:"flex",gap:6,padding:"7px 14px",background:"#040C18",borderBottom:"1px solid #0A1E30",alignItems:"center",flexWrap:"wrap"}}>
      <span style={{fontSize:15,color:"#1E3A55",letterSpacing:1,marginRight:4}}>PERIOD</span>
      {[1,3,6,12].map(p=><button key={p} onClick={()=>setPeriod(p)} style={btn(period===p)}>{p}MO</button>)}
      <div style={{width:1,height:20,background:"#162030",margin:"0 4px"}}/>
      <button onClick={()=>setFullField(f=>!f)} style={btn2(fullField)}>{fullField?"CLOSE PACK":"FULL FIELD"}</button>
      <button onClick={()=>setShowRank(r=>!r)} style={{...bb,background:showRank?"#0D2240":"transparent",border:"1px solid #162030",color:showRank?"#7FAACC":"#2C4A68"}}>{showRank?"HIDE RANKING":"SHOW RANKING"}</button>
      <div className="legend-row" style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        {[["#E8B84B","Beagle"],["#00E676","< 100d"],["#69F0AE","catching"],["#3A6090","away"],["#E74C3C","passed"]].map(([c,l])=>(
          <span key={l} style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:l==="Beagle"?20:16,height:l==="Beagle"?3:2,background:c,display:"inline-block",borderRadius:2}}/>
            <span style={{fontSize:13.5,color:"#2C4A68"}}>{l}</span>
          </span>
        ))}
      </div>
    </div>

    <div style={{padding:"2px 6px 0",height:"340px",overflow:"hidden",flexShrink:0}}>
      <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:"340px",display:"block"}}>
        <defs>
          <filter id="fg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="fl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <clipPath id="cc"><rect x={ml} y={mt} width={cw} height={ch}/></clipPath>
          <style>{"@keyframes pu{0%,100%{r:5;opacity:1}50%{r:9;opacity:0.4}} .pd{animation:pu 1.8s ease-in-out infinite}"}</style>
        </defs>
        <rect x={ml} y={mt} width={cw} height={ch} fill="#030810" rx="2"/>
        {yTicks.map(v=>(<g key={v}>
          <line x1={ml} x2={ml+cw} y1={ys(v)} y2={ys(v)} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
          <text x={ml-6} y={ys(v)+3.5} textAnchor="end" fill="#182838" fontSize="13.5">{v>=1000?(v/1000).toFixed(1)+"k":v}</text>
        </g>))}
        {xTicks.map(d=>(<g key={d}>
          <line x1={xs(d)} x2={xs(d)} y1={mt} y2={mt+ch} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
          <text x={xs(d)} y={mt+ch+14} textAnchor="middle" fill="#182838" fontSize="13" fontWeight="600">{xLabels[d]}</text>
        </g>))}
        <g clipPath="url(#cc)">
          {selected&&pool.filter(a=>a.name!==selected).map(a=>(<line key={a.name} x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(a.sv+(a.pace||0)*days)} stroke={col(a)} strokeWidth="0.5" opacity="0.1"/>))}
          {!selected&&pool.map(a=>{const cd=crossDay(a);return(<g key={a.name}>
            <line x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(a.sv+(a.pace||0)*days)} stroke={col(a)} strokeWidth="1.8" opacity="0.85" strokeLinecap="round" strokeDasharray={!a.catchable&&!a.passed?"4,3":"none"}/>
            {cd&&<circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="3" fill={col(a)} opacity="0.85"/>}
          </g>);})}
          {selA&&!selA.isBeagle&&(()=>{const c=col(selA),cd=crossDay(selA);return(<g>
            <line x1={xs(0)} y1={ys(selA.sv)} x2={xs(days)} y2={ys(selA.sv+(selA.pace||0)*days)} stroke={c} strokeWidth="7" opacity="0.12" strokeLinecap="round"/>
            <line x1={xs(0)} y1={ys(selA.sv)} x2={xs(days)} y2={ys(selA.sv+(selA.pace||0)*days)} stroke={c} strokeWidth="3.2" strokeLinecap="round" filter="url(#fl)"/>
            <circle cx={xs(0)} cy={ys(selA.sv)} r="4" fill={c} opacity="0.9"/>
            {cd&&(<g>
              <circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="8" fill="none" stroke={c} strokeWidth="1.5" className="pd" filter="url(#fl)"/>
              <circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="3.5" fill={c}/>
              <line x1={xs(cd)} x2={xs(cd)} y1={ys(B_SV+B_PACE*cd)-42} y2={ys(B_SV+B_PACE*cd)-14} stroke={c} strokeWidth="0.8" strokeDasharray="3,2" opacity="0.4"/>
              <rect x={xs(cd)-44} y={ys(B_SV+B_PACE*cd)-60} width={88} height={20} fill="#040C18" rx="3" stroke={c} strokeWidth="0.8"/>
              <text x={xs(cd)} y={ys(B_SV+B_PACE*cd)-46} textAnchor="middle" fill={c} fontSize="14.5" fontWeight="700">{fmtDate(selA.overtakeDate)}</text>
            </g>)}
          </g>);})()}
          <line x1={xs(0)} y1={ys(B_SV)} x2={xs(days)} y2={ys(B_SV+B_PACE*days)} stroke="#E8B84B" strokeWidth="10" opacity="0.15" strokeLinecap="round"/>
          <line x1={xs(0)} y1={ys(B_SV)} x2={xs(days)} y2={ys(B_SV+B_PACE*days)} stroke="#E8B84B" strokeWidth="3.5" strokeLinecap="round" filter="url(#fg)"/>
          <circle cx={xs(0)} cy={ys(B_SV)} r="5" fill="#E8B84B" filter="url(#fg)"/>
          <circle cx={xs(days)} cy={ys(B_SV+B_PACE*days)} r="4" fill="#E8B84B" opacity="0.7"/>
        </g>
        {pool.slice(0,12).map(a=>{if(selected&&a.name!==selected)return null;const isSel=selected===a.name;return(<text key={a.name} x={ml-6} y={ys(a.sv)+3.5} textAnchor="end" fill={col(a)} fontSize={isSel?"12":"10"} fontWeight={isSel?"700":"500"} opacity={isSel?1:0.7}>#{a.rank}</text>);})}
        <text x={ml-6} y={ys(B_SV)+3.5} textAnchor="end" fill="#E8B84B" fontSize="14" fontWeight="700">★{beagle.rank}</text>
        <line x1={ml} y1={mt} x2={ml} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
        <line x1={ml} y1={mt+ch} x2={ml+cw} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
        <text x="10" y={mt+ch/2} textAnchor="middle" fill="#162030" fontSize="12.5" fontWeight="600" letterSpacing="0.8" transform={"rotate(-90,10,"+(mt+ch/2)+")"}>SV ($M)</text>
      </svg>
    </div>

    {showRank&&ranking.length>0&&(<div style={{margin:"4px 10px",background:"#050D1A",border:"1px solid #0A1E30",borderTop:"2px solid #C4920A",borderRadius:4,padding:"10px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div>
          <span style={{fontSize:15,color:"#2C4A68",letterSpacing:1}}>PROJECTED RANKING AT </span>
          <span style={{fontSize:15,color:"#E8B84B",fontWeight:700,letterSpacing:1}}>{period} MONTH{period>1?"S":""}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:14,color:"#2C4A68"}}>Beagle</span>
          <span style={{fontSize:18,fontWeight:700,color:"#E8B84B"}}>#{beagle.rank}</span>
          <span style={{fontSize:19,color:"#2C4A68"}}>→</span>
          <span style={{fontSize:23,fontWeight:700,color:rankChange>0?"#00E676":"#E8B84B"}}>#{beagleRank?.projRank}</span>
          {rankChange>0&&<span style={{fontSize:16,fontWeight:700,color:"#00E676"}}>▲{rankChange}</span>}
          {rankChange<0&&<span style={{fontSize:16,fontWeight:700,color:"#E74C3C"}}>▼{Math.abs(rankChange)}</span>}
          {selA&&!selA.isBeagle&&(()=>{
            const sp=ranking.find(r=>r.name===selA.name),sc=selA.rank-(sp?.projRank??selA.rank),c=col(selA);
            return(<span style={{display:"flex",alignItems:"center",gap:6,marginLeft:12,paddingLeft:12,borderLeft:"1px solid #162030"}}>
              <span style={{fontSize:14,color:c,fontWeight:600}}>{selA.name}</span>
              <span style={{fontSize:18,fontWeight:700,color:c}}>#{selA.rank}</span>
              <span style={{fontSize:19,color:"#2C4A68"}}>→</span>
              <span style={{fontSize:21,fontWeight:700,color:sc>0?"#00E676":sc<0?"#E74C3C":c}}>#{sp?.projRank}</span>
              {sc!==0&&<span style={{fontSize:16,fontWeight:700,color:sc>0?"#00E676":"#E74C3C"}}>{sc>0?"▲"+sc:"▼"+Math.abs(sc)}</span>}
            </span>);
          })()}
        </div>
      </div>
      <div className="rank-grid" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:"0 14px"}}>
        <div><div style={{fontSize:13,color:"#182838",fontWeight:600,letterSpacing:1,padding:"0 6px 4px"}}>1 — 10</div>{ranking.slice(0,10).map(renderRow)}</div>
        <div><div style={{fontSize:13,color:"#182838",fontWeight:600,letterSpacing:1,padding:"0 6px 4px"}}>11 — 20</div>{ranking.slice(10,20).map(renderRow)}</div>
      </div>
    </div>)}

    {selA&&!selA.isBeagle&&(<div style={{margin:"4px 10px 4px",background:"#050D1A",border:"1px solid "+col(selA)+"30",borderLeft:"3px solid "+col(selA),borderRadius:4,padding:"10px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{fontSize:19,fontWeight:700,color:"#E2EAF4"}}>#{selA.rank} {selA.name}</div>
          <div style={{fontSize:15,color:"#2C4A68",marginTop:2}}>{"SV $"+selA.sv.toLocaleString("en",{minimumFractionDigits:2})+"M · Pace"} {selA.pace?.toFixed(3)??"—"}/day · Gap {selA.gap>0?"+":""}{selA.gap.toFixed(0)}M</div>
        </div>
        {selA.catchable?(<div style={{background:"#04120A",border:"1px solid "+col(selA),borderRadius:4,padding:"4px 10px",textAlign:"right"}}>
          <div style={{fontSize:14,color:col(selA),letterSpacing:1}}>BEAGLE OVERTAKES</div>
          <div style={{fontSize:18,fontWeight:700,color:col(selA)}}>{fmtDate(selA.overtakeDate)}</div>
          <div style={{fontSize:14,color:"#2C4A68"}}>in {Math.round(selA.daysTo)} days</div>
        </div>):selA.passed?(<div style={{background:"#1C0606",border:"1px solid #E74C3C",borderRadius:4,padding:"4px 10px",textAlign:"right"}}>
          <div style={{fontSize:14,color:"#E74C3C",letterSpacing:1}}>STATUS</div>
          <div style={{fontSize:18,fontWeight:700,color:"#E74C3C"}}>✓ OVERTAKEN</div>
        </div>):(<div style={{background:"#06101C",border:"1px solid #3A6090",borderRadius:4,padding:"4px 10px",textAlign:"right"}}>
          <div style={{fontSize:14,color:"#3A6090",letterSpacing:1}}>STATUS</div>
          <div style={{fontSize:17,fontWeight:700,color:"#3A6090"}}>PULLING AWAY</div>
        </div>)}
      </div>
      <div style={{display:"flex",gap:5,marginBottom:8}}>
        {detailProj.map(({mo,sv,rank})=>{const ahead=sv-(B_SV+B_PACE*MTD[mo]),c=ahead<=0?"#00E676":ahead<100?"#69F0AE":"#3A6090";return(<div key={mo} style={{flex:1,background:"#030B17",borderRadius:4,padding:"7px 5px",textAlign:"center",border:"1px solid #0A1E30"}}>
          <div style={{fontSize:14,color:"#182838",fontWeight:600,letterSpacing:1,marginBottom:3}}>{mo}MO</div>
          <div style={{fontSize:16,fontWeight:700,color:"#C0CCD8"}}>{"$"+sv.toFixed(0)+"M"}</div>
          <div style={{fontSize:13.5,color:c,marginTop:2,fontWeight:600}}>{ahead<=0?"✓ BEHIND":"+$"+ahead.toFixed(0)+"M ahead"}</div>
          <div style={{fontSize:13,color:"#182838",marginTop:1}}>Beagle #{rank}</div>
        </div>);})}
      </div>
      <div className="stat-row" style={{display:"flex",alignItems:"center",gap:20,borderTop:"1px solid #0A1E30",paddingTop:8,flexWrap:"wrap"}}>
        <div><div style={{fontSize:14,color:"#182838",letterSpacing:1}}>DAILY CLOSURE</div><div style={{fontSize:17,fontWeight:700,color:selA.catchable?col(selA):"#3A6090"}}>{selA.closure!=null?(selA.closure>0?"+":"")+"$"+selA.closure.toFixed(3)+"M/day":"unknown"}</div></div>
        <div><div style={{fontSize:14,color:"#182838",letterSpacing:1}}>THEIR PACE</div><div style={{fontSize:17,fontWeight:700,color:"#E2EAF4"}}>{selA.pace?.toFixed(3)??"—"} $M/day</div></div>
        <div><div style={{fontSize:14,color:"#182838",letterSpacing:1}}>BEAGLE PACE</div><div style={{fontSize:17,fontWeight:700,color:"#E8B84B"}}>{B_PACE.toFixed(3)} $M/day</div></div>
        <div style={{marginLeft:"auto",fontSize:16,fontWeight:700,color:selA.catchable?"#69F0AE":selA.passed?"#00E676":"#3A6090"}}>{selA.catchable?"↓ CONVERGING":selA.passed?"✓ CLEAR":"↑ DIVERGING"}</div>
      </div>
    </div>)}

    <div style={{padding:"5px 10px 16px",overflowY:"auto",maxHeight:500}}>
      <div style={{fontSize:14,color:"#162030",letterSpacing:1,marginBottom:6,paddingLeft:2}}>{fullField?"ALL ALLIANCES":"CLOSE PACK"}{!fullField&&<span style={{color:"#1E3A55"}}> · {FAR.length} far alliances hidden</span>}</div>
      {[...(fullField?[...CLOSE,...FAR]:CLOSE)].sort((a,b)=>a.rank-b.rank).map(a=>{
        const c=col(a),isSel=selected===a.name,projR=ranking.find(r=>r.name===a.name)?.projRank,rChg=a.rank-(projR??a.rank);
        return(<div key={a.name} onClick={()=>setSelected(isSel?null:a.name)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",marginBottom:4,background:isSel?c+"14":"#040C18",border:"1px solid "+(isSel?c:"#0A1E30"),borderLeft:"3px solid "+c,borderRadius:4,cursor:"pointer",transition:"all 0.12s"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16,fontWeight:700,color:c,minWidth:26}}>#{a.rank}</span>
            <span style={{fontSize:16,fontWeight:isSel?700:400,color:isSel?c:"#C0CCD8"}}>{a.name}</span>
            {a.passed&&<span style={{fontSize:14,color:"#00E676",fontWeight:700}}>✓</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14,fontSize:14}}>
            <span style={{color:"#2C4A68"}}>{"$"+a.sv.toFixed(0)+"M"}</span>
            <span style={{color:"#2C4A68"}}>{a.gap>0?"+":""}{a.gap.toFixed(0)}M</span>
            <span style={{color:c,fontWeight:600,minWidth:60,textAlign:"right"}}>{a.catchable?(a.daysTo<days?"⬆ "+fmtDate(a.overtakeDate):Math.round(a.daysTo)+"d"):a.passed?"✓ passed":"↑ away"}</span>
            {projR&&<span style={{color:rChg>0?"#00E676":rChg<0?"#E74C3C":"#2C4A68",fontWeight:700,minWidth:32,textAlign:"right"}}>→#{projR}{rChg>0?" ▲"+rChg:rChg<0?" ▼"+Math.abs(rChg):""}</span>}
          </div>
        </div>);
      })}
    </div>
  </div>);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
</script>
</body>
</html>`;

app.get('*', (req, res) => res.type('html').send(HTML));

app.listen(PORT, () => console.log(`Beagle Projections live on port ${PORT}`));


