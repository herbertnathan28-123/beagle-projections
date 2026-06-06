// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE GLOBAL — ALLIANCE PROJECTIONS SERVICE
// Deploy as new Render web service: beagle-projections
// Start command: node server.js
// Env vars needed: PROJECTIONS_SECRET, PORT (auto-set by Render)
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.PROJECTIONS_SECRET || 'changeme';
app.use(cors());
app.use(express.json());
// ── DEFAULT DATA (Jun 2026 snapshot · 10-month recent paces) ───────────────
const DEFAULT_DATA = {
timestamp: '2026-06-06T10:45:00+08:00',
uploader: 'atlas.4693',
beagleSV: 2925.08,
beaglePace: 4.627,
beagleRank: 19,
alliances: [
{ rank:1, name:"Dokdo", sv:8157.92, pace:null },
{ rank:2, name:"Valiant Air", sv:7126.52, pace:7.134 },
{ rank:3, name:"Free Flying", sv:5544.02, pace:6.924 },
{ rank:4, name:"Grizzly Group", sv:5543.80, pace:4.218 },
{ rank:5, name:"Per Aspera", sv:5306.19, pace:5.277 },
{ rank:6, name:"Indonesia Unity", sv:4527.80, pace:3.802 },
{ rank:7, name:"GERMAN ALLIANCE", sv:4361.05, pace:3.947 },
{ rank:8, name:"Happy Skies 2.0", sv:3939.90, pace:3.918 },
{ rank:9, name:"STARFLEET", sv:3538.11, pace:3.219 },
{ rank:10, name:"Russian Wings", sv:3513.81, pace:2.997 },
{ rank:11, name:"CODESHARE", sv:3502.37, pace:3.641 },
{ rank:12, name:"SpaceX", sv:3309.25, pace:4.310 },
{ rank:13, name:"ClearSky Group", sv:3094.99, pace:2.783 },
{ rank:14, name:"JetSTAR", sv:3083.44, pace:2.372 },
{ rank:15, name:"BRASIL GT", sv:3045.63, pace:3.292 },
{ rank:16, name:"Mixer World", sv:3045.00, pace:1.633 },
{ rank:17, name:"Sky Wings", sv:3024.46, pace:3.725 },
{ rank:18, name:"Alpha Vikings", sv:2962.65, pace:3.766 },
{ rank:20, name:"Star Alliance", sv:2831.37, pace:3.413 },
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
beagleSV: beagleSV ?? liveData.beagleSV,
beaglePace: liveData.beaglePace,
beagleRank: beagleRank ?? liveData.beagleRank,
alliances: merged.length ? merged : liveData.alliances,
};
console.log(`[${new Date().toISOString()}] Updated by ${uploader}`);
res.json({ ok: true });
});
// ── CHART HTML (self-contained) ───────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1400"/>
<title>Beagle Global — Alliance Projections</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></s
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',Calibri,sans-serif;zoom:0.75}
button{font-family:inherit}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:#040C18}
::-webkit-scrollbar-thumb{background:#1E3A5F;border-radius:2px}
@media(max-width:768px){
.rank-grid{grid-template-columns:1fr !important}
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
if(p<3.5)return' ';if(p<4.5)return' ';if(p<5)return' ';
if(p<5.5)return' ';if(p<6)return' ';if(p<6.5)return' ';return' ';
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
return awst.getUTCDate()+" "+mo[awst.getUTCMonth()]+" "+awst.getUTCFullYear()+" · "+pad(aws
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
const unknown=all.filter(a=>a.pace==null&&!a.isBeagle).map(a=>({...a,pSV:null,noPace:true})
const bp={...beagle,pSV:beagle.sv+beagle.pace*days};
const sorted=[...known,bp].sort((a,b)=>b.pSV-a.pSV);
const result=[...sorted];
unknown.forEach(u=>{const at=Math.min(u.rank-1,result.length);result.splice(at,0,{...u,proj
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
},[]);
fetch("/api/data").then(r=>r.json()).then(d=>{setApiData(d);setLoading(false);}).catch(()
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
const W=860,H=isMobile?240:320,ml=isMobile?58:70,mr=14,mt=24,mb=isMobile?34:40,cw=W-ml-mr,c
const allAtEnd=[...pool,beagle].map(a=>a.sv+(a.pace||0)*days);
// Y axis — clamp to alliances within 2500M of Beagle so far ones don't blow scale
const _visPool=pool.filter(a=>Math.abs(a.gap)<2500);
const _yMin=Math.min(...(_visPool.length?_visPool:[...pool]).map(a=>a.sv),B_SV)*0.97;
const _yMax=Math.max(...(_visPool.length?_visPool:[...pool]).map(a=>a.sv+(a.pace||0)*days),
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
const getPath=a=>{const p0=a.sv,p1=a.sv+(a.pace||0)*days;return"M"+xs(0).toFixed(1)+","+ys(
const crossDay=a=>{if(!a.catchable||a.gap<=0||!a.pace||!B_PACE)return null;const t=a.gap/(B
const col=a=>lineColor(a);
const detailProj=selA?[1,3,6,12].map(mo=>({mo,sv:selA.sv+(selA.pace||0)*MTD[mo],rank:projRa
const bb={borderRadius:3,fontSize:16,fontWeight:700,cursor:"pointer",letterSpacing:1,fontFa
const btn=active=>({...bb,background:active?"#C4920A":"transparent",border:"1px solid "+(ac
const btn2=active=>({...bb,background:active?"#1A3050":"transparent",border:"1px solid "+(a
if(loading)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",h
const ts=apiData?.timestamp,uploader=apiData?.uploader;
const renderRow=a=>{
const isB=a.isBeagle,change=a.rank-(a.projRank??a.rank),c=isB?"#E8B84B":col(a);
return(<div key={a.name} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 6p
<span style={{fontSize:14,fontWeight:700,color:a.noPace?"#3A6090":c,minWidth:22}}>#{a.p
<span style={{fontSize:14,color:isB?c:a.noPace?"#2C4A68":"#8AAABB",flex:1,whiteSpace:"n
<span style={{fontSize:13,fontWeight:600,minWidth:20,textAlign:"right",color:a.noPace?"
</div>);
};
solid
return(<div style={{background:"#030B17",minHeight:"100vh",display:"flex",flexDirection:"co
<div style={{background:"linear-gradient(90deg,#04101E,#0A1C32)",borderBottom:"2px <div>
<div style={{fontSize:20,fontWeight:700,color:"#E8B84B",letterSpacing:2}}>◈ BEAGLE GL
<div style={{fontSize:15,color:"#2C4A68",marginTop:2,letterSpacing:1}}>
10-MO RECENT PACE · RANK #{beagle.rank}
{ts&&<span style={{marginLeft:12,color:"#1E3A55"}}>UPDATED {fmtAWST(ts)}{uploader?"
{!ts&&<span style={{marginLeft:12,color:"#1E3A55"}}>DEFAULT DATA · UPLOAD TO REFRES
</div>
</div>
<div style={{textAlign:"right"}}>
<div style={{fontSize:22,fontWeight:700,color:"#E8B84B"}}>{"$"+B_SV.toLocaleString("e
<div style={{fontSize:15,color:"#2C4A68",letterSpacing:1}}>{B_PACE.toFixed(3)} $M/DAY
</div>
</div>
<div style={{display:"flex",gap:6,padding:"7px 14px",background:"#040C18",borderBottom:"1
<span style={{fontSize:15,color:"#1E3A55",letterSpacing:1,marginRight:4}}>PERIOD</span>
{[1,3,6,12].map(p=><button key={p} onClick={()=>setPeriod(p)} style={btn(period===p)}>{
<div style={{width:1,height:20,background:"#162030",margin:"0 4px"}}/>
<button onClick={()=>setFullField(f=>!f)} style={btn2(fullField)}>{fullField?"CLOSE PAC
<button onClick={()=>setShowRank(r=>!r)} style={{...bb,background:showRank?"#0D2240":"t
<div className="legend-row" style={{marginLeft:"auto",display:"flex",gap:10,alignItems:
{[["#E8B84B","Beagle"],["#00E676","< 100d"],["#69F0AE","catching"],["#3A6090","away"]
<span key={l} style={{display:"flex",alignItems:"center",gap:4}}>
<span style={{width:l==="Beagle"?20:16,height:l==="Beagle"?3:2,background:c,displ
<span style={{fontSize:13.5,color:"#2C4A68"}}>{l}</span>
</span>
))}
</div>
</div>
<div style={{padding:"2px 6px 0",height:"340px",overflow:"hidden",flexShrink:0}}>
<svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:"340px",display:"block"}}>
<defs>
<filter id="fg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode
<filter id="fl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode
<clipPath id="cc"><rect x={ml} y={mt} width={cw} height={ch}/></clipPath>
<style>{"@keyframes pu{0%,100%{r:5;opacity:1}50%{r:9;opacity:0.4}} .pd{animation:pu
</defs>
<rect x={ml} y={mt} width={cw} height={ch} fill="#030810" rx="2"/>
{yTicks.map(v=>(<g key={v}>
<line x1={ml} x2={ml+cw} y1={ys(v)} y2={ys(v)} stroke="#1E3A5F" strokeWidth="0.6" s
<text x={ml-6} y={ys(v)+3.5} textAnchor="end" fill="#182838" fontSize="13.5">{v>=10
</g>))}
{xTicks.map(d=>(<g key={d}>
<line x1={xs(d)} x2={xs(d)} y1={mt} y2={mt+ch} stroke="#1E3A5F" strokeWidth="0.6" s
<text x={xs(d)} y={mt+ch+14} textAnchor="middle" fill="#182838" fontSize="13" fontW
</g>))}
<g clipPath="url(#cc)">
{selected&&pool.filter(a=>a.name!==selected).map(a=>(<line key={a.name} x1={xs(0)}
{!selected&&pool.map(a=>{const cd=crossDay(a);return(<g key={a.name}>
<line x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(a.sv+(a.pace||0)*days)} strok
{cd&&<circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="3" fill={col(a)} opacity="0.8
</g>);})}
{selA&&!selA.isBeagle&&(()=>{const c=col(selA),cd=crossDay(selA);return(<g>
<line x1={xs(0)} y1={ys(selA.sv)} x2={xs(days)} y2={ys(selA.sv+(selA.pace||0)*day
<line x1={xs(0)} y1={ys(selA.sv)} x2={xs(days)} y2={ys(selA.sv+(selA.pace||0)*day
<circle cx={xs(0)} cy={ys(selA.sv)} r="4" fill={c} opacity="0.9"/>
{cd&&(<g>
stroke
<circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="8" fill="none" stroke={c} <circle cx={xs(cd)} cy={ys(B_SV+B_PACE*cd)} r="3.5" fill={c}/>
<line x1={xs(cd)} x2={xs(cd)} y1={ys(B_SV+B_PACE*cd)-42} y2={ys(B_SV+B_PACE*cd)
<rect x={xs(cd)-44} y={ys(B_SV+B_PACE*cd)-60} width={88} height={20} fill="#040
<text x={xs(cd)} y={ys(B_SV+B_PACE*cd)-46} textAnchor="middle" fill={c} fontSiz
</g>)}
</g>);})()}
<line x1={xs(0)} y1={ys(B_SV)} x2={xs(days)} y2={ys(B_SV+B_PACE*days)} stroke="#E8B
<line x1={xs(0)} y1={ys(B_SV)} x2={xs(days)} y2={ys(B_SV+B_PACE*days)} stroke="#E8B
<circle cx={xs(0)} cy={ys(B_SV)} r="5" fill="#E8B84B" filter="url(#fg)"/>
<circle cx={xs(days)} cy={ys(B_SV+B_PACE*days)} r="4" fill="#E8B84B" opacity="0.7"/
</g>
{pool.slice(0,12).map(a=>{if(selected&&a.name!==selected)return null;const isSel=sele
<text x={ml-6} y={ys(B_SV)+3.5} textAnchor="end" fill="#E8B84B" fontSize="14" fontWei
<line x1={ml} y1={mt} x2={ml} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
<line x1={ml} y1={mt+ch} x2={ml+cw} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
<text x="10" y={mt+ch/2} textAnchor="middle" fill="#162030" fontSize="12.5" fontWeigh
</svg>
</div>
{showRank&&ranking.length>0&&(<div style={{margin:"4px 10px",background:"#050D1A",border:
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBo
<div>
<span style={{fontSize:15,color:"#2C4A68",letterSpacing:1}}>PROJECTED RANKING AT </
<span style={{fontSize:15,color:"#E8B84B",fontWeight:700,letterSpacing:1}}>{period}
</div>
<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
<span style={{fontSize:14,color:"#2C4A68"}}>Beagle</span>
<span style={{fontSize:18,fontWeight:700,color:"#E8B84B"}}>#{beagle.rank}</span>
<span style={{fontSize:19,color:"#2C4A68"}}>→</span>
<span style={{fontSize:23,fontWeight:700,color:rankChange>0?"#00E676":"#E8B84B"}}>#
{rankChange>0&&<span style={{fontSize:16,fontWeight:700,color:"#00E676"}}>▲{rankCha
{rankChange<0&&<span style={{fontSize:16,fontWeight:700,color:"#E74C3C"}}>▼{Math.ab
{selA&&!selA.isBeagle&&(()=>{
const sp=ranking.find(r=>r.name===selA.name),sc=selA.rank-(sp?.projRank??selA.ran
return(<span style={{display:"flex",alignItems:"center",gap:6,marginLeft:12,paddi
<span style={{fontSize:14,color:c,fontWeight:600}}>{selA.name}</span>
<span style={{fontSize:18,fontWeight:700,color:c}}>#{selA.rank}</span>
<span style={{fontSize:19,color:"#2C4A68"}}>→</span>
<span style={{fontSize:21,fontWeight:700,color:sc>0?"#00E676":sc<0?"#E74C3C":c}
{sc!==0&&<span style={{fontSize:16,fontWeight:700,color:sc>0?"#00E676":"#E74C3C
</span>);
})()}
</div>
</div>
<div className="rank-grid" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1
<div><div style={{fontSize:13,color:"#182838",fontWeight:600,letterSpacing:1,padding:
<div><div style={{fontSize:13,color:"#182838",fontWeight:600,letterSpacing:1,padding:
</div>
</div>)}
{selA&&!selA.isBeagle&&(<div style={{margin:"4px 10px 4px",background:"#050D1A",border:"1
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marg
<div>
<div style={{fontSize:19,fontWeight:700,color:"#E2EAF4"}}>#{selA.rank} {selA.name}<
<div style={{fontSize:15,color:"#2C4A68",marginTop:2}}>{"SV $"+selA.sv.toLocaleStri
</div>
{selA.catchable?(<div style={{background:"#04120A",border:"1px solid "+col(selA),bord
<div style={{fontSize:14,color:col(selA),letterSpacing:1}}>BEAGLE OVERTAKES</div>
<div style={{fontSize:18,fontWeight:700,color:col(selA)}}>{fmtDate(selA.overtakeDat
<div style={{fontSize:14,color:"#2C4A68"}}>in {Math.round(selA.daysTo)} days</div>
</div>):selA.passed?(<div style={{background:"#1C0606",border:"1px solid #E74C3C",bor
<div style={{fontSize:14,color:"#E74C3C",letterSpacing:1}}>STATUS</div>
<div style={{fontSize:18,fontWeight:700,color:"#E74C3C"}}>✓ OVERTAKEN</div>
</div>):(<div style={{background:"#06101C",border:"1px solid #3A6090",borderRadius:4,
<div style={{fontSize:14,color:"#3A6090",letterSpacing:1}}>STATUS</div>
<div style={{fontSize:17,fontWeight:700,color:"#3A6090"}}>PULLING AWAY</div>
</div>)}
</div>
<div style={{display:"flex",gap:5,marginBottom:8}}>
{detailProj.map(({mo,sv,rank})=>{const ahead=sv-(B_SV+B_PACE*MTD[mo]),c=ahead<=0?"#00
<div style={{fontSize:14,color:"#182838",fontWeight:600,letterSpacing:1,marginBotto
<div style={{fontSize:16,fontWeight:700,color:"#C0CCD8"}}>{"$"+sv.toFixed(0)+"M"}</
<div style={{fontSize:13.5,color:c,marginTop:2,fontWeight:600}}>{ahead<=0?"✓ BEHIND
<div style={{fontSize:13,color:"#182838",marginTop:1}}>Beagle #{rank}</div>
</div>);})}
</div>
<div className="stat-row" style={{display:"flex",alignItems:"center",gap:20,borderTop:"
<div><div style={{fontSize:14,color:"#182838",letterSpacing:1}}>DAILY CLOSURE</div><d
<div><div style={{fontSize:14,color:"#182838",letterSpacing:1}}>THEIR PACE</div><div
<div><div style={{fontSize:14,color:"#182838",letterSpacing:1}}>BEAGLE PACE</div><div
<div style={{marginLeft:"auto",fontSize:16,fontWeight:700,color:selA.catchable?"#69F0
</div>
</div>)}
<div style={{padding:"5px 10px 16px",overflowY:"auto",maxHeight:isMobile?220:280}}>
<div style={{fontSize:14,color:"#162030",letterSpacing:1,marginBottom:6,paddingLeft:2}}
{[...(fullField?[...CLOSE,...FAR]:CLOSE)].sort((a,b)=>a.rank-b.rank).map(a=>{
const c=col(a),isSel=selected===a.name,projR=ranking.find(r=>r.name===a.name)?.projRa
return(<div key={a.name} onClick={()=>setSelected(isSel?null:a.name)} style={{display
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontSize:16,fontWeight:700,color:c,minWidth:26}}>#{a.rank}</span>
<span style={{fontSize:16,fontWeight:isSel?700:400,color:isSel?c:"#C0CCD8"}}>{a.n
{a.passed&&<span style={{fontSize:14,color:"#00E676",fontWeight:700}}>✓</span>}
</div>
<div style={{display:"flex",alignItems:"center",gap:14,fontSize:14}}>
<span style={{color:"#2C4A68"}}>{"$"+a.sv.toFixed(0)+"M"}</span>
<span style={{color:"#2C4A68"}}>{a.gap>0?"+":""}{a.gap.toFixed(0)}M</span>
<span style={{color:c,fontWeight:600,minWidth:60,textAlign:"right"}}>{a.catchable
{projR&&<span style={{color:rChg>0?"#00E676":rChg<0?"#E74C3C":"#2C4A68",fontWeigh
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
