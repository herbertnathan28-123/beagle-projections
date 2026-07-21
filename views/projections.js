const esbuild = require('esbuild');

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
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
</head>
<body>
<div id="diag" style="position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#E8B84B;color:#000;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:700;z-index:9999;letter-spacing:.05em;">LOADING...</div>
<div id="root"></div>
<script>
window.onerror=function(m,s,l,c,e){
  var d=document.getElementById('diag');
  if(d){d.style.background='#CC0000';d.style.color='#fff';d.style.maxWidth='90vw';d.style.whiteSpace='pre-wrap';d.textContent='JS ERROR: '+m+' @ '+s+':'+l+':'+c;}
  return false;
};
window.addEventListener('unhandledrejection',function(e){
  var d=document.getElementById('diag');
  if(d){d.style.background='#CC0000';d.style.color='#fff';d.textContent='PROMISE ERROR: '+(e.reason?.message||String(e.reason));}
});
</script>
<script type="text/babel">
const {useState,useEffect,useMemo,useRef,useCallback}=React;
const PERIOD_OPTS=[{label:'1MO',days:30.4,g:'M'},{label:'2MO',days:60.8,g:'M'},{label:'3MO',days:91.3,g:'M'},{label:'4MO',days:121.7,g:'M'},{label:'5MO',days:152.1,g:'M'},{label:'6MO',days:182.6,g:'M'},{label:'7MO',days:213.0,g:'M'},{label:'8MO',days:243.3,g:'M'},{label:'9MO',days:273.9,g:'M'},{label:'10MO',days:304.3,g:'M'},{label:'11MO',days:334.6,g:'M'},{label:'12MO',days:365,g:'M'},{label:'15MO',days:456.3,g:'M'},{label:'18MO',days:547.5,g:'M'},{label:'21MO',days:638.8,g:'M'},{label:'24MO',days:730,g:'M'},{label:'3Y',days:1095,g:'Y'},{label:'4Y',days:1460,g:'Y'},{label:'5Y',days:1825,g:'Y'},{label:'6Y',days:2190,g:'Y'},{label:'7Y',days:2555,g:'Y'},{label:'8Y',days:2920,g:'Y'},{label:'9Y',days:3285,g:'Y'},{label:'10Y',days:3650,g:'Y'},{label:'15Y',days:5475,g:'Y'},{label:'20Y',days:7300,g:'Y'},{label:'25Y',days:9125,g:'Y'},{label:'50Y',days:18250,g:'Y'},{label:'MAX',days:null,g:'A'}];
const MTD={1:30.4,3:91.3,6:182.6,12:365};
function getXTicks(total,visStart,visDays){const e=visStart+visDays;let t=[];if(total<=182.6)t=[30.4,91.3,182.6];else if(total<=365)t=[91.3,182.6,365];else if(total<=730)t=[182.6,365,547.5,730];else if(total<=1825)t=[365,730,1095,1460,1825];else if(total<=3650)t=[365,730,1825,2555,3650];else{const s=Math.ceil(total/5/365)*365;for(let d=s;d<=total;d+=s)t.push(d);}return t.filter(d=>d>=visStart&&d<=e);}
function xlbl(d){if(d<365)return Math.round(d/30.4)+'MO';const y=d/365;return(Number.isInteger(y)?y:y.toFixed(1))+'Y';}
const VIBRANT_COLORS=['#44EC1E','#FF2910','#FFC422','#E013E0','#4411DB','#0DC1E8'];
const NON_BEAGLE_COLORS=['#44EC1E','#FF2910','#E013E0','#4411DB','#0DC1E8'];
function strHash(s){let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))>>>0;}return h;}
function lc(a){if(a.isBeagle)return'#FFC422';const others=NON_BEAGLE_COLORS;return others[strHash(a.name||'')%others.length];}
function fmtD(d){if(!d)return null;const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return d.getDate()+' '+m[d.getMonth()]+' '+d.getFullYear();}
function fmtAxis(v){return v>=1000?(v/1000).toFixed(1)+'k':v<=-1000?(v/1000).toFixed(1)+'k':String(v);}
function fmtAWST(ts){if(!ts)return null;const d=new Date(ts),a=new Date(d.getTime()+8*3600000);const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];const p=n=>String(n).padStart(2,'0');return a.getUTCDate()+' '+m[a.getUTCMonth()]+' '+a.getUTCFullYear()+' \xb7 '+p(a.getUTCHours())+':'+p(a.getUTCMinutes())+' AWST';}
function build(data){const BS=data.beagleSV,BP=data.beaglePace;const bg={rank:data.beagleRank,name:'Beagle Global',sv:BS,pace:BP,isBeagle:true};const MAX_CATCH_DAYS=3650;const all=[...data.alliances,bg].map(a=>{const gap=+(a.sv-BS).toFixed(2);const cl=a.pace!=null?+(BP-a.pace).toFixed(4):null;let dt=null,catchable=false; if(cl>0&&gap>0){dt=gap/cl; if(dt<=MAX_CATCH_DAYS){catchable=true;}else{dt=null;}} const od=dt?new Date(Date.now()+dt*86400000):null;return{...a,gap,closure:cl,daysTo:dt,overtakeDate:od,catchable,passed:gap<0};});const _seen=new Set();const deduped=all.filter(a=>{const k=(a.name||'').toLowerCase().trim();if(_seen.has(k))return false;_seen.add(k);return true;});return{all:deduped,beagle:{...bg,gap:0,closure:0,catchable:false,passed:false},BS,BP};}
function projR(all,beagle,days){const kn=all.filter(a=>a.pace!=null&&!a.isBeagle).map(a=>({...a,pSV:a.sv+a.pace*days}));const un=all.filter(a=>a.pace==null&&!a.isBeagle).map(a=>({...a,pSV:null,noPace:true}));const bp={...beagle,pSV:beagle.sv+beagle.pace*days};const sorted=[...kn,bp].sort((a,b)=>b.pSV-a.pSV);const res=[...sorted];un.forEach(u=>{const at=Math.min(u.rank-1,res.length);res.splice(at,0,{...u,projRank:u.rank});});return res.map((a,i)=>({...a,projRank:a.noPace?a.rank:i+1}));}
function App(){
  const[apiData,setApiData]=useState(null);const[loading,setLoading]=useState(true);const[pk,setPk]=useState('6MO');const[mode,setMode]=useState('SV');const[act,setAct]=useState(new Set());
  const[,forceLayout]=useState(0);
  useEffect(()=>{const d=document.getElementById('diag');if(d)d.style.display='none';},[]);
  useEffect(()=>{let t;const onResize=()=>{clearTimeout(t);t=setTimeout(()=>{forceLayout(n=>n+1);[svChart,gapChart,rkChart].forEach(r=>r.current?.resize());},200);};window.addEventListener('resize',onResize);window.addEventListener('orientationchange',onResize);return()=>{clearTimeout(t);window.removeEventListener('resize',onResize);window.removeEventListener('orientationchange',onResize);};},[]);
  const[focus,setFocus]=useState(null);const[full,setFull]=useState(true);const[showR,setShowR]=useState(true);const[yZ,setYZ]=useState(1);const[yP,setYP]=useState(0);const[xZ,setXZ]=useState(1);const[xP,setXP]=useState(0);
  const[rkTip,setRkTip]=useState(null);const rkDots=useRef([]);
  const svgRef=useRef(null);const pinchDist=useRef(null);const drag=useRef({active:false,x:0,y:0,yp:0,xp:0});const lv=useRef({yP:0,xP:0,days:182.6,yRZ:0,xZ:1});const gapCvs=useRef(null);const gapChart=useRef(null);const gapZI=useRef(null);const gapZO=useRef(null);const gapRZ=useRef(null);const gapPL=useRef(null);const gapPR=useRef(null);const gapPU=useRef(null);const gapPD=useRef(null);const svCvs=useRef(null);const svChart=useRef(null);const svZI=useRef(null);const svZO=useRef(null);const svRZ=useRef(null);const svPL=useRef(null);const svPR=useRef(null);const svPU=useRef(null);const svPD=useRef(null);const rkCvs=useRef(null);const rkChart=useRef(null);const rkZI=useRef(null);const rkZO=useRef(null);const rkRZ=useRef(null);const rkPL=useRef(null);const rkPR=useRef(null);const rkPU=useRef(null);const rkPD=useRef(null);
  const toggle=useCallback(name=>{setAct(prev=>{const n=new Set(prev);if(n.has(name)){n.delete(name);setFocus(f=>f===name?([...n].pop()||null):f);}else{n.add(name);setFocus(name);}return n;});},[]);
  useEffect(()=>{fetch('/api/data').then(r=>r.json()).then(d=>{setApiData(d);setLoading(false);}).catch(()=>setLoading(false));},[]);
  const[teamRating,setTeamRating]=useState(null);
  useEffect(()=>{fetch('/api/team-rating').then(r=>r.json()).then(d=>{if(d&&d.overall!=null)setTeamRating(d);}).catch(()=>{});},[]);
  const{all,beagle,BS,BP}=useMemo(()=>{if(!apiData)return{all:[],beagle:{sv:0,pace:0,rank:19},BS:0,BP:0};return build(apiData);},[apiData]);
  const maxCD=all.filter(a=>!a.isBeagle&&a.catchable&&a.daysTo).reduce((m,a)=>Math.max(m,a.daysTo),365);
  const hasAct=act.size>0;
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
  const portrait=mob&&(typeof window!=='undefined'?window.innerHeight>window.innerWidth:false);
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

  const GAP_COLS=NON_BEAGLE_COLORS;
  const FF2='-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
  const rgba2=(h,a)=>{const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';};
  useEffect(()=>{
    if(mode!=='GAP'){if(gapChart.current){gapChart.current.destroy();gapChart.current=null;}return;}
    if(!all.length||!gapCvs.current||typeof Chart==='undefined')return;
    if(gapChart.current){gapChart.current.destroy();gapChart.current=null;}
    const above=all.filter(a=>!a.isBeagle&&a.gap>0).sort((x,y)=>y.gap-x.gap);
    const maxDay=Math.max(days,above.filter(a=>a.daysTo).reduce((m,a)=>Math.max(m,a.daysTo),260)*1.15);
    const maxGap=above.reduce((m,a)=>Math.max(m,a.gap),200)*1.1;
    const GDS=above.map((a,i)=>{
      const c=GAP_COLS[i%GAP_COLS.length];
      if(!a.catchable||!a.daysTo)return{label:a.name,data:[{x:0,y:a.gap},{x:maxDay,y:a.gap}],borderColor:rgba2(c,.35),borderWidth:1,pointRadius:0,showLine:true,tension:0,fill:false,_c:c};
      const cr=a.gap/a.daysTo,pts=[];
      for(let d=0;d<=maxDay;d+=Math.max(2,Math.floor(maxDay/130)))pts.push({x:d,y:Math.max(0,a.gap-cr*d)});
      return{label:a.name,data:pts,borderColor:c,borderWidth:1.1,pointRadius:0,showLine:true,tension:0,fill:false,_c:c};
    });
    GDS.push({label:'Beagle',data:[{x:0,y:0},{x:maxDay,y:0}],borderColor:'#FFC422',borderWidth:2,pointRadius:0,showLine:true,tension:0,fill:false});
    let selG=null;
    const bgP2={id:'bg2',beforeDraw(c){const x=c.ctx;x.save();x.fillStyle='#000000';x.fillRect(0,0,c.width,c.height);x.restore();}};
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
    try{gapChart.current=new Chart(gapCvs.current,{
      type:'scatter',data:{datasets:GDS},plugins:[bgP2,lblP2],
      options:{
        responsive:true,maintainAspectRatio:false,animation:{duration:600},
        plugins:{legend:{display:false},tooltip:{enabled:false}},
        scales:{
          x:{type:'linear',min:0,max:maxDay,grid:{color:'#112030',lineWidth:.8},border:{color:'#1A324A'},
            ticks:{color:'#7AAAC8',font:{family:FF2,size:11,weight:'300'},
              callback:v=>v===0?'NOW':v<60?Math.round(v)+'d':Math.round(v/30.4)+'MO'}},
          y:{min:-Math.max(BS*0.04,80),max:maxGap,grid:{color:'#112030',lineWidth:.8},border:{color:'#1A324A'},
            ticks:{color:'#7AAAC8',font:{family:FF2,size:11,weight:'300'},
              callback:v=>v===0?'':v<0?'▼$'+Math.abs(v).toFixed(0)+'M':'$'+v.toFixed(0)+'M'}}
        },
        layout:{padding:{left:120,right:showR?20:0,top:20,bottom:8}},
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
    });}catch(e){console.error('GAP chart err',e);return;}
    const cvs=gapCvs.current;
    const zS={minX:0,maxX:maxDay,minY:-Math.max(BS*0.04,80),maxY:maxGap};
    const apZ=()=>{if(!gapChart.current)return;gapChart.current.options.scales.x.min=zS.minX;gapChart.current.options.scales.x.max=zS.maxX;gapChart.current.options.scales.y.min=zS.minY;gapChart.current.options.scales.y.max=zS.maxY;gapChart.current.update('none');};
    const dZoom=f=>{const rx=zS.maxX-zS.minX,ry=zS.maxY-zS.minY,mx=(zS.minX+zS.maxX)/2,my=(zS.minY+zS.maxY)/2;zS.minX=mx-rx*f/2;zS.maxX=mx+rx*f/2;zS.minY=my-ry*f/2;zS.maxY=my+ry*f/2;apZ();};
    const dPan=(dx,dy)=>{const rx=zS.maxX-zS.minX,ry=zS.maxY-zS.minY;zS.minX+=dx*rx;zS.maxX+=dx*rx;zS.minY+=dy*ry;zS.maxY+=dy*ry;apZ();};
    gapZI.current=()=>dZoom(0.72);gapZO.current=()=>dZoom(1.35);
    gapRZ.current=()=>{zS.minX=0;zS.maxX=maxDay;zS.minY=-Math.max(BS*0.04,80);zS.maxY=maxGap;apZ();};
    gapPL.current=()=>dPan(-0.15,0);gapPR.current=()=>dPan(0.15,0);
    gapPU.current=()=>dPan(0,0.12);gapPD.current=()=>dPan(0,-0.12);
    let td={a:false,x:0,y:0,mx:0,Mx:0,my:0,My:0,pd:null,pmx:0,pMx:0,pmy:0,pMy:0};
    const onTS=e=>{if(e.touches.length===1){td.a=true;td.x=e.touches[0].clientX;td.y=e.touches[0].clientY;td.mx=zS.minX;td.Mx=zS.maxX;td.my=zS.minY;td.My=zS.maxY;td.pd=null;}else if(e.touches.length===2){td.a=false;td.pd=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);td.pmx=zS.minX;td.pMx=zS.maxX;td.pmy=zS.minY;td.pMy=zS.maxY;}};
    const onTM=e=>{e.preventDefault();const rect=cvs.getBoundingClientRect();if(e.touches.length===1&&td.a){const dx=(e.touches[0].clientX-td.x)/rect.width*(td.Mx-td.mx);const dy=(e.touches[0].clientY-td.y)/rect.height*(td.My-td.my);zS.minX=td.mx-dx;zS.maxX=td.Mx-dx;zS.minY=td.my+dy;zS.maxY=td.My+dy;apZ();}else if(e.touches.length===2&&td.pd!=null){const nd=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);const f=td.pd/nd;const mx=(td.pmx+td.pMx)/2,my=(td.pmy+td.pMy)/2;const rx=(td.pMx-td.pmx)*f/2,ry=(td.pMy-td.pmy)*f/2;zS.minX=mx-rx;zS.maxX=mx+rx;zS.minY=my-ry;zS.maxY=my+ry;apZ();}};
    const onTE=e=>{if(e.touches.length<2)td.pd=null;if(e.touches.length===0)td.a=false;};
    const onWH=e=>{e.preventDefault();dZoom(e.deltaY>0?1.25:0.8);};
    cvs.addEventListener('touchstart',onTS,{passive:false});cvs.addEventListener('touchmove',onTM,{passive:false});cvs.addEventListener('touchend',onTE);cvs.addEventListener('wheel',onWH,{passive:false});
    return()=>{cvs.removeEventListener('touchstart',onTS);cvs.removeEventListener('touchmove',onTM);cvs.removeEventListener('touchend',onTE);cvs.removeEventListener('wheel',onWH);if(gapChart.current){gapChart.current.destroy();gapChart.current=null;}};
  },[mode,all,BS,BP,beagle,days]);

  useEffect(()=>{
    if(mode!=='SV'){if(svChart.current){svChart.current.destroy();svChart.current=null;}return;}
    if(!all.length||!svCvs.current||typeof Chart==='undefined')return;
    if(svChart.current){svChart.current.destroy();svChart.current=null;}
    const FF2='-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
    const rgba2=(h,a)=>{const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';};
    const getC=lc;
    const svPool=(full?[...all]:[...all].filter(a=>a.isBeagle||a.passed||a.gap<800)).sort((a,b)=>b.sv-a.sv);
    const svVals=svPool.flatMap(a=>{
      const sv=a.sv;
      if(sv==null)return[];
      const end=sv+(a.pace||0)*days;
      return [sv,end];
    });
    let minY=svVals.length?Math.min(...svVals):1000;
    let maxY=svVals.length?Math.max(...svVals):5000;
    if(minY===maxY){minY-=1;maxY+=1;}
    minY=Math.max(0,minY);
    let selS=null;
    const SDS=svPool.map(a=>{
      const c=getC(a),isAct=act.has(a.name),dim=hasAct&&!isAct&&!a.isBeagle;
      const pts=a.pace!=null?[{x:0,y:a.sv},{x:days,y:a.sv+a.pace*days}]:[{x:0,y:a.sv},{x:days,y:a.sv}];
      return{label:a.name,data:pts,borderColor:dim?rgba2(c,.06):c,borderWidth:a.isBeagle?3.5:isAct?2.5:1.3,pointRadius:0,showLine:true,tension:0,fill:false,_c:c,_beagle:a.isBeagle,_a:a};
    });
    const bgSV={id:'bgSV',beforeDraw(c){const x=c.ctx;x.save();x.fillStyle='#000000';x.fillRect(0,0,c.width,c.height);x.restore();}};
    const lblSV={id:'lblSV',afterDraw(ch){
      const ctx=ch.ctx,ys=ch.scales.y,xs=ch.scales.x,ca=ch.chartArea;ctx.save();
      const xL=Math.max(zS.minX,0),xR=Math.min(zS.maxX,days);
      const pxL=Math.max(xs.getPixelForValue(xL),ca.left);
      const pxR=Math.min(xs.getPixelForValue(xR),ca.right);
      const leftVis=pxL>=ca.left&&pxL<=ca.right;
      const rightVis=pxR>=ca.left&&pxR<=ca.right;
      const rawY=svPool.map(a=>ys.getPixelForValue(a.sv+(a.pace||0)*xL));
      const adjY=[...rawY];
      for(let i=1;i<adjY.length;i++)for(let j=0;j<i;j++)if(Math.abs(adjY[i]-adjY[j])<14)adjY[i]=adjY[j]+15;
      const rawYR=svPool.map(a=>ys.getPixelForValue(a.sv+(a.pace||0)*xR));
      const adjYR=[...rawYR];
      for(let i=1;i<adjYR.length;i++)for(let j=0;j<i;j++)if(Math.abs(adjYR[i]-adjYR[j])<14)adjYR[i]=adjYR[j]+15;
      svPool.forEach((a,i)=>{
        const c=getC(a);const isSel=selS===i,hasSel=selS!==null,dim=hasSel&&!isSel&&!a.isBeagle;
        ctx.globalAlpha=dim?.07:1;
        if(leftVis&&rawY[i]>=ca.top-30&&rawY[i]<=ca.bottom+30){
          ctx.fillStyle=a.isBeagle?'#E8B84B':'#FFFFFF';
          ctx.font=(a.isBeagle||isSel?'600':'400')+' 13px '+FF2;
          ctx.textAlign='right';
          ctx.fillText('#'+a.rank+' '+(a.name.length>17?a.name.slice(0,16)+'\u2026':a.name),pxL-8,adjY[i]+4);
          ctx.fillStyle=c;ctx.beginPath();ctx.arc(pxL-2,rawY[i],isSel?4:2.5,0,Math.PI*2);ctx.fill();
        }
        if(rightVis&&rawYR[i]>=ca.top-30&&rawYR[i]<=ca.bottom+30){
          const svEnd=a.sv+(a.pace||0)*xR;
          const svStr='$'+(svEnd>=1000?(svEnd/1000).toFixed(2)+'B':svEnd.toFixed(1)+'M');
          ctx.fillStyle=a.isBeagle?'#E8B84B':c;
          ctx.font=(a.isBeagle||isSel?'700':'500')+' 12px '+FF2;
          ctx.textAlign='right';
          ctx.fillText(svStr,pxR-8,adjYR[i]+4);
          ctx.fillStyle=c;ctx.beginPath();ctx.arc(pxR-3,rawYR[i],isSel?3.5:2,0,Math.PI*2);ctx.fill();
        }
      });
      ctx.globalAlpha=1;ctx.restore();
    }};
    try{svChart.current=new Chart(svCvs.current,{type:'scatter',data:{datasets:SDS},plugins:[bgSV,lblSV],
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:400},
        plugins:{legend:{display:false},tooltip:{enabled:false}},
        scales:{
          x:{type:'linear',min:0,max:days,grid:{color:'#0F1E2E',lineWidth:.6},border:{color:'#1A324A'},
            ticks:{color:'#7AAAC8',font:{family:FF2,size:11},callback:v=>v===0?'NOW':v<60?Math.round(v)+'d':Math.round(v/30.4)+'MO'}},
          y:{min:minY,max:maxY,grid:{color:'#0F1E2E',lineWidth:.6},border:{color:'#1A324A'},
            ticks:{color:'#7AAAC8',font:{family:FF2,size:11},callback:v=>'$'+v.toFixed(0)+'M'}}
        },
        layout:{padding:{left:120,right:showR?80:0,top:20,bottom:8}},
        onClick(e){
          if(!svChart.current)return;
          const ca=svChart.current.chartArea,xs=svChart.current.scales.x,ys=svChart.current.scales.y;
          const mx=e.native.offsetX,my=e.native.offsetY;
          if(mx<ca.left||mx>ca.right||my<ca.top||my>ca.bottom)return;
          let near=null,minD=22;
          svPool.forEach((a,i)=>{
            const d=xs.getValueForPixel(mx),sv1=a.sv+(a.pace||0)*d;
            const ly=ys.getPixelForValue(sv1);
            if(Math.abs(my-ly)<minD){minD=Math.abs(my-ly);near=i;}
          });
          selS=(near===selS)?null:near;
          svPool.forEach((a,i)=>{const c=getC(a);const isSel=selS===i,dim=selS!==null&&!isSel&&!a.isBeagle;SDS[i].borderColor=dim?rgba2(c,.06):c;SDS[i].borderWidth=isSel?3:a.isBeagle?3.5:1.3;});
          svChart.current.update('none');
          setFocus(selS!==null?svPool[selS].name:null);
        }
      }
    });}catch(e){console.error('SV chart err',e);return;}
    const cvs=svCvs.current;
    const zS={minX:0,maxX:days,minY,maxY};
    const apZ=()=>{if(!svChart.current)return;svChart.current.options.scales.x.min=zS.minX;svChart.current.options.scales.x.max=zS.maxX;svChart.current.options.scales.y.min=zS.minY;svChart.current.options.scales.y.max=zS.maxY;svChart.current.update('none');};
    const dZoom=f=>{const rx=zS.maxX-zS.minX,ry=zS.maxY-zS.minY,mx=(zS.minX+zS.maxX)/2,my=(zS.minY+zS.maxY)/2;zS.minX=mx-rx*f/2;zS.maxX=mx+rx*f/2;zS.minY=my-ry*f/2;zS.maxY=my+ry*f/2;apZ();};
    const dPan=(dx,dy)=>{const rx=zS.maxX-zS.minX,ry=zS.maxY-zS.minY;zS.minX+=dx*rx;zS.maxX+=dx*rx;zS.minY+=dy*ry;zS.maxY+=dy*ry;apZ();};
    svZI.current=()=>dZoom(0.72);svZO.current=()=>dZoom(1.35);
    svRZ.current=()=>{zS.minX=0;zS.maxX=days;zS.minY=minY;zS.maxY=maxY;apZ();};
    svPL.current=()=>dPan(-0.15,0);svPR.current=()=>dPan(0.15,0);svPU.current=()=>dPan(0,0.12);svPD.current=()=>dPan(0,-0.12);
    let td={a:false,x:0,y:0,mx:0,Mx:0,my:0,My:0,pd:null,pmx:0,pMx:0,pmy:0,pMy:0};
    const onTS=e=>{if(e.touches.length===1){td.a=true;td.x=e.touches[0].clientX;td.y=e.touches[0].clientY;td.mx=zS.minX;td.Mx=zS.maxX;td.my=zS.minY;td.My=zS.maxY;td.pd=null;}else if(e.touches.length===2){td.a=false;td.pd=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);td.pmx=zS.minX;td.pMx=zS.maxX;td.pmy=zS.minY;td.pMy=zS.maxY;}};
    const onTM=e=>{e.preventDefault();const rect=cvs.getBoundingClientRect();if(e.touches.length===1&&td.a){const dx=(e.touches[0].clientX-td.x)/rect.width*(td.Mx-td.mx);const dy=(e.touches[0].clientY-td.y)/rect.height*(td.My-td.my);zS.minX=td.mx-dx;zS.maxX=td.Mx-dx;zS.minY=td.my+dy;zS.maxY=td.My+dy;apZ();}else if(e.touches.length===2&&td.pd!=null){const nd=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);const f=td.pd/nd;const mx=(td.pmx+td.pMx)/2,my=(td.pmy+td.pMy)/2;const rx=(td.pMx-td.pmx)*f/2,ry=(td.pMy-td.pmy)*f/2;zS.minX=mx-rx;zS.maxX=mx+rx;zS.minY=my-ry;zS.maxY=my+ry;apZ();}};
    const onTE=e=>{if(e.touches.length<2)td.pd=null;if(e.touches.length===0)td.a=false;};
    const onWH=e=>{e.preventDefault();dZoom(e.deltaY>0?1.25:0.8);};
    cvs.addEventListener('touchstart',onTS,{passive:false});cvs.addEventListener('touchmove',onTM,{passive:false});cvs.addEventListener('touchend',onTE);cvs.addEventListener('wheel',onWH,{passive:false});
    return()=>{cvs.removeEventListener('touchstart',onTS);cvs.removeEventListener('touchmove',onTM);cvs.removeEventListener('touchend',onTE);cvs.removeEventListener('wheel',onWH);if(svChart.current){svChart.current.destroy();svChart.current=null;}};
  },[mode,all,BS,BP,beagle,days,act,hasAct,full]);

  useEffect(()=>{
    const apply=()=>{
      [svChart,gapChart,rkChart].forEach((ref,i)=>{
        const c=ref.current;if(!c)return;
        const right=i===0?(showR?80:0):i===1?(showR?20:0):(showR?155:0);
        c.options.layout.padding.right=right;
        c.resize();
        c.update('none');
      });
    };
    requestAnimationFrame(()=>requestAnimationFrame(apply));
  },[showR]);

  useEffect(()=>{
    if(mode!=='RANK'){if(rkChart.current){rkChart.current.destroy();rkChart.current=null;}return;}
    if(!all.length||!rkCvs.current||typeof Chart==='undefined')return;
    if(rkChart.current){rkChart.current.destroy();rkChart.current=null;}
    const FF2='-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
    const rgba2=(h,a)=>{const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';};
    const getC=lc;
    const rkAll=[...all,beagle].filter((a,i,arr)=>arr.findIndex(x=>x.name===a.name)===i);
    const ptFracs=[0,.2,.4,.6,.8,1];const ptDays=ptFracs.map(f=>Math.round(f*days));
    let selR=null;
    const RDS=rkAll.map(a=>{
      const c=getC(a),isAct=act.has(a.name),dim=hasAct&&!isAct&&!a.isBeagle;
      const data=ptDays.map(d=>{const pr=projR(all,beagle,d);const e=pr.find(r=>r.name===a.name);return{x:d,y:e?.projRank??a.rank};});
      return{label:a.name,data,borderColor:dim?rgba2(c,.06):c,borderWidth:a.isBeagle?3.5:isAct?2.5:1.2,pointRadius:0,showLine:true,tension:0.25,fill:false,_c:c,_beagle:a.isBeagle};
    });
    const crossovers=[];
    for(let i=0;i<rkAll.length;i++){for(let j=i+1;j<rkAll.length;j++){
      for(let k=0;k<RDS[i].data.length-1;k++){
        const rAk=RDS[i].data[k].y,rAk1=RDS[i].data[k+1].y;
        const rBk=RDS[j].data[k].y,rBk1=RDS[j].data[k+1].y;
        const dA=rAk1-rAk,dB=rBk1-rBk;
        if(Math.sign(rAk-rBk)!==Math.sign(rAk1-rBk1)&&Math.abs(dA-dB)>0.01){
          const f=(rBk-rAk)/(dA-dB);
          if(f>0&&f<1){
            const tx=RDS[i].data[k].x+f*(RDS[i].data[k+1].x-RDS[i].data[k].x);
            const rv=rAk+f*dA;
            const aUp=rAk>rBk;
            crossovers.push({ci:crossovers.length,tx,rv,
              nameA:rkAll[i].name,paceA:rkAll[i].pace||0,colorA:RDS[i]._c,rankAbefore:Math.round(rAk),rankAafter:Math.round(rAk1),
              nameB:rkAll[j].name,paceB:rkAll[j].pace||0,colorB:RDS[j]._c,rankBbefore:Math.round(rBk),rankBafter:Math.round(rBk1),
              aUp});
          }
        }
      }
    }}
    const bgRK={id:'bgRK',beforeDraw(c){const x=c.ctx;x.save();x.fillStyle='#000000';x.fillRect(0,0,c.width,c.height);x.restore()}};
    const lblRK={id:'lblRK',afterDraw(ch){
      const ctx=ch.ctx,xs=ch.scales.x,ys=ch.scales.y,ca=ch.chartArea;ctx.save();
      const interpRank=(ds,T)=>{
        const pts=ds.data;if(!pts.length)return pts[0]?.y??10;
        if(T>=pts[pts.length-1].x)return pts[pts.length-1].y;
        if(T<=pts[0].x)return pts[0].y;
        for(let k=0;k<pts.length-1;k++){
          if(T>=pts[k].x&&T<=pts[k+1].x){
            const f=(T-pts[k].x)/(pts[k+1].x-pts[k].x);
            return pts[k].y+f*(pts[k+1].y-pts[k].y);
          }
        }
        return pts[pts.length-1].y;
      };
      const xR=Math.min(Math.max(zS.maxX,0),days);
      const endRanks=RDS.map(ds=>interpRank(ds,xR));
      const rawY=endRanks.map(r=>ys.getPixelForValue(r));
      const adjY=[...rawY];
      for(let i=1;i<adjY.length;i++)for(let j=0;j<i;j++)if(Math.abs(adjY[i]-adjY[j])<13)adjY[i]=adjY[j]+14;
      rkAll.forEach((a,i)=>{
        const c=getC(a);const isSel=selR===i,hasSel=selR!==null,dim=hasSel&&!isSel&&!a.isBeagle;
        ctx.globalAlpha=dim?.07:1;
        if(rawY[i]>=ca.top-20&&rawY[i]<=ca.bottom+20){
          ctx.fillStyle=a.isBeagle?'#E8B84B':'#FFFFFF';
          ctx.font=(a.isBeagle||isSel?'600':'400')+' 12px '+FF2;
          ctx.textAlign='left';
          ctx.fillText('#'+Math.round(endRanks[i])+' '+(a.name.length>16?a.name.slice(0,15)+'\u2026':a.name),ca.right+8,adjY[i]+4);
          ctx.fillStyle=c;ctx.beginPath();ctx.arc(ca.right+4,rawY[i],isSel?3.5:2,0,Math.PI*2);ctx.fill();
        }
      });
      for(let r=1;r<=20;r+=r<5?1:r<10?2:5){
        const py=ys.getPixelForValue(r);
        if(py<ca.top||py>ca.bottom)continue;
        ctx.globalAlpha=1;ctx.fillStyle='#7AAAC8';ctx.font='300 11px '+FF2;ctx.textAlign='right';
        ctx.fillText('#'+r,ca.left-6,py+4);
      }
      const dotPx=[];
      crossovers.forEach(co=>{
        const px=xs.getPixelForValue(co.tx),py=ys.getPixelForValue(co.rv);
        if(px>=ca.left&&px<=ca.right&&py>=ca.top&&py<=ca.bottom){
          ctx.globalAlpha=1;
          ctx.fillStyle='#FF3333';ctx.strokeStyle='rgba(255,255,255,0.8)';ctx.lineWidth=1.5;
          ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();ctx.stroke();
          dotPx.push({...co,px,py});
        }
      });
      rkDots.current=dotPx;
      ctx.globalAlpha=1;ctx.restore();
    }};
    try{rkChart.current=new Chart(rkCvs.current,{type:'scatter',data:{datasets:RDS},plugins:[bgRK,lblRK],
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:400},
        plugins:{legend:{display:false},tooltip:{enabled:false}},
        scales:{
          x:{type:'linear',min:0,max:days,grid:{color:'#0F1E2E',lineWidth:.6},border:{color:'#1A324A'},
            ticks:{color:'#7AAAC8',font:{family:FF2,size:11},callback:v=>v===0?'NOW':v<60?Math.round(v)+'d':Math.round(v/30.4)+'MO'}},
          y:{min:1,max:20,reverse:true,grid:{color:'#0F1E2E',lineWidth:.6},border:{color:'#1A324A'},ticks:{display:false}}
        },
        layout:{padding:{left:40,right:showR?155:0,top:20,bottom:8}},
        onClick(e){
          if(!rkChart.current)return;
          const ca=rkChart.current.chartArea,xs=rkChart.current.scales.x,ys=rkChart.current.scales.y;
          const mx=e.native.offsetX,my=e.native.offsetY;
          if(mx<ca.left||mx>ca.right||my<ca.top||my>ca.bottom)return;
          let near=null,minD=22;
          rkAll.forEach((a,i)=>{
            const d=xs.getValueForPixel(mx),frac=d/days;
            const pidx=Math.min(Math.floor(frac*ptDays.length),RDS[i].data.length-1);
            const ly=ys.getPixelForValue(RDS[i].data[pidx].y);
            if(Math.abs(my-ly)<minD){minD=Math.abs(my-ly);near=i;}
          });
          selR=(near===selR)?null:near;
          rkAll.forEach((a,i)=>{const c=getC(a);const isSel=selR===i,dim=selR!==null&&!isSel&&!a.isBeagle;RDS[i].borderColor=dim?rgba2(c,.06):c;RDS[i].borderWidth=isSel?3:a.isBeagle?3.5:1.2;});
          rkChart.current.update('none');
          setFocus(selR!==null&&!rkAll[selR]?.isBeagle?rkAll[selR].name:null);
        }
      }
    });}catch(e){console.error('RANK chart err',e);return;}
    const cvs=rkCvs.current;
    const zS={minX:0,maxX:days,minY:1,maxY:20};
    const apZ=()=>{if(!rkChart.current)return;rkChart.current.options.scales.x.min=zS.minX;rkChart.current.options.scales.x.max=zS.maxX;rkChart.current.options.scales.y.min=zS.minY;rkChart.current.options.scales.y.max=zS.maxY;rkChart.current.update('none');};
    const dZoom=f=>{const rx=zS.maxX-zS.minX,ry=zS.maxY-zS.minY,mx=(zS.minX+zS.maxX)/2,my=(zS.minY+zS.maxY)/2;zS.minX=mx-rx*f/2;zS.maxX=mx+rx*f/2;zS.minY=my-ry*f/2;zS.maxY=my+ry*f/2;apZ();};
    const dPan=(dx,dy)=>{const rx=zS.maxX-zS.minX,ry=zS.maxY-zS.minY;zS.minX+=dx*rx;zS.maxX+=dx*rx;zS.minY+=dy*ry;zS.maxY+=dy*ry;apZ();};
    rkZI.current=()=>dZoom(0.72);rkZO.current=()=>dZoom(1.35);
    rkRZ.current=()=>{zS.minX=0;zS.maxX=days;zS.minY=1;zS.maxY=20;apZ();};
    rkPL.current=()=>dPan(-0.15,0);rkPR.current=()=>dPan(0.15,0);rkPU.current=()=>dPan(0,-0.12);rkPD.current=()=>dPan(0,0.12);
    let td={a:false,x:0,y:0,mx:0,Mx:0,my:0,My:0,pd:null,pmx:0,pMx:0,pmy:0,pMy:0};
    const onTS=e=>{if(e.touches.length===1){td.a=true;td.x=e.touches[0].clientX;td.y=e.touches[0].clientY;td.mx=zS.minX;td.Mx=zS.maxX;td.my=zS.minY;td.My=zS.maxY;td.pd=null;}else if(e.touches.length===2){td.a=false;td.pd=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);td.pmx=zS.minX;td.pMx=zS.maxX;td.pmy=zS.minY;td.pMy=zS.maxY;}};
    const onTM=e=>{e.preventDefault();const rect=cvs.getBoundingClientRect();if(e.touches.length===1&&td.a){const dx=(e.touches[0].clientX-td.x)/rect.width*(td.Mx-td.mx);const dy=(e.touches[0].clientY-td.y)/rect.height*(td.My-td.my);zS.minX=td.mx-dx;zS.maxX=td.Mx-dx;zS.minY=td.my-dy;zS.maxY=td.My-dy;apZ();}else if(e.touches.length===2&&td.pd!=null){const nd=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);const f=td.pd/nd;const mx=(td.pmx+td.pMx)/2,my=(td.pmy+td.pMy)/2;const rx=(td.pMx-td.pmx)*f/2,ry=(td.pMy-td.pmy)*f/2;zS.minX=mx-rx;zS.maxX=mx+rx;zS.minY=my-ry;zS.maxY=my+ry;apZ();}};
    const onTE=e=>{if(e.touches.length<2)td.pd=null;if(e.touches.length===0)td.a=false;};
    const onWH=e=>{e.preventDefault();dZoom(e.deltaY>0?1.25:0.8);};
    cvs.addEventListener('touchstart',onTS,{passive:false});cvs.addEventListener('touchmove',onTM,{passive:false});cvs.addEventListener('touchend',onTE);cvs.addEventListener('wheel',onWH,{passive:false});
    const onRkClick=e=>{const rect=cvs.getBoundingClientRect();const mx=e.clientX-rect.left;const my=e.clientY-rect.top;const hit=rkDots.current.find(d=>Math.hypot(d.px-mx,d.py-my)<12);if(hit){setRkTip(prev=>prev&&prev.ci===hit.ci?null:{...hit,tipX:rect.left+hit.px,tipY:rect.top+hit.py});}else{setRkTip(null);}};
    cvs.addEventListener('click',onRkClick);
    return()=>{cvs.removeEventListener('touchstart',onTS);cvs.removeEventListener('touchmove',onTM);cvs.removeEventListener('touchend',onTE);cvs.removeEventListener('wheel',onWH);cvs.removeEventListener('click',onRkClick);if(rkChart.current){rkChart.current.destroy();rkChart.current=null;}};
  },[mode,all,beagle,days,act,hasAct]);
  const onDblClick=useCallback(e=>{const svg=svgRef.current;if(!svg)return;setZHint(false);const r=svg.getBoundingClientRect();const mx=(e.clientX-r.left-ml*(r.width/W))/(cw*(r.width/W));const my=(e.clientY-r.top-mt*(r.height/H))/(ch*(r.height/H));const clampX=Math.max(0,Math.min(1,mx)),clampY=Math.max(0,Math.min(1,my));const f=2;setYZ(prev=>{const nz=Math.max(1,Math.min(30,prev*f));const oldR=lv.current.yRZ,newR=(yMxB-yMnB)/nz;setYP(p=>p+(oldR-newR)*(0.5-clampY));return nz;});setXZ(prev=>{const nz=Math.max(1,Math.min(30,prev*f));const oldVD=lv.current.days/lv.current.xZ,newVD=lv.current.days/nz;setXP(p=>Math.max(0,Math.min(p+(oldVD-newVD)*clampX,lv.current.days-newVD)));return nz;});},[yMnB,yMxB]);
  const detP=selA?[1,3,6,12].map(mo=>({mo,sv:selA.sv+(selA.pace||0)*MTD[mo],rank:projR(all,beagle,MTD[mo]).findIndex(a=>a.isBeagle)+1})):[];
  const BB={borderRadius:3,fontSize:14,fontWeight:700,cursor:'pointer',letterSpacing:1,fontFamily:'inherit',padding:'5px 12px'};
  const btn=on=>({...BB,background:on?'#C4920A':'transparent',border:'1px solid '+(on?'#C4920A':'#162030'),color:on?'#030B17':'#6A9AB5'});
  const btn2=on=>({...BB,background:on?'#1A3050':'transparent',border:'1px solid '+(on?'#4A80B0':'#162030'),color:on?'#E8B84B':'#6A9AB5'});
  if(loading)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}><div style={{fontSize:40,color:'#E8B84B'}}>&#9672;</div><div style={{fontSize:20,color:'#5A8AAB',letterSpacing:2}}>LOADING PROJECTIONS...</div></div>);
  const ts2=apiData?.timestamp,upl=apiData?.uploader;
  const CHEATERS=new Set(['Dokdo']);
  const paceColor=(pr,total)=>{if(total<=1)return'#00E676';const t=(pr-1)/(total-1);const r=Math.round(0+(58-0)*t),g=Math.round(230+(144-230)*t),b=Math.round(118+(110-118)*t);return'rgb('+r+','+g+','+b+')';};
  const renderRow=a=>{const isB=a.isBeagle,chg=a.rank-(a.projRank??a.rank),c=isB?'#E8B84B':lc(a),isAct=act.has(a.name),pr=paceRanks.get(a.name),isCheater=CHEATERS.has(a.name),totalPaced=paceRanks.size,pc=pr!=null?paceColor(pr,totalPaced):'#3A6090';return(<div key={a.name} onClick={()=>!isB&&toggle(a.name)} style={{display:'flex',alignItems:'center',gap:8,padding:W2>=1600?'10px 14px':'7px 10px',background:isB?'#1A1000':isAct?c+'22':'transparent',borderRadius:3,borderLeft:isAct?'3px solid '+c:'3px solid transparent',cursor:isB?'default':'pointer',transition:'all 0.1s',opacity:isCheater?0.35:1}}><span style={{fontSize:sz(18,34,0.017),fontWeight:700,color:a.noPace?'#4A7090':isCheater?'#4A5060':c,minWidth:36}}>#{a.projRank}</span><span style={{fontSize:sz(18,30,0.016),color:isB?c:isCheater?'#4A5060':isAct?'#E2EAF4':a.noPace?'#4A7090':'#9AAABB',flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:isAct?600:400}}>{a.name}</span>{pr!=null&&<span style={{fontSize:sz(12,20,0.011),fontWeight:700,color:isCheater?'#4A5060':pc,minWidth:26,textAlign:'center',borderRadius:3,padding:'1px 4px',letterSpacing:0.5}}>{pr}</span>}<span style={{fontSize:sz(13,24,0.013),color:isB?'#C4920A':a.noPace?'#2C4A68':isCheater?'#4A5060':pc,fontWeight:pr!=null&&pr<=3?700:400,minWidth:52,textAlign:'right',whiteSpace:'nowrap',marginRight:4}}>{a.pace!=null?'$'+a.pace.toFixed(2):''}</span><span style={{fontSize:sz(16,26,0.014),fontWeight:600,minWidth:30,textAlign:'right',color:a.noPace?'#4A7090':chg>0?'#00E676':chg<0?'#E74C3C':'#4A7090'}}>{a.noPace?'?':chg>0?'\u25b2'+chg:chg<0?'\u25bc'+Math.abs(chg):isB?'\u2605':'\u2014'}</span></div>);};
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
    {teamRating&&(
      <div style={{background:'#C4920A',color:'#030B17',padding:'7px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6,fontWeight:700,letterSpacing:1,fontSize:12}}>
        <span>PREVIOUS 7 DAYS TEAM RANKING \xb7 {teamRating.history.map(h=>h.rating==null?'—':h.rating).join(', ')}</span>
        <span>OVERALL {teamRating.overall}</span>
      </div>
    )}
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
        <button onClick={()=>{if(mode==='GAP')gapZI.current?.();else if(mode==='SV')svZI.current?.();else if(mode==='RANK')rkZI.current?.();else{setYZ(z=>Math.min(30,z*1.25));setXZ(z=>Math.min(30,z*1.25));}}} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:16,fontWeight:700}} title="Zoom in">+</button>
        <span style={{fontSize:12,color:zoomed?'#E8B84B':'#3A6080',minWidth:36,textAlign:'center'}}>{zoomed?('x'+Math.max(yZ,xZ).toFixed(1)):'1x'}</span>
        <button onClick={()=>{if(mode==='GAP')gapZO.current?.();else if(mode==='SV')svZO.current?.();else if(mode==='RANK')rkZO.current?.();else{setYZ(z=>Math.max(1,z*0.8));setXZ(z=>Math.max(1,z*0.8));}}} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:16,fontWeight:700}} title="Zoom out">-</button>
        {!mob&&<><div style={{width:1,height:16,background:'#162030',margin:'0 3px'}}/>
        <button onClick={()=>mode==='GAP'?gapPL.current?.():mode==='SV'?svPL.current?.():mode==='RANK'?rkPL.current?.():setXP(p=>Math.max(0,p-lv.current.days/lv.current.xZ*0.2))} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}}>◄</button>
        <button onClick={()=>mode==='GAP'?gapPU.current?.():mode==='SV'?svPU.current?.():mode==='RANK'?rkPU.current?.():setYP(p=>p+lv.current.yRZ*0.15)} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}}>▲</button>
        <button onClick={()=>mode==='GAP'?gapPD.current?.():mode==='SV'?svPD.current?.():mode==='RANK'?rkPD.current?.():setYP(p=>p-lv.current.yRZ*0.15)} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}}>▼</button>
        <button onClick={()=>mode==='GAP'?gapPR.current?.():mode==='SV'?svPR.current?.():mode==='RANK'?rkPR.current?.():setXP(p=>Math.max(0,Math.min(p+lv.current.days/lv.current.xZ*0.2,lv.current.days-lv.current.days/lv.current.xZ)))} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}}>►</button></>}
        {(mode==='GAP'||zoomed||yP!==0||xP!==0)&&<button onClick={()=>{if(mode==='GAP')gapRZ.current?.();else if(mode==='SV')svRZ.current?.();else if(mode==='RANK')rkRZ.current?.();else resetZoom();}} style={{...BB,background:'#1A0A00',border:'1px solid #C4920A60',color:'#E8B84B',fontSize:12,marginLeft:2}}>RESET</button>}
      </div>
      <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
        {[['#E8B84B','Beagle'],['#00E676','<100d'],['#69F0AE','catching'],['#3A6090','away'],['#E74C3C','passed']].map(([c,l])=>(<span key={l} style={{display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}><span style={{width:l==='Beagle'?20:15,height:l==='Beagle'?3:2,background:c,display:'inline-block',borderRadius:2}}/><span style={{fontSize:12,color:'#8AAABB'}}>{l}</span></span>))}
      </div>
    </div>
    <div style={{padding:'2px 4px 4px',display:'flex',flexDirection:'column',flex:showR?'0 0 auto':'1 1 0%',minHeight:0,touchAction:'auto'}}>
      {portrait&&(<div style={{background:'#0A1520',border:'1px solid #1A3A5A',borderRadius:4,padding:'6px 12px',marginBottom:6,display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#5A8AAB',letterSpacing:'.05em'}}><span style={{fontSize:16}}>&#8635;</span><span>ROTATE DEVICE FOR BEST EXPERIENCE</span></div>)}
      {mode==='GAP'?(<div style={{position:'relative',width:'100%',flex:showR?'0 0 auto':'1 1 0%',height:showR?(portrait?'44vh':'38vh'):'100%',minHeight:0,background:'#000000',borderRadius:2}}><canvas ref={gapCvs} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',display:'block'}}/></div>):mode==='SV'?(<div style={{position:'relative',width:'100%',flex:showR?'0 0 auto':'1 1 0%',height:showR?(portrait?'44vh':'38vh'):'100%',minHeight:0,background:'#000000',borderRadius:2}}><canvas ref={svCvs} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',display:'block'}}/></div>):mode==='RANK'?(<div style={{position:'relative',width:'100%',flex:showR?'0 0 auto':'1 1 0%',height:showR?(portrait?'44vh':'38vh'):'100%',minHeight:0,background:'#000000',borderRadius:2}}>
  <canvas ref={rkCvs} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',display:'block'}} onClick={()=>{}}/>
  {rkTip&&(<div onClick={()=>setRkTip(null)} style={{position:'fixed',left:Math.min(rkTip.tipX+12,window.innerWidth-280),top:Math.max(rkTip.tipY-110,8),zIndex:999,background:'#0A1520',border:'1px solid #1A3A5A',borderRadius:6,padding:'10px 14px',minWidth:240,maxWidth:280,boxShadow:'0 4px 20px rgba(0,0,0,0.7)',cursor:'pointer'}}>
    <div style={{fontSize:10,color:'#5A8AAB',letterSpacing:'.1em',marginBottom:6}}>RANK CROSSOVER · TAP TO CLOSE</div>
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
      <span style={{width:8,height:8,borderRadius:'50%',background:rkTip.aUp?rkTip.colorA:rkTip.colorB,display:'inline-block'}}/>
      <span style={{color:'#E2EAF4',fontWeight:700,fontSize:13}}>{rkTip.aUp?rkTip.nameA:rkTip.nameB}</span>
      <span style={{color:'#00E676',fontWeight:700,fontSize:12}}>▲#{rkTip.aUp?rkTip.rankAbefore:rkTip.rankBbefore}→#{rkTip.aUp?rkTip.rankAafter:rkTip.rankBafter}</span>
      <span style={{color:'#7AAAC8',fontSize:11,marginLeft:'auto'}}>{'$'+(rkTip.aUp?rkTip.paceA:rkTip.paceB).toFixed(2)+'/d'}</span>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
      <span style={{width:8,height:8,borderRadius:'50%',background:rkTip.aUp?rkTip.colorB:rkTip.colorA,display:'inline-block'}}/>
      <span style={{color:'#E2EAF4',fontWeight:700,fontSize:13}}>{rkTip.aUp?rkTip.nameB:rkTip.nameA}</span>
      <span style={{color:'#E74C3C',fontWeight:700,fontSize:12}}>▼#{rkTip.aUp?rkTip.rankBbefore:rkTip.rankAbefore}→#{rkTip.aUp?rkTip.rankBafter:rkTip.rankAafter}</span>
      <span style={{color:'#7AAAC8',fontSize:11,marginLeft:'auto'}}>{'$'+(rkTip.aUp?rkTip.paceB:rkTip.paceA).toFixed(2)+'/d'}</span>
    </div>
    <div style={{fontSize:11,color:'#5A8AAB',borderTop:'1px solid #1A2A3A',paddingTop:6}}>
      {(()=>{const d=rkTip.tx;const s=d<60?Math.round(d)+'d':Math.round(d/30.4)+'MO';const dt=new Date(Date.now()+d*86400000);const ds=dt.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});return s+' from now · ~'+ds;})()}
    </div>
  </div>)}
</div>):(<svg ref={svgRef} className={'svg-chart'+(zoomed?' zoomed':'')} viewBox={'0 0 '+W+' '+H} style={{width:'100%',maxHeight:showR?'38vh':'82vh',display:'block',transition:'max-height 0.3s ease',touchAction:'none'}} onMouseDown={onMouseDown} onDoubleClick={onDblClick}>
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
      {mob?(<div style={{width:'100%'}}>{ranking.slice(0,20).map(renderRow)}</div>):(<div style={{display:'flex',gap:16,width:'100%'}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:sz(13,20,0.012),color:'#8AAABB',fontWeight:600,letterSpacing:1,padding:'0 6px 5px',borderBottom:'1px solid #0A1E30',marginBottom:4}}>1 \u2014 10</div>{ranking.slice(0,10).map(renderRow)}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:sz(13,20,0.012),color:'#8AAABB',fontWeight:600,letterSpacing:1,padding:'0 6px 5px',borderBottom:'1px solid #0A1E30',marginBottom:4}}>11 \u2014 20</div>{ranking.slice(10,20).map(renderRow)}</div></div>)}
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
<div id="pace-root" style="padding:0 8px 16px;background:#030B17"></div>
<script type="text/babel">
(function(){
const {useState,useEffect,useRef,useMemo}=React;
const PACE_COLORS=['#E8B84B','#00E676','#69F0AE','#F9A825','#F57F17','#29B6F6','#AB47BC','#EF5350','#26A69A','#EC407A','#AA00FF','#00B0FF'];
function fmtPct(n){if(n==null)return '—';return (n>0?'+':'')+n.toFixed(1)+'%';}
function PaceTrendApp(){
  const [data,setData]=useState(null);
  const [sel,setSel]=useState(null);
  const [loading,setLoading]=useState(true);
  const cvs=useRef(null),chart=useRef(null);
  useEffect(()=>{fetch('/api/pace-history?days=30').then(r=>r.json()).then(d=>{setData(d);setSel(d.labels.length?d.labels.length-1:null);setLoading(false);}).catch(e=>{console.error(e);setLoading(false);});},[]);
  useEffect(()=>{
    if(!data||!cvs.current||typeof Chart==='undefined')return;
    if(chart.current){chart.current.destroy();chart.current=null;}
    const datasets=data.teams.map(t=>({
      label:t.name,
      data:t.points,
      borderColor:t.color,
      backgroundColor:t.color,
      borderWidth:2,
      pointRadius:0,
      pointHoverRadius:5,
      tension:0.35,
      fill:false,
      segment:{borderDash:ctx=>{
        const p0=ctx.p0.raw,p1=ctx.p1.raw;
        if((p0&&p0.interpolated)||(p1&&p1.interpolated))return[6,6];
      }}
    }));
    chart.current=new Chart(cvs.current.getContext('2d'),{
      type:'line',
      data:{labels:data.labels,datasets},
      options:{
        responsive:true,
        maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        onHover:(e,els)=>{if(els&&els.length){const i=els[0].index;if(i!=null)setSel(i);}},
        onClick:(e,els)=>{if(els&&els.length){const i=els[0].index;if(i!=null)setSel(i);}},
        plugins:{
          legend:{display:false},
          tooltip:{
            backgroundColor:'#0A1520',
            titleColor:'#E8B84B',
            bodyColor:'#E2EAF4',
            borderColor:'#1A3A5A',
            borderWidth:1,
            callbacks:{
              title:items=>data.labels[items[0].dataIndex],
              label:item=>{
                const p=item.raw;
                const v=p.y!=null?p.y.toFixed(3):'NA';
                return item.dataset.label+': $'+v+'/day'+(p.interpolated?' (interpolated)':'');
              }
            }
          }
        },
        scales:{
          x:{grid:{color:'#162030'},ticks:{color:'#5A8AAB',maxRotation:45,minRotation:30}},
          y:{grid:{color:'#162030'},ticks:{color:'#5A8AAB',callback:v=>'$'+v},title:{display:true,text:'PACE ($ / day)',color:'#8AAABB'}}
        }
      }
    });
    return()=>{if(chart.current){chart.current.destroy();chart.current=null;}};
  },[data]);
  const selected=useMemo(()=>{
    if(sel==null||!data)return null;
    const date=data.labels[sel];
    const rows=data.teams.map(t=>({...t,point:t.points[sel]})).filter(r=>r.point&&r.point.y!=null).sort((a,b)=>b.point.y-a.point.y);
    const withPct=rows.filter(r=>r.point&&r.point.pct!=null);
    const top=withPct.length?withPct.reduce((a,b)=>b.point.pct>a.point.pct?b:a):null;
    const bottom=withPct.length?withPct.reduce((a,b)=>b.point.pct<a.point.pct?b:a):null;
    return {date,rows,top,bottom};
  },[sel,data]);
  if(loading)return <div style={{padding:16,color:'#5A8ABB'}}>Loading pace history...</div>;
  if(!data||!data.teams.length)return <div style={{padding:16,color:'#5A8ABB'}}>No pace history available.</div>;
  return (
    <div style={{padding:'0 8px 16px',background:'#030B17'}}>
      <div style={{background:'#040C18',border:'1px solid #0A1E30',borderTop:'2px solid #C4920A',borderRadius:6,padding:14}}>
        <div style={{fontSize:15,color:'#E8B84B',fontWeight:700,letterSpacing:1,marginBottom:10}}>TOP 10 PACE TEAMS · DAILY TREND</div>
        {selected&&(
          <div style={{background:'#0A1520',border:'1px solid #1A3A5A',borderRadius:6,padding:'10px 14px',marginBottom:12}}>
            <div style={{fontSize:16,fontWeight:700,color:'#E8B84B',marginBottom:8}}>{selected.date}</div>
            {selected.top&&<div style={{fontSize:13,color:'#00E676',marginBottom:4}}>&#9650; Top performer: {selected.top.name} {fmtPct(selected.top.point.pct)} {'($'+selected.top.point.y.toFixed(3)+'/day)'}</div>}
            {selected.bottom&&<div style={{fontSize:13,color:'#E74C3C',marginBottom:8}}>&#9660; Bottom performer: {selected.bottom.name} {fmtPct(selected.bottom.point.pct)} {'($'+selected.bottom.point.y.toFixed(3)+'/day)'}</div>}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8}}>
              {selected.rows.map((r,i)=>{
                const pct=r.point.pct;
                const pctColor=pct>0?'#00E676':pct<0?'#E74C3C':'#8AAABB';
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,background:'#030B17',borderRadius:4,padding:'6px 8px'}}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:r.color,display:'inline-block'}}/>
                    <span style={{fontSize:12,fontWeight:600,color:'#E2EAF4',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</span>
                    <span style={{fontSize:12,fontWeight:700,color:'#E8B84B'}}>{'$'+r.point.y.toFixed(3)+'/d'}</span>
                    <span style={{fontSize:11,fontWeight:600,color:pctColor}}>{fmtPct(pct)}</span>
                    {r.point.interpolated&&<span style={{fontSize:10,color:'#5A8AAB',marginLeft:2}}>*</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{height:320,position:'relative'}}>
          <canvas ref={cvs} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%'}}/>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px 14px',marginTop:10}}>
          {data.teams.map(t=>{
            const last=t.points[t.points.length-1];
            return (
              <span key={t.name} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#8AAABB'}}>
                <span style={{width:10,height:10,borderRadius:'50%',background:t.color,display:'inline-block'}}/>
                {t.name} {last&&last.y!=null?'$'+last.y.toFixed(3):''}
              </span>
            );
          })}
        </div>
        <div style={{fontSize:11,color:'#5A8AAB',marginTop:8}}>* dotted line = missing-day interpolation · touch chart to see each day</div>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('pace-root')).render(<PaceTrendApp/>);
})();
</script>
</body>
</html>`;

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

module.exports = { HTML, HTML_COMPILED, precompileJSX };
