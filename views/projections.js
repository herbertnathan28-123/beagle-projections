const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// ATL-131: the projections app lives in its own JSX file, and the canonical
// pace maths (lib/pace.js) is loaded into the page verbatim as window.PaceLib,
// so the browser runs the exact code the server and the Discord post use.
const PROJECTIONS_APP = fs.readFileSync(path.join(__dirname, 'projections-app.jsx'), 'utf8');
const PACE_BOARD = fs.readFileSync(path.join(__dirname, 'pace-board.jsx'), 'utf8');
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
<script type="text/babel">__PACE_BOARD__</script>
<script type="text/babel">
/* PACE_TREND_ANIM_v1_OK — animated split-axis daily pace trend + alliance cards */
(function(){
const {useState,useEffect,useRef,useMemo,useCallback}=React;
const NIL='nil data';
window.__PACE_TREND_BUILD='PACE_TREND_ANIM_v1_OK';
function fmtV(v){return '$'+v.toFixed(3);}

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
    const onTab=function(e){setTab(e.detail==='trend'?'pace':e.detail);};
    window.addEventListener('pace-tab',onTab);
    return function(){window.removeEventListener('pace-tab',onTab);};
  },[]);
  const btn=function(active){return{background:active?'#1A3050':'transparent',border:'1px solid '+(active?'#4A80B0':'#162030'),color:active?'#E8B84B':'#6A9AB5',borderRadius:3,padding:'6px 16px',fontSize:13,fontWeight:700,letterSpacing:1,cursor:'pointer'};};
  return(<div>
    <div style={{display:'flex',gap:6,padding:'8px 12px',background:'#040C18',borderBottom:'1px solid #0A1E30'}}>
      <button style={btn(tab==='pace')} onClick={function(){setTab('pace');}}>CURRENT PACE 1—20</button>
      <button style={btn(tab==='projections')} onClick={function(){setTab('projections');}}>PROJECTIONS</button>
      <button style={btn(tab==='cards')} onClick={function(){setTab('cards');}}>ALLIANCE CARDS</button>
    </div>
    {tab==='pace'?<window.PaceBoard/>:tab==='cards'?<AllianceCards/>:null}
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
  .replace('__PROJECTIONS_APP__', () => PROJECTIONS_APP)
  .replace('__PACE_BOARD__', () => PACE_BOARD);
const HTML_COMPILED = precompileJSX(HTML_FULL);

module.exports = { HTML: HTML_FULL, HTML_COMPILED, precompileJSX };
