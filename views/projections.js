const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// ATL-131: the projections app lives in its own JSX file, and the canonical
// pace maths (lib/pace.js) is loaded into the page verbatim as window.PaceLib,
// so the browser runs the exact code the server and the Discord post use.
const PROJECTIONS_APP = fs.readFileSync(path.join(__dirname, 'projections-app.jsx'), 'utf8');
const PACE_LIB = '(function(){var module={exports:{}};' +
  fs.readFileSync(path.join(__dirname, '..', 'lib', 'pace.js'), 'utf8') +
  '\n;window.PaceLib=module.exports;})();';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<title>Beagle Global \u2014 Alliance Projections v45</title>
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
</style>
</head>
<body>
<div id="diag" style="position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#E8B84B;color:#000;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:700;z-index:9999;letter-spacing:.05em;">LOADING...</div>
<div id="tabs-root"></div>
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
<script>__PACE_LIB__</script>
<script type="text/babel">__PROJECTIONS_APP__</script>
<script type="text/babel">
/* PACE_TREND_ANIM_v1_OK — animated split-axis daily pace trend + alliance cards */
(function(){
const {useState,useEffect,useRef,useMemo,useCallback}=React;
const NIL='nil data';
const ANIM_MS=5200;
const DEF_DAYS=14;
window.__PACE_TREND_BUILD='PACE_TREND_ANIM_v1_OK';
function realIdx(pts){const o=[];for(let i=0;i<pts.length;i++){if(pts[i].y!=null)o.push(i);}return o;}
function fmtV(v){return '$'+v.toFixed(3);}
function lastReal(pts){for(let i=pts.length-1;i>=0;i--){if(pts[i].y!=null)return pts[i];}return null;}
function prevReal(pts){let seen=0;for(let i=pts.length-1;i>=0;i--){if(pts[i].y!=null){seen++;if(seen===2)return pts[i];}}return null;}
function shortName(s){return s&&s.length>17?s.slice(0,16)+'\u2026':s;}

/* One panel = one independent y-axis. Alliances 1-10 and 11-20 never share a scale. */
function TrendPanel(props){
  const teams=props.teams,labels=props.labels,nilDays=props.nilDays,prog=props.prog;
  const selDay=props.selDay,iso=props.iso,hidden=props.hidden;
  const W=1600,H=470,ml=90,mr=230,mt=30,mb=76;
  const cw=W-ml-mr,ch=H-mt-mb;
  const n=labels.length||1;
  const vis=teams.filter(t=>!hidden[t.name]);
  /* Zoom/pan is expressed as the visible domain, not as an SVG transform, so
     axes, gridlines, labels and lines are all built from the same X/Y and
     cannot drift out of alignment. Opens on the most recent DEF_DAYS; zoom out
     for the whole month. */
  const defView=function(){
    return{xz:n>DEF_DAYS?(n-1)/(DEF_DAYS-1):1,yz:1,xc:(n-1)-(DEF_DAYS-1)/2,yc:null};
  };
  const [view,setView]=useState(defView);
  const [pins,setPins]=useState({});
  const pinKey=function(name,i){return name+'@'+i;};
  const togglePin=function(name,i){
    setPins(function(p){
      const k=pinKey(name,i),o={};
      for(const q in p)if(p[q]&&q!==k)o[q]=true;
      if(!p[k])o[k]=true;
      return o;
    });
  };
  const zoomed=view.xz>1.001||view.yz>1.001;
  const xSpan=(n-1)/view.xz||1;
  const xcRaw=view.xc==null?(n-1)/2:view.xc;
  const xStart=Math.max(0,Math.min(xcRaw-xSpan/2,Math.max(0,(n-1)-xSpan)));
  /* The y-axis fits what is actually on screen, so narrowing the window
     spreads the lines instead of leaving them squashed by an off-screen spike. */
  const vals=[];
  vis.forEach(function(t){t.points.forEach(function(p,i){
    if(p.y!=null&&i>=xStart-0.5&&i<=xStart+xSpan+0.5)vals.push(p.y);
  });});
  const mn=vals.length?Math.min.apply(null,vals):0;
  const mx=vals.length?Math.max.apply(null,vals):1;
  const pad=(mx-mn)*0.14||Math.max(0.5,Math.abs(mx)*0.1);
  const fy0=mn-pad,fy1=mx+pad;
  const vFull=fy1-fy0;
  const vSpan=vFull/view.yz;
  const ycRaw=view.yc==null?(fy0+fy1)/2:view.yc;
  const y0=Math.max(fy0,Math.min(ycRaw-vSpan/2,fy1-vSpan));
  const y1=y0+vSpan;
  const X=function(i){return ml+(n>1?((i-xStart)/xSpan)*cw:cw/2);};
  const Y=function(v){return mt+ch-((v-y0)/(y1-y0))*ch;};
  const colW=cw/xSpan;
  const inView=function(i){return i>=xStart-1&&i<=xStart+xSpan+1;};
  const head=(n-1)*prog;
  const ticks=[];
  for(let k=0;k<=4;k++)ticks.push(y0+(y1-y0)*k/4);
  const svgRef=useRef(null);
  const dragRef=useRef(null);
  const geo=useRef({});
  geo.current={n:n,xSpan:xSpan,xStart:xStart,vSpan:vSpan,y0:y0,y1:y1,fy0:fy0,fy1:fy1,vFull:vFull};
  const toBox=function(cx,cy){
    const r=svgRef.current.getBoundingClientRect();
    return{fx:(cx-r.left)/r.width*W,fy:(cy-r.top)/r.height*H};
  };
  const zoomAt=function(fx,fy,f){
    const g=geo.current;
    const px=Math.max(0,Math.min(1,(fx-ml)/cw));
    const py=Math.max(0,Math.min(1,(fy-mt)/ch));
    const iAt=g.xStart+px*g.xSpan;
    const vAt=g.y1-py*(g.y1-g.y0);
    setView(function(v){
      const xz=Math.max(1,Math.min(24,v.xz*f));
      const yz=Math.max(1,Math.min(24,v.yz*f));
      const nx=(g.n-1)/xz||1;
      const nv=g.vFull/yz;
      return{xz:xz,yz:yz,xc:iAt-(px-0.5)*nx,yc:vAt+(py-0.5)*nv};
    });
  };
  const panBy=function(dfx,dfy){
    const g=geo.current;
    setView(function(v){
      return{xz:v.xz,yz:v.yz,
        xc:(v.xc==null?(g.n-1)/2:v.xc)-(dfx/cw)*g.xSpan,
        yc:(v.yc==null?(g.fy0+g.fy1)/2:v.yc)+(dfy/ch)*(g.y1-g.y0)};
    });
  };
  useEffect(function(){
    const el=svgRef.current;
    if(!el)return;
    const onWheel=function(e){
      e.preventDefault();
      const b=toBox(e.clientX,e.clientY);
      zoomAt(b.fx,b.fy,e.deltaY<0?1.18:1/1.18);
    };
    let pinch=null;
    const dist=function(t){return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);};
    const onTouchStart=function(e){
      if(e.touches.length===2){
        pinch={d:dist(e.touches),cx:(e.touches[0].clientX+e.touches[1].clientX)/2,cy:(e.touches[0].clientY+e.touches[1].clientY)/2};
      }else if(e.touches.length===1){
        pinch=null;
        dragRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY,moved:false,touch:true};
      }
    };
    const onTouchMove=function(e){
      if(e.touches.length===2&&pinch){
        e.preventDefault();
        const d=dist(e.touches);
        if(pinch.d>0&&Math.abs(d-pinch.d)>1){
          const b=toBox(pinch.cx,pinch.cy);
          zoomAt(b.fx,b.fy,d/pinch.d);
          pinch.d=d;
        }
      }else if(e.touches.length===1&&dragRef.current&&dragRef.current.touch){
        e.preventDefault();
        const t=e.touches[0],d=dragRef.current;
        const r=el.getBoundingClientRect();
        panBy((t.clientX-d.x)/r.width*W,(t.clientY-d.y)/r.height*H);
        if(Math.abs(t.clientX-d.x)+Math.abs(t.clientY-d.y)>6)d.moved=true;
        d.x=t.clientX;d.y=t.clientY;
      }
    };
    const onTouchEnd=function(){pinch=null;};
    el.addEventListener('wheel',onWheel,{passive:false});
    el.addEventListener('touchstart',onTouchStart,{passive:false});
    el.addEventListener('touchmove',onTouchMove,{passive:false});
    el.addEventListener('touchend',onTouchEnd);
    return function(){
      el.removeEventListener('wheel',onWheel);
      el.removeEventListener('touchstart',onTouchStart);
      el.removeEventListener('touchmove',onTouchMove);
      el.removeEventListener('touchend',onTouchEnd);
    };
  },[]);
  useEffect(function(){
    const onMove=function(e){
      const d=dragRef.current;
      if(!d||d.touch)return;
      const r=svgRef.current.getBoundingClientRect();
      panBy((e.clientX-d.x)/r.width*W,(e.clientY-d.y)/r.height*H);
      if(Math.abs(e.clientX-d.x)+Math.abs(e.clientY-d.y)>4)d.moved=true;
      d.x=e.clientX;d.y=e.clientY;
    };
    const onUp=function(){
      const d=dragRef.current;
      if(d)d.up=Date.now();
      if(d&&!d.moved)dragRef.current=null;
    };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    return function(){
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
    };
  },[]);
  /* A drag that moved swallows the click it ends with, so panning never
     selects a day or isolates a line. */
  const dragged=function(){
    const d=dragRef.current;
    if(d&&d.moved){dragRef.current=null;return true;}
    return false;
  };
  /* Value shown for a day the alliance has no reading for: the position its own
     line passes through, never a number. The readout prints "nil data". */
  const bridgeY=function(t,i){
    const ri=realIdx(t.points);
    if(!ri.length)return null;
    if(t.points[i].y!=null)return Y(t.points[i].y);
    let a=null,b=null;
    for(let k=0;k<ri.length;k++){if(ri[k]<i)a=ri[k];if(ri[k]>i&&b==null)b=ri[k];}
    if(a==null&&b==null)return null;
    if(a==null)return Y(t.points[b].y);
    if(b==null)return Y(t.points[a].y);
    const ya=t.points[a].y,yb=t.points[b].y;
    return Y(ya+(yb-ya)*((i-a)/(b-a)));
  };
  const valAt=function(t,i){
    const ri=realIdx(t.points);
    if(!ri.length)return null;
    if(i<=ri[0])return t.points[ri[0]].y;
    if(i>=ri[ri.length-1])return t.points[ri[ri.length-1]].y;
    let a=ri[0],b=null;
    for(let k=0;k<ri.length;k++){if(ri[k]<=i)a=ri[k];else if(b==null)b=ri[k];}
    if(b==null)return t.points[a].y;
    const ya=t.points[a].y,yb=t.points[b].y;
    return ya+(yb-ya)*((i-a)/(b-a));
  };
  /* Names sit where their own line leaves the visible window, so panning and
     zooming keep each name against its line; a line pushed out of the panel
     vertically takes its name with it. */
  const edge=Math.max(xStart,Math.min(head,xStart+xSpan));
  const ends=[];
  vis.forEach(function(t){
    const v=valAt(t,edge);
    if(v==null)return;
    const ty=Y(v);
    if(ty<mt-1||ty>mt+ch+1)return;
    ends.push({name:t.name,color:t.color,x:X(edge),y:ty,anchor:ty});
  });
  ends.sort(function(a,b){return a.y-b.y;});
  for(let i=1;i<ends.length;i++){if(ends[i].y-ends[i-1].y<14)ends[i].y=ends[i-1].y+14;}
  const spill=ends.length?ends[ends.length-1].y-(mt+ch):0;
  if(spill>0)ends.forEach(function(e){e.y-=spill;});
  /* Day readouts are boxed beside each alliance's own line, in the same style as
     a tapped dot. Lines sit close together, so boxes are pushed apart and keep a
     leader line back to the point they belong to. */
  const RBH=19;
  const readouts=[];
  if(selDay!=null){
    vis.map(function(t){return{t:t,by:bridgeY(t,selDay)};})
      .filter(function(e){return e.by!=null&&e.by>=mt&&e.by<=mt+ch;})
      .sort(function(a,b){return a.by-b.by;})
      .forEach(function(e,k){
        const p=e.t.points[selDay];
        const text=p.y!=null?fmtV(p.y):NIL;
        let by=e.by-RBH/2;
        if(k&&by<readouts[k-1].by+RBH+2)by=readouts[k-1].by+RBH+2;
        by=Math.max(mt+1,Math.min(by,mt+ch-RBH-1));
        const w=text.length*6.4+14;
        const right=X(selDay)+9+w<=ml+cw-2;
        readouts.push({name:e.t.name,color:e.t.color,real:p.y!=null,text:text,
          w:w,x:right?X(selDay)+9:X(selDay)-9-w,edge:right?X(selDay)+9:X(selDay)-9,by:by,anchor:e.by});
      });
  }
  const clipId=props.id+'-clip';
  const plotId=props.id+'-plot';
  const labelStep=Math.max(1,Math.round(xSpan/14));
  return(<div style={{background:'#040C18',border:'1px solid #0A1E30',borderTop:'2px solid #C4920A',borderRadius:6,padding:'10px 12px 12px'}}>
    <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:6}}>
      <span style={{fontSize:14,color:'#E8B84B',fontWeight:700,letterSpacing:1}}>{props.title}</span>
      <span style={{fontSize:11,color:'#4A7090',letterSpacing:'.06em'}}>OWN Y-AXIS \u00b7 $ PER DAY</span>
      <span style={{fontSize:10,color:'#3E6280',letterSpacing:'.06em'}}>WHEEL OR PINCH TO ZOOM \u00b7 DRAG TO PAN \u00b7 TAP A DOT FOR ITS PRICE</span>
      {Object.keys(pins).length>0&&<button onClick={function(){setPins({});}} style={{marginLeft:'auto',background:'transparent',border:'1px solid #2C4A6E',color:'#7FAACC',borderRadius:3,padding:'3px 10px',fontSize:11,fontWeight:700,letterSpacing:1,cursor:'pointer'}}>CLEAR {Object.keys(pins).length} PRICE{Object.keys(pins).length>1?'S':''}</button>}
      <button onClick={function(){setView(zoomed?{xz:1,yz:1,xc:null,yc:null}:defView());}} style={{marginLeft:'auto',background:'#12233A',border:'1px solid #2C4A6E',color:'#E8B84B',borderRadius:3,padding:'3px 10px',fontSize:11,fontWeight:700,letterSpacing:1,cursor:'pointer'}}>{zoomed?'FULL MONTH':'LAST '+DEF_DAYS+' DAYS'}</button>
    </div>
    <svg ref={svgRef} viewBox={'0 0 '+W+' '+H} onMouseDown={function(e){dragRef.current={x:e.clientX,y:e.clientY,moved:false};}} style={{width:'100%',height:'auto',maxHeight:'44vh',display:'block',userSelect:'none',touchAction:'none',cursor:'grab'}}>
      <defs>
        <clipPath id={clipId}><rect x={ml-1} y={mt-14} width={Math.max(0,X(head)-ml+2)} height={ch+28}/></clipPath>
        <clipPath id={plotId}><rect x={ml} y={mt} width={cw} height={ch}/></clipPath>
      </defs>
      <rect x={ml} y={mt} width={cw} height={ch} fill="#030810" rx="2"/>
      {nilDays.filter(inView).map(function(i){return(<g key={'nil'+i}>
        <rect x={Math.max(ml,X(i)-colW/2)} y={mt} width={Math.min(colW,ml+cw-Math.max(ml,X(i)-colW/2))} height={ch} fill="#0E1726" opacity="0.85"/>
        <text x={X(i)} y={mt+ch+34} textAnchor="middle" fill="#5A7A96" fontSize="10" fontStyle="italic">{NIL}</text>
      </g>);})}
      {ticks.map(function(v,k){return(<g key={'t'+k}>
        <line x1={ml} x2={ml+cw} y1={Y(v)} y2={Y(v)} stroke="#16283C" strokeWidth="0.7" strokeDasharray="4,6"/>
        <text x={ml-8} y={Y(v)+4} textAnchor="end" fill="#5A8AAB" fontSize="12">{'$'+v.toFixed(2)}</text>
      </g>);})}
      {labels.map(function(l,i){return(i%labelStep===0&&inView(i))?(<text key={'x'+i} x={X(i)} y={mt+ch+18} textAnchor="middle" fill="#5A8AAB" fontSize="11">{l}</text>):null;})}
      {labels.map(function(l,i){return inView(i)?(<rect key={'hit'+i} x={Math.max(ml,X(i)-colW/2)} y={mt} width={Math.max(0,Math.min(colW,ml+cw-Math.max(ml,X(i)-colW/2)))} height={ch} fill="transparent" onClick={function(){if(dragged())return;props.onSelDay(selDay===i?null:i);}}/>):null;})}
      <g clipPath={'url(#'+plotId+')'}>
      <g clipPath={'url(#'+clipId+')'}>
        {vis.map(function(t){
          const ri=realIdx(t.points);
          if(!ri.length)return null;
          const d=ri.map(function(i,k){return(k?'L':'M')+X(i).toFixed(1)+','+Y(t.points[i].y).toFixed(1);}).join(' ');
          const dim=iso&&iso!==t.name;
          return(<g key={t.name}>
            <path d={d} stroke="transparent" strokeWidth="16" fill="none" onClick={function(){if(dragged())return;props.onIso(iso===t.name?null:t.name);}}/>
            <path d={d} stroke={t.color} strokeWidth={iso===t.name?3.2:1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={dim?0.09:0.92}/>
            {ri.filter(inView).map(function(i){
              const on=!!pins[pinKey(t.name,i)];
              return(<g key={i}>
                <circle cx={X(i)} cy={Y(t.points[i].y)} r={on?4.4:(iso===t.name?3:2.1)} fill={t.color} stroke={on?'#FFFFFF':'none'} strokeWidth={on?1.2:0} opacity={dim?0.09:0.95}/>
                <circle cx={X(i)} cy={Y(t.points[i].y)} r="10" fill="transparent" style={{cursor:'pointer'}} onClick={function(e){if(dragged())return;e.stopPropagation();togglePin(t.name,i);}}/>
              </g>);
            })}
          </g>);
        })}
      </g>
      </g>
      {ends.map(function(e){
        const dim=iso&&iso!==e.name;
        const lx=Math.min(e.x,ml+cw)+9;
        return(<g key={e.name} opacity={dim?0.15:1}>
          {Math.abs(e.y-e.anchor)>2&&<line x1={Math.min(e.x,ml+cw)+1} y1={e.anchor} x2={lx-2} y2={e.y} stroke={e.color} strokeWidth="0.8" opacity="0.5"/>}
          <text x={lx} y={e.y+4} fill={e.color} fontSize="12" fontWeight="700">{shortName(e.name)}</text>
        </g>);
      })}
      {prog<1&&<line x1={X(head)} x2={X(head)} y1={mt} y2={mt+ch} stroke="#E8B84B" strokeWidth="1.4" opacity="0.75"/>}
      {/* Tap a dot to toggle its price box; any number can stay open at once. */}
      {(function(){
        const boxes=[];
        vis.forEach(function(t){
          t.points.forEach(function(p,i){
            if(p.y==null||!pins[pinKey(t.name,i)]||!inView(i))return;
            const py=Y(p.y);
            if(py<mt||py>mt+ch)return;
            const txt=shortName(t.name)+'  '+labels[i]+'  '+fmtV(p.y);
            boxes.push({key:t.name+i,color:t.color,txt:txt,bw:txt.length*6.6+18,px:X(i),py:Y(p.y)});
          });
        });
        const bh=24;
        boxes.sort(function(a,b){return a.py-b.py;});
        boxes.forEach(function(b,k){
          b.by=Math.max(mt+2,b.py-bh-12);
          if(k&&b.by<boxes[k-1].by+bh+3)b.by=boxes[k-1].by+bh+3;
          b.by=Math.min(b.by,mt+ch-bh-2);
          b.bx=Math.max(ml+2,Math.min(b.px-b.bw/2,ml+cw-b.bw-2));
        });
        return boxes.map(function(b){return(<g key={b.key} style={{pointerEvents:'none'}}>
          <line x1={b.px} y1={b.py} x2={b.bx+b.bw/2} y2={b.by+bh} stroke={b.color} strokeWidth="0.8" opacity="0.55"/>
          <rect x={b.bx} y={b.by} width={b.bw} height={bh} rx="4" fill="#071322" stroke={b.color} strokeWidth="1.2" opacity="0.97"/>
          <text x={b.bx+b.bw/2} y={b.by+16} textAnchor="middle" fill={b.color} fontSize="12.5" fontWeight="700">{b.txt}</text>
        </g>);});
      })()}
      {selDay!=null&&inView(selDay)&&(<g clipPath={'url(#'+plotId+')'}>
        <line x1={X(selDay)} x2={X(selDay)} y1={mt} y2={mt+ch} stroke="#E8B84B" strokeWidth="1" strokeDasharray="3,4" opacity="0.9"/>
        {readouts.map(function(r){
          const dim=iso&&iso!==r.name;
          const col=r.real?r.color:'#5A7A96';
          return(<g key={'v'+r.name} opacity={dim?0.15:1}>
            <line x1={X(selDay)} y1={r.anchor} x2={r.edge} y2={r.by+RBH/2} stroke={col} strokeWidth="0.8" opacity="0.55"/>
            <rect x={r.x} y={r.by} width={r.w} height={RBH} rx="3" fill="#071322" stroke={col} strokeWidth="1.1" opacity="0.97"/>
            <text x={r.x+r.w/2} y={r.by+13.5} textAnchor="middle" fill={col} fontSize="11.5" fontWeight={r.real?'700':'400'}>{r.text}</text>
          </g>);
        })}
      </g>)}
      <line x1={ml} y1={mt} x2={ml} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
      <line x1={ml} y1={mt+ch} x2={ml+cw} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
    </svg>
    <div style={{display:'flex',flexWrap:'wrap',gap:'6px 12px',marginTop:8}}>
      {teams.map(function(t){
        const off=!!hidden[t.name];
        const lr=lastReal(t.points);
        return(<span key={t.name} onClick={function(){props.onLegend(t.name);}} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:off?'#3A5570':'#8AAABB',cursor:'pointer',textDecoration:off?'line-through':'none'}}>
          <span style={{width:10,height:10,borderRadius:'50%',background:off?'#24384C':t.color,display:'inline-block'}}/>
          {t.name}{lr?' '+fmtV(lr.y):''}
        </span>);
      })}
    </div>
  </div>);
}

function PaceDailyTrend(){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState(null);
  const [prog,setProg]=useState(0);
  const [selDay,setSelDay]=useState(null);
  const [iso,setIso]=useState(null);
  const [hidden,setHidden]=useState({});
  const raf=useRef(null);
  useEffect(function(){
    fetch('/api/pace-history?days=30').then(function(r){return r.json();}).then(function(d){setData(d);setLoading(false);}).catch(function(e){setErr(String(e&&e.message||e));setLoading(false);});
  },[]);
  const play=useCallback(function(){
    if(raf.current)cancelAnimationFrame(raf.current);
    const t0=Date.now();
    const step=function(){
      const p=Math.min(1,(Date.now()-t0)/ANIM_MS);
      setProg(p);
      if(p<1)raf.current=requestAnimationFrame(step);
    };
    setProg(0);
    raf.current=requestAnimationFrame(step);
  },[]);
  useEffect(function(){if(data&&data.teams&&data.teams.length)play();return function(){if(raf.current)cancelAnimationFrame(raf.current);};},[data,play]);
  const groups=useMemo(function(){
    if(!data||!data.teams)return{a:[],b:[]};
    const ranked=data.teams.slice().sort(function(x,y){
      const lx=lastReal(x.points),ly=lastReal(y.points);
      return((ly?ly.y:-Infinity)-(lx?lx.y:-Infinity));
    });
    return{a:ranked.slice(0,10),b:ranked.slice(10,20)};
  },[data]);
  const nilDays=useMemo(function(){
    if(!data||!data.teams||!data.teams.length)return[];
    const out=[];
    for(let i=0;i<data.labels.length;i++){
      let any=false;
      data.teams.forEach(function(t){if(t.points[i]&&t.points[i].y!=null)any=true;});
      if(!any)out.push(i);
    }
    return out;
  },[data]);
  const onLegend=useCallback(function(name){
    setHidden(function(h){const nh=Object.assign({},h);if(nh[name])delete nh[name];else nh[name]=true;return nh;});
  },[]);
  if(loading)return <div style={{padding:16,color:'#5A8ABB'}}>Loading pace history\u2026</div>;
  if(err)return <div style={{padding:16,color:'#E74C3C'}}>Pace history unavailable: {err}</div>;
  if(!data||!data.teams||!data.teams.length)return <div style={{padding:16,color:'#5A8ABB'}}>No pace history available.</div>;
  const dayLabel=selDay!=null?data.labels[selDay]:null;
  return(<div style={{padding:'0 8px 16px',background:'#030B17'}}>
    <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',margin:'4px 0 8px'}}>
      <span style={{fontSize:15,color:'#E8B84B',fontWeight:700,letterSpacing:1}}>ALLIANCE PACE \u00b7 DAILY TREND</span>
      <span style={{fontSize:11,color:'#4A7090'}}>{data.start+' \u2192 '+data.end+' \u00b7 tap a dot for its price \u00b7 tap a day for every alliance\u2019s pace \u00b7 tap a line to isolate \u00b7 tap a legend name to hide'}</span>
      <button onClick={play} style={{marginLeft:'auto',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',borderRadius:3,padding:'4px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>REPLAY</button>
      {iso&&<button onClick={function(){setIso(null);}} style={{background:'#1A0A00',border:'1px solid #C4920A60',color:'#E8B84B',borderRadius:3,padding:'4px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>SHOW ALL LINES</button>}
      {selDay!=null&&<button onClick={function(){setSelDay(null);}} style={{background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',borderRadius:3,padding:'4px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{'CLEAR '+dayLabel}</button>}
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <TrendPanel id="p1" title="ALLIANCES 1 \u2014 10" teams={groups.a} labels={data.labels} nilDays={nilDays} prog={prog} selDay={selDay} onSelDay={setSelDay} iso={iso} onIso={setIso} hidden={hidden} onLegend={onLegend}/>
      <TrendPanel id="p2" title="ALLIANCES 11 \u2014 20" teams={groups.b} labels={data.labels} nilDays={nilDays} prog={prog} selDay={selDay} onSelDay={setSelDay} iso={iso} onIso={setIso} hidden={hidden} onLegend={onLegend}/>
    </div>
    <div style={{fontSize:11,color:'#5A8AAB',marginTop:8}}>Shaded columns carry no reading for any alliance \u2014 lines bridge them in their own colour and the day prints \u201cnil data\u201d. Nothing is smoothed into a value.</div>
  </div>);
}

/* ── Alliance cards ─────────────────────────────────────────────────────── */
function heat(pace,mn,mx){
  if(pace==null)return'#3A6090';
  const f=mx>mn?(pace-mn)/(mx-mn):1;
  if(f>=0.8)return'#00E676';
  if(f>=0.6)return'#69F0AE';
  if(f>=0.4)return'#E8B84B';
  if(f>=0.2)return'#FF9E40';
  return'#E74C3C';
}
function Chip(props){
  const v=props.value;
  const up=v>0,down=v<0;
  const c=props.invert?(down?'#00E676':up?'#E74C3C':'#5A8AAB'):(up?'#00E676':down?'#E74C3C':'#5A8AAB');
  const arrow=up?'\u25b2':down?'\u25bc':'\u2014';
  return(<span style={{display:'inline-flex',alignItems:'center',gap:4,background:'#030B17',border:'1px solid '+c+'40',borderRadius:10,padding:'2px 8px',fontSize:11,color:c,fontWeight:700}}>
    <span style={{fontSize:9,color:'#5A8AAB',fontWeight:600,letterSpacing:'.06em'}}>{props.label}</span>
    {arrow}{props.text}
  </span>);
}
function AllianceCards(){
  const [live,setLive]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(function(){
    fetch('/api/data').then(function(r){return r.json();}).then(function(d){setLive(d);setLoading(false);}).catch(function(){setLoading(false);});
  },[]);
  /* ATL-131: every card reads the canonical board (lib/pace.js) — the same
     current pace as the header, the projections, /pace and the Discord post. The
     change chip is the current pace against the same alliance's 30-day rate, and
     the position chip is its pace rank now against its rank on the 30-day rate.
     Every alliance is shown. */
  const cards=useMemo(function(){
    const board=live&&live.canonical;
    if(!board)return[];
    const field=board.alliances.slice();
    const rankBy=function(key){const o={};field.filter(function(c){return c[key]!=null;}).sort(function(x,y){return y[key]-x[key];}).forEach(function(c,i){o[c.name]=i+1;});return o;};
    const nowPos=rankBy('pace'),prevPos=rankBy('longPace');
    const svs=field.map(function(c){return c.sv;}).filter(function(v){return v!=null;});
    const svMin=Math.min.apply(null,svs),svMax=Math.max.apply(null,svs);
    const paces=field.map(function(c){return c.pace;}).filter(function(v){return v!=null;});
    const pMin=paces.length?Math.min.apply(null,paces):0,pMax=paces.length?Math.max.apply(null,paces):1;
    return field.sort(function(x,y){return(x.rank||99)-(y.rank||99);}).map(function(c){
      const dPace=(c.pace!=null&&c.longPace!=null)?c.pace-c.longPace:null;
      const dPos=(nowPos[c.name]&&prevPos[c.name])?prevPos[c.name]-nowPos[c.name]:null;
      const field01=svMax>svMin?(c.sv-svMin)/(svMax-svMin):1;
      return Object.assign({},c,{dPace:dPace,dPos:dPos,field01:field01,heat:heat(c.pace,pMin,pMax),paceRank:nowPos[c.name]||null});
    });
  },[live]);
  if(loading)return <div style={{padding:16,color:'#5A8ABB'}}>Loading alliance cards\u2026</div>;
  if(!cards.length)return <div style={{padding:16,color:'#5A8ABB'}}>No alliance data available.</div>;
  return(<div style={{padding:'10px 8px 24px',background:'#030B17'}}>
    <div style={{fontSize:15,color:'#E8B84B',fontWeight:700,letterSpacing:1,marginBottom:10}}>ALLIANCE CARDS \u00b7 ALL {cards.length}</div>
    <div style={{fontSize:12,color:'#7AAAC8',marginBottom:10}}>Pace on every card is the current pace: SV gained since the previous upload \u00f7 the exact time between uploads \u2014 the same figure as the projections page, the pace page and the Discord post. Chips compare it with the same alliance's 30-day rate.</div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
      {cards.map(function(c){
        return(<div key={c.name} style={{background:'#040C18',border:'1px solid '+(c.isBeagle?'#C4920A':'#0A1E30'),borderLeft:'4px solid '+c.heat,borderRadius:6,padding:'10px 12px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:30,height:24,borderRadius:4,background:c.isBeagle?'#C4920A':'#0A1E30',color:c.isBeagle?'#030B17':'#8AAABB',fontWeight:700,fontSize:13}}>{'#'+(c.rank!=null?c.rank:'?')}</span>
            <span style={{fontSize:14,fontWeight:700,color:c.isBeagle?'#E8B84B':'#E2EAF4',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
            <span style={{marginLeft:'auto',fontSize:11,color:'#5A8AAB'}}>{c.sv!=null?'$'+c.sv.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2}):'\u2014'}</span>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
            <span style={{fontSize:22,fontWeight:700,color:c.heat}}>{c.pace!=null?fmtV(c.pace):NIL}</span>
            <span style={{fontSize:11,color:'#7AAAC8',letterSpacing:'.06em'}}>PER DAY \u00b7 CURRENT{c.paceRank?' \u00b7 PACE #'+c.paceRank:''}</span>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
            <Chip label="VS 30-DAY" value={c.dPace==null?0:c.dPace} text={c.dPace==null?NIL:'$'+Math.abs(c.dPace).toFixed(3)}/>
            <Chip label="PACE RANK VS 30-DAY" value={c.dPos==null?0:c.dPos} text={c.dPos==null?NIL:String(Math.abs(c.dPos))}/>
          </div>
          <div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#4A7090',letterSpacing:'.06em',marginBottom:3}}><span>FIELD POSITION</span><span>{Math.round(c.field01*100)+'%'}</span></div>
            <div style={{position:'relative',height:6,borderRadius:3,background:'#0A1E30'}}>
              <div style={{position:'absolute',left:0,top:0,bottom:0,width:(c.field01*100)+'%',background:c.heat,borderRadius:3,opacity:0.75}}/>
              <div style={{position:'absolute',left:'calc('+(c.field01*100)+'% - 1px)',top:-3,width:2,height:12,background:'#E2EAF4'}}/>
            </div>
          </div>
        </div>);
      })}
    </div>
  </div>);
}

/* ── Current pace 1-10 / 11-20 (ruling 5 Aug) ──────────────────────────────
   Ranked by the canonical current pace from the latest upload (board.paceRank),
   each with the exact window it was measured over and its share-value rank. */
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function utcShort(ts){if(!ts)return'\u2014';const d=new Date(ts),p=function(n){return String(n).padStart(2,'0');};return d.getUTCDate()+' '+MO[d.getUTCMonth()]+' '+p(d.getUTCHours())+':'+p(d.getUTCMinutes());}
function PaceList(props){
  const th={padding:'6px 8px',fontSize:11,letterSpacing:.6,color:'#6E8CA6',fontWeight:700,textAlign:'right'};
  const td={padding:'6px 8px'};
  const mob=window.innerWidth<640;
  const win=function(r){return(r.windowDays!=null?window.PaceLib.fmtWindow(r.windowDays)+' \u00b7 ':'')+utcShort(r.from)+' \u2192 '+utcShort(r.to);};
  return(<div style={{background:'#050D1A',border:'1px solid #0A1E30',borderTop:'2px solid #C4920A',borderRadius:4,padding:'10px 12px'}}>
    <div style={{fontSize:15,color:'#E8B84B',fontWeight:700,letterSpacing:1,marginBottom:8}}>{props.title}</div>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
      <thead><tr><th style={{...th,textAlign:'left'}}>PACE #</th><th style={{...th,textAlign:'left'}}>ALLIANCE</th><th style={th}>PACE /DAY</th>{!mob&&<th style={th}>MEASURED OVER (UTC)</th>}<th style={th}>SV RANK</th></tr></thead>
      <tbody>{props.rows.map(function(r){
        return(<tr key={r.name} style={{borderBottom:'1px solid #0B1A2B',background:r.isBeagle?'rgba(232,184,75,.12)':'transparent',textAlign:'right'}}>
          <td style={{...td,textAlign:'left',fontWeight:800,color:r.isBeagle?'#E8B84B':'#E2EAF4'}}>{'#'+r.paceRank}</td>
          <td style={{...td,textAlign:'left',color:r.isBeagle?'#E8B84B':'#E2EAF4',fontWeight:r.isBeagle?800:500}}><div style={{maxWidth:mob?170:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</div>{mob&&<div style={{fontSize:11,color:'#9AB4C8',fontWeight:400}}>{win(r)+' UTC'}</div>}</td>
          <td style={{...td,fontWeight:700,whiteSpace:'nowrap'}}>{'$'+r.pace.toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3})+'/day'}</td>
          {!mob&&<td style={{...td,color:'#9AB4C8',whiteSpace:'nowrap'}}>{win(r)}</td>}
          <td style={{...td,color:'#9AB4C8'}}>{r.rank!=null?'#'+r.rank:'\u2014'}</td>
        </tr>);
      })}</tbody>
    </table></div>
  </div>);
}
function CurrentPace(){
  const [board,setBoard]=useState(null);
  const [err,setErr]=useState(null);
  useEffect(function(){
    fetch('/api/data').then(function(r){return r.json();}).then(function(d){setBoard(d.canonical||{alliances:[]});}).catch(function(e){setErr(String(e&&e.message||e));});
  },[]);
  if(err)return <div style={{padding:16,color:'#E74C3C'}}>Current pace unavailable: {err}</div>;
  if(!board)return <div style={{padding:16,color:'#5A8ABB'}}>Loading current pace\u2026</div>;
  const ranked=(board.alliances||[]).filter(function(r){return r.paceRank!=null&&r.pace!=null;}).sort(function(a,b){return a.paceRank-b.paceRank;});
  const unread=(board.alliances||[]).filter(function(r){return r.paceRank==null;});
  return(<div style={{padding:'8px 10px 16px',background:'#030B17',display:'flex',flexDirection:'column',gap:10}}>
    <div style={{fontSize:13,color:'#9AB4C8'}}>{'Ordered by current pace from the latest upload \u00b7 data as of '+utcShort(board.asOf)+' UTC'}</div>
    <PaceList title={'CURRENT PACE \u00b7 1 \u2014 10'} rows={ranked.slice(0,10)}/>
    <PaceList title={'CURRENT PACE \u00b7 11 \u2014 20'} rows={ranked.slice(10,20)}/>
    {unread.length>0&&<div style={{fontSize:12,color:'#6E8CA6'}}>{'No pace reading yet: '+unread.map(function(r){return r.name;}).join(', ')}</div>}
    <div style={{fontSize:12,color:'#6E8CA6',lineHeight:1.5}}>{board.methodLabel}</div>
  </div>);
}

/* Top tabs. PROJECTIONS hands the page back to the untouched dashboard in #root;
   the pace panes render here, above it, so they own the full width of the page. */
function TopTabs(){
  const [tab,setTab]=useState('pace');
  useEffect(function(){
    const main=document.getElementById('root');
    if(main)main.style.display=tab==='projections'?'':'none';
  },[tab]);
  /* PACE TREND is opened from the projections toolbar, beside HIDE RANKING. */
  useEffect(function(){
    const onTab=function(e){setTab(e.detail);};
    window.addEventListener('pace-tab',onTab);
    return function(){window.removeEventListener('pace-tab',onTab);};
  },[]);
  const btn=function(active){return{background:active?'#1A3050':'transparent',border:'1px solid '+(active?'#4A80B0':'#162030'),color:active?'#E8B84B':'#6A9AB5',borderRadius:3,padding:'6px 16px',fontSize:13,fontWeight:700,letterSpacing:1,cursor:'pointer'};};
  return(<div>
    <div style={{display:'flex',gap:6,padding:'8px 12px',background:'#040C18',borderBottom:'1px solid #0A1E30'}}>
      <button style={btn(tab==='pace')} onClick={function(){setTab('pace');}}>CURRENT PACE 1—20</button>
      <button style={btn(tab==='projections')} onClick={function(){setTab('projections');}}>PROJECTIONS</button>
      <button style={btn(tab==='cards')} onClick={function(){setTab('cards');}}>ALLIANCE CARDS</button>
      {tab==='trend'&&<button style={btn(true)} onClick={function(){setTab('projections');}}>PACE TREND \u00d7</button>}
    </div>
    {tab==='pace'?<CurrentPace/>:tab==='trend'?<PaceDailyTrend/>:tab==='cards'?<AllianceCards/>:null}
  </div>);
}

ReactDOM.createRoot(document.getElementById('tabs-root')).render(<TopTabs/>);
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

const HTML_FULL = HTML
  .replace('__PACE_LIB__', () => PACE_LIB)
  .replace('__PROJECTIONS_APP__', () => PROJECTIONS_APP);
const HTML_COMPILED = precompileJSX(HTML_FULL);

module.exports = { HTML: HTML_FULL, HTML_COMPILED, precompileJSX };
