/* ATL-154 rework (3 Oct 2026): the CURRENT PACE tab is the ALLIANCE PACE DAILY TREND
   graph ruled 5-6 Aug, 31 Aug and 5 Sep. Ranks 1-10 and 11-20 sit behind a
   two-position toggle, each half is full screen on its own y-axis, and the ruled
   columns sit on the right of the graph. Every figure comes from the canonical board
   (lib/pace.js) or the stored uploads. Nothing is smoothed, interpolated into a
   value, or averaged into a headline. */
(function () {
const { useState, useEffect, useMemo, useRef, useLayoutEffect } = React;
const PL = window.PaceLib;
const DAY = 86400000;
const MIN_INTERVAL = 20 * 3600000; // same 20 h floor as lib/pace.js and /pace
const GOLD = '#FFC422';
const BG = '#020409';
const INK = '#E2EAF4', DIM = '#7F95AA', FAINT = '#4A6280', UP = '#2BFF6E', DN = '#FF3B3B';
// Deep full-saturation neon, one set per half so the ten lines on screen never share a colour.
const NEON = [
  ['#44EC1E', '#FF2910', '#0DC1E8', '#E013E0', '#FEA900', '#4411DB', '#1AFF00', '#FF00CE', '#FFFF00', '#9F00D0'],
  ['#00FFC8', '#F11501', '#2E8BFF', '#FF7A00', '#B4FF00', '#FF0090', '#00E1FF', '#C800FF', '#FFE600', '#00FF6A'],
];
// Average-pace datum: the 10 Jan 2026 alliance list (the same datum and share
// values the /pace page carries in views/pace.js).
const DATUM_T = '2026-01-09T23:36:00Z';
const DATUM_SV = {
  valiantair: 6018.47, freeflying: 4431.18, dokdo: 7094.15, beagleglobal: 2179.67, peraspera: 4515.21,
  grizzlygroup: 4896.57, happyskies20: 3339.55, germanalliance: 3774.81, spacex: 2632.89, skywings: 2451.45,
  indonesiaunity: 3976.07, alphavikings: 2370.93, brasilgt: 2550.15, codeshare: 2907.55, starfleet: 3031.45,
  staralliance: 2350.81, clearskygroup: 2690.46, jetstar: 2724.48, russianwings: 3041.19, mixerworld: 2809.26,
};
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const short = (s, n) => s && s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
const fmtP = v => v == null || !isFinite(v) ? 'nil data' : '$' + v.toFixed(3);
const fmtPct = v => v == null ? 'nil data' : (v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(1) + '%';
// The window a pace was measured over, as h:mm (24.3 h -> 24:20).
const hmm = days => { if (days == null) return '\u2014'; const m = Math.round(days * 1440); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
const dShort = t => { const d = new Date(t); return d.getUTCDate() + ' ' + MO[d.getUTCMonth()]; };
const utc = t => { if (!t) return '\u2014'; const d = new Date(t); return dShort(t) + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };

/* % change of the latest upload-to-upload pace against the one before it. */
function lastMove(readings) {
  const rs = (readings || []).filter(r => r.sv != null).slice().sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const ps = [];
  for (let i = 1; i < rs.length; i++) {
    const dt = Date.parse(rs[i].t) - Date.parse(rs[i - 1].t);
    if (dt < MIN_INTERVAL) continue;
    ps.push((rs[i].sv - rs[i - 1].sv) / (dt / DAY));
  }
  const n = ps.length;
  return n > 1 && ps[n - 2] ? (ps[n - 1] - ps[n - 2]) / Math.abs(ps[n - 2]) * 100 : null;
}

/* Days / date to pass, at today's (current) pace for both teams: straight line, no
   trend, no average. Rivals: Beagle passes them or they pass Beagle. Beagle: the next
   team above it on share value. */
function passOf(r, beagle, all, asOf) {
  const when = d => (d < 1 ? '<1' : Math.round(d)) + 'd \u00b7 ' + dShort(asOf + d * DAY);
  if (r.isBeagle) {
    const next = all.filter(a => !a.isBeagle && a.sv > r.sv).sort((a, b) => a.sv - b.sv)[0];
    if (!next) return { txt: 'top of the table', col: DIM, days: null };
    const d = PL.catchDay(r, next);
    return d != null ? { txt: 'passes #' + next.rank + ' \u00b7 ' + when(d), col: UP, days: d, who: next.name } : { txt: 'not closing on #' + next.rank, col: DN, days: null, who: next.name };
  }
  const d = r.catchDaysLinear;
  if (r.gap > 0) return d != null ? { txt: 'Beagle passes ' + when(d), col: UP, days: d } : { txt: 'pulling away from Beagle', col: DN, days: null };
  return d != null ? { txt: 'passes Beagle ' + when(d), col: DN, days: d } : { txt: 'Beagle stays clear', col: UP, days: null };
}

function buildRows(board, hist, rd) {
  const all = (board && board.alliances) || [];
  const asOf = Date.parse(board && board.asOf);
  const beagle = all.find(r => r.isBeagle) || null;
  const histBy = new Map(((hist && hist.teams) || []).map(t => [norm(t.name), t]));
  const rdBy = new Map(((rd && rd.series) || []).map(s => [norm(s.name), s]));
  const since = (asOf - Date.parse(DATUM_T)) / DAY;
  const rows = all.filter(r => r.paceRank != null && r.pace != null)
    .sort((a, b) => a.paceRank - b.paceRank)
    .map((r, i) => {
      const h = histBy.get(norm(r.name));
      const pts = h ? h.points.map(p => p.y) : [];
      const s = rdBy.get(norm(r.name));
      const dsv = DATUM_SV[norm(r.name)];
      return Object.assign({}, r, {
        half: i < 10 ? 0 : 1,
        pts,
        today: pts.length ? pts[pts.length - 1] : null,
        move: s ? lastMove(s.readings) : null,
        avg: dsv != null && since > 0 ? (r.sv - dsv) / since : null,
        moveRank: null,
      });
    });
  rows.filter(r => r.move != null).sort((a, b) => a.move - b.move).forEach((r, i) => { r.moveRank = i + 1; });
  [0, 1].forEach(hf => { let j = 0; rows.filter(r => r.half === hf).forEach(r => { r.color = r.isBeagle ? GOLD : NEON[hf][j++ % 10]; }); });
  rows.forEach(r => { r.pass = passOf(r, beagle, all, asOf); });
  return rows;
}

function nilDaysOf(hist) {
  const teams = (hist && hist.teams) || [], n = ((hist && hist.labels) || []).length, out = [];
  for (let i = 0; i < n; i++) if (!teams.some(t => t.points[i] && t.points[i].y != null)) out.push(i);
  return out;
}

/* Where a line passes at index i, between its real readings: a position for drawing
   only, never printed as a number. */
function bridged(pts, i) {
  let a = -1, b = -1;
  for (let k = 0; k < pts.length; k++) { if (pts[k] == null) continue; if (k <= i) a = k; if (k >= i && b < 0) b = k; }
  if (a < 0 && b < 0) return null;
  if (a < 0) return pts[b];
  if (b < 0 || a === b) return pts[a];
  return pts[a] + (pts[b] - pts[a]) * (i - a) / (b - a);
}
/* Days to print "nil data" under: every day when there is room, else once per run of days. */
function nilRuns(days, each) {
  if (each) return days.map(i => [i, i]);
  const out = [];
  days.forEach(i => { const l = out[out.length - 1]; if (l && i === l[1] + 1) l[1] = i; else out.push([i, i]); });
  return out;
}
function lastIdx(pts) { for (let i = pts.length - 1; i >= 0; i--) if (pts[i] != null) return i; return -1; }
function decollide(items, gap, top, bottom) {
  const a = items.slice().sort((p, q) => p.y - q.y);
  for (let i = 1; i < a.length; i++) if (a[i].y - a[i - 1].y < gap) a[i].y = a[i - 1].y + gap;
  const over = a.length ? a[a.length - 1].y - bottom : 0;
  if (over > 0) a.forEach(it => { it.y -= over; });
  if (a.length && a[0].y < top) { const u = top - a[0].y; a.forEach(it => { it.y += u; }); }
  return a;
}

const COLDEF = {
  name: { h: 'ALLIANCE', sub: 'pace # \u00b7 SV rank' },
  today: { h: 'TODAY', sub: '' },
  cur: { h: 'CURRENT PACE', sub: 'latest upload \u00b7 h:mm' },
  avg: { h: 'AVERAGE', sub: 'since 10 Jan 2026' },
  move: { h: 'LAST MOVE', sub: 'latest reading' },
  mrank: { h: 'RANK', sub: 'worst = #1' },
  pass: { h: 'DAYS / DATE TO PASS', sub: 'at today\u2019s pace' },
};
const SETS = [
  [['name', 200], ['today', 84], ['cur', 140], ['avg', 124], ['move', 88], ['mrank', 70], ['pass', 214]],
  [['name', 190], ['cur', 140], ['avg', 120], ['move', 86], ['mrank', 70], ['pass', 208]],
  [['name', 180], ['cur', 134], ['move', 86], ['pass', 196]],
  [['name', 176], ['cur', 128], ['pass', 192]],
  [['name', 170], ['cur', 120]],
];
/* The widest set of ruled columns that still leaves the graph a usable width; every
   column is always in the NUMBERS view under the graph. */
function colsFor(w) {
  if (w < 640) return [['name', 130], ['cur', 62]];
  for (const s of SETS) { const t = s.reduce((a, c) => a + c[1], 0); if (w - t - 90 >= Math.max(340, w * 0.34)) return s; }
  return SETS[SETS.length - 1];
}

const CSS = '@keyframes pbDraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}' +
  '.pb-line{stroke-dasharray:1;animation:pbDraw 1.7s cubic-bezier(.2,.7,.2,1) both}' +
  '.pb-seg button{font-family:inherit}';

function TrendGraph(props) {
  const { rows, labels, nilDays, hidden, onToggle, w, mob, range, todayLabel } = props;
  const n = labels.length;
  const clampV = (a, b) => { const span = Math.max(2, Math.min(n - 1, b - a)); const x0 = Math.max(0, Math.min(a, n - 1 - span)); return { x0, x1: x0 + span }; };
  const [view, setView] = useState(() => clampV(n - range, n - 1));
  const [sel, setSel] = useState(null);
  const svgRef = useRef(null), drag = useRef(null), ptrs = useRef(new Map()), pinch = useRef(null);

  const cols = colsFor(w), colsW = cols.reduce((a, c) => a + c[1], 0);
  const ml = mob ? 44 : 64, mt = mob ? 54 : 70, mb = mob ? 44 : 52, BUF = 19; // BUF ~ 5 mm between line end and name
  const pr = w - colsW - BUF - 6, plotW = Math.max(60, pr - ml);
  const H = mob ? 440 : Math.round(Math.max(520, Math.min(window.innerHeight * 0.68, 780)));
  const ch = H - mt - mb;
  const { x0, x1 } = view;
  const X = i => ml + (i - x0) / (x1 - x0) * plotW;
  let mn = Infinity, mx = -Infinity;
  rows.forEach(r => r.pts.forEach((y, i) => { if (y != null && i >= Math.floor(x0) && i <= Math.ceil(x1)) { if (y < mn) mn = y; if (y > mx) mx = y; } }));
  if (!isFinite(mn)) { mn = 0; mx = 1; }
  const pad = (mx - mn) * 0.1 || 0.5, y0 = mn - pad, y1 = mx + pad;
  const Y = v => mt + ch - (v - y0) / (y1 - y0) * ch;
  const colW = plotW / (x1 - x0);
  const inView = i => i >= x0 - 0.5 && i <= x1 + 0.5;
  const fsRow = mob ? 11.5 : 13.5, rowGap = mob ? 19 : 25;
  const chipFs = Math.max(11, Math.min(18, 11.5 * Math.sqrt(14 / (x1 - x0))));

  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = e => {
      const r = el.getBoundingClientRect(), px = e.clientX - r.left;
      if (px < ml || px > pr) return;
      e.preventDefault();
      setView(v => { const c = v.x0 + (px - ml) / plotW * (v.x1 - v.x0), f = e.deltaY < 0 ? 1 / 1.15 : 1.15; return clampV(c - (c - v.x0) * f, c + (v.x1 - c) * f); });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ml, pr, plotW, n]);
  const onDown = e => {
    ptrs.current.set(e.pointerId, e.clientX);
    if (ptrs.current.size === 2) { const xs = [...ptrs.current.values()]; pinch.current = { d: Math.abs(xs[0] - xs[1]), v: view }; }
    else drag.current = { x: e.clientX, v: view, moved: false };
  };
  const onMove = e => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, e.clientX);
    if (ptrs.current.size === 2 && pinch.current) {
      const xs = [...ptrs.current.values()], d = Math.abs(xs[0] - xs[1]), p = pinch.current;
      if (p.d > 10 && d > 10) { const f = p.d / d, c = (p.v.x0 + p.v.x1) / 2; setView(clampV(c - (c - p.v.x0) * f, c + (p.v.x1 - c) * f)); }
      if (drag.current) drag.current.moved = true;
      return;
    }
    const dr = drag.current; if (!dr) return;
    const dx = e.clientX - dr.x;
    if (Math.abs(dx) > 5) dr.moved = true;
    if (dr.moved) { const s = dx / plotW * (dr.v.x1 - dr.v.x0); setView(clampV(dr.v.x0 - s, dr.v.x1 - s)); }
  };
  const onUp = e => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null; };
  const moved = () => !!(drag.current && drag.current.moved);
  const idxAt = e => { const r = svgRef.current.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.round(x0 + (e.clientX - r.left - ml) / plotW * (x1 - x0)))); };
  const pick = (e, name) => {
    if (moved()) return;
    e.stopPropagation();
    const i = idxAt(e);
    setSel(s => s && s.i === i && s.name === name ? null : { i, name });
  };

  const path = r => { let d = ''; r.pts.forEach((y, i) => { if (y == null) return; d += (d ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(y).toFixed(1); }); return d; };
  const ends = decollide(rows.map(r => {
    const li = lastIdx(r.pts);
    if (li < 0) return { r, ax: null, ay: null, y: mt + ch / 2 };
    const v = bridged(r.pts, x1), ax = X(Math.min(x1, li)), ay = Math.max(mt, Math.min(mt + ch, Y(v)));
    return { r, ax: ax >= ml ? ax : null, ay, y: ay };
  }), rowGap, mt + rowGap / 2, mt + ch - rowGap / 2);

  const ticks = [0, 1, 2, 3, 4].map(k => y0 + (y1 - y0) * k / 4);
  const step = Math.max(1, Math.ceil((x1 - x0) / Math.max(2, plotW / 64)));
  const ordered = rows.filter(r => !hidden[r.name]).sort((a, b) => (a.isBeagle - b.isBeagle));

  let chips = [];
  if (sel && inView(sel.i)) {
    const list = sel.name ? rows.filter(r => r.name === sel.name && !hidden[r.name]) : ordered;
    const chH = chipFs + 10;
    chips = decollide(list.map(r => {
      const pv = bridged(r.pts, sel.i); if (pv == null) return null;
      const real = r.pts[sel.i] != null;
      const txt = sel.name ? short(r.name, 18) + ' \u00b7 ' + labels[sel.i] + ' \u00b7 ' + (real ? fmtP(r.pts[sel.i]) + '/day' : 'nil data') : short(r.name, 11) + '  ' + (real ? fmtP(r.pts[sel.i]) : 'nil data');
      const cw = txt.length * chipFs * 0.58 + 18;
      return { r, real, txt, cw, py: Y(pv), y: Y(pv) };
    }).filter(Boolean), chH + 3, mt + chH / 2, mt + ch - chH / 2);
  }

  const headX = []; { let cx = pr + BUF; cols.forEach(c => { headX.push(cx); cx += c[1]; }); }
  const cell = (k, cw, r, x, y) => {
    const ex = x + cw - 8, base = { y: y + fsRow * 0.36, fontSize: fsRow };
    if (k === 'name') return (<text key={k} x={x} {...base} fill={r.color} fontWeight={r.isBeagle ? 800 : 650}>
      {'#' + r.paceRank + ' ' + short(r.name, mob ? 10 : cw > 185 ? 17 : 15)}
      <tspan fill={DIM} fontSize={fsRow - 3} fontWeight="500">{'  SV #' + r.rank}</tspan></text>);
    if (k === 'today') return (<text key={k} x={ex} {...base} textAnchor="end" fill={r.today == null ? FAINT : INK} fontStyle={r.today == null ? 'italic' : 'normal'}>{fmtP(r.today)}</text>);
    if (k === 'cur') return (<text key={k} x={ex} {...base} textAnchor="end">
      <tspan fill={r.color} fontWeight="800">{fmtP(r.pace)}</tspan>
      {cw > 100 && <tspan fill={DIM} fontSize={fsRow - 2.5}>{'  ' + hmm(r.windowDays)}</tspan>}</text>);
    if (k === 'avg') return (<text key={k} x={ex} {...base} textAnchor="end" fontWeight="700" fill={r.avg == null ? FAINT : r.pace >= r.avg ? UP : DN}>
      {r.avg == null ? 'nil data' : (r.pace >= r.avg ? '\u25b2 ' : '\u25bc ') + fmtP(r.avg)}</text>);
    if (k === 'move') return (<text key={k} x={ex} {...base} textAnchor="end" fontWeight="700" fill={r.move == null ? FAINT : r.move >= 0 ? UP : DN}>{fmtPct(r.move)}</text>);
    if (k === 'mrank') return (<text key={k} x={ex} {...base} textAnchor="end" fill={INK} fontWeight="700">{r.moveRank ? '#' + r.moveRank : '\u2014'}</text>);
    if (k === 'pass') return (<text key={k} x={ex} {...base} fontSize={fsRow - 1} textAnchor="end" fill={r.pass.col} fontWeight="700">{r.pass.txt}{r.pass.who ? <title>{r.pass.who}</title> : null}</text>);
    return null;
  };

  return (<svg ref={svgRef} width={w} height={H} viewBox={'0 0 ' + w + ' ' + H} style={{ display: 'block', userSelect: 'none', touchAction: 'pan-y' }}
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
    onClick={e => { if (moved()) return; const r = svgRef.current.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top; if (px >= ml && px <= pr && py >= mt && py <= mt + ch) pick(e, null); }}>
    <defs>
      <filter id="pb-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <clipPath id="pb-plot"><rect x={ml} y={mt - 8} width={plotW + 1} height={ch + 16} /></clipPath>
      <linearGradient id="pb-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#07122A" /><stop offset="1" stopColor="#020409" /></linearGradient>
    </defs>
    <rect x={ml} y={mt} width={plotW} height={ch} fill="url(#pb-bg)" rx="3" />
    {nilDays.filter(inView).map(i => (<g key={'nil' + i} clipPath="url(#pb-plot)">
      <rect x={X(i) - colW / 2} y={mt} width={colW} height={ch} fill="#1A2236" opacity="0.55" />
    </g>))}
    {nilRuns(nilDays.filter(i => i >= x0 && i <= x1), colW >= 46).map(([a, b]) => (<text key={'nl' + a} x={(X(a) + X(b)) / 2} y={mt + ch + 34} textAnchor="middle" fill={FAINT} fontSize="10.5" fontStyle="italic">nil data</text>))}
    {ticks.map((v, k) => (<g key={'t' + k}>
      <line x1={ml} x2={pr} y1={Y(v)} y2={Y(v)} stroke="#13243C" strokeWidth="0.8" strokeDasharray="3,6" />
      <text x={ml - 8} y={Y(v) + 4} textAnchor="end" fill={DIM} fontSize={mob ? 10 : 12}>{'$' + v.toFixed(2)}</text>
    </g>))}
    {labels.map((l, i) => (i >= x0 - 1e-9 && i <= x1 + 1e-9 && (n - 1 - i) % step === 0) ? (<text key={'x' + i} x={X(i)} y={mt + ch + 18} textAnchor="middle" fill={DIM} fontSize={mob ? 10 : 12}>{l}</text>) : null)}
    <g clipPath="url(#pb-plot)">
      {ordered.map(r => { const d = path(r); if (!d) return null; const B = r.isBeagle; return (<g key={r.name}>
        <path d={d} pathLength="1" className="pb-line" stroke={r.color} strokeWidth={B ? 4 : 2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#pb-glow)" style={{ animationDelay: B ? '.25s' : '0s' }} opacity={sel && sel.name && sel.name !== r.name ? 0.28 : 1} />
        {r.pts.map((y, i) => y == null || !inView(i) ? null : (<circle key={i} cx={X(i)} cy={Y(y)} r={B ? 3.6 : 2.6} fill={r.color} />))}
        <path d={d} stroke="transparent" strokeWidth="18" fill="none" style={{ cursor: 'pointer' }} onClick={e => pick(e, r.name)} />
      </g>); })}
    </g>
    {sel && inView(sel.i) && (<g pointerEvents="none">
      <line x1={X(sel.i)} x2={X(sel.i)} y1={mt} y2={mt + ch} stroke={GOLD} strokeWidth="1.4" strokeDasharray="4,4" />
      <text x={X(sel.i)} y={mt - 6} textAnchor="middle" fill={GOLD} fontSize="12" fontWeight="800">{labels[sel.i]}</text>
      {chips.map(c => { const chH = chipFs + 10, right = X(sel.i) - 12, x = Math.max(2, right - c.cw); return (<g key={'c' + c.r.name}>
        <circle cx={X(sel.i)} cy={c.py} r="5" fill={c.real ? c.r.color : BG} stroke={c.real ? '#FFFFFF' : FAINT} strokeWidth="1.5" />
        <line x1={X(sel.i) - 5} y1={c.py} x2={right} y2={c.y} stroke={c.r.color} strokeWidth="1" opacity=".7" />
        <rect x={x} y={c.y - chH / 2} width={right - x} height={chH} rx="5" fill="#050B18" stroke={c.real ? c.r.color : FAINT} strokeWidth="1.4" />
        <text x={right - 9} y={c.y + chipFs * 0.36} textAnchor="end" fill={c.real ? c.r.color : DIM} fontSize={chipFs} fontWeight="800">{c.txt}</text>
      </g>); })}
    </g>)}
    <line x1={ml} y1={mt} x2={ml} y2={mt + ch} stroke="#2C4A6E" />
    <line x1={ml} y1={mt + ch} x2={pr} y2={mt + ch} stroke="#2C4A6E" />
    {cols.map((c, k) => { const end = c[0] !== 'name', tx = end ? headX[k] + c[1] - 8 : headX[k], d = COLDEF[c[0]]; return (<g key={'h' + c[0]}>
      <text x={tx} y={mt - 34} textAnchor={end ? 'end' : 'start'} fill={GOLD} fontSize={mob ? 10 : 11.5} fontWeight="800" letterSpacing=".08em">{mob && c[0] === 'cur' ? 'CURRENT' : d.h}</text>
      <text x={tx} y={mt - 20} textAnchor={end ? 'end' : 'start'} fill={DIM} fontSize={mob ? 9 : 10}>{c[0] === 'today' ? todayLabel : mob && c[0] === 'cur' ? '$/day' : d.sub}</text>
    </g>); })}
    <line x1={pr + BUF} x2={w - 4} y1={mt - 12} y2={mt - 12} stroke={GOLD} opacity=".45" />
    {ends.map(e => { const r = e.r, off = !!hidden[r.name]; return (<g key={'row' + r.name} opacity={off ? 0.32 : 1} style={{ cursor: 'pointer' }} onClick={ev => { ev.stopPropagation(); onToggle(r.name); }}>
      <rect x={pr + BUF - 6} y={e.y - rowGap / 2} width={colsW + 8} height={rowGap} fill={r.isBeagle ? 'rgba(255,196,34,.13)' : 'transparent'} rx="3" />
      {!off && e.ax != null && <path d={'M' + e.ax + ',' + e.ay + ' L' + (pr + 4) + ',' + e.ay + ' L' + (pr + BUF - 8) + ',' + e.y} stroke={r.color} strokeWidth="1.2" opacity=".75" fill="none" />}
      {cols.map((c, k) => cell(c[0], c[1], r, headX[k], e.y))}
    </g>); })}
  </svg>);
}

function Seg({ options, value, onChange, big }) {
  return (<div className="pb-seg" style={{ display: 'inline-flex', border: '1px solid #1E3352', borderRadius: 7, overflow: 'hidden' }}>
    {options.map(([v, l]) => { const on = v === value; return (<button key={String(v)} onClick={() => onChange(v)} aria-pressed={on}
      style={{ background: on ? GOLD : '#050B18', color: on ? '#0B0800' : '#8FB0CC', border: 'none', padding: big ? '9px 22px' : '7px 14px', fontSize: big ? 16 : 13, fontWeight: 800, letterSpacing: '.08em', cursor: 'pointer', boxShadow: on ? '0 0 16px rgba(255,196,34,.55)' : 'none' }}>{l}</button>); })}
  </div>);
}

function Spark({ pts, color }) {
  const W = 220, H = 46, real = pts.map((y, i) => [i, y]).filter(p => p[1] != null);
  if (real.length < 2) return <div style={{ height: H, color: FAINT, fontSize: 11, fontStyle: 'italic' }}>nil data</div>;
  const mn = Math.min(...real.map(p => p[1])), mx = Math.max(...real.map(p => p[1]));
  const X = i => 4 + i / Math.max(1, pts.length - 1) * (W - 8), Y = v => H - 5 - (mx > mn ? (v - mn) / (mx - mn) : 0.5) * (H - 10);
  const d = real.map((p, k) => (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join('');
  return (<svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block', marginTop: 6 }}>
    <path d={d} stroke={color} strokeWidth="2.2" fill="none" vectorEffect="non-scaling-stroke" style={{ filter: 'drop-shadow(0 0 3px ' + color + ')' }} />
  </svg>);
}

function Cards({ rows }) {
  return (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 12 }}>
    {rows.map(r => (<div key={r.name} style={{ background: '#050A14', border: '1px solid ' + (r.isBeagle ? GOLD : '#13233B'), borderTop: '3px solid ' + r.color, boxShadow: r.isBeagle ? '0 0 26px rgba(255,196,34,.35)' : 'none', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color: r.color, fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{'#' + r.paceRank + ' ' + r.name}</span>
        <span style={{ color: DIM, fontSize: 11, whiteSpace: 'nowrap' }}>{'SV #' + r.rank}</span>
      </div>
      <div style={{ fontSize: 31, fontWeight: 900, color: r.color, textShadow: '0 0 16px ' + r.color + '77', marginTop: 2 }}>{fmtP(r.pace)}
        <span style={{ fontSize: 12, color: DIM, fontWeight: 600 }}>{' /day \u00b7 ' + hmm(r.windowDays)}</span></div>
      <Spark pts={r.pts.slice(-14)} color={r.color} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, fontWeight: 700 }}>
        <span style={{ color: r.avg == null ? FAINT : r.pace >= r.avg ? UP : DN }}>{'avg since 10 Jan ' + fmtP(r.avg)}</span>
        <span style={{ color: r.move == null ? FAINT : r.move >= 0 ? UP : DN }}>{fmtPct(r.move)}</span>
      </div>
    </div>))}
  </div>);
}

function Numbers({ rows, half }) {
  const th = { padding: '6px 8px', fontSize: 11, letterSpacing: '.06em', color: GOLD, fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap' };
  const td = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' };
  return (<details style={{ marginTop: 12 }}>
    <summary style={{ cursor: 'pointer', color: GOLD, fontWeight: 800, letterSpacing: '.1em', fontSize: 13 }}>{'NUMBERS \u00b7 ' + (half ? '11 \u2014 20' : '1 \u2014 10')}</summary>
    <div style={{ overflowX: 'auto', marginTop: 8 }}><table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
      <thead><tr><th style={{ ...th, textAlign: 'left' }}>PACE #</th><th style={{ ...th, textAlign: 'left' }}>ALLIANCE</th><th style={th}>TODAY</th><th style={th}>CURRENT PACE</th><th style={th}>MEASURED OVER (UTC)</th><th style={th}>AVERAGE SINCE 10 JAN 2026</th><th style={th}>LAST MOVE</th><th style={th}>RANK</th><th style={th}>DAYS / DATE TO PASS (TODAY&rsquo;S PACE)</th><th style={th}>SV RANK</th></tr></thead>
      <tbody>{rows.map(r => (<tr key={r.name} style={{ borderBottom: '1px solid #0B1A2B', background: r.isBeagle ? 'rgba(255,196,34,.12)' : 'transparent' }}>
        <td style={{ ...td, textAlign: 'left', fontWeight: 800, color: r.color }}>{'#' + r.paceRank}</td>
        <td style={{ ...td, textAlign: 'left', color: r.color, fontWeight: r.isBeagle ? 800 : 600 }}>{r.name}</td>
        <td style={td}>{fmtP(r.today)}</td>
        <td style={{ ...td, fontWeight: 800 }}>{fmtP(r.pace) + '/day'}</td>
        <td style={{ ...td, color: DIM }}>{hmm(r.windowDays) + ' \u00b7 ' + utc(r.from) + ' \u2192 ' + utc(r.to)}</td>
        <td style={{ ...td, color: r.avg == null ? FAINT : r.pace >= r.avg ? UP : DN }}>{fmtP(r.avg)}</td>
        <td style={{ ...td, color: r.move == null ? FAINT : r.move >= 0 ? UP : DN }}>{fmtPct(r.move)}</td>
        <td style={td}>{r.moveRank ? '#' + r.moveRank : '\u2014'}</td>
        <td style={{ ...td, color: r.pass.col }}>{r.pass.txt + (r.pass.who ? ' (' + r.pass.who + ')' : '')}</td>
        <td style={{ ...td, color: DIM }}>{'#' + r.rank}</td>
      </tr>))}</tbody>
    </table></div>
  </details>);
}

function useWidth(ref) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const upd = () => setW(el.clientWidth);
    upd();
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

function PaceBoard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [half, setHalf] = useState(0);
  const [range, setRange] = useState(14);
  const [mode, setMode] = useState('graph');
  const [hidden, setHidden] = useState({});
  const wrapRef = useRef(null);
  const w = useWidth(wrapRef);
  useEffect(() => {
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    Promise.all([get('/api/data'), get('/api/pace-history?days=30'), get('/api/pace-readings?days=90')])
      .then(([d, h, rd]) => { if (!d || !d.canonical) throw new Error('server returned no canonical pace block'); setData({ board: d.canonical, hist: h, rd }); })
      .catch(e => setErr(String(e && e.message || e)));
  }, []);
  const rows = useMemo(() => data ? buildRows(data.board, data.hist, data.rd) : [], [data]);
  const nilDays = useMemo(() => data ? nilDaysOf(data.hist) : [], [data]);
  const mob = w > 0 && w < 640;
  const padX = mob ? 8 : 18;
  const toggle = name => setHidden(h => { const o = Object.assign({}, h); if (o[name]) delete o[name]; else o[name] = true; return o; });
  const halfRows = rows.filter(r => r.half === half);
  const nHidden = halfRows.filter(r => hidden[r.name]).length;
  return (<div ref={wrapRef} style={{ background: BG, minHeight: '80vh', padding: (mob ? 10 : 14) + 'px ' + padX + 'px 28px', color: INK }}>
    <style>{CSS}</style>
    {err ? <div style={{ color: DN, padding: 8 }}>Current pace unavailable: {err}</div>
      : !data ? <div style={{ color: DIM, padding: 8 }}>Loading current pace{'\u2026'}</div>
      : (<div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 340px', minWidth: 0 }}>
            <div style={{ fontSize: mob ? 20 : 28, fontWeight: 900, letterSpacing: '.12em', color: GOLD, textShadow: '0 0 20px rgba(255,196,34,.5)' }}>ALLIANCE PACE {'\u00b7'} DAILY TREND</div>
            <div style={{ fontSize: mob ? 11.5 : 13, color: DIM, marginTop: 3 }}>{'Ranked by current pace from the latest upload (' + utc(data.board.asOf) + ' UTC). Each point is the share value gained over the day \u00f7 the exact time between uploads.'}</div>
          </div>
          {mode === 'graph' && <Seg big options={[[0, '1 \u2014 10'], [1, '11 \u2014 20']]} value={half} onChange={setHalf} />}
          {mode === 'graph' && <Seg options={[[7, '7D'], [14, '14D'], [30, '30D']]} value={range} onChange={setRange} />}
          <Seg options={[['graph', 'GRAPH'], ['cards', 'CARDS']]} value={mode} onChange={setMode} />
          {mode === 'graph' && nHidden > 0 && <button onClick={() => setHidden({})} style={{ background: '#1A1200', border: '1px solid ' + GOLD, color: GOLD, borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{'ALL LINES ON (' + nHidden + ' off)'}</button>}
        </div>
        {mode === 'graph' ? (<div>
          <div style={{ border: '1px solid #10203A', borderTop: '2px solid ' + GOLD, borderRadius: 8, background: '#03060D', boxShadow: '0 0 60px rgba(13,193,232,.06), inset 0 0 50px rgba(0,0,0,.7)', overflow: 'hidden' }}>
            {w > 0 && <TrendGraph key={half + '-' + range} rows={halfRows} labels={data.hist.labels || []} nilDays={nilDays} hidden={hidden} onToggle={toggle}
              w={w - padX * 2 - 2} mob={mob} range={range} todayLabel={data.hist.end ? dShort(data.hist.end + 'T00:00:00Z') : ''} />}
          </div>
          <div style={{ fontSize: 11.5, color: DIM, marginTop: 8, lineHeight: 1.5 }}>Tap a line for its pace that day (chip left of the playhead) {'\u00b7'} tap the chart for every line {'\u00b7'} tap a name to switch its line off or on {'\u00b7'} wheel or pinch to zoom, drag to pan. Shaded columns are days with no upload from anyone: they read {'\u201c'}nil data{'\u201d'}, lines stay continuous in their own colour, and nothing is smoothed into a value.</div>
          <Numbers rows={halfRows} half={half} />
        </div>) : <Cards rows={rows} />}
        <div style={{ fontSize: 11.5, color: FAINT, marginTop: 10, lineHeight: 1.5 }}>{data.board.methodLabel} Days / date to pass use today{'\u2019'}s current pace for both teams, as a straight line. Averages are context only.</div>
      </div>)}
  </div>);
}

window.PaceBoard = PaceBoard;
window.PaceBoardLib = { buildRows, passOf, lastMove, colsFor, nilDaysOf, hmm, DATUM_T, DATUM_SV, NEON, GOLD };
})();
