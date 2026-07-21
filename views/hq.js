const HQ_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Beagle HQ — Player Statistics</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{height:-webkit-fill-available}
body{background:#060610;color:#E2EAF4;font-family:'Segoe UI',Calibri,sans-serif;min-height:100vh;min-height:-webkit-fill-available;font-size:13px}
::-webkit-scrollbar{width:5px;height:5px;background:#0A0A18}
::-webkit-scrollbar-thumb{background:#1A3050;border-radius:3px}
.tooltip-wrap{position:relative;cursor:help}
.tooltip-wrap .tooltip-text{visibility:hidden;position:absolute;z-index:999;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#1A2040;color:#D0D8E8;border:1px solid #2A3A60;border-radius:5px;padding:8px 12px;font-size:11px;line-height:1.5;white-space:normal;width:220px;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.5)}
.tooltip-wrap:hover .tooltip-text,.tooltip-wrap:focus .tooltip-text{visibility:visible}
.tooltip-wrap .tooltip-text::after{content:'';position:absolute;bottom:100%;left:50%;margin-left:-5px;border:5px solid transparent;border-bottom-color:#1A2040}
.tab-bar{display:flex;gap:4px;padding:8px 16px;background:#0A0A18;border-bottom:1px solid #1A1A30}
.tab-btn{background:#12122A;border:1px solid #2A2A50;color:#8888AA;padding:8px 16px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-radius:4px;transition:all 0.15s;font-family:inherit}
.tab-btn:hover{color:#C0C0E0;border-color:#4040A0}
.tab-btn.active{background:#C4920A;color:#060610;border-color:#C4920A}
.stats-table{width:100%;border-collapse:collapse;font-size:11px}
.stats-table thead th{position:sticky;top:0;background:#0E0E20;padding:8px 6px;text-align:center;font-weight:700;letter-spacing:1px;color:#8888AA;border-bottom:2px solid #1A1A30;z-index:10;white-space:nowrap;cursor:default;font-size:10px}
.stats-table thead th:first-child{text-align:left;padding-left:12px}
.stats-table thead th:nth-child(2){text-align:left}
.stats-table tbody tr{border-bottom:1px solid #0E0E20;transition:background 0.1s}
.stats-table tbody tr:hover{background:#12122E}
.stats-table td{padding:6px 6px;text-align:center;white-space:nowrap}
.stats-table td:first-child{text-align:center;color:#5A5A80;font-weight:600;padding-left:12px}
.stats-table td:nth-child(2){text-align:left;font-weight:600}
.score-pill{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:0.5px}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.anim-row{animation:fadeSlideIn 0.3s ease-out both}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const{useState,useEffect,useCallback}=React;

const TOOLTIPS={
  'C/D':'Contribution per Day. How much money this player puts into the alliance each day. Higher = better.',
  'EFF':'Efficiency. How much this player earns per flight. Long profitable routes score higher than short cheap ones.',
  'MOM':'Momentum. Is this player improving or declining? Compares recent contribution rate against the previous period.',
  'CONSIST':'Consistency. Does this player contribute regularly with steady output? Active consistent contribution scores high, inactivity scores low.',
  'ACTIVITY':'Activity. Does this player\\'s online presence match their output? Being online and producing = high score.',
  'CONF':'Data Confidence. How reliable is the data for this player? More snapshots and more data points = higher confidence.',
  'MERIT':'Merit Score. The overall weighted performance score (0-100). C/D 40% + EFF 20% + MOM 15% + CONSIST 10% + ACTIVITY 5% + CONF 10%.',
};

const CONSIST_COLORS={
  'ELITE':'#1AFF00','STRONG':'#90EE02','BUILDING':'#FFD700','DEVELOPING':'#FF8C00','INCONSISTENT':'#FF3030','INACTIVE':'#8B0000','LOW DATA':'#555580'
};

function meritColor(s){
  if(s>=80)return '#1AFF00';
  if(s>=65)return '#90EE02';
  if(s>=50)return '#FFD700';
  if(s>=35)return '#FF8C00';
  if(s>=20)return '#FF3030';
  return '#8B0000';
}

function scoreColor(s){
  if(s==null)return '#555580';
  if(s>=80)return '#1AFF00';
  if(s>=60)return '#90EE02';
  if(s>=40)return '#FFD700';
  if(s>=20)return '#FF8C00';
  return '#FF3030';
}

function momColor(label){
  const m={'SURGING':'#1AFF00','RISING':'#90EE02','STABLE':'#FFD700','DROPPING':'#FF8C00','COLLAPSING':'#FF3030','INACTIVE':'#8B0000','NO DATA':'#555580'};
  return m[label]||'#555580';
}

const fmt=n=>{if(n==null)return'—';if(n>=1e6)return'$'+(n/1e6).toFixed(1)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(0)+'k';return'$'+n;};

function ThCell({label,tip}){
  if(!tip)return <th>{label}</th>;
  return <th><div className="tooltip-wrap" tabIndex="0">{label}<div className="tooltip-text">{tip}</div></div></th>;
}

function ManualEntry({players,onSave}){
  const[sel,setSel]=useState('');
  const[field,setField]=useState('sv');
  const[val,setVal]=useState('');
  const[msg,setMsg]=useState('');
  const save=async()=>{
    if(!sel||!val){setMsg('Select a player and enter a value');return;}
    try{
      const r=await fetch('/api/player-manual-entry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player:sel,field,value:parseFloat(val)})});
      const d=await r.json();
      if(d.ok){setMsg('Saved: '+sel+' '+field+' = '+val);setVal('');onSave();}
      else setMsg('Error: '+(d.error||'Unknown'));
    }catch(e){setMsg('Network error');}
  };
  return(<div style={{padding:20}}>
    <h3 style={{color:'#C4920A',fontSize:14,letterSpacing:1,marginBottom:16}}>MANUAL DATA ENTRY</h3>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
      <div><label style={{display:'block',fontSize:10,color:'#6A6A90',letterSpacing:1,marginBottom:4}}>PLAYER</label>
        <select value={sel} onChange={e=>setSel(e.target.value)} style={{background:'#12122A',border:'1px solid #2A2A50',color:'#E2EAF4',padding:'8px 12px',borderRadius:4,fontSize:13,minWidth:200}}>
          <option value="">— select player —</option>
          {players.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <div><label style={{display:'block',fontSize:10,color:'#6A6A90',letterSpacing:1,marginBottom:4}}>DATA POINT</label>
        <select value={field} onChange={e=>setField(e.target.value)} style={{background:'#12122A',border:'1px solid #2A2A50',color:'#E2EAF4',padding:'8px 12px',borderRadius:4,fontSize:13}}>
          <option value="sv">Share Value (SV)</option>
          <option value="lastContrib">Last Contribution</option>
          <option value="allianceContrib">Alliance Contribution</option>
          <option value="flights">Flights</option>
        </select>
      </div>
      <div><label style={{display:'block',fontSize:10,color:'#6A6A90',letterSpacing:1,marginBottom:4}}>VALUE</label>
        <input type="number" value={val} onChange={e=>setVal(e.target.value)} placeholder="Enter value..." style={{background:'#12122A',border:'1px solid #2A2A50',color:'#E2EAF4',padding:'8px 12px',borderRadius:4,fontSize:13,width:160}}/>
      </div>
      <button onClick={save} style={{background:'#C4920A',color:'#060610',border:'none',borderRadius:4,padding:'9px 20px',fontSize:12,fontWeight:700,letterSpacing:1,cursor:'pointer'}}>SAVE</button>
    </div>
    {msg&&<div style={{marginTop:12,fontSize:12,color:msg.startsWith('Error')?'#FF3030':'#1AFF00',letterSpacing:0.5}}>{msg}</div>}
    <div style={{marginTop:20,fontSize:11,color:'#4A4A70',lineHeight:1.6}}>
      Select any player and manually enter or override their share value, contribution, or flight count.<br/>
      Overrides are applied on next data refresh and logged for audit.
    </div>
  </div>);
}

function MostImproved({improved}){
  if(!improved||improved.length===0)return <div style={{padding:40,textAlign:'center',color:'#4A4A70'}}>No improvement data available yet. Need at least 2 snapshots.</div>;
  const maxPct=Math.max(...improved.map(p=>Math.abs(p.svPct)),1);
  return(<div style={{padding:16}}>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:16}}>
      {improved.slice(0,3).map((p,i)=>(
        <div key={p.name} style={{background:'#0E0E20',border:'1px solid '+(i===0?'#C4920A':'#1A1A30'),borderRadius:6,padding:14,flex:'1 1 200px',minWidth:200}}>
          <div style={{fontSize:10,color:i===0?'#C4920A':'#6A6A90',letterSpacing:1,marginBottom:4}}>#{i+1} MOST IMPROVED</div>
          <div style={{fontSize:16,fontWeight:700,color:'#E2EAF4'}}>{p.name}</div>
          <div style={{fontSize:24,fontWeight:700,color:'#1AFF00',marginTop:4}}>+{p.svPct.toFixed(2)}%</div>
          <div style={{fontSize:11,color:'#5A5A80',marginTop:4}}>{p.svStart.toFixed(2)} → {p.svEnd.toFixed(2)} SV</div>
        </div>
      ))}
    </div>
    <div style={{overflowY:'auto',maxHeight:'calc(100vh - 320px)'}}>
      <table className="stats-table">
        <thead><tr><th>#</th><th>PLAYER</th><th>SV START</th><th>SV END</th><th>CHANGE</th><th>% IMPROVEMENT</th></tr></thead>
        <tbody>
          {improved.map((p,i)=>{
            const barW=Math.max(2,Math.abs(p.svPct)/maxPct*100);
            const isUp=p.svPct>0;
            return(<tr key={p.name} className="anim-row" style={{animationDelay:i*0.03+'s'}}>
              <td>{i+1}</td>
              <td>{p.name}</td>
              <td style={{color:'#5A8AAB'}}>{p.svStart.toFixed(2)}</td>
              <td style={{color:'#5A8AAB'}}>{p.svEnd.toFixed(2)}</td>
              <td style={{color:isUp?'#1AFF00':'#FF3030'}}>{isUp?'+':''}{p.svChange.toFixed(2)}</td>
              <td>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:barW+'%',height:6,background:isUp?'#1AFF00':'#FF3030',borderRadius:3,minWidth:4,transition:'width 0.5s ease-out'}}/>
                  <span style={{color:isUp?'#1AFF00':'#FF3030',fontWeight:700}}>{isUp?'+':''}{p.svPct.toFixed(2)}%</span>
                </div>
              </td>
            </tr>);
          })}
        </tbody>
      </table>
    </div>
  </div>);
}

function App(){
  const[data,setData]=useState(null);
  const[stats,setStats]=useState(null);
  const[improved,setImproved]=useState(null);
  const[tab,setTab]=useState('stats');
  const[sort,setSort]=useState('merit');
  const[search,setSearch]=useState('');
  const[loading,setLoading]=useState(true);
  const[showAll,setShowAll]=useState(false);

  const reload=useCallback(async()=>{
    try{
      const[r1,r2,r3]=await Promise.all([
        fetch('/api/hq-data'),
        fetch('/api/player-stats'),
        fetch('/api/most-improved')
      ]);
      if(r1.ok){const d=await r1.json();setData(d);}
      if(r2.ok){const d=await r2.json();setStats(d);}
      if(r3.ok){const d=await r3.json();setImproved(d);}
    }catch(e){}
    setLoading(false);
  },[]);

  useEffect(()=>{reload();const t=setInterval(reload,30000);return()=>clearInterval(t);},[reload]);

  if(loading)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}><div style={{fontSize:36,color:'#C4920A'}}>◈</div><div style={{fontSize:18,color:'#5A5A80',letterSpacing:2}}>LOADING BEAGLE HQ...</div></div>);
  if(!data||!data.players||data.players.length===0)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}><div style={{fontSize:36,color:'#C4920A'}}>◈</div><div style={{fontSize:20,color:'#C4920A',fontWeight:700,letterSpacing:2}}>BEAGLE HQ</div><div style={{fontSize:15,color:'#5A5A80',marginTop:8}}>No pace data yet.</div></div>);

  const players=stats&&stats.players?stats.players:data.players.map((p,i)=>({...p,meritScore:0,meritRank:i+1,cdScore:0,efficiency:{efficiencyScore:null},momentum:{momentumScore:null,momentumLabel:'NO DATA'},consistency:{consistencyScore:null,consistencyLabel:'LOW DATA'},activity:{activityScore:null,activityLabel:'—'},confidence:{confidenceScore:null,confidenceLevel:'—'}}));

  let filtered=[...players];
  if(search)filtered=filtered.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
  filtered.sort((a,b)=>{
    if(sort==='merit')return b.meritScore-a.meritScore;
    if(sort==='cd')return b.cdScore-a.cdScore;
    if(sort==='eff')return(b.efficiency.efficiencyScore||0)-(a.efficiency.efficiencyScore||0);
    if(sort==='mom')return(b.momentum.momentumScore||0)-(a.momentum.momentumScore||0);
    if(sort==='consist')return(b.consistency.consistencyScore||0)-(a.consistency.consistencyScore||0);
    if(sort==='sv')return b.sv-a.sv;
    if(sort==='name')return a.name.localeCompare(b.name);
    return 0;
  });

  const visible=showAll?filtered:filtered.slice(0,10);
  const totalContrib=data.players.reduce((s,p)=>s+p.lastContrib,0);
  const avgMerit=players.length?Math.round(players.reduce((s,p)=>s+p.meritScore,0)/players.length*10)/10:0;
  const ts=data.timestamp?new Date(data.timestamp).toUTCString().replace(/.*?(\\d+:\\d+:\\d+).*/,'$1')+' UTC':'—';

  const tr=stats&&stats.teamRating;
  const trVals=tr&&tr.history?tr.history.map(h=>h.rating==null?'—':h.rating).join(', '):null;
  const bw=tr&&tr.bottomWatch?tr.bottomWatch:[];
  const worst=bw.length?bw[0]:null;

  return(<div style={{background:'#060610',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
    {tr&&tr.overall!=null&&(
      <div style={{background:'#C4920A',color:'#060610',padding:'7px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6,fontWeight:700,letterSpacing:1,fontSize:12}}>
        <span>PREVIOUS 7 DAYS TEAM RANKING · {trVals}</span>
        <span>OVERALL {tr.overall}</span>
      </div>
    )}
    {worst&&(
      <div style={{background:'#1A0808',borderBottom:'1px solid #5A1515',padding:'6px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6,fontSize:11,letterSpacing:0.5}}>
        <span style={{color:'#C08080'}}>
          <span style={{color:'#FF3030',fontWeight:700,letterSpacing:1}}>🔻 BOTTOM 5 WATCH ({tr.daysWithData}D)</span>
          {'  '}{bw.slice(0,5).map(p=>p.name+' '+p.daysInBottom+'/'+p.daysTracked).join(' · ')}
        </span>
        <span style={{color:'#FF3030',fontWeight:700}}>WORST: {worst.name} (#{worst.currentRank} of {worst.totalPlayers} · rating {Math.round(worst.currentRating)})</span>
      </div>
    )}
    <div style={{background:'linear-gradient(90deg,#08081A,#0E0E28)',borderBottom:'2px solid #C4920A',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <div>
        <div style={{fontSize:22,fontWeight:700,color:'#C4920A',letterSpacing:2}}>◈ BEAGLE HQ</div>
        <div style={{fontSize:12,color:'#5A5A80',marginTop:2,letterSpacing:1}}>PLAYER STATISTICS · UPDATED {ts} · {data.uploader||'—'}</div>
      </div>
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#C4920A'}}>{data.alliancePace||'—'}</div><div style={{fontSize:10,color:'#5A5A80'}}>PACE</div></div>
        <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#1AFF00'}}>{data.players.length}</div><div style={{fontSize:10,color:'#5A5A80'}}>PLAYERS</div></div>
        <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:meritColor(avgMerit)}}>{avgMerit}</div><div style={{fontSize:10,color:'#5A5A80'}}>AVG MERIT</div></div>
      </div>
    </div>

    <div className="tab-bar">
      {[['stats','PLAYER STATISTICS'],['improved','MOST IMPROVED'],['entry','MANUAL ENTRY']].map(([id,label])=>(
        <button key={id} className={'tab-btn'+(tab===id?' active':'')} onClick={()=>setTab(id)}>{label}</button>
      ))}
    </div>

    {tab==='stats'&&(<div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',gap:6,padding:'8px 16px',background:'#08081A',alignItems:'center',flexWrap:'wrap',borderBottom:'1px solid #1A1A30'}}>
        <span style={{fontSize:10,color:'#5A5A80',letterSpacing:1,marginRight:4}}>SORT</span>
        {[['merit','MERIT'],['cd','C/D'],['eff','EFF'],['mom','MOM'],['consist','CONSIST'],['sv','SV'],['name','NAME']].map(([k,l])=>(
          <button key={k} onClick={()=>setSort(k)} style={{background:sort===k?'#1A1A40':'transparent',border:'1px solid '+(sort===k?'#4040A0':'#1A1A30'),color:sort===k?'#C4920A':'#5A5A80',borderRadius:3,padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer',letterSpacing:0.5,fontFamily:'inherit'}}>{l}</button>
        ))}
        <div style={{marginLeft:'auto'}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search player..." style={{background:'#12122A',border:'1px solid #2A2A50',borderRadius:3,color:'#E2EAF4',padding:'5px 10px',fontSize:12,fontFamily:'inherit',outline:'none',width:160}}/></div>
      </div>

      <div style={{flex:1,overflow:'auto'}}>
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>PLAYER</th>
              <ThCell label="C/D" tip={TOOLTIPS['C/D']}/>
              <ThCell label="EFF" tip={TOOLTIPS['EFF']}/>
              <ThCell label="MOM" tip={TOOLTIPS['MOM']}/>
              <ThCell label="CONSIST" tip={TOOLTIPS['CONSIST']}/>
              <ThCell label="ACTIVITY" tip={TOOLTIPS['ACTIVITY']}/>
              <ThCell label="CONF" tip={TOOLTIPS['CONF']}/>
              <ThCell label="MERIT" tip={TOOLTIPS['MERIT']}/>
              <th>SV</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p,i)=>{
              const ms=p.meritScore||0;
              const mc=meritColor(ms);
              const eff=p.efficiency.efficiencyScore;
              const mom=p.momentum.momentumScore;
              const cons=p.consistency.consistencyScore;
              const act=p.activity.activityScore;
              const conf=p.confidence.confidenceScore;
              return(<tr key={p.name} className="anim-row" style={{animationDelay:i*0.02+'s'}}>
                <td>{p.meritRank}</td>
                <td>
                  <div style={{fontSize:13,color:'#E2EAF4'}}>{p.name}</div>
                  <div style={{fontSize:10,color:'#4A4A70',marginTop:1}}>{fmt(p.lastContrib)} · {p.lastSeenStr||'?'}</div>
                </td>
                <td><span style={{color:scoreColor(p.cdScore),fontWeight:700}}>{p.cdScore!=null?p.cdScore.toFixed(1):'—'}</span></td>
                <td><span style={{color:scoreColor(eff),fontWeight:600}}>{eff!=null?eff.toFixed(1):'—'}</span></td>
                <td><span className="score-pill" style={{background:momColor(p.momentum.momentumLabel)+'22',color:momColor(p.momentum.momentumLabel),border:'1px solid '+momColor(p.momentum.momentumLabel)+'44'}}>{p.momentum.momentumLabel}</span></td>
                <td><span className="score-pill" style={{background:(CONSIST_COLORS[p.consistency.consistencyLabel]||'#555')+'22',color:CONSIST_COLORS[p.consistency.consistencyLabel]||'#555',border:'1px solid '+(CONSIST_COLORS[p.consistency.consistencyLabel]||'#555')+'44'}}>{p.consistency.consistencyLabel}</span></td>
                <td><span style={{color:scoreColor(act),fontWeight:600}}>{act!=null?act:'—'}</span></td>
                <td><span style={{color:scoreColor(conf),fontWeight:600}}>{conf!=null?conf:'—'}</span></td>
                <td style={{fontWeight:700}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <div style={{width:32,height:4,background:'#1A1A30',borderRadius:2,overflow:'hidden'}}><div style={{width:ms+'%',height:'100%',background:mc,borderRadius:2}}/></div>
                    <span style={{color:mc}}>{ms.toFixed(1)}</span>
                  </div>
                </td>
                <td style={{color:'#5A8AAB',fontSize:12}}>{p.sv?p.sv.toFixed(2):'—'}</td>
              </tr>);
            })}
          </tbody>
        </table>
        {!showAll&&filtered.length>10&&(
          <div style={{textAlign:'center',padding:12}}>
            <button onClick={()=>setShowAll(true)} style={{background:'#12122A',border:'1px solid #2A2A50',color:'#C4920A',padding:'8px 24px',borderRadius:4,cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:1,fontFamily:'inherit'}}>
              SHOW ALL {filtered.length} PLAYERS ▾
            </button>
          </div>
        )}
        {showAll&&filtered.length>10&&(
          <div style={{textAlign:'center',padding:12}}>
            <button onClick={()=>setShowAll(false)} style={{background:'#12122A',border:'1px solid #2A2A50',color:'#5A5A80',padding:'8px 24px',borderRadius:4,cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:1,fontFamily:'inherit'}}>
              COLLAPSE TO TOP 10 ▴
            </button>
          </div>
        )}
      </div>
    </div>)}

    {tab==='improved'&&<MostImproved improved={improved}/>}

    {tab==='entry'&&<ManualEntry players={data.players} onSave={reload}/>}
  </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
<\/script>
</body>
</html>`;

module.exports = { HQ_HTML };
