// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE GLOBAL — ALLIANCE PROJECTIONS SERVICE — v44
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
  timestamp:  '2026-06-07T07:22:00Z',
  uploader:   'atlas.4693',
  beagleSV:   2929.83,
  beaglePace: 5.312,
  beagleRank: 19,
  // Pace from 12h 20min window (19:02 UTC Jun 6 → 07:22 UTC Jun 7)
  alliances: [
    { rank:1,  name:"Dokdo",            sv:8164.14, pace:7.842 },
    { rank:2,  name:"Valiant Air",      sv:7133.09, pace:7.395 },
    { rank:3,  name:"Free Flying",      sv:5550.95, pace:8.134 },
    { rank:4,  name:"Grizzly Group",    sv:5547.41, pace:4.281 },
    { rank:5,  name:"Per Aspera",       sv:5309.77, pace:4.456 },
    { rank:6,  name:"Indonesia Unity",  sv:4531.24, pace:3.814 },
    { rank:7,  name:"GERMAN ALLIANCE",  sv:4364.19, pace:3.600 },
    { rank:8,  name:"Happy Skies 2.0",  sv:3942.91, pace:3.483 },
    { rank:9,  name:"STARFLEET",        sv:3541.02, pace:3.464 },
    { rank:10, name:"Russian Wings",    sv:3515.59, pace:2.121 },
    { rank:11, name:"CODESHARE",        sv:3505.56, pace:3.522 },
    { rank:12, name:"SpaceX",           sv:3312.59, pace:3.736 },
    { rank:13, name:"ClearSky Group",   sv:3097.31, pace:2.530 },
    { rank:14, name:"JetSTAR",          sv:3085.56, pace:2.530 },
    { rank:15, name:"BRASIL GT",        sv:3048.67, pace:3.289 },
    { rank:16, name:"Mixer World",      sv:3046.26, pace:1.518 },
    { rank:17, name:"Sky Wings",        sv:3027.74, pace:4.106 },
    { rank:18, name:"Alpha Vikings",    sv:2965.52, pace:3.055 },
    { rank:20, name:"Star Alliance",    sv:2833.68, pace:2.977 },
  ]
};

let liveData = { ...DEFAULT_DATA };

// ─── BEAGLE HQ ───────────────────────────────────────────────────────────────
// ============================================================
// BEAGLE HQ — /hq route
// Parser for pace upload format:
// PlayerName $SV $TotalRevenue $AllianceContrib X years/months/days/hours ago Flights X hours/mins ago $LastContrib
// ============================================================

// In-memory store for HQ data
let hqData = {
  timestamp: null,
  uploader: null,
  alliancePace: null,
  airlines: 0,
  players: [],
  history: [] // [{timestamp, alliancePace, airlines}]
};

// Parse a single player line
function parsePaceLine(line) {
  // Last value is $LastContrib (e.g. $597 or $0)
  // Second-to-last group: "X hours/mins ago"
  // Before that: flights number
  // Pattern: Name $SV $Revenue $Contrib X (years|months|days|hours) ago Flights X (hours|mins|secs) ago $LastContrib
  const contrib = line.match(/\$(\d[\d,]*)\s*$/);
  if (!contrib) return null;
  const lastContrib = parseInt(contrib[1].replace(/,/g, ''));

  // Last seen: "X hours ago" / "X mins ago" / "X secs ago"
  const lastSeen = line.match(/(\d+)\s+(hours?|mins?|secs?)\s+ago\s+\$[\d,]+\s*$/);
  let lastSeenStr = '?';
  let lastSeenMins = 9999;
  if (lastSeen) {
    const n = parseInt(lastSeen[1]);
    const u = lastSeen[2];
    if (u.startsWith('sec')) { lastSeenStr = n+'s ago'; lastSeenMins = n/60; }
    else if (u.startsWith('min')) { lastSeenStr = n+'m ago'; lastSeenMins = n; }
    else { lastSeenStr = n+'h ago'; lastSeenMins = n*60; }
  }

  // Flights
  const flightsMatch = line.match(/(\d[\d,]*)\s+\d+\s+(hours?|mins?|secs?)\s+ago\s+\$/);
  const flights = flightsMatch ? parseInt(flightsMatch[1].replace(/,/g, '')) : 0;

  // Alliance contrib (3rd dollar amount)
  const dollars = [...line.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)].map(m => parseFloat(m[1].replace(/,/g,'')));
  const sv = dollars[0] || 0;
  const allianceContrib = dollars[2] || 0;

  // Name: everything before the first $
  const name = line.split('$')[0].trim().replace(/\s+$/, '');

  return { name, sv, allianceContrib, lastContrib, lastSeenStr, lastSeenMins, flights };
}

function parsePaceUpload(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const players = [];
  for (const line of lines) {
    if (!line.includes('$')) continue;
    if (line === '!' || line.startsWith('!')) continue;
    const p = parsePaceLine(line);
    if (p && p.name && p.name.length > 0 && p.name.length < 60) players.push(p);
  }
  return players;
}

const HQ_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<title>Beagle HQ</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{height:-webkit-fill-available}
body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',Calibri,sans-serif;min-height:100vh;min-height:-webkit-fill-available}
::-webkit-scrollbar{width:4px;background:#040C18}
::-webkit-scrollbar-thumb{background:#1A3050;border-radius:2px}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const{useState,useEffect,useRef}=React;

function ContribBar({pct,color}){
  return(<div style={{width:'100%',height:4,background:'#0A1E30',borderRadius:2,marginTop:3}}>
    <div style={{width:pct+'%',height:'100%',background:color,borderRadius:2,transition:'width 0.4s'}}/>
  </div>);
}

function App(){
  const[data,setData]=useState(null);
  const[sort,setSort]=useState('contrib'); // contrib|sv|lastseen|name
  const[filter,setFilter]=useState('all'); // all|active|low|zero
  const[search,setSearch]=useState('');
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    const load=async()=>{
      try{
        const r=await fetch('/api/hq-data');
        if(r.ok){const d=await r.json();setData(d);}
      }catch(e){}
      setLoading(false);
    };
    load();
    const t=setInterval(load,30000);
    return()=>clearInterval(t);
  },[]);

  if(loading) return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}>
    <div style={{fontSize:36,color:'#E8B84B'}}>&#9672;</div>
    <div style={{fontSize:18,color:'#5A8AAB',letterSpacing:2}}>LOADING BEAGLE HQ...</div>
  </div>);

  if(!data||!data.players||data.players.length===0) return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}>
    <div style={{fontSize:36,color:'#E8B84B'}}>&#9672;</div>
    <div style={{fontSize:20,color:'#E8B84B',fontWeight:700,letterSpacing:2}}>BEAGLE HQ</div>
    <div style={{fontSize:15,color:'#5A8AAB',marginTop:8}}>No pace data yet.</div>
    <div style={{fontSize:13,color:'#2C4A6E',marginTop:4}}>Upload player data in the alliance-pace channel to populate.</div>
  </div>);

  const players=[...data.players];
  const maxContrib=Math.max(...players.map(p=>p.lastContrib),1);

  // Filter
  let filtered=players.filter(p=>{
    if(filter==='active') return p.lastSeenMins<180;
    if(filter==='low') return p.lastContrib>0&&p.lastContrib<40000;
    if(filter==='zero') return p.lastContrib===0;
    return true;
  });
  if(search) filtered=filtered.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));

  // Sort
  filtered.sort((a,b)=>{
    if(sort==='contrib') return b.lastContrib-a.lastContrib;
    if(sort==='sv') return b.sv-a.sv;
    if(sort==='lastseen') return a.lastSeenMins-b.lastSeenMins;
    if(sort==='name') return a.name.localeCompare(b.name);
    return 0;
  });

  const totalContrib=players.reduce((s,p)=>s+p.lastContrib,0);
  const activeCount=players.filter(p=>p.lastSeenMins<180).length;
  const zeroCount=players.filter(p=>p.lastContrib===0).length;
  const lowCount=players.filter(p=>p.lastContrib>0&&p.lastContrib<40000).length;
  const avgContrib=players.length?Math.round(totalContrib/players.length):0;

  const fmt=n=>n>=1000000?(n/1000000).toFixed(2)+'M':n>=1000?(n/1000).toFixed(1)+'k':n.toString();
  const contribColor=c=>c===0?'#E74C3C':c<40000?'#E8B84B':c<80000?'#00E676':'#69F0AE';
  const activeColor=m=>m<60?'#69F0AE':m<180?'#00E676':m<360?'#E8B84B':'#E74C3C';

  const ts=data.timestamp?new Date(data.timestamp).toUTCString().replace(/.*?(\d+:\d+:\d+).*/,'$1')+' UTC':'—';

  const BB={border:'none',borderRadius:3,cursor:'pointer',padding:'4px 10px',fontFamily:'inherit',fontWeight:600,fontSize:13,letterSpacing:0.5};
  const SB=(s)=>({...BB,background:sort===s?'#1A3050':'transparent',border:'1px solid '+(sort===s?'#4A80B0':'#162030'),color:sort===s?'#E8B84B':'#5A8AAB'});
  const FB=(f,col)=>({...BB,background:filter===f?'#0A1E30':'transparent',border:'1px solid '+(filter===f?col:'#162030'),color:filter===f?col:'#4A7090'});

  return(<div style={{background:'#030B17',minHeight:'100vh',display:'flex',flexDirection:'column'}}>

    {/* HEADER */}
    <div style={{background:'linear-gradient(90deg,#04101E,#0A1C32)',borderBottom:'2px solid #C4920A',padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:4}}>
      <div>
        <div style={{fontSize:22,fontWeight:700,color:'#E8B84B',letterSpacing:2}}>&#9672; BEAGLE HQ</div>
        <div style={{fontSize:13,color:'#5A8AAB',marginTop:2,letterSpacing:1}}>PLAYER PACE MONITOR &nbsp;&#183;&nbsp; UPDATED {ts} &nbsp;&#183;&nbsp; {data.uploader||'—'}</div>
      </div>
      <div style={{textAlign:'right'}}>
        <div style={{fontSize:22,fontWeight:700,color:'#E8B84B'}}>{data.alliancePace||'—'}</div>
        <div style={{fontSize:13,color:'#8AAABB',letterSpacing:1}}>{data.airlines||0} AIRLINES</div>
      </div>
    </div>

    {/* SUMMARY CARDS */}
    <div style={{display:'flex',gap:8,padding:'8px 12px',background:'#040C18',borderBottom:'1px solid #0A1E30',flexWrap:'wrap'}}>
      {[
        {label:'TOTAL CONTRIB',value:'$'+fmt(totalContrib),color:'#E8B84B'},
        {label:'AVG PER PLAYER',value:'$'+fmt(avgContrib),color:'#8AAABB'},
        {label:'ACTIVE (<3h)',value:activeCount+'/'+players.length,color:'#00E676'},
        {label:'LOW CONTRIB',value:lowCount,color:'#E8B84B'},
        {label:'ZERO CONTRIB',value:zeroCount,color:zeroCount>0?'#E74C3C':'#4A7090'},
      ].map(c=>(
        <div key={c.label} style={{background:'#06121E',border:'1px solid #0A1E30',borderRadius:4,padding:'5px 12px',minWidth:100}}>
          <div style={{fontSize:10,color:'#3A6080',letterSpacing:1,marginBottom:2}}>{c.label}</div>
          <div style={{fontSize:18,fontWeight:700,color:c.color}}>{c.value}</div>
        </div>
      ))}
    </div>

    {/* CONTROLS */}
    <div style={{display:'flex',gap:6,padding:'6px 12px',background:'#040C18',borderBottom:'1px solid #0A1E30',alignItems:'center',flexWrap:'wrap',rowGap:4}}>
      <span style={{fontSize:12,color:'#3A6080',letterSpacing:1,marginRight:4}}>SORT</span>
      {[['contrib','CONTRIB'],['sv','SV'],['lastseen','LAST SEEN'],['name','NAME']].map(([k,l])=>(
        <button key={k} onClick={()=>setSort(k)} style={SB(k)}>{l}</button>
      ))}
      <div style={{width:1,height:16,background:'#162030',margin:'0 4px'}}/>
      <button onClick={()=>setFilter('all')} style={FB('all','#8AAABB')}>ALL ({players.length})</button>
      <button onClick={()=>setFilter('active')} style={FB('active','#00E676')}>ACTIVE ({activeCount})</button>
      <button onClick={()=>setFilter('low')} style={FB('low','#E8B84B')}>LOW ({lowCount})</button>
      <button onClick={()=>setFilter('zero')} style={FB('zero','#E74C3C')}>ZERO ({zeroCount})</button>
      <div style={{marginLeft:'auto'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search player..." style={{background:'#06121E',border:'1px solid #1A3050',borderRadius:3,color:'#E2EAF4',padding:'4px 8px',fontSize:13,fontFamily:'inherit',outline:'none',width:160}}/>
      </div>
    </div>

    {/* PLAYER TABLE */}
    <div style={{flex:1,overflowY:'auto',padding:'8px 12px'}}>
      {/* Header row */}
      <div style={{display:'grid',gridTemplateColumns:'32px 1fr 90px 90px 90px 70px',gap:8,padding:'4px 8px',marginBottom:4,borderBottom:'1px solid #0A1E30'}}>
        {['#','PLAYER','CONTRIB','SV','ALLIANCE','LAST SEEN'].map(h=>(
          <div key={h} style={{fontSize:11,color:'#3A6080',letterSpacing:1,fontWeight:600}}>{h}</div>
        ))}
      </div>
      {filtered.map((p,i)=>{
        const c=contribColor(p.lastContrib);
        const pct=maxContrib>0?Math.round(p.lastContrib/maxContrib*100):0;
        const globalRank=players.indexOf(p)+1; // rank by original contrib sort
        return(<div key={p.name} style={{display:'grid',gridTemplateColumns:'32px 1fr 90px 90px 90px 70px',gap:8,padding:'6px 8px',borderRadius:4,marginBottom:2,background:p.lastContrib===0?'#0A0510':p.lastContrib<40000?'#0A0E10':'transparent',borderLeft:'3px solid '+(p.lastContrib===0?'#3A0A0A':p.lastContrib<40000?'#3A3000':'transparent')}}>
          <div style={{fontSize:13,color:'#3A6080',fontWeight:600,paddingTop:2}}>#{globalRank}</div>
          <div>
            <div style={{fontSize:15,fontWeight:600,color:p.lastContrib===0?'#5A3A3A':p.lastContrib<40000?'#9A8A40':'#E2EAF4',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
            <ContribBar pct={pct} color={c}/>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:c,paddingTop:2}}>{'$'+fmt(p.lastContrib)}</div>
          <div style={{fontSize:13,color:'#5A8AAB',paddingTop:2}}>{'$'+p.sv.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div style={{fontSize:13,color:'#4A7090',paddingTop:2}}>{'$'+fmt(p.allianceContrib)}</div>
          <div style={{fontSize:13,color:activeColor(p.lastSeenMins),paddingTop:2}}>{p.lastSeenStr}</div>
        </div>);
      })}
      {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:'#2C4A68',fontSize:15}}>No players match this filter.</div>}
    </div>

  </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
</script>
</body>
</html>`;

// HQ update endpoint — accepts pace upload from n8n
app.post('/api/hq-update', (req, res) => {
  try {
    const body = req.body || {};
    const token = body.token || '';
    const N8N_TOKEN = 'bgln8n-hq-2026';
    if (token !== N8N_TOKEN && token !== process.env.PROJECTIONS_SECRET) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const rawText = body.rawText || '';
    const players = parsePaceUpload(rawText);
    if (players.length === 0) return res.status(400).json({ ok: false, error: 'no players parsed' });

    // Save to history
    if (hqData.alliancePace) {
      hqData.history = [...(hqData.history || []).slice(-23), {
        timestamp: hqData.timestamp,
        alliancePace: hqData.alliancePace,
        airlines: hqData.airlines
      }];
    }

    hqData.timestamp = body.timestamp || new Date().toISOString();
    hqData.uploader = body.uploader || 'unknown';
    hqData.alliancePace = body.alliancePace || null;
    hqData.airlines = body.airlines || players.length;
    hqData.players = players.sort((a, b) => b.lastContrib - a.lastContrib);

    console.log('[HQ] updated — ' + players.length + ' players, pace ' + hqData.alliancePace);
    res.json({ ok: true, players: players.length });
  } catch (e) {
    console.error('[HQ] error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// HQ data endpoint
app.get('/api/hq-data', (req, res) => res.json(hqData));

// HQ page route — no access key required (internal use)
app.get('/hq', (req, res) => {
  logVisit(req);
  res.type('html').send(HQ_HTML);
});
// ─────────────────────────────────────────────────────────────────────────────


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
.svg-chart{cursor:grab;user-select:none;touch-action:none;-webkit-user-select:none;-ms-touch-action:none}
.svg-chart.dragging{cursor:grabbing}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useMemo,useRef,useCallback}=React;

const PERIOD_OPTS=[
  {label:'1MO', days:30.4,  g:'M'},{label:'2MO', days:60.8,  g:'M'},
  {label:'3MO', days:91.3,  g:'M'},{label:'4MO', days:121.7, g:'M'},
  {label:'5MO', days:152.1, g:'M'},{label:'6MO', days:182.6, g:'M'},
  {label:'7MO', days:213.0, g:'M'},{label:'8MO', days:243.3, g:'M'},
  {label:'9MO', days:273.9, g:'M'},{label:'10MO',days:304.3, g:'M'},
  {label:'11MO',days:334.6, g:'M'},{label:'12MO',days:365,   g:'M'},
  {label:'15MO',days:456.3, g:'M'},{label:'18MO',days:547.5, g:'M'},
  {label:'21MO',days:638.8, g:'M'},{label:'24MO',days:730,   g:'M'},
  {label:'3Y',  days:1095,  g:'Y'},{label:'4Y',  days:1460,  g:'Y'},
  {label:'5Y',  days:1825,  g:'Y'},{label:'6Y',  days:2190,  g:'Y'},
  {label:'7Y',  days:2555,  g:'Y'},{label:'8Y',  days:2920,  g:'Y'},
  {label:'9Y',  days:3285,  g:'Y'},{label:'10Y', days:3650,  g:'Y'},
  {label:'15Y', days:5475,  g:'Y'},{label:'20Y', days:7300,  g:'Y'},
  {label:'25Y', days:9125,  g:'Y'},{label:'50Y', days:18250, g:'Y'},
  {label:'MAX', days:null,  g:'A'},
];
const MTD={1:30.4,3:91.3,6:182.6,12:365};

function getXTicks(total,visStart,visDays){
  const e=visStart+visDays;
  let t=[];
  if(total<=182.6)t=[30.4,91.3,182.6];
  else if(total<=365)t=[91.3,182.6,365];
  else if(total<=730)t=[182.6,365,547.5,730];
  else if(total<=1825)t=[365,730,1095,1460,1825];
  else if(total<=3650)t=[365,730,1825,2555,3650];
  else{const s=Math.ceil(total/5/365)*365;for(let d=s;d<=total;d+=s)t.push(d);}
  return t.filter(d=>d>=visStart&&d<=e);
}
function xlbl(d){
  if(d<365)return Math.round(d/30.4)+'MO';
  const y=d/365;return(Number.isInteger(y)?y:y.toFixed(1))+'Y';
}
function lc(a){
  if(a.isBeagle)return'#E8B84B';
  if(a.passed)return'#E74C3C';
  if(!a.catchable)return'#3A6090';
  if(a.daysTo<100)return'#00E676';
  if(a.daysTo<400)return'#69F0AE';
  if(a.daysTo<800)return'#F9A825';
  return'#F57F17';
}
function fmtD(d){
  if(!d)return null;
  const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return d.getDate()+' '+m[d.getMonth()]+' '+d.getFullYear();
}
function fmtAWST(ts){
  if(!ts)return null;
  const d=new Date(ts),a=new Date(d.getTime()+8*3600000);
  const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const p=n=>String(n).padStart(2,'0');
  return a.getUTCDate()+' '+m[a.getUTCMonth()]+' '+a.getUTCFullYear()+' \xb7 '+p(a.getUTCHours())+':'+p(a.getUTCMinutes())+' AWST';
}
function build(data){
  const BS=data.beagleSV,BP=data.beaglePace;
  const bg={rank:data.beagleRank,name:'Beagle Global',sv:BS,pace:BP,isBeagle:true};
  const all=[...data.alliances,bg].map(a=>{
    const gap=+(a.sv-BS).toFixed(2);
    const cl=a.pace!=null?+(BP-a.pace).toFixed(4):null;
    const dt=cl>0&&gap>0?gap/cl:null;
    const od=dt?new Date(Date.now()+dt*86400000):null;
    return{...a,gap,closure:cl,daysTo:dt,overtakeDate:od,catchable:cl>0,passed:gap<0};
  });
  return{all,beagle:{...bg,gap:0,closure:0,catchable:false,passed:false},BS,BP};
}
function projR(all,beagle,days){
  const kn=all.filter(a=>a.pace!=null&&!a.isBeagle).map(a=>({...a,pSV:a.sv+a.pace*days}));
  const un=all.filter(a=>a.pace==null&&!a.isBeagle).map(a=>({...a,pSV:null,noPace:true}));
  const bp={...beagle,pSV:beagle.sv+beagle.pace*days};
  const sorted=[...kn,bp].sort((a,b)=>b.pSV-a.pSV);
  const res=[...sorted];
  un.forEach(u=>{const at=Math.min(u.rank-1,res.length);res.splice(at,0,{...u,projRank:u.rank});});
  return res.map((a,i)=>({...a,projRank:a.noPace?a.rank:i+1}));
}

function App(){
  const[apiData,setApiData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[pk,setPk]=useState('6MO');
  const[mode,setMode]=useState('SV');
  const[act,setAct]=useState(new Set());
  // iOS orientation fix — force re-render after rotate so layout recalculates
  const[,forceLayout]=useState(0);
  useEffect(()=>{
    let t;
    const onResize=()=>{clearTimeout(t);t=setTimeout(()=>forceLayout(n=>n+1),200);};
    window.addEventListener('resize',onResize);
    window.addEventListener('orientationchange',onResize);
    return()=>{clearTimeout(t);window.removeEventListener('resize',onResize);window.removeEventListener('orientationchange',onResize);};
  },[]);
  const[focus,setFocus]=useState(null);
  const[full,setFull]=useState(true);
  const[showR,setShowR]=useState(true);
  const[yZ,setYZ]=useState(1);
  const[yP,setYP]=useState(0);
  const[xZ,setXZ]=useState(1);
  const[xP,setXP]=useState(0);

  const svgRef=useRef(null);
  const pinchDist=useRef(null);
  const drag=useRef({active:false,x:0,y:0,yp:0,xp:0});
  // Live values ref — always current inside event handlers
  const lv=useRef({yP:0,xP:0,days:182.6,yRZ:0,xZ:1});

  const toggle=useCallback(name=>{
    setAct(prev=>{
      const n=new Set(prev);
      if(n.has(name)){n.delete(name);setFocus(f=>f===name?([...n].pop()||null):f);}
      else{n.add(name);setFocus(name);}
      return n;
    });
  },[]);

  useEffect(()=>{
    fetch('/api/data').then(r=>r.json()).then(d=>{setApiData(d);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  const{all,beagle,BS,BP}=useMemo(()=>{
    if(!apiData)return{all:[],beagle:{sv:0,pace:0,rank:19},BS:0,BP:0};
    return build(apiData);
  },[apiData]);

  const maxCD=all.filter(a=>!a.isBeagle&&a.catchable&&a.daysTo).reduce((m,a)=>Math.max(m,a.daysTo),365);
  const MAX_D=Math.ceil(maxCD*1.2/30)*30;
  const pOpt=PERIOD_OPTS.find(p=>p.label===pk)||PERIOD_OPTS[5];
  const days=pOpt.days??MAX_D;
  const pool=full?all.filter(a=>!a.isBeagle):all.filter(a=>!a.isBeagle&&(a.passed||a.gap<800));
  const selA=focus?all.find(a=>a.name===focus):null;
  const ranking=useMemo(()=>all.length?projR(all,beagle,days):[],[all,beagle,days]);
  const bRank=ranking.find(a=>a.isBeagle);
  const mob=typeof window!=='undefined'&&window.innerWidth<700;
  const W2=typeof window!=='undefined'?window.innerWidth:1200;
  // Smooth font scaling: min at 700px, max at 1920px, no hard jumps
  const sz=(mn,mx,sc)=>mob?mn:Math.round(Math.min(mx,Math.max(mn+2,W2*sc)));
  const rChg=beagle.rank?(beagle.rank-(bRank?.projRank??beagle.rank)):0;

  // Crossovers between activated non-Beagle pairs
  const crossovers=useMemo(()=>{
    const activeA=[...act].map(n=>all.find(a=>a.name===n)).filter(a=>a&&!a.isBeagle&&a.pace!=null);
    const pairs=[];
    for(let i=0;i<activeA.length;i++){
      for(let j=i+1;j<activeA.length;j++){
        const a=activeA[i],b=activeA[j];
        const paceDiff=a.pace-b.pace; // positive = A gaining on B
        const svDiff=a.sv-b.sv;       // positive = A ahead
        // A overtakes B (A behind, gaining): svDiff<0 && paceDiff>0
        // B overtakes A (B behind, gaining): svDiff>0 && paceDiff<0
        if(paceDiff!==0){
          const t=-svDiff/paceDiff; // days until equal
          if(t>0){
            const ahead=svDiff>0?a:b;
            const behind=svDiff>0?b:a;
            const xDate=new Date(Date.now()+t*86400000);
            pairs.push({ahead:ahead.name,behind:behind.name,daysTo:Math.round(t),date:xDate,crossDay:t,aColor:lc(a),bColor:lc(b),aName:a.name,bName:b.name});
          }
        }
      }
    }
    return pairs;
  },[act,all]);

  // Chart geometry
  const W=1380,H=280,ml=72,mr=170,mt=18,mb=42,cw=W-ml-mr,ch=H-mt-mb;
  const _vis=pool.filter(a=>Math.abs(a.gap)<2500);
  const _src=_vis.length?_vis:[...pool];
  const yMnB=Math.min(..._src.map(a=>a.sv),BS)*0.97;
  const yMxB=Math.max(..._src.map(a=>a.sv+(a.pace||0)*days),BS+BP*days)*1.03;
  const yRF=yMxB-yMnB;
  const yRZ=yRF/yZ;
  const yMid=(yMnB+yMxB)/2-yP;
  const yMnZ=yMid-yRZ/2,yMxZ=yMid+yRZ/2;
  const ys=v=>mt+ch-((v-yMnZ)/(yMxZ-yMnZ))*ch;

  const xVD=days/xZ;
  const xSt=Math.max(0,Math.min(xP,days-xVD));
  const xs=d=>ml+((d-xSt)/xVD)*cw;

  const yStep=yRF>5000?1000:yRF>2000?500:yRF>800?200:100;
  const yTks=[];for(let v=Math.ceil(yMnZ/yStep)*yStep;v<=yMxZ;v+=yStep)yTks.push(v);
  const xTks=getXTicks(days,xSt,xVD);

  const crossD=a=>{
    if(!a.catchable||a.gap<=0||!a.pace||!BP)return null;
    const t=a.gap/(BP-a.pace);return t>0&&t<=days?t:null;
  };

  const resetZoom=()=>{setYZ(1);setYP(0);setXZ(1);setXP(0);};
  const zoomed=yZ>1||xZ>1;

  // Keep lv ref current — safe to use inside addEventListener callbacks
  useEffect(()=>{lv.current={yP,xP,days,yRZ,xZ};},[yP,xP,days,yRZ,xZ]);

  // MOUSE drag — window-level for reliable tracking
  const onMouseDown=useCallback(e=>{
    drag.current={active:true,x:e.clientX,y:e.clientY,yp:lv.current.yP,xp:lv.current.xP};
    svgRef.current?.classList.add('dragging');
  },[]);
  useEffect(()=>{
    const mm=e=>{
      if(!drag.current.active)return;
      const rect=svgRef.current?.getBoundingClientRect();
      const svgH=rect?.height||280,svgW=rect?.width||1200;
      const dy=e.clientY-drag.current.y,dx=e.clientX-drag.current.x;
      // CORRECT direction: drag down → lines move down (negative dy flips pan)
      setYP(drag.current.yp-(dy/svgH)*lv.current.yRZ);
      const xd=lv.current.days/lv.current.xZ;
      setXP(Math.max(0,Math.min(drag.current.xp-(dx/svgW)*xd,lv.current.days-xd)));
    };
    const mu=()=>{drag.current.active=false;svgRef.current?.classList.remove('dragging');};
    window.addEventListener('mousemove',mm);
    window.addEventListener('mouseup',mu);
    return()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu);};
  },[]);

  // TOUCH — pinch zoom + single-finger pan
  useEffect(()=>{
    const svg=svgRef.current;if(!svg)return;
    const ts=e=>{
      e.preventDefault();
      if(e.touches.length===1){
        drag.current={active:true,x:e.touches[0].clientX,y:e.touches[0].clientY,yp:lv.current.yP,xp:lv.current.xP};
      } else if(e.touches.length===2){
        drag.current.active=false;
        pinchDist.current=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);
      }
    };
    const tm=e=>{
      e.preventDefault();
      const rect=svg.getBoundingClientRect();
      const svgH=rect.height||280,svgW=rect.width||1200;
      if(e.touches.length===1&&drag.current.active){
        const dx=e.touches[0].clientX-drag.current.x;
        const dy=e.touches[0].clientY-drag.current.y;
        setYP(drag.current.yp-(dy/svgH)*lv.current.yRZ);
        const xd=lv.current.days/lv.current.xZ;
        setXP(Math.max(0,Math.min(drag.current.xp-(dx/svgW)*xd,lv.current.days-xd)));
      } else if(e.touches.length===2&&pinchDist.current!=null){
        const d=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);
        const f=d/pinchDist.current;
        setYZ(z=>Math.max(1,Math.min(30,z*f)));
        setXZ(z=>Math.max(1,Math.min(30,z*f)));
        pinchDist.current=d;
      }
    };
    const te=e=>{
      if(e.touches.length===0)drag.current.active=false;
      if(e.touches.length<2)pinchDist.current=null;
    };
    svg.addEventListener('touchstart',ts,{passive:false});
    svg.addEventListener('touchmove',tm,{passive:false});
    svg.addEventListener('touchend',te);
    return()=>{svg.removeEventListener('touchstart',ts);svg.removeEventListener('touchmove',tm);svg.removeEventListener('touchend',te);};
  },[]);

  // WHEEL zoom — window-level so Chrome can't intercept it first
  useEffect(()=>{
    const handler=e=>{
      const svg=svgRef.current;if(!svg)return;
      const r=svg.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
      e.preventDefault();
      const f=e.deltaY<0?1.25:0.8;
      setYZ(z=>Math.max(1,Math.min(30,z*f)));
      setXZ(z=>Math.max(1,Math.min(30,z*f)));
    };
    window.addEventListener('wheel',handler,{passive:false});
    return()=>window.removeEventListener('wheel',handler);
  },[]);

  const detP=selA?[1,3,6,12].map(mo=>({mo,sv:selA.sv+(selA.pace||0)*MTD[mo],rank:projR(all,beagle,MTD[mo]).findIndex(a=>a.isBeagle)+1})):[];

  const BB={borderRadius:3,fontSize:14,fontWeight:700,cursor:'pointer',letterSpacing:1,fontFamily:'inherit',padding:'5px 12px'};
  const btn=on=>({...BB,background:on?'#C4920A':'transparent',border:'1px solid '+(on?'#C4920A':'#162030'),color:on?'#030B17':'#6A9AB5'});
  const btn2=on=>({...BB,background:on?'#1A3050':'transparent',border:'1px solid '+(on?'#4A80B0':'#162030'),color:on?'#E8B84B':'#6A9AB5'});

  if(loading)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}><div style={{fontSize:40,color:'#E8B84B'}}>&#9672;</div><div style={{fontSize:20,color:'#5A8AAB',letterSpacing:2}}>LOADING PROJECTIONS...</div></div>);

  const ts2=apiData?.timestamp,upl=apiData?.uploader;
  const hasAct=act.size>0;

  const renderRow=a=>{
    const isB=a.isBeagle,chg=a.rank-(a.projRank??a.rank),c=isB?'#E8B84B':lc(a),isAct=act.has(a.name);
    return(<div key={a.name} onClick={()=>!isB&&toggle(a.name)}
      style={{display:'flex',alignItems:'center',gap:8,padding:W2>=1600?'10px 14px':'7px 10px',
        background:isB?'#1A1000':isAct?c+'22':'transparent',
        borderRadius:3,borderLeft:isAct?'3px solid '+c:'3px solid transparent',
        cursor:isB?'default':'pointer',transition:'all 0.1s'}}>
      <span style={{fontSize:sz(18,34,0.017),fontWeight:700,color:a.noPace?'#4A7090':c,minWidth:36}}>#{a.projRank}</span>
      <span style={{fontSize:sz(18,30,0.016),color:isB?c:isAct?'#E2EAF4':a.noPace?'#4A7090':'#9AAABB',flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:isAct?600:400}}>{a.name}</span>
      <span style={{fontSize:sz(13,24,0.013),color:isB?'#C4920A':a.noPace?'#2C4A68':'#5A8AAB',minWidth:52,textAlign:'right',whiteSpace:'nowrap',marginRight:4}}>{a.pace!=null?'$'+a.pace.toFixed(2):''}</span>
      <span style={{fontSize:sz(16,28,0.015),fontWeight:600,minWidth:30,textAlign:'right',color:a.noPace?'#4A7090':chg>0?'#00E676':chg<0?'#E74C3C':'#4A7090'}}>{a.noPace?'?':chg>0?'\u25b2'+chg:chg<0?'\u25bc'+Math.abs(chg):isB?'\u2605':'\u2014'}</span>
    </div>);
  };

  const nameTag=(name,c)=>name.length>18?name.slice(0,17)+'\u2026':name;

  return(<div style={{background:'#030B17',height:'100%',minHeight:'100vh',display:'flex',flexDirection:'column'}}>

    {/* HEADER */}
    <div style={{background:'linear-gradient(90deg,#04101E,#0A1C32)',borderBottom:'2px solid #C4920A',padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:4}}>
      <div>
        <div style={{fontSize:sz(22,38,0.020),fontWeight:700,color:'#E8B84B',letterSpacing:2}}>&#9672; BEAGLE GLOBAL \u2014 ALLIANCE PROJECTIONS</div>
        <div style={{fontSize:sz(13,20,0.011),color:'#8AAABB',marginTop:3,letterSpacing:1}}>
          10-MO RECENT PACE \xb7 RANK #{beagle.rank}
          {ts2&&<span style={{marginLeft:12,color:'#5A8AAB'}}>UPDATED {fmtAWST(ts2)}{upl?' \xb7 '+upl:''}</span>}
          {!ts2&&<span style={{marginLeft:12,color:'#5A8AAB'}}>DEFAULT DATA \xb7 UPLOAD TO REFRESH</span>}
        </div>
      </div>
      <div style={{textAlign:'right'}}>
        <div style={{fontSize:sz(22,42,0.022),fontWeight:700,color:'#E8B84B'}}>{'$'+BS.toLocaleString('en',{minimumFractionDigits:2})+'M'}</div>
        <div style={{fontSize:sz(13,20,0.011),color:'#8AAABB',letterSpacing:1}}>{BP.toFixed(3)}/DAY</div>
      </div>
    </div>

    {/* CONTROLS */}
    <div style={{display:'flex',gap:4,padding:'5px 8px',background:'#040C18',borderBottom:'1px solid #0A1E30',alignItems:'center',flexWrap:'wrap',rowGap:4}}>
      <span style={{fontSize:13,color:'#6A9AB5',letterSpacing:1,marginRight:3,flexShrink:0}}>PERIOD</span>
      <select value={pk} onChange={e=>setPk(e.target.value)} style={{background:'#040C18',color:'#E8B84B',border:'1px solid #C4920A',borderRadius:3,padding:'4px 8px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',outline:'none',flexShrink:0}}>
        <optgroup label='\u2500 MONTHS \u2500'>
          {PERIOD_OPTS.filter(p=>p.g==='M').map(p=><option key={p.label} value={p.label}>{p.label}</option>)}
        </optgroup>
        <optgroup label='\u2500 YEARS \u2500'>
          {PERIOD_OPTS.filter(p=>p.g==='Y').map(p=><option key={p.label} value={p.label}>{p.label}</option>)}
        </optgroup>
        <optgroup label='\u2500 AUTO \u2500'>
          <option value="MAX">MAX \u2014 furthest overtake</option>
        </optgroup>
      </select>
      <div style={{width:1,height:18,background:'#162030',margin:'0 3px',flexShrink:0}}/>
      <button onClick={()=>setFull(f=>!f)} style={btn2(full)}>{full?'CLOSE PACK':'ALL LINES'}</button>
      {hasAct&&<button onClick={()=>{setAct(new Set());setFocus(null);}} style={{...BB,background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB'}}>CLEAR ({act.size})</button>}
      <div style={{width:1,height:18,background:'#162030',margin:'0 3px',flexShrink:0}}/>
      {[['SV','SV LINES'],['GAP','SV GAP'],['RANK','RANK']].map(([m,l])=>{ const lbl=mob?m:l; return (
        <button key={m} onClick={()=>setMode(m)} style={{...BB,background:mode===m?'#1A3050':'transparent',border:'1px solid '+(mode===m?'#4A80B0':'#162030'),color:mode===m?'#E8B84B':'#6A9AB5'}}>{lbl}</button>);
      })}
      <div style={{width:1,height:18,background:'#162030',margin:'0 3px',flexShrink:0}}/>
      <button onClick={()=>setShowR(r=>!r)} style={{...BB,background:showR?'#0D2240':'transparent',border:'1px solid #162030',color:showR?'#7FAACC':'#4A7090'}}>{showR?(mob?'HIDE':'HIDE RANKING'):(mob?'SHOW':'SHOW RANKING')}</button>
      <div style={{display:'flex',alignItems:'center',gap:3,marginLeft:'auto'}}>
        {/* Zoom */}
        <button onClick={()=>{setYZ(z=>Math.min(30,z*1.25));setXZ(z=>Math.min(30,z*1.25));}} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:16,fontWeight:700}} title="Zoom in">+</button>
        <span style={{fontSize:12,color:zoomed?'#E8B84B':'#3A6080',minWidth:36,textAlign:'center'}}>{zoomed?('x'+Math.max(yZ,xZ).toFixed(1)):'1x'}</span>
        <button onClick={()=>{setYZ(z=>Math.max(1,z*0.8));setXZ(z=>Math.max(1,z*0.8));}} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:16,fontWeight:700}} title="Zoom out">-</button>
        {!mob&&<><div style={{width:1,height:16,background:'#162030',margin:'0 3px'}}/>
        <button onClick={()=>setXP(p=>Math.max(0,p-lv.current.days/lv.current.xZ*0.2))} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}} title="Pan left">◄</button>
        <button onClick={()=>setYP(p=>p+lv.current.yRZ*0.15)} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}} title="Pan up">▲</button>
        <button onClick={()=>setYP(p=>p-lv.current.yRZ*0.15)} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}} title="Pan down">▼</button>
        <button onClick={()=>setXP(p=>Math.max(0,Math.min(p+lv.current.days/lv.current.xZ*0.2,lv.current.days-lv.current.days/lv.current.xZ)))} style={{...BB,padding:'4px 10px',background:'#0A1E30',border:'1px solid #2C4A6E',color:'#8AAABB',fontSize:15,fontWeight:700}} title="Pan right">►</button></>
        }
        {(zoomed||yP!==0||xP!==0)&&<button onClick={resetZoom} style={{...BB,background:'#1A0A00',border:'1px solid #C4920A60',color:'#E8B84B',fontSize:12,marginLeft:2}}>RESET</button>}
      </div>
      <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
        {[['#E8B84B','Beagle'],['#00E676','<100d'],['#69F0AE','catching'],['#3A6090','away'],['#E74C3C','passed']].map(([c,l])=>(
          <span key={l} style={{display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}>
            <span style={{width:l==='Beagle'?20:15,height:l==='Beagle'?3:2,background:c,display:'inline-block',borderRadius:2}}/>
            <span style={{fontSize:12,color:'#8AAABB'}}>{l}</span>
          </span>
        ))}
      </div>
    </div>

    {/* CHART */}
    <div style={{padding:'2px 4px 4px',flexShrink:0,touchAction:'none'}}>
      <svg ref={svgRef} className="svg-chart" viewBox={'0 0 '+W+' '+H} style={{width:'100%',maxHeight:'38vh',display:'block',touchAction:'none'}} onMouseDown={onMouseDown}>
        <defs>
          <filter id="fg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="fl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <clipPath id="cc"><rect x={ml} y={mt} width={cw} height={ch}/></clipPath>
          <style>{'@keyframes pu{0%,100%{r:5;opacity:1}50%{r:9;opacity:0.4}} .pd{animation:pu 1.8s ease-in-out infinite}'}</style>
        </defs>
        <rect x={ml} y={mt} width={cw} height={ch} fill="#030810" rx="2"/>
        {mode!=='RANK'&&yTks.map(v=>(<g key={v}>
          <line x1={ml} x2={ml+cw} y1={ys(v)} y2={ys(v)} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
          <text x={ml-6} y={ys(v)+4} textAnchor="end" fill="#5A8AAB" fontSize="14">{v>=1000?(v/1000).toFixed(1)+'k':v<=-1000?(v/1000).toFixed(1)+'k':v}</text>
        </g>))}
        {xTks.map(d=>(<g key={d}>
          <line x1={xs(d)} x2={xs(d)} y1={mt} y2={mt+ch} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
          <text x={xs(d)} y={mt+ch+18} textAnchor="middle" fill="#5A8AAB" fontSize="14" fontWeight="600">{xlbl(d)}</text>
        </g>))}

        {/* SV LINES */}
        {mode==='SV'&&(<g>
          <g clipPath="url(#cc)">
            {pool.map(a=>{
              const isAct=act.has(a.name),dim=hasAct&&!isAct,c=lc(a);
              const sv1=a.sv+(a.pace||0)*days;
              const cd=crossD(a);
              return(<g key={a.name}>
                <line x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(sv1)} stroke="transparent" strokeWidth="22" style={{cursor:'pointer'}} onClick={()=>toggle(a.name)}/>
                <line x1={xs(0)} y1={ys(a.sv)} x2={xs(days)} y2={ys(sv1)} stroke={c} strokeWidth={isAct?3:dim?1:1.8} opacity={dim?0.1:0.88} strokeLinecap="round" strokeDasharray={!a.catchable&&!a.passed?'4,3':'none'}/>
                {cd&&!dim&&<circle cx={xs(cd)} cy={ys(BS+BP*cd)} r="3.5" fill={c} opacity="0.9"/>}
              </g>);
            })}
            {/* Team-vs-team crossover dots */}
            {crossovers.map((co,i)=>{
              const xc=xs(co.crossDay),yc=ys(BS); // approximate midpoint
              const ahead=pool.find(a=>a.name===co.ahead),behind=pool.find(a=>a.name===co.behind);
              if(!ahead||!behind)return null;
              const yCross=ys(ahead.sv+(ahead.pace||0)*co.crossDay);
              if(yCross<mt||yCross>mt+ch)return null;
              return(<g key={i}>
                <circle cx={xs(co.crossDay)} cy={yCross} r="6" fill="none" stroke="#FFD700" strokeWidth="2" className="pd"/>
                <circle cx={xs(co.crossDay)} cy={yCross} r="3" fill="#FFD700"/>
                <rect x={xs(co.crossDay)-52} y={yCross-30} width={104} height={20} fill="#0A0800" rx="3" stroke="#C4920A" strokeWidth="1"/>
                <text x={xs(co.crossDay)} y={yCross-17} textAnchor="middle" fill="#FFD700" fontSize="12" fontWeight="700">{fmtD(co.date)}</text>
              </g>);
            })}
            {/* Beagle */}
            <line x1={xs(0)} y1={ys(BS)} x2={xs(days)} y2={ys(BS+BP*days)} stroke="#E8B84B" strokeWidth="10" opacity="0.15" strokeLinecap="round"/>
            <line x1={xs(0)} y1={ys(BS)} x2={xs(days)} y2={ys(BS+BP*days)} stroke="#E8B84B" strokeWidth="3.5" strokeLinecap="round" filter="url(#fg)"/>
            <circle cx={xs(0)} cy={ys(BS)} r="5" fill="#E8B84B" filter="url(#fg)"/>
            <circle cx={xs(days)} cy={ys(BS+BP*days)} r="4" fill="#E8B84B" opacity="0.7"/>
          </g>
          {/* Name labels outside clip */}
          {pool.filter(a=>act.has(a.name)).map(a=>{
            const yE=ys(a.sv+(a.pace||0)*days);
            if(yE<mt||yE>mt+ch)return null;
            return(<text key={a.name+'_l'} x={xs(days)+8} y={yE+5} fill={lc(a)} fontSize="14" fontWeight="700">{nameTag(a.name)}</text>);
          })}
          <text x={ml-6} y={ys(BS)+4} textAnchor="end" fill="#E8B84B" fontSize="14" fontWeight="700">\u2605{beagle.rank}</text>
        </g>)}

        {/* SV GAP */}
        {mode==='GAP'&&(()=>{
          const gMin=Math.min(...pool.map(a=>a.sv-BS+(((a.pace||0)-BP)*days)),-200)*1.05;
          const gMax=Math.max(...pool.map(a=>a.sv-BS),200)*1.05;
          const gR=gMax-gMin;
          const yg=v=>mt+ch-((v-gMin)/gR)*ch;
          const gStep=gR>5000?1000:gR>2000?500:gR>800?200:100;
          const gTks=[];for(let v=Math.ceil(gMin/gStep)*gStep;v<=gMax;v+=gStep)gTks.push(v);
          return(<g>
            {gTks.map(v=>(<g key={v}>
              <line x1={ml} x2={ml+cw} y1={yg(v)} y2={yg(v)} stroke={v===0?'#E8B84B':'#1E3A5F'} strokeWidth={v===0?'1.5':'0.6'} strokeDasharray={v===0?'none':'4,6'} opacity={v===0?0.7:1}/>
              <text x={ml-6} y={yg(v)+4} textAnchor="end" fill={v===0?'#E8B84B':'#5A8AAB'} fontSize="14" fontWeight={v===0?'700':'400'}>{v>=1000?(v/1000).toFixed(1)+'k':v<=-1000?(v/1000).toFixed(1)+'k':v}</text>
            </g>))}
            {yg(0)>mt&&yg(0)<mt+ch&&<text x={ml+10} y={yg(0)-8} fill="#E8B84B" fontSize="13" fontWeight="700">BEAGLE</text>}
            <g clipPath="url(#cc)">
              {pool.map(a=>{
                const isAct=act.has(a.name),dim=hasAct&&!isAct,c=lc(a);
                const g0=a.sv-BS,g1=(a.sv+(a.pace||0)*days)-(BS+BP*days);
                const cX=g0!==g1?(-g0/(g1-g0)):null;
                const cD=cX!=null&&cX>0&&cX<1?cX*days:null;
                const yE=yg(g1);
                return(<g key={a.name} opacity={dim?0.1:0.9}>
                  <line x1={xs(0)} y1={yg(g0)} x2={xs(days)} y2={yg(g1)} stroke="transparent" strokeWidth="22" style={{cursor:'pointer'}} onClick={()=>toggle(a.name)}/>
                  <line x1={xs(0)} y1={yg(g0)} x2={xs(days)} y2={yg(g1)} stroke={c} strokeWidth={isAct?3:1.5} strokeLinecap="round"/>
                  {cD&&<circle cx={xs(cD)} cy={yg(0)} r="4" fill={c}/>}
                  {cD&&<text x={xs(cD)} y={yg(0)-12} textAnchor="middle" fill={c} fontSize="12" fontWeight="700">{fmtD(new Date(Date.now()+cD*86400000))}</text>}
                  {isAct&&yE>=mt&&yE<=mt+ch&&<text x={xs(days)+8} y={yE+5} fill={c} fontSize="14" fontWeight="700">{nameTag(a.name)}</text>}
                </g>);
              })}
            </g>
            <text x={ml-6} y={yg(0)+4} textAnchor="end" fill="#E8B84B" fontSize="14" fontWeight="700">0</text>
          </g>);
        })()}

        {/* RANK */}
        {mode==='RANK'&&(()=>{
          const yr=v=>mt+((v-1)/19)*ch;
          return(<g>
            {[1,5,10,15,20].map(r=>(<g key={r}>
              <line x1={ml} x2={ml+cw} y1={yr(r)} y2={yr(r)} stroke="#1E3A5F" strokeWidth="0.6" strokeDasharray="4,6"/>
              <text x={ml-6} y={yr(r)+4} textAnchor="end" fill="#5A8AAB" fontSize="13">#{r}</text>
            </g>))}
            <g clipPath="url(#cc)">
              {[...pool,beagle].map(a=>{
                const isB=a.isBeagle,isAct=act.has(a.name),dim=hasAct&&!isAct&&!isB,c=lc(a);
                const pts=[0,days/4,days/2,3*days/4,days].map(d=>{
                  const pr=projR(all,beagle,d),e=pr.find(r=>r.name===a.name);
                  return{d,r:e?.projRank??a.rank};
                });
                const pd=pts.map((p,i)=>(i===0?'M':'L')+xs(p.d).toFixed(1)+','+yr(p.r).toFixed(1)).join(' ');
                const ep=pts[pts.length-1];
                return(<g key={a.name} onClick={()=>!isB&&toggle(a.name)} style={{cursor:isB?'default':'pointer'}}>
                  <path d={pd} stroke="transparent" strokeWidth="18" fill="none"/>
                  <path d={pd} stroke={c} strokeWidth={isB?3.5:isAct?2.5:1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={dim?0.08:isB?1:0.85} filter={isB?'url(#fg)':undefined}/>
                  {(isAct||isB)&&yr(ep.r)>=mt&&yr(ep.r)<=mt+ch&&<text x={xs(days)+8} y={yr(ep.r)+5} fill={c} fontSize="14" fontWeight="700">{isB?'Beagle':nameTag(a.name)}</text>}
                </g>);
              })}
            </g>
          </g>);
        })()}

        <line x1={ml} y1={mt} x2={ml} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
        <line x1={ml} y1={mt+ch} x2={ml+cw} y2={mt+ch} stroke="#2C4A6E" strokeWidth="1"/>
        <line x1={ml+cw} y1={mt} x2={ml+cw} y2={mt+ch} stroke="#1A3050" strokeWidth="1" strokeDasharray="3,4"/>
        <text x="12" y={mt+ch/2} textAnchor="middle" fill="#3A6080" fontSize="13" fontWeight="600" transform={'rotate(-90,12,'+(mt+ch/2)+')'}>{mode==='SV'?'Share Value':mode==='GAP'?'SV Gap':'Rank'}</text>
        {zoomed&&<text x={ml+cw-4} y={mt+16} textAnchor="end" fill="#E8B84B" fontSize="13" fontWeight="700" opacity="0.7">{'x'+Math.max(yZ,xZ).toFixed(1)}</text>}
      </svg>
    </div>

    {/* CROSSOVER BANNER — shown when 2+ activated non-Beagle teams have a crossover */}
    {crossovers.length>0&&(<div style={{margin:'0 8px 4px',background:'#0A0800',border:'1px solid #C4920A',borderLeft:'4px solid #FFD700',borderRadius:4,padding:'8px 14px'}}>
      {crossovers.map((co,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:i<crossovers.length-1?4:0}}>
          <span style={{fontSize:13,color:'#FFD700',fontWeight:700,letterSpacing:1}}>&#9733; CROSSOVER</span>
          <span style={{fontSize:15,fontWeight:700,color:lc(pool.find(a=>a.name===co.behind)||{})}}>#{(pool.find(a=>a.name===co.behind)||{}).rank} {co.behind}</span>
          <span style={{fontSize:13,color:'#8AAABB'}}>overtakes</span>
          <span style={{fontSize:15,fontWeight:700,color:lc(pool.find(a=>a.name===co.ahead)||{})}}>#{(pool.find(a=>a.name===co.ahead)||{}).rank} {co.ahead}</span>
          <span style={{fontSize:13,color:'#8AAABB'}}>on</span>
          <span style={{fontSize:16,fontWeight:700,color:'#FFD700'}}>{fmtD(co.date)}</span>
          <span style={{fontSize:13,color:'#5A8AAB'}}>({co.daysTo} days)</span>
        </div>
      ))}
    </div>)}

    {/* RANKING PANEL */}
    {showR&&ranking.length>0&&(<div style={{margin:'0 8px 4px',background:'#050D1A',border:'1px solid #0A1E30',borderTop:'2px solid #C4920A',borderRadius:4,padding:'8px 12px',flex:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
        <div>
          <span style={{fontSize:sz(15,24,0.013),color:'#8AAABB',letterSpacing:1}}>PROJECTED RANKING AT </span>
          <span style={{fontSize:sz(15,24,0.013),color:'#E8B84B',fontWeight:700,letterSpacing:1}}>{pk}</span>
          <span style={{fontSize:13,color:'#4A7090',marginLeft:10}}>\u2014 tap row or line to select</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontSize:sz(14,22,0.012),color:'#8AAABB'}}>Beagle</span>
          <span style={{fontSize:sz(17,30,0.016),fontWeight:700,color:'#E8B84B'}}>#{beagle.rank}</span>
          <span style={{fontSize:sz(16,26,0.014),color:'#5A8AAB'}}>\u2192</span>
          <span style={{fontSize:sz(20,34,0.018),fontWeight:700,color:rChg>0?'#00E676':'#E8B84B'}}>#{bRank?.projRank}</span>
          {rChg>0&&<span style={{fontSize:sz(16,28,0.015),fontWeight:700,color:'#00E676'}}>\u25b2{rChg}</span>}
          {rChg<0&&<span style={{fontSize:sz(16,28,0.015),fontWeight:700,color:'#E74C3C'}}>\u25bc{Math.abs(rChg)}</span>}
          {selA&&!selA.isBeagle&&(()=>{
            const sp=ranking.find(r=>r.name===selA.name),sc=selA.rank-(sp?.projRank??selA.rank),c=lc(selA);
            return(<span style={{display:'flex',alignItems:'center',gap:6,marginLeft:12,paddingLeft:12,borderLeft:'1px solid #162030'}}>
              <span style={{fontSize:14,color:c,fontWeight:600}}>{selA.name}</span>
              <span style={{fontSize:16,fontWeight:700,color:c}}>#{selA.rank}</span>
              <span style={{fontSize:15,color:'#5A8AAB'}}>\u2192</span>
              <span style={{fontSize:17,fontWeight:700,color:sc>0?'#00E676':sc<0?'#E74C3C':c}}>#{sp?.projRank}</span>
              {sc!==0&&<span style={{fontSize:14,fontWeight:700,color:sc>0?'#00E676':'#E74C3C'}}>{sc>0?'\u25b2'+sc:'\u25bc'+Math.abs(sc)}</span>}
            </span>);
          })()}
        </div>
      </div>
      <div style={{display:'flex',gap:16,width:'100%'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:sz(13,20,0.012),color:'#8AAABB',fontWeight:600,letterSpacing:1,padding:'0 6px 5px',borderBottom:'1px solid #0A1E30',marginBottom:4}}>1 \u2014 10</div>
          {ranking.slice(0,10).map(renderRow)}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:sz(13,20,0.012),color:'#8AAABB',fontWeight:600,letterSpacing:1,padding:'0 6px 5px',borderBottom:'1px solid #0A1E30',marginBottom:4}}>11 \u2014 20</div>
          {ranking.slice(10,20).map(renderRow)}
        </div>
      </div>
    </div>)}

    {/* DETAIL PANEL */}
    {selA&&!selA.isBeagle&&(<div style={{margin:'0 8px 8px',background:'#050D1A',border:'1px solid '+lc(selA)+'30',borderLeft:'4px solid '+lc(selA),borderRadius:4,padding:'12px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:'#E2EAF4'}}>#{selA.rank} {selA.name}</div>
          <div style={{fontSize:14,color:'#8AAABB',marginTop:3}}>{'SV $'+selA.sv.toLocaleString('en',{minimumFractionDigits:2})+'M \xb7 Pace '}{selA.pace?.toFixed(3)??'\u2014'}/day \xb7 Gap {selA.gap>0?'+':''}{selA.gap.toFixed(0)}M</div>
        </div>
        {selA.catchable?(<div style={{background:'#04120A',border:'1px solid '+lc(selA),borderRadius:4,padding:'6px 12px',textAlign:'right'}}>
          <div style={{fontSize:12,color:lc(selA),letterSpacing:1}}>BEAGLE OVERTAKES</div>
          <div style={{fontSize:16,fontWeight:700,color:lc(selA)}}>{fmtD(selA.overtakeDate)}</div>
          <div style={{fontSize:12,color:'#8AAABB'}}>in {Math.round(selA.daysTo)} days</div>
        </div>):selA.passed?(<div style={{background:'#1C0606',border:'1px solid #E74C3C',borderRadius:4,padding:'6px 12px',textAlign:'right'}}>
          <div style={{fontSize:12,color:'#E74C3C',letterSpacing:1}}>STATUS</div>
          <div style={{fontSize:16,fontWeight:700,color:'#E74C3C'}}>\u2713 OVERTAKEN</div>
        </div>):(<div style={{background:'#06101C',border:'1px solid #3A6090',borderRadius:4,padding:'6px 12px',textAlign:'right'}}>
          <div style={{fontSize:12,color:'#3A6090',letterSpacing:1}}>STATUS</div>
          <div style={{fontSize:14,fontWeight:700,color:'#3A6090'}}>PULLING AWAY</div>
        </div>)}
      </div>
      <div style={{display:'flex',gap:6,marginBottom:8}}>
        {detP.map(({mo,sv,rank})=>{const ah=sv-(BS+BP*MTD[mo]),c=ah<=0?'#00E676':ah<100?'#69F0AE':'#3A6090';return(<div key={mo} style={{flex:1,background:'#030B17',borderRadius:4,padding:'7px 5px',textAlign:'center',border:'1px solid #0A1E30'}}>
          <div style={{fontSize:12,color:'#8AAABB',fontWeight:600,letterSpacing:1,marginBottom:2}}>{mo}MO</div>
          <div style={{fontSize:15,fontWeight:700,color:'#C0CCD8'}}>{'$'+sv.toFixed(0)+'M'}</div>
          <div style={{fontSize:12,color:c,marginTop:2,fontWeight:600}}>{ah<=0?'\u2713 BEHIND':'+$'+ah.toFixed(0)+'M'}</div>
          <div style={{fontSize:12,color:'#5A8AAB',marginTop:1}}>Beagle #{rank}</div>
        </div>);})}
      </div>
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
</body>
</html>`;

// ── CONTRIBUTION CALCULATOR DOWNLOAD ─────────────────────────────────────

app.get('/calculator', (req, res) => {
  const KEY = process.env.CONTRIBUTIONS_LOG_IN || '';
  if (!KEY || req.query.k !== KEY) {
    return res.status(403).type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access Expired</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}.card{max-width:420px}.icon{font-size:48px;color:#C4920A;margin-bottom:20px}.title{font-size:26px;font-weight:700;color:#E8B84B;letter-spacing:2px;margin-bottom:12px}.sub{font-size:16px;color:#5A8AAB;line-height:1.6;margin-bottom:24px}.note{font-size:13px;color:#2C4A6E;letter-spacing:1px}</style></head><body><div class="card"><div class="icon">&#9672;</div><div class="title">ACCESS EXPIRED</div><div class="sub">This link has expired.<br>Contact your alliance leader for the updated access link.</div><div class="note">BEAGLE GLOBAL &mdash; AM4 TOOLS</div></div></body></html>`);
  }
  res.redirect('https://1drv.ms/x/c/1d8aec0d94831858/IQBVm4IplVXqT5dGbTbij7saAde5i02VMwDKSclI-W9HTD0');
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).send('Not found');
  logVisit(req);
  const ACCESS_KEY = process.env.ACCESS_KEY || '';
  if (ACCESS_KEY && req.query.k !== ACCESS_KEY) {
    return res.status(403).type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access Expired</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}.card{max-width:420px}.icon{font-size:48px;color:#C4920A;margin-bottom:20px}.title{font-size:26px;font-weight:700;color:#E8B84B;letter-spacing:2px;margin-bottom:12px}.sub{font-size:16px;color:#5A8AAB;line-height:1.6;margin-bottom:24px}.note{font-size:13px;color:#2C4A6E;letter-spacing:1px}</style></head><body><div class="card"><div class="icon">&#9672;</div><div class="title">ACCESS EXPIRED</div><div class="sub">This link has expired.<br>Contact your alliance leader for the current month's access link.</div><div class="note">BEAGLE GLOBAL &mdash; ALLIANCE PROJECTIONS</div></div></body></html>`);
  }
  res.type('html').send(HTML);
});
// ============================================================
// AM4 CONTRIBUTION CALCULATOR — add this block to server.js
// ============================================================

const AIRCRAFT_DATA = [
  { name: 'A380',          realism: 1154, easy: 1731 },
  { name: 'MC21-400',      realism: 1206, easy: 1808 },
  { name: 'A340-300 CHTR', realism: 1017, easy: 1526 },
  { name: 'B787-10',       realism: 1040, easy: 1559 },
  { name: 'B787-8/9',      realism: 894,  easy: 1341 },
  { name: 'B737-MAX 10',   realism: 969,  easy: 1454 },
  { name: 'A350-ULR',      realism: 933,  easy: 1399 },
  { name: 'DC10 Variants', realism: 999,  easy: 1498 },
  { name: 'B747-8',        realism: 1207, easy: 1810 },
  { name: 'B747SP',        realism: 1100, easy: 1650 },
  { name: 'B747-8F',       realism: 1087, easy: 1630 },
  { name: 'A380F',         realism: 1039, easy: 1559 },
  { name: 'A330 Variants', realism: 968,  easy: 1452 },
  { name: 'A330 CHTR',     realism: 969,  easy: 1454 },
  { name: 'FALCON 2000LX', realism: 1201, easy: 1802 },
  { name: 'Space Jet',     realism: 1235, easy: 1846 },
  { name: 'Concorde',      realism: 2126, easy: 3189 },
];

function _m(d) {
  if (d <= 6000) return 0.0044;
  if (d <= 10000) return 0.0044 + (0.00355 - 0.0044) * (d - 6000) / 4000;
  return 0.00355 + (0.00349 - 0.00355) * (d - 10000) / 10000;
}

function _calc(dist, th, speed, mode) {
  const ef = mode === 'Easy' ? 1 / 1.5 : 1;
  const ci = (2000 / 7) * (dist / (speed * th)) - (600 / 6.9);
  if (ci > 200) return 'X';
  return Math.round((1 + (200 - ci) * 0.01) * _m(dist) * dist * ef * 100) / 100;
}

const CALC_DISTANCES = [
  500,1000,1500,2000,2500,3000,3500,4000,4500,5000,5500,6000,
  10000,10500,11000,11500,12000,12500,13000,13500,14000,14500,
  15000,15500,16000,16500,17000,17500,18000,18500,19000,19500,20000
];

const CALC_TIMES = [];
for (let h = 1; h <= 24; h += 0.5) CALC_TIMES.push(h);

function timeLabel(h) {
  const hr = Math.floor(h);
  return hr + 'h ' + (h % 1 === 0 ? '00m' : '30m');
}

app.get('/api/calc', (req, res) => {
  if (req.query.k !== process.env.CONTRIBUTIONS_LOG_IN) return res.status(403).json({ error: 'Denied' });
  const ac = AIRCRAFT_DATA.find(a => a.name === req.query.aircraft);
  if (!ac) return res.status(400).json({ error: 'Unknown aircraft' });
  const mode = req.query.mode === 'Easy' ? 'Easy' : 'Realism';
  const speed = mode === 'Easy' ? ac.easy : ac.realism;
  const grid = CALC_TIMES.map(t => CALC_DISTANCES.map(d => _calc(d, t, speed, mode)));
  res.json({ grid });
});

app.get('/calculator', (req, res) => {
  if (req.query.k !== process.env.CONTRIBUTIONS_LOG_IN) return res.status(403).send('Access denied.');
  res.send(buildCalcPage(req.query.k));
});

function buildCalcPage(key) {
  const acOptions = AIRCRAFT_DATA.map(a =>
    '<option value="' + a.name + '">' + a.name + '</option>'
  ).join('');

  const distHeaders = CALC_DISTANCES.map((d, i) => {
    const isDzBefore = i === 12; // first col after dead zone
    const spacer = isDzBefore ? '<th class="dz-col" rowspan="1">DEAD ZONE<br><span>6,001 – 9,999 km</span></th>' : '';
    return spacer + '<th>' + d.toLocaleString() + '</th>';
  }).join('');

  const timeLabels = CALC_TIMES.map(t => '<td class="time-label">' + timeLabel(t) + '</td>').join('</tr><tr>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AM4 Contribution Calculator — Beagle Global</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #07090F;
    --surface: #0C1120;
    --header-bg: #0A1628;
    --border: #1B2A45;
    --border-light: #243352;
    --text: #C8D4EE;
    --text-dim: #4E6080;
    --accent: #1A72BB;
    --accent-glow: rgba(26,114,187,0.25);
    --dead-bg: #0D1118;
    --dead-text: #252F42;
    --dead-border: #151E2D;
    --x-bg: #2A0606;
    --x-text: #FF3D3D;
    --t1-bg: #071A0E; --t1-txt: #16A34A;
    --t2-bg: #0A2115; --t2-txt: #22C55E;
    --t3-bg: #0D2A1B; --t3-txt: #4ADE80;
    --t4-bg: #1A1400; --t4-txt: #EAB308;
    --t5-bg: #141D30; --t5-txt: #94A3B8;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    min-height: 100vh;
  }

  /* ── TOP HEADER ── */
  .top-bar {
    background: var(--header-bg);
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .logo-block { display: flex; align-items: center; gap: 12px; }
  .logo-text {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .logo-sep { color: var(--border-light); }
  .page-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text);
  }

  /* ── CONTROL BAR ── */
  .control-bar {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 14px 24px;
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
    position: sticky;
    top: 52px;
    z-index: 99;
  }
  .control-group { display: flex; align-items: center; gap: 10px; }
  .control-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  select {
    background: #0A1422;
    border: 1px solid var(--border-light);
    color: var(--text);
    padding: 6px 28px 6px 10px;
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234E6080'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    min-width: 160px;
  }
  select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }

  .mode-toggle { display: flex; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-light); }
  .mode-btn {
    padding: 6px 16px;
    background: #0A1422;
    border: none;
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    letter-spacing: 0.05em;
    transition: background 0.15s, color 0.15s;
  }
  .mode-btn.active { background: var(--accent); color: #fff; }
  .mode-btn:not(:last-child) { border-right: 1px solid var(--border-light); }

  .speed-display {
    font-size: 11px;
    color: var(--text-dim);
    letter-spacing: 0.05em;
  }
  .speed-display span { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }

  .status-msg {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
  }

  /* ── TABLE WRAPPER ── */
  .table-wrap {
    overflow: auto;
    max-height: calc(100vh - 120px);
  }

  table {
    border-collapse: collapse;
    white-space: nowrap;
    font-size: 11.5px;
  }

  /* ── HEADER ROW ── */
  thead th {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 6px 8px;
    text-align: center;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    position: sticky;
    top: 0;
    z-index: 50;
    font-variant-numeric: tabular-nums;
  }
  thead th:first-child {
    position: sticky;
    left: 0;
    z-index: 60;
    background: var(--surface);
    min-width: 68px;
    color: var(--text-dim);
    font-size: 9px;
    letter-spacing: 0.1em;
  }

  /* ── DEAD ZONE HEADER ── */
  th.dz-col {
    background: var(--dead-bg) !important;
    color: var(--dead-text) !important;
    border-color: var(--dead-border) !important;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    min-width: 90px;
    padding: 4px 8px;
    vertical-align: middle;
  }
  th.dz-col span { font-size: 8px; display: block; margin-top: 2px; letter-spacing: 0.05em; }

  /* ── TIME LABEL CELLS ── */
  td.time-label {
    position: sticky;
    left: 0;
    z-index: 10;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 4px 10px 4px 8px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-dim);
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  /* ── DATA CELLS ── */
  td.cell {
    border: 1px solid var(--border);
    padding: 4px 7px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    min-width: 52px;
    font-size: 11px;
    font-weight: 500;
    transition: filter 0.1s;
  }
  td.cell:hover { filter: brightness(1.35); cursor: default; }

  td.dz { background: var(--dead-bg); border-color: var(--dead-border); min-width: 90px; }

  td.val-x  { background: var(--x-bg);  color: var(--x-text);  font-weight: 700; }
  td.val-t1 { background: var(--t1-bg); color: var(--t1-txt); font-weight: 700; }
  td.val-t2 { background: var(--t2-bg); color: var(--t2-txt); font-weight: 600; }
  td.val-t3 { background: var(--t3-bg); color: var(--t3-txt); }
  td.val-t4 { background: var(--t4-bg); color: var(--t4-txt); }
  td.val-t5 { background: #0F1424; color: #5A7090; }
  td.val-empty { background: #090C14; color: #1A2235; }

  /* ── FOOTER ── */
  .footer {
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--text-dim);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* ── LOADING STATE ── */
  #loading-overlay {
    position: fixed; inset: 0;
    background: rgba(7,9,15,0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
    font-size: 13px;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    display: none;
  }

  @media print { body { display: none !important; } }
</style>
</head>
<body>

<div id="loading-overlay">CALCULATING...</div>

<div class="top-bar">
  <div class="logo-block">
    <span class="logo-text">ATLAS FX</span>
    <span class="logo-sep">|</span>
    <span class="logo-text">BEAGLE GLOBAL</span>
  </div>
  <span class="page-title">AM4 CONTRIBUTION CALCULATOR</span>
  <span style="width:160px"></span>
</div>

<div class="control-bar">
  <div class="control-group">
    <span class="control-label">Aircraft</span>
    <select id="aircraft-select">
      ${acOptions}
    </select>
  </div>
  <div class="control-group">
    <span class="control-label">Mode</span>
    <div class="mode-toggle">
      <button class="mode-btn active" id="btn-realism" onclick="setMode('Realism')">REALISM</button>
      <button class="mode-btn" id="btn-easy" onclick="setMode('Easy')">EASY</button>
    </div>
  </div>
  <div class="speed-display" id="speed-display">
    Speed: <span id="speed-val">—</span> km/h
  </div>
  <div class="status-msg" id="status-msg">SELECT AIRCRAFT TO LOAD TABLE</div>
</div>

<div class="table-wrap">
<table id="calc-table">
  <thead>
    <tr>
      <th>FLIGHT TIME</th>
      ${distHeaders}
    </tr>
  </thead>
  <tbody id="calc-body">
    <tr>
      ${timeLabels}
      ${CALC_DISTANCES.map((d, i) => (i === 12 ? '<td class="dz cell"></td>' : '') + '<td class="cell val-empty" id="empty-' + i + '"></td>').join('')}
    </tr>
  </tbody>
</table>
</div>

<div class="footer">
  <span>ATLAS FX | BEAGLE GLOBAL — AM4 CONTRIBUTION CALCULATOR</span>
  <span>BROWSER USE ONLY — NOT FOR DOWNLOAD OR DISTRIBUTION</span>
</div>

<script>
const DISTANCES = ${JSON.stringify(CALC_DISTANCES)};
const TIMES = ${JSON.stringify(CALC_TIMES)};
const AC_SPEEDS = ${JSON.stringify(Object.fromEntries(AIRCRAFT_DATA.map(a => [a.name, { r: a.realism, e: a.easy }])))};
const KEY = '${key}';

let currentMode = 'Realism';

function timeLabel(h) {
  const hr = Math.floor(h);
  return hr + 'h ' + (h % 1 === 0 ? '00m' : '30m');
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById('btn-realism').classList.toggle('active', mode === 'Realism');
  document.getElementById('btn-easy').classList.toggle('active', mode === 'Easy');
  const ac = document.getElementById('aircraft-select').value;
  if (ac) {
    const sp = AC_SPEEDS[ac];
    document.getElementById('speed-val').textContent = (mode === 'Easy' ? sp.e : sp.r).toLocaleString();
    loadGrid(ac, mode);
  }
}

function getTier(val, p20, p40, p60, p80) {
  if (val >= p80) return 'val-t1';
  if (val >= p60) return 'val-t2';
  if (val >= p40) return 'val-t3';
  if (val >= p20) return 'val-t4';
  return 'val-t5';
}

function percentile(sorted, p) {
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

async function loadGrid(aircraft, mode) {
  const overlay = document.getElementById('loading-overlay');
  overlay.style.display = 'flex';
  document.getElementById('status-msg').textContent = 'LOADING...';
  try {
    const r = await fetch('/api/calc?k=' + encodeURIComponent(KEY) + '&aircraft=' + encodeURIComponent(aircraft) + '&mode=' + encodeURIComponent(mode));
    const data = await r.json();
    const grid = data.grid;

    // Collect numeric values for percentile coloring
    const nums = [];
    grid.forEach(row => row.forEach(v => { if (typeof v === 'number') nums.push(v); }));
    nums.sort((a, b) => a - b);
    const p20 = percentile(nums, 0.2);
    const p40 = percentile(nums, 0.4);
    const p60 = percentile(nums, 0.6);
    const p80 = percentile(nums, 0.8);

    // Build table body
    const tbody = document.getElementById('calc-body');
    const rows = TIMES.map((t, ti) => {
      const cells = DISTANCES.map((d, di) => {
        const isDzBefore = di === 12;
        const dzCell = isDzBefore ? '<td class="cell dz"></td>' : '';
        const v = grid[ti][di];
        let cls, txt;
        if (v === 'X') { cls = 'val-x'; txt = 'X'; }
        else if (typeof v === 'number') { cls = getTier(v, p20, p40, p60, p80); txt = v.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2}); }
        else { cls = 'val-empty'; txt = ''; }
        return dzCell + '<td class="cell ' + cls + '">' + txt + '</td>';
      }).join('');
      return '<tr><td class="time-label">' + timeLabel(t) + '</td>' + cells + '</tr>';
    }).join('');

    tbody.innerHTML = rows;
    document.getElementById('status-msg').textContent = aircraft.toUpperCase() + ' — ' + mode.toUpperCase() + ' MODE';
  } catch(e) {
    document.getElementById('status-msg').textContent = 'ERROR — RELOAD PAGE';
  } finally {
    overlay.style.display = 'none';
  }
}

// Init on aircraft change
document.getElementById('aircraft-select').addEventListener('change', function() {
  const ac = this.value;
  const sp = AC_SPEEDS[ac];
  document.getElementById('speed-val').textContent = (currentMode === 'Easy' ? sp.e : sp.r).toLocaleString();
  loadGrid(ac, currentMode);
});

// Load first aircraft on page load
window.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('aircraft-select');
  if (sel.options.length) {
    const ac = sel.options[0].value;
    document.getElementById('speed-val').textContent = AC_SPEEDS[ac].r.toLocaleString();
    loadGrid(ac, currentMode);
  }
});

// Block right-click save
document.addEventListener('contextmenu', e => e.preventDefault());
</script>
</body>
</html>`;
}

// ============================================================
// END AM4 CONTRIBUTION CALCULATOR
// ============================================================


app.listen(PORT, () => console.log(`Beagle Projections live on port ${PORT}`));

