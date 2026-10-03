/* ═══════════════════════════════════════════════════════════════════════════
   BEAGLE GLOBAL — ALLIANCE PROJECTIONS (ATL-131 rebuild)

   Every number on this page comes from the canonical board served in
   /api/data → canonical (lib/pace.js). The projection maths is the same file,
   loaded into the page as window.PaceLib, so the browser cannot drift from the
   server or the Discord post.

   Rendering: one <canvas>, one renderer. Series are built once per
   (data, period, view, focus, projection) change. Zoom, pan and hover only
   move the view window and schedule a single requestAnimationFrame redraw —
   nothing is rebuilt, nothing animates, React does not re-render.
   ═══════════════════════════════════════════════════════════════════════════ */
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const PL = window.PaceLib;
const DAY_MS = 86400000;

const C = {
  bg: '#030B17', panel: '#050D1A', plot: '#02070F', line: '#0E2236', grid: '#0F2034',
  axis: '#7AAAC8', text: '#E2EAF4', muted: '#9AB4C8', dim: '#6E8CA6',
  gold: '#E8B84B', beagle: '#FFC422', up: '#00E676', dn: '#FF5A5A', amber: '#FF9100',
};
// 19 distinct, high-contrast line colours, assigned in rank order so two
// neighbours never share a colour (the old hash could).
// No yellows or ambers: gold is Beagle's alone.
const PALETTE = ['#00E36B','#19D9C6','#FF6B18','#3B93FF','#FF3D63','#A855F7','#00C9A7','#FF4D9D','#4ADE80',
  '#818CF8','#38BDF8','#E879F9','#67E8F9','#F87171','#C084FC','#94A3B8','#F43F8E','#A3E635','#60A5FA'];
const PERIODS = [
  { k: '20D', d: 20 }, { k: '1MO', d: 30.4 }, { k: '2MO', d: 60.8 },
  { k: '3MO', d: 91.3 }, { k: '6MO', d: 182.6 }, { k: '12MO', d: 365 },
];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtMoney(v, dp) { if (v == null || !isFinite(v)) return '—'; return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: dp == null ? 2 : dp, maximumFractionDigits: dp == null ? 2 : dp }); }
function fmtDate(d) { return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
function fmtShortDate(d) { return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
function fmtUtc(ts) {
  if (!ts) return '—';
  const d = new Date(ts), p = n => String(n).padStart(2, '0');
  const a = new Date(d.getTime() + 8 * 3600000);
  return fmtShortDate(d) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ' UTC · ' + p(a.getUTCHours()) + ':' + p(a.getUTCMinutes()) + ' AWST';
}
function trendArrow(t) { return t === 'accelerating' ? '↗' : t === 'decelerating' ? '↘' : t === 'steady' ? '→' : ''; }
function trendColor(t) { return t === 'accelerating' ? C.up : t === 'decelerating' ? C.dn : C.muted; }
function shortName(s, n) { n = n || 18; return s && s.length > n ? s.slice(0, n - 1) + '…' : s; }

/* ── model building ───────────────────────────────────────────────────────── */
function svAt(r, d, trend) { return PL.projectSV(r.sv, r.pace, trend ? r.accel : 0, d); }

function catchFor(r, trend) { return trend ? r.catchDaysTrend : r.catchDaysLinear; }

// The pack Beagle is actually racing: anyone Beagle reaches or who reaches
// Beagle inside the period, plus the two ranks either side. Never fewer than
// five lines besides Beagle.
function packOf(rows, beagle, days, trend) {
  const others = rows.filter(r => !r.isBeagle && r.pace != null);
  const keep = new Set(['Beagle Global']);
  for (const r of others) {
    const cd = catchFor(r, trend);
    if ((cd != null && cd <= days) || Math.abs((r.rank || 99) - (beagle.rank || 99)) <= 2) keep.add(r.name);
  }
  let span = 3;
  while ([...keep].length < 6 && span < 20) {
    for (const r of others) if (Math.abs((r.rank || 99) - (beagle.rank || 99)) <= span) keep.add(r.name);
    span++;
  }
  return rows.filter(r => keep.has(r.name));
}

function buildModel(board, opts) {
  const { view, days, focus, trend, log, colorOf } = opts;
  const rows = board.alliances.filter(r => r.pace != null);
  const beagle = rows.find(r => r.isBeagle);
  if (!beagle) return null;
  const shown = focus === 'pack' ? packOf(rows, beagle, days, trend) : rows;
  const N = 90;
  const xs = Array.from({ length: N + 1 }, (_, i) => days * i / N);
  const base = { kind: view, xMax: days, asOf: board.asOf, series: [], markers: [], yLog: false, invert: false };
  // Projected rank of every alliance at day d, from the whole field's projected SV —
  // the ranking the table prints for the same horizon. The right-edge labels use it.
  base.rankAt = d => {
    const m = new Map();
    rows.map(r => ({ name: r.name, v: svAt(r, d, trend) })).sort((a, b) => b.v - a.v).forEach((s, i) => m.set(s.name, i + 1));
    return m;
  };

  if (view === 'rank') {
    // Rank at every step from the whole field's projected SV (not just the shown pack).
    const ranksAt = xs.map(d => {
      const svs = rows.map(r => ({ name: r.name, v: svAt(r, d, trend) })).sort((a, b) => b.v - a.v);
      const m = new Map(); svs.forEach((s, i) => m.set(s.name, i + 1)); return m;
    });
    for (const r of shown) {
      base.series.push({
        name: r.name, rank: r.rank, isBeagle: r.isBeagle, color: colorOf(r),
        pts: xs.map((d, i) => [d, ranksAt[i].get(r.name)]), lin: null,
        endFmt: v => '#' + Math.round(v),
      });
    }
    const rk = base.series.flatMap(s => s.pts.map(p => p[1]));
    base.yMin = Math.min(...rk) - 0.6; base.yMax = Math.max(...rk) + 0.6;
    base.invert = true; base.yTick = v => '#' + v; base.intTicks = true;
    base.title = 'Projected rank';
    return base;
  }

  if (view === 'gap') {
    // Measured against Beagle's share value NOW, so Beagle carries its own projected
    // climb from 0 through the pack instead of being pinned flat to 0. A crossing is
    // where a rival's line meets Beagle's line, and that is where its dot sits.
    const b0 = beagle.sv;
    for (const r of shown) {
      const f = d => svAt(r, d, trend) - b0;
      const fl = d => svAt(r, d, false) - b0;
      base.series.push({
        name: r.name, rank: r.rank, isBeagle: r.isBeagle, color: colorOf(r),
        pts: xs.map(d => [d, f(d)]), lin: trend ? xs.map(d => [d, fl(d)]) : null,
        endFmt: v => (v >= 0 ? '+' : '−') + fmtMoney(Math.abs(v)),
      });
      const cd = catchFor(r, trend);
      if (!r.isBeagle && cd != null && cd > 0 && cd <= days) base.markers.push({ x: cd, y: svAt(beagle, cd, trend) - b0, color: colorOf(r), text: fmtShortDate(new Date(Date.parse(board.asOf) + cd * DAY_MS)), name: r.name });
    }
    const all = base.series.flatMap(s => s.pts.concat(s.lin || []).map(p => p[1]));
    const lo = Math.min(0, ...all), hi = Math.max(0, ...all), pad = (hi - lo) * 0.06 || 10;
    base.yMin = lo - pad; base.yMax = hi + pad;
    base.yTick = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtMoney(Math.abs(v));
    base.zeroLine = true;
    base.title = 'Share value against Beagle now (0 = Beagle today; Beagle climbs from 0)';
    return base;
  }

  // SV lines
  for (const r of shown) {
    base.series.push({
      name: r.name, rank: r.rank, isBeagle: r.isBeagle, color: colorOf(r),
      pts: xs.map(d => [d, svAt(r, d, trend)]), lin: trend ? xs.map(d => [d, svAt(r, d, false)]) : null,
      endFmt: v => fmtMoney(v),
    });
    const cd = catchFor(r, trend);
    if (!r.isBeagle && cd != null && cd > 0 && cd <= days) {
      base.markers.push({ x: cd, y: svAt(beagle, cd, trend), color: colorOf(r), text: fmtShortDate(new Date(Date.parse(board.asOf) + cd * DAY_MS)), name: r.name });
    }
  }
  const all = base.series.flatMap(s => s.pts.concat(s.lin || []).map(p => p[1]));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (log) { base.yLog = true; lo *= 0.985; hi *= 1.015; }
  else { const pad = (hi - lo) * 0.05 || 10; lo -= pad; hi += pad; }
  base.yMin = lo; base.yMax = hi;
  base.yTick = v => fmtMoney(v);
  base.title = 'Share value' + (log ? ' (log scale)' : '');
  return base;
}

/* ── canvas renderer ─────────────────────────────────────────────────────── */
function niceStep(range, target) {
  const raw = range / Math.max(1, target), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
}

function createRenderer(canvas, hooks) {
  const ctx = canvas.getContext('2d');
  const st = { model: null, view: null, w: 0, h: 0, dpr: 1, hover: null, sel: null, raf: 0, mobile: false };

  function plotRect() {
    const mob = st.w < 640;
    const labelW = mob ? 118 : 236, m = st.model;
    // wide enough for the longest tick label, e.g. $10,000.00
    const tickChars = m && m.yTick ? Math.max(String(m.yTick(m.yMin)).length, String(m.yTick(m.yMax)).length) : 0;
    const l = Math.max(mob ? 46 : 64, Math.round(tickChars * (mob ? 6 : 7) + 10));
    return { l, r: st.w - labelW, t: 14, b: st.h - (mob ? 26 : 30), labelW, mob };
  }
  function yMap(v) {
    const m = st.model, V = st.view, R = plotRect();
    let a = V.y0, b = V.y1, x = v;
    if (m.yLog) { a = Math.log(a); b = Math.log(b); x = Math.log(Math.max(v, 1e-9)); }
    let f = (x - a) / (b - a); if (m.invert) f = 1 - f;
    return R.b - f * (R.b - R.t);
  }
  function yInv(py) {
    const m = st.model, V = st.view, R = plotRect();
    let f = (R.b - py) / (R.b - R.t); if (m.invert) f = 1 - f;
    if (m.yLog) return Math.exp(Math.log(V.y0) + f * (Math.log(V.y1) - Math.log(V.y0)));
    return V.y0 + f * (V.y1 - V.y0);
  }
  function xMap(d) { const V = st.view, R = plotRect(); return R.l + (d - V.x0) / (V.x1 - V.x0) * (R.r - R.l); }
  function xInv(px) { const V = st.view, R = plotRect(); return V.x0 + (px - R.l) / (R.r - R.l) * (V.x1 - V.x0); }
  function valueAt(pts, d) {
    if (d <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (pts[i][0] >= d) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]); }
    return pts[pts.length - 1][1];
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(280, Math.round(r.width)), h = Math.max(220, Math.round(r.height));
    // Bounded backing store: never more than ~4 MP however large the screen or zoom.
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    while (w * h * dpr * dpr > 4e6 && dpr > 1) dpr -= 0.25;
    if (w !== st.w || h !== st.h || dpr !== st.dpr) {
      st.w = w; st.h = h; st.dpr = dpr;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    schedule();
  }
  function schedule() { if (!st.raf) st.raf = requestAnimationFrame(() => { st.raf = 0; draw(); }); }

  function drawLine(pts, color, width, alpha, dash) {
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) { const x = xMap(pts[i][0]), y = yMap(pts[i][1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  function draw() {
    const t0 = performance.now();
    const m = st.model; if (!m || !st.w) return;
    const R = plotRect(), V = st.view;
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, st.w, st.h);
    ctx.fillStyle = C.plot; ctx.fillRect(R.l, R.t, R.r - R.l, R.b - R.t);
    const font = (wt, px) => wt + ' ' + px + 'px -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';

    // y grid
    ctx.font = font(400, R.mob ? 10 : 12); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const ticks = [];
    if (m.intTicks) {
      const lo = Math.ceil(Math.min(V.y0, V.y1)), hi = Math.floor(Math.max(V.y0, V.y1));
      const step = Math.max(1, Math.round((hi - lo) / 10));
      for (let v = lo; v <= hi; v += step) ticks.push(v);
    } else {
      const lo = Math.min(V.y0, V.y1), hi = Math.max(V.y0, V.y1), step = niceStep(hi - lo, R.mob ? 5 : 7);
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    }
    for (const v of ticks) {
      const y = yMap(v); if (y < R.t - 1 || y > R.b + 1) continue;
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(R.l, y); ctx.lineTo(R.r, y); ctx.stroke();
      ctx.fillStyle = C.axis; ctx.fillText(m.yTick(v), R.l - 6, y);
    }
    if (m.zeroLine) { const y = yMap(0); if (y >= R.t && y <= R.b) { ctx.strokeStyle = C.gold; ctx.globalAlpha = .55; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(R.l, y); ctx.lineTo(R.r, y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; } }

    // x grid: calendar-aligned, never duplicated. Short spans tick every n days
    // from today; month-scale spans tick on the 1st of the month.
    const span = V.x1 - V.x0, want = R.mob ? 4 : 7;
    const asOf = Date.parse(m.asOf) || Date.now();
    const xt = [];
    const dayStep = [1, 2, 3, 7, 14].find(s => span / s <= want);
    if (dayStep) {
      for (let d = Math.ceil(V.x0 / dayStep) * dayStep; d <= V.x1 + 1e-6; d += dayStep) xt.push([d, d < 0.5 ? 'NOW' : fmtShortDate(new Date(asOf + d * DAY_MS))]);
    } else {
      const k = [1, 2, 3, 6, 12].find(n => span / (n * 30.44) <= want) || 12;
      const start = new Date(asOf + V.x0 * DAY_MS);
      let y = start.getUTCFullYear(), mo = start.getUTCMonth() + 1;
      if (mo > 11) { mo = 0; y++; }
      for (let guard = 0; guard < 400; guard++) {
        const t = Date.UTC(y, mo, 1), d = (t - asOf) / DAY_MS;
        if (d > V.x1) break;
        if (mo % k === 0 && d >= V.x0) xt.push([d, mo === 0 ? 'Jan ' + y : MON[mo]]);
        mo++; if (mo > 11) { mo = 0; y++; }
      }
      if (V.x0 < 0.5) xt.unshift([0, 'NOW']);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; let lastPx = -1e9;
    for (const [d, lbl] of xt) {
      const x = xMap(d); if (x < R.l - 1 || x > R.r + 1) continue;
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, R.t); ctx.lineTo(x, R.b); ctx.stroke();
      if (x - lastPx < (R.mob ? 44 : 52)) continue; lastPx = x;
      ctx.fillStyle = lbl === 'NOW' ? C.gold : C.axis; ctx.fillText(lbl, x, R.b + 6);
    }

    // series
    ctx.save(); ctx.beginPath(); ctx.rect(R.l, R.t, R.r - R.l, R.b - R.t); ctx.clip();
    const sel = st.sel, hov = st.hover;
    const focusName = hov || sel;
    const order = m.series.slice().sort((a, b) => (a.isBeagle - b.isBeagle) || ((a.name === focusName) - (b.name === focusName)));
    for (const s of order) {
      const faded = focusName && s.name !== focusName && !s.isBeagle;
      if (s.lin) drawLine(s.lin, s.color, 1, faded ? .08 : .35, [4, 4]);
      if (s.isBeagle) {
        ctx.shadowColor = C.beagle; ctx.shadowBlur = 10;
        drawLine(s.pts, C.beagle, 4, 1); ctx.shadowBlur = 0;
      } else drawLine(s.pts, s.color, s.name === focusName ? 3 : 1.8, faded ? .14 : .95);
    }
    for (const mk of m.markers) {
      const x = xMap(mk.x), y = yMap(mk.y); if (x < R.l || x > R.r || y < R.t || y > R.b) continue;
      const faded = focusName && mk.name !== focusName;
      ctx.globalAlpha = faded ? .25 : 1;
      ctx.fillStyle = C.bg; ctx.strokeStyle = mk.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!faded && (focusName || !R.mob)) {
        ctx.font = font(600, R.mob ? 10 : 11); ctx.fillStyle = mk.color; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(mk.text, x, y - 8);
      }
      ctx.globalAlpha = 1;
    }
    // Zoomed into a region with no line in it: say so instead of an empty plot.
    const anyVisible = m.series.some(s => s.pts.some(p => { const x = xMap(p[0]), y = yMap(p[1]); return x >= R.l && x <= R.r && y >= R.t && y <= R.b; }));
    if (!anyVisible) {
      ctx.font = font(600, 13); ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('No lines in this view — press RESET or double-click', (R.l + R.r) / 2, (R.t + R.b) / 2);
    }
    // Beagle's own start marker
    const bs = m.series.find(s => s.isBeagle);
    if (bs) { const x = xMap(Math.max(V.x0, 0)), y = yMap(valueAt(bs.pts, Math.max(V.x0, 0))); ctx.fillStyle = C.beagle; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();

    // axes
    ctx.strokeStyle = '#2C4A6E'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(R.l, R.t); ctx.lineTo(R.l, R.b); ctx.lineTo(R.r, R.b); ctx.stroke();

    // right-hand labels with two-way collision avoidance and leader lines
    const fs = R.mob ? 10.5 : 12.5, gapPx = fs + 3;
    const endX = Math.min(V.x1, m.xMax);
    const rankMap = m.rankAt ? m.rankAt(endX) : null;
    let labels = m.series.map(s => { const v = valueAt(s.pts, endX); return { s, v, y0: yMap(v) }; })
      .filter(l => l.y0 >= R.t - 40 && l.y0 <= R.b + 40);
    const cap = Math.floor((R.b - R.t) / gapPx);
    if (labels.length > cap) {
      // Too many to print legibly: keep Beagle, the focused line, then the nearest to Beagle.
      const by = labels.find(l => l.s.isBeagle), byY = by ? by.y0 : (R.t + R.b) / 2;
      labels.sort((a, b) => (b.s.isBeagle - a.s.isBeagle) || ((b.s.name === focusName) - (a.s.name === focusName)) || (Math.abs(a.y0 - byY) - Math.abs(b.y0 - byY)));
      labels = labels.slice(0, cap);
    }
    labels.sort((a, b) => a.y0 - b.y0);
    labels.forEach(l => { l.y = Math.min(Math.max(l.y0, R.t + fs / 2), R.b - fs / 2); });
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < gapPx) labels[i].y = labels[i - 1].y + gapPx;
      const over = labels.length ? labels[labels.length - 1].y - (R.b - fs / 2) : 0;
      if (over > 0) for (const l of labels) l.y -= over;
      for (let i = labels.length - 2; i >= 0; i--) if (labels[i + 1].y - labels[i].y < gapPx) labels[i].y = labels[i + 1].y - gapPx;
      const under = labels.length ? (R.t + fs / 2) - labels[0].y : 0;
      if (under > 0) for (const l of labels) l.y += under;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const l of labels) {
      const s = l.s, faded = focusName && s.name !== focusName && !s.isBeagle;
      ctx.globalAlpha = faded ? .35 : 1;
      const yl = Math.min(Math.max(l.y0, R.t), R.b);
      ctx.strokeStyle = s.isBeagle ? C.beagle : s.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(R.r, yl); ctx.lineTo(R.r + 6, yl); ctx.lineTo(R.r + 12, l.y); ctx.stroke();
      const nameMax = R.mob ? 11 : 17;
      const pr = rankMap ? rankMap.get(s.name) : null;
      const txt = (pr ? '#' + pr + ' ' : '') + shortName(s.name, nameMax);
      ctx.font = font(s.isBeagle || s.name === focusName ? 700 : 500, fs);
      ctx.fillStyle = s.isBeagle ? C.beagle : s.color;
      ctx.fillText(txt, R.r + 15, l.y);
      if (!R.mob || s.isBeagle || s.name === focusName) {
        const tw = ctx.measureText(txt).width;
        ctx.font = font(400, fs - 1); ctx.fillStyle = s.isBeagle ? C.beagle : C.muted;
        const nowTxt = pr && pr !== s.rank ? 'now #' + s.rank : '';
        const endTxt = m.kind === 'rank' ? '' : s.endFmt(l.v);
        for (const val of [[nowTxt, endTxt].filter(Boolean).join(' · '), nowTxt]) {
          if (val && R.r + 15 + tw + 6 + ctx.measureText(val).width < st.w - 2) { ctx.fillText(val, R.r + 15 + tw + 6, l.y); break; }
        }
      }
      ctx.globalAlpha = 1;
    }

    // hover read-out
    if (st.hoverX != null && hov) {
      const s = m.series.find(q => q.name === hov);
      if (s) {
        const d = Math.min(Math.max(st.hoverX, V.x0), V.x1), v = valueAt(s.pts, d), x = xMap(d), y = yMap(v);
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, R.t); ctx.lineTo(x, R.b); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = s.isBeagle ? C.beagle : s.color; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        const dt = new Date((Date.parse(m.asOf) || Date.now()) + d * DAY_MS);
        const text = shortName(s.name, 20) + ' · ' + fmtShortDate(dt) + ' · ' + s.endFmt(v);
        ctx.font = font(600, 12); const tw = ctx.measureText(text).width + 14;
        let bx = x + 10; if (bx + tw > R.r) bx = x - 10 - tw; const by = Math.max(R.t + 2, y - 30);
        ctx.fillStyle = 'rgba(5,13,26,.94)'; ctx.strokeStyle = s.isBeagle ? C.beagle : s.color; ctx.lineWidth = 1;
        ctx.fillRect(bx, by, tw, 22); ctx.strokeRect(bx, by, tw, 22);
        ctx.fillStyle = C.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + 7, by + 11);
      }
    }
    st.lastFrameMs = performance.now() - t0;
    if (hooks.onDraw) hooks.onDraw(st);
  }

  function defaultView() { const m = st.model; return { x0: 0, x1: m.xMax, y0: m.yMin, y1: m.yMax }; }
  function zoomLevel() { const m = st.model, V = st.view; return m ? Math.max(m.xMax / (V.x1 - V.x0), (m.yMax - m.yMin) / Math.abs(V.y1 - V.y0)) : 1; }
  function clampView(V) {
    const m = st.model; const xr = Math.min(V.x1 - V.x0, m.xMax);
    let x0 = Math.max(0, Math.min(V.x0, m.xMax - xr));
    const out = { x0, x1: x0 + xr, y0: V.y0, y1: V.y1 };
    if (m.yLog && out.y0 <= 0) { out.y0 = m.yMin; }
    return out;
  }
  // Zoom by factor f (<1 = in) about a point in pixels; limited to 40×.
  function zoom(f, px, py) {
    if (!st.model) return;
    const R = plotRect(), V = st.view, m = st.model;
    px = px == null ? (R.l + R.r) / 2 : px; py = py == null ? (R.t + R.b) / 2 : py;
    const cx = xInv(px), cy = yInv(py);
    const minX = m.xMax / 40, minY = (m.yMax - m.yMin) / 40;
    let xr = Math.min(m.xMax, Math.max(minX, (V.x1 - V.x0) * f));
    let yr0 = V.y1 - V.y0, yr = Math.min(m.yMax - m.yMin, Math.max(minY, yr0 * f));
    if (m.yLog) { st.view = clampView({ x0: cx - (cx - V.x0) * xr / (V.x1 - V.x0), x1: cx + (V.x1 - cx) * xr / (V.x1 - V.x0), y0: V.y0, y1: V.y1 }); const lf = yr / yr0; const lc = Math.log(cy), l0 = Math.log(V.y0), l1 = Math.log(V.y1); st.view.y0 = Math.exp(lc - (lc - l0) * lf); st.view.y1 = Math.exp(lc + (l1 - lc) * lf); }
    else st.view = clampView({ x0: cx - (cx - V.x0) * xr / (V.x1 - V.x0), x1: cx + (V.x1 - cx) * xr / (V.x1 - V.x0), y0: cy - (cy - V.y0) * yr / yr0, y1: cy + (V.y1 - cy) * yr / yr0 });
    if (hooks.onZoom) hooks.onZoom(zoomLevel());
    schedule();
  }
  function panPx(dx, dy) {
    if (!st.model) return;
    const R = plotRect(), V = st.view, m = st.model;
    const ddx = -dx / (R.r - R.l) * (V.x1 - V.x0);
    const sgn = m.invert ? -1 : 1;
    let nv = { x0: V.x0 + ddx, x1: V.x1 + ddx, y0: V.y0, y1: V.y1 };
    if (m.yLog) { const k = Math.exp(sgn * dy / (R.b - R.t) * (Math.log(V.y1) - Math.log(V.y0))); nv.y0 *= k; nv.y1 *= k; }
    else { const ddy = sgn * dy / (R.b - R.t) * (V.y1 - V.y0); nv.y0 += ddy; nv.y1 += ddy; }
    st.view = clampView(nv); schedule();
  }
  function beagleAnchorY() {
    const m = st.model; if (!m) return null; const b = m.series.find(s => s.isBeagle); if (!b) return null;
    const R = plotRect(), y = yMap(valueAt(b.pts, (st.view.x0 + st.view.x1) / 2));
    return y >= R.t && y <= R.b ? y : null;
  }
  function reset() { if (!st.model) return; st.view = defaultView(); if (hooks.onZoom) hooks.onZoom(1); schedule(); }
  function nearest(px, py) {
    const m = st.model; if (!m) return null; const R = plotRect();
    if (px > R.r) { // label column: pick by label row
      let best = null, bd = 14; for (const s of m.series) { const y = yMap(valueAt(s.pts, Math.min(st.view.x1, m.xMax))); const dd = Math.abs(y - py); if (dd < bd) { bd = dd; best = s.name; } } return best;
    }
    if (px < R.l || py < R.t || py > R.b) return null;
    const d = xInv(px); let best = null, bd = 16;
    for (const s of m.series) { const dd = Math.abs(yMap(valueAt(s.pts, d)) - py); if (dd < bd) { bd = dd; best = s.name; } }
    return best;
  }

  // Input. Wheel zooms only with Ctrl/⌘ (trackpad pinch sends ctrlKey) so a
  // plain scroll over the chart still scrolls the page. Touch: horizontal drag
  // pans, vertical drag scrolls the page (touch-action: pan-y), two fingers zoom.
  const ptrs = new Map(); let pinch = null, dragged = false;
  function rel(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function onWheel(e) {
    if (!(e.ctrlKey || e.metaKey)) { if (hooks.onHint) hooks.onHint(); return; }
    e.preventDefault(); const [x, y] = rel(e); zoom(e.deltaY > 0 ? 1.18 : 1 / 1.18, x, y);
  }
  function onDown(e) { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, rel(e)); dragged = false; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; } }
  function onMove(e) {
    const p = rel(e);
    if (!ptrs.has(e.pointerId)) {
      if (e.pointerType === 'mouse') { const n = nearest(p[0], p[1]); st.hover = n; st.hoverX = n ? xInv(p[0]) : null; schedule(); }
      return;
    }
    const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, p);
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d > 0 && pinch.d > 0) zoom(pinch.d / d, pinch.c[0], pinch.c[1]);
      pinch.d = d; dragged = true; return;
    }
    const dx = p[0] - prev[0], dy = p[1] - prev[1];
    if (Math.abs(dx) + Math.abs(dy) > 0) { if (Math.hypot(dx, dy) > 1) dragged = true; panPx(dx, e.pointerType === 'mouse' ? dy : 0); }
  }
  function onUp(e) {
    const p = rel(e); const wasDrag = dragged; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    if (!wasDrag) { const n = nearest(p[0], p[1]); st.sel = n && n === st.sel ? null : n; if (e.pointerType !== 'mouse') { st.hover = st.sel; st.hoverX = st.sel ? xInv(p[0]) : null; } if (hooks.onSelect) hooks.onSelect(st.sel); schedule(); }
  }
  function onLeave() { if (st.hover) { st.hover = null; st.hoverX = null; schedule(); } }
  function onDbl(e) { e.preventDefault(); reset(); }
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('dblclick', onDbl);
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  return {
    setModel(m, keepView) { const had = st.model; st.model = m; if (!m) return; if (!had || !keepView) st.view = defaultView(); else st.view = clampView(st.view); if (hooks.onZoom) hooks.onZoom(zoomLevel()); resize(); },
    setSelected(name) { st.sel = name; schedule(); },
    // Buttons zoom about Beagle's line at the centre of the view, so pressing +
    // on a crowded chart closes in on the pack Beagle is in, not on empty space.
    zoomIn() { zoom(1 / 1.35, null, beagleAnchorY()); }, zoomOut() { zoom(1.35, null, beagleAnchorY()); }, reset,
    pan(fx, fy) { const R = plotRect(); panPx(-fx * (R.r - R.l), fy * (R.b - R.t)); },
    stats() { return { lastFrameMs: st.lastFrameMs, w: st.w, h: st.h, dpr: st.dpr, backing: canvas.width * canvas.height }; },
    destroy() { ro.disconnect(); if (st.raf) cancelAnimationFrame(st.raf); canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('dblclick', onDbl); },
  };
}

/* ── React shell ─────────────────────────────────────────────────────────── */
function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 700);
  useEffect(() => { let t; const f = () => { clearTimeout(t); t = setTimeout(() => setM(window.innerWidth < 700), 150); }; window.addEventListener('resize', f); return () => { clearTimeout(t); window.removeEventListener('resize', f); }; }, []);
  return m;
}

function Seg({ options, value, onChange, small }) {
  return (<div style={{ display: 'inline-flex', border: '1px solid #1E3A5F', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
    {options.map(([v, l, title]) => (
      <button key={v} title={title || ''} onClick={() => onChange(v)} style={{
        background: value === v ? '#1A3050' : 'transparent', color: value === v ? C.gold : C.muted,
        border: 'none', borderRight: '1px solid #13283F', padding: small ? '6px 9px' : '7px 12px', fontSize: small ? 12 : 13,
        fontWeight: 700, letterSpacing: .6, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34,
      }}>{l}</button>))}
  </div>);
}

function App() {
  const mob = useIsMobile();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [period, setPeriod] = useState('6MO');
  const [view, setView] = useState('sv');
  const [focus, setFocus] = useState('pack');
  const [proj, setProj] = useState('trend');
  const [log, setLog] = useState(false);
  const [showRank, setShowRank] = useState(true);
  const [sel, setSel] = useState(null);
  const [hint, setHint] = useState(false);
  const [teamRating, setTeamRating] = useState(null);
  const canvasRef = useRef(null), chartRef = useRef(null), zoomLblRef = useRef(null), hintT = useRef(0);

  useEffect(() => { const d = document.getElementById('diag'); if (d) d.style.display = 'none'; }, []);
  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(d => { if (!d || !d.canonical) throw new Error('server returned no canonical pace block'); setData(d); }).catch(e => setErr(String(e && e.message || e)));
    fetch('/api/team-rating').then(r => r.json()).then(d => { if (d && d.overall != null) setTeamRating(d); }).catch(() => {});
  }, []);

  const board = data && data.canonical;
  const days = (PERIODS.find(p => p.k === period) || PERIODS[4]).d;
  const trend = proj === 'trend';
  const colorOf = useMemo(() => {
    const m = new Map(); if (!board) return () => '#888';
    board.alliances.filter(r => !r.isBeagle).sort((a, b) => (a.rank || 99) - (b.rank || 99)).forEach((r, i) => m.set(r.name, PALETTE[i % PALETTE.length]));
    return r => r.isBeagle ? C.beagle : (m.get(r.name) || '#888');
  }, [board]);

  const model = useMemo(() => board ? buildModel(board, { view, days, focus, trend, log: log && view === 'sv', colorOf }) : null, [board, view, days, focus, trend, log, colorOf]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const c = createRenderer(canvasRef.current, {
      onZoom: z => { if (zoomLblRef.current) zoomLblRef.current.textContent = z > 1.02 ? z.toFixed(1) + '×' : '1×'; },
      onSelect: n => setSel(n),
      onHint: () => { const now = Date.now(); if (now - hintT.current > 4000) { hintT.current = now; setHint(true); setTimeout(() => setHint(false), 2500); } },
    });
    chartRef.current = c; window.__projChart = c;
    return () => { c.destroy(); chartRef.current = null; };
  }, [!!board]);
  useEffect(() => { if (chartRef.current && model) chartRef.current.setModel(model, false); }, [model]);
  useEffect(() => { if (chartRef.current) chartRef.current.setSelected(sel); }, [sel]);

  const ranking = useMemo(() => {
    if (!board) return [];
    const rows = board.alliances.map(r => ({ ...r, proj: r.pace != null ? PL.projectSV(r.sv, r.pace, trend ? r.accel : 0, days) : null }));
    const known = rows.filter(r => r.proj != null).sort((a, b) => b.proj - a.proj);
    known.forEach((r, i) => { r.projRank = i + 1; });
    // An alliance with no measurable pace keeps its current rank, marked, never dropped.
    const unknown = rows.filter(r => r.proj == null).map(r => ({ ...r, projRank: null }));
    return known.concat(unknown);
  }, [board, days, trend]);

  if (err) return (<div style={{ padding: 20, color: C.dn }}>Could not load projections: {err}</div>);
  if (!board) return (<div style={{ padding: 20, color: C.muted }}>Loading projections…</div>);

  const b = board.beagle;
  const bProj = ranking.find(r => r.isBeagle);
  const rChg = b && bProj && bProj.projRank ? b.rank - bProj.projRank : 0;
  const selRow = sel ? board.alliances.find(r => r.name === sel) : null;
  const asOfMs = Date.parse(board.asOf) || Date.now();
  const etaText = d => d == null ? '—' : Math.round(d) + 'd · ' + fmtDate(new Date(asOfMs + d * DAY_MS));
  // What the last column says, in words: who catches whom, when, on the curved
  // projection — and why not, when there is no date.
  const etaCell = r => {
    if (r.isBeagle) return '—';
    // Follows the TREND / STRAIGHT toggle, like the chart and the ranking.
    const d = trend ? r.catchDaysTrend : r.catchDaysLinear, lin = r.catchDaysLinear;
    const when = x => mob ? Math.round(x) + 'd' : etaText(x);
    if (r.gap > 0) {
      if (d != null) return (mob ? '' : 'Beagle passes ') + when(d);
      if (r.closing != null && r.closing <= 0) return mob ? 'pulling away' : 'pulling away (' + fmtMoney(-r.closing, 2) + '/day)';
      return trend && lin != null ? (mob ? 'not on trend' : 'not on trend · straight line ' + when(lin)) : 'beyond 10 years';
    }
    if (d != null) return (mob ? 'caught ' : 'they pass Beagle ') + when(d);
    return mob ? 'clear' : 'Beagle stays clear';
  };
  const BTN = { background: '#0A1E30', border: '1px solid #2C4A6E', color: C.muted, borderRadius: 4, padding: '6px 12px', fontSize: 15, fontWeight: 700, cursor: 'pointer', minWidth: 38, minHeight: 34, fontFamily: 'inherit' };

  return (<div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
    {teamRating && (<div style={{ background: '#C4920A', color: C.bg, padding: '7px 16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontWeight: 700, letterSpacing: 1, fontSize: 12 }}>
      <span>PREVIOUS 7 DAYS TEAM RANKING · {teamRating.history.map(h => h.rating == null ? '—' : h.rating).join(', ')}</span><span>OVERALL {teamRating.overall}</span></div>)}

    {/* Header — one pace, method named */}
    <div style={{ background: 'linear-gradient(90deg,#04101E,#0A1C32)', borderBottom: '2px solid #C4920A', padding: mob ? '10px 12px' : '12px 18px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: mob ? 19 : 28, fontWeight: 800, color: C.gold, letterSpacing: 1.5 }}>◈ BEAGLE GLOBAL — ALLIANCE PROJECTIONS</div>
        <div style={{ fontSize: mob ? 12 : 14, color: C.muted, marginTop: 4 }}>Rank <b style={{ color: C.text }}>#{b.rank}</b> · data as of {fmtUtc(board.asOf)}</div>
      </div>
      <div style={{ textAlign: mob ? 'left' : 'right' }}>
        <div style={{ fontSize: mob ? 22 : 30, fontWeight: 800, color: C.gold }}>{fmtMoney(b.sv)}</div>
        <div style={{ fontSize: mob ? 16 : 19, fontWeight: 700, color: C.text }}>Pace {fmtMoney(b.pace, 3)}/day</div>
        <div style={{ fontSize: 12, color: C.dim }}>{b.label}</div>
        <div style={{ fontSize: 12, color: C.dim }}>7-day {fmtMoney(b.weekPace, 3)} · 30-day {fmtMoney(b.longPace, 3)} · trend <span style={{ color: trendColor(b.trend), fontWeight: 700 }}>{trendArrow(b.trend)} {b.trend || 'n/a'}</span></div>
        {board.memberCd && <div style={{ fontSize: 12, color: C.dim }}>Member C/D today {fmtMoney(board.memberCd.pace, 3)}/day (reference, not used in projections)</div>}
      </div>
    </div>

    {/* Controls */}
    <div style={{ display: 'flex', gap: 8, padding: '8px 10px', background: '#040C18', borderBottom: '1px solid #0A1E30', alignItems: 'center', flexWrap: 'wrap' }}>
      <Seg small={mob} value={period} onChange={setPeriod} options={PERIODS.map(p => [p.k, p.k])} />
      <Seg small={mob} value={view} onChange={setView} options={[['sv', mob ? 'SV' : 'SV LINES'], ['gap', mob ? 'GAP' : 'OVERTAKE'], ['rank', 'RANK']]} />
      <Seg small={mob} value={focus} onChange={setFocus} options={[['pack', mob ? 'PACK' : 'CATCHING PACK', 'Beagle, everyone Beagle reaches or who reaches Beagle in the period, and two ranks either side'], ['all', mob ? 'ALL' : 'ALL 20']]} />
      <Seg small={mob} value={proj} onChange={setProj} options={[['trend', 'TREND', 'Curved: 7-day vs 30-day pace change carried forward'], ['straight', 'STRAIGHT', 'Straight line at the current pace']]} />
      {view === 'sv' && <Seg small={mob} value={log ? 'log' : 'lin'} onChange={v => setLog(v === 'log')} options={[['lin', 'LINEAR'], ['log', 'LOG']]} />}
      <button onClick={() => setShowRank(s => !s)} style={{ ...BTN, fontSize: 12 }}>{showRank ? 'HIDE RANKING' : 'SHOW RANKING'}</button>
      <button onClick={() => { window.location.href = '/pace'; }} style={{ ...BTN, fontSize: 12, color: C.gold }}>PACE TREND</button>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }}>
        <button title="Zoom in" aria-label="Zoom in" onClick={() => chartRef.current && chartRef.current.zoomIn()} style={BTN}>+</button>
        <span ref={zoomLblRef} style={{ fontSize: 12, color: C.dim, minWidth: 34, textAlign: 'center' }}>1×</span>
        <button title="Zoom out" aria-label="Zoom out" onClick={() => chartRef.current && chartRef.current.zoomOut()} style={BTN}>−</button>
        <button title="Reset view" onClick={() => chartRef.current && chartRef.current.reset()} style={{ ...BTN, fontSize: 12, color: C.gold }}>RESET</button>
      </div>
    </div>

    {/* Chart */}
    <div style={{ padding: mob ? '6px 4px' : '8px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 12, color: C.dim, padding: '0 4px 6px' }}>
        <span>{model ? model.title : ''} · {focus === 'pack' ? 'catching pack (' + (model ? model.series.length : 0) + ' lines)' : 'all alliances'} · {trend ? 'solid = trend projection from the current pace, dashed = straight line at the current pace' : 'straight line at the current pace'}</span>
        <span>{mob ? 'Pinch to zoom · drag sideways to pan · tap a line' : 'Ctrl/⌘ + scroll or pinch to zoom · drag to pan · click a line · double-click resets'}</span>
      </div>
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: mob ? '62vh' : (showRank ? '52vh' : '76vh'), minHeight: 300, display: 'block', touchAction: 'pan-y', borderRadius: 4, cursor: 'crosshair' }} />
        {hint && <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(5,13,26,.94)', border: '1px solid #2C4A6E', color: C.muted, padding: '6px 12px', borderRadius: 4, fontSize: 12, pointerEvents: 'none' }}>Hold Ctrl (⌘ on Mac) and scroll to zoom</div>}
      </div>
    </div>

    {selRow && !selRow.isBeagle && (<div style={{ margin: '0 10px 10px', background: C.panel, border: '1px solid ' + colorOf(selRow) + '55', borderLeft: '4px solid ' + colorOf(selRow), borderRadius: 4, padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><div style={{ fontSize: 18, fontWeight: 700 }}>#{selRow.rank} {selRow.name}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>SV {fmtMoney(selRow.sv)} · pace {fmtMoney(selRow.pace, 3)}/day ({selRow.label}) · 7-day {fmtMoney(selRow.weekPace, 3)} · 30-day {fmtMoney(selRow.longPace, 3)} · trend <span style={{ color: trendColor(selRow.trend) }}>{trendArrow(selRow.trend)} {selRow.trend || 'n/a'}</span></div></div>
        <button onClick={() => setSel(null)} style={{ ...BTN, fontSize: 12 }}>CLOSE</button>
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 10, fontSize: 13 }}>
        <div><div style={{ color: C.dim }}>GAP TO BEAGLE</div><div style={{ fontWeight: 700, fontSize: 16 }}>{selRow.gap > 0 ? 'ahead ' : 'behind '}{fmtMoney(Math.abs(selRow.gap))}</div></div>
        <div><div style={{ color: C.dim }}>BEAGLE {selRow.gap > 0 ? 'GAINS' : 'PULLS AWAY'}</div><div style={{ fontWeight: 700, fontSize: 16, color: (selRow.gap > 0 ? selRow.closing > 0 : selRow.closing > 0) ? C.up : C.dn }}>{selRow.closing != null ? (selRow.closing >= 0 ? '+' : '−') + fmtMoney(Math.abs(selRow.closing), 3) + '/day' : '—'}</div></div>
        <div><div style={{ color: C.dim }}>{selRow.gap > 0 ? 'BEAGLE OVERTAKES (TREND)' : 'THEY CATCH BEAGLE (TREND)'}</div><div style={{ fontWeight: 700, fontSize: 16 }}>{etaText(selRow.catchDaysTrend)}</div></div>
        <div><div style={{ color: C.dim }}>STRAIGHT LINE</div><div style={{ fontWeight: 700, fontSize: 16 }}>{etaText(selRow.catchDaysLinear)}</div></div>
      </div>
    </div>)}

    {showRank && (<div style={{ margin: '0 10px 16px', background: C.panel, border: '1px solid #0A1E30', borderTop: '2px solid #C4920A', borderRadius: 4, padding: mob ? '8px 6px' : '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: mob ? 14 : 17, color: C.muted, letterSpacing: 1 }}>PROJECTED RANKING AT <b style={{ color: C.gold }}>{period}</b> · {fmtDate(new Date(asOfMs + days * DAY_MS))} <span style={{ fontSize: 12, color: C.dim }}>({trend ? 'trend' : 'straight line'})</span></div>
        <div style={{ fontSize: mob ? 15 : 19 }}>Beagle <b style={{ color: C.gold }}>#{b.rank}</b> → <b style={{ color: rChg > 0 ? C.up : rChg < 0 ? C.dn : C.gold }}>#{bProj && bProj.projRank}</b> {rChg > 0 ? <span style={{ color: C.up }}>▲{rChg}</span> : rChg < 0 ? <span style={{ color: C.dn }}>▼{-rChg}</span> : null}</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: mob ? 12.5 : 14, minWidth: mob ? 0 : 760 }}>
          <thead><tr style={{ color: C.dim, fontSize: 11, letterSpacing: .6, textAlign: 'right' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px' }}>PROJ</th><th style={{ textAlign: 'left' }}>ALLIANCE</th>
            <th>NOW</th>{!mob && <th>SV NOW</th>}<th title={board.methodLabel}>PACE /DAY</th>{!mob && <th>7-DAY</th>}{!mob && <th title="Rank by current pace">PACE #</th>}
            {!mob && <th>GAP TO BEAGLE</th>}<th>{mob ? 'ETA' : 'OVERTAKE ETA (' + (trend ? 'TREND' : 'STRAIGHT') + ')'}</th>
          </tr></thead>
          <tbody>{ranking.map(r => {
            const c = colorOf(r), mv = r.projRank ? r.rank - r.projRank : 0, isSel = sel === r.name;
            return (<tr key={r.name} onClick={() => !r.isBeagle && setSel(isSel ? null : r.name)} style={{ cursor: r.isBeagle ? 'default' : 'pointer', background: r.isBeagle ? 'rgba(232,184,75,.12)' : isSel ? 'rgba(59,147,255,.10)' : 'transparent', borderBottom: '1px solid #0B1A2B', textAlign: 'right' }}>
              <td style={{ textAlign: 'left', padding: '6px', fontWeight: 800, color: c, whiteSpace: 'nowrap' }}>{r.projRank ? '#' + r.projRank : '—'} {mv > 0 ? <span style={{ color: C.up, fontSize: 12 }}>▲{mv}</span> : mv < 0 ? <span style={{ color: C.dn, fontSize: 12 }}>▼{-mv}</span> : null}</td>
              <td style={{ textAlign: 'left', color: r.isBeagle ? C.gold : C.text, fontWeight: r.isBeagle ? 800 : 500, maxWidth: mob ? 120 : 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
              <td style={{ color: C.muted }}>#{r.rank}</td>
              {!mob && <td style={{ color: C.muted }}>{fmtMoney(r.sv)}</td>}
              <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.pace != null ? fmtMoney(r.pace, mob ? 2 : 3) : <span style={{ color: C.dim }}>no reading</span>} <span style={{ color: trendColor(r.trend) }}>{trendArrow(r.trend)}</span></td>
              {!mob && <td style={{ color: C.muted }}>{fmtMoney(r.weekPace, 3)}</td>}
              {!mob && <td style={{ color: C.muted }}>{r.paceRank ? '#' + r.paceRank : '—'}</td>}
              {!mob && <td style={{ color: r.isBeagle ? C.dim : r.gap > 0 ? C.muted : C.up }}>{r.isBeagle ? '—' : (r.gap > 0 ? '' : '−') + fmtMoney(Math.abs(r.gap))}</td>}
              <td style={{ color: C.muted, whiteSpace: 'nowrap', fontSize: mob ? 11.5 : 13 }}>{etaCell(r)}</td>
            </tr>);
          })}</tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>{board.methodLabel} {board.trendLabel} Trend arrows: ↗ accelerating · → steady (7-day within 3 % of the 30-day rate) · ↘ decelerating.</div>
    </div>)}
  </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
