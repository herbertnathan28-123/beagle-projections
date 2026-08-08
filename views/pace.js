const esbuild = require('esbuild');

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<title>Beagle Global — Alliance Pace</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080b14;color:#e8edf7;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;overflow-x:hidden;overscroll-behavior:none}
button{font-family:inherit}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:#0d1220}
::-webkit-scrollbar-thumb{background:#1c2740;border-radius:2px}
#root{min-height:100vh}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const { useEffect, useLayoutEffect, useMemo, useRef, useState } = React;
/* ============================================================================
   BEAGLE PROJECTIONS — ALLIANCE PACE
   ----------------------------------------------------------------------------
   Rebuilt 7 Aug 2026 on Nathan's definitions. Pace is NOT stored. It is derived
   from share value and exact elapsed time, every time.

       CURRENT PACE  = (SV this upload − SV previous upload)
                       ÷ exact elapsed time between those two uploads

       AVERAGE PACE  = (SV this upload − SV at the datum)
                       ÷ exact elapsed time since the datum

       DATUM         = 2026-01-09T23:36Z   (10 Jan 2026 07:36 AWST)

   Exact elapsed time means days, hours, minutes and seconds. Never a nominal
   24-hour day. Uploads do not land 24 hours apart, so a nominal day silently
   distorts both figures.

   Because "daily pace" is only daily when the uploads happen to be a day apart,
   every current-pace figure is shown with the interval it was measured over.

   WHAT EACH IS FOR
   · Current pace drives the projections — crossovers, who passes whom, and when.
     It is the figure that matters for forecasting.
   · Average pace is the health check — is the alliance running above or below
     its own long-run rate since the datum.

   CONTRACT FOR THE HISTORY STORE
   Each reading must carry share value and an exact UTC timestamp:
       { t: "2026-08-06T09:12:31Z", sv: 3319.72 }        sv in $ millions
   Do not store pace. Storing pace throws away the information both figures are
   computed from and cannot be undone.
       workflow  zSQTVWueN3G8lQxg   (project aI47r2igv97JqK8Z)
       webhook   https://atlas-nathan28.app.n8n.cloud/webhook/history-store

   ⚠  READINGS BELOW ARE PART REAL, PART PLACEHOLDER  ⚠
   The datum share values are real, taken from the 10 Jan 2026 alliance list.
   The final reading's share values are real, from the 5 Aug 2026 cards. The two
   intermediate readings are shape only, so the derivation and the chart can be
   seen working. Replace READINGS wholesale once the History Store is wired.
   ========================================================================== */

/* -------------------------------------------------------------- design tokens */
const T = {
  bg: "#080b14",
  panel: "#0d1220",
  panelEdge: "#1c2740",
  gold: "#e0a82e",
  goldDim: "#8a6a20",
  ink: "#e8edf7",
  inkDim: "#7f8aa3",
  inkFaint: "#4a5570",
  grid: "#18213a",
  nil: "#0f1526",
  warn: "#ff7043",
  up: "#4ade80",
  down: "#f87171",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
};

/* ----------------------------------------------------------------- the datum */
const DATUM_T = "2026-01-09T23:36:00Z";

/* ----------------------------------------------------------------- utilities */
const DAY_MS = 86400000;
const ms = (iso) => new Date(iso).getTime();
const fmtMoney = (v) => "$" + v.toFixed(3);
const fmtAxis = (v) => "$" + v.toFixed(2);

/** Exact elapsed time as a human interval — the window a pace was measured over. */
function fmtInterval(msDiff) {
  const totalMin = Math.round(msDiff / 60000);
  const d = Math.floor(totalMin / 1440);
  const hrs = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  if (d > 0) return \`\${d}d \${hrs}h \${min}m\`;
  return \`\${hrs}h \${min}m\`;
}

function fmtStamp(iso) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const mon = d.toLocaleString("en-AU", { month: "short", timeZone: "UTC" });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return \`\${day} \${mon} \${hh}:\${mm}Z\`;
}

function fmtDayShort(t) {
  const d = new Date(t);
  return d.getUTCDate() + " " + d.toLocaleString("en-AU", { month: "short", timeZone: "UTC" });
}

/* An interval shorter than this is not a window a daily pace can be measured
   over — a re-stamped snapshot seconds after the one it came from, or a re-paste
   of one capture minutes to hours later, divides a small share-value delta by a
   short window and prints either $0.000 or a wild multiple. 20 hours is the floor
   lib/storage.js measures the stored pace over, so the two cannot disagree. */
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;

/** Drop readings closer together than MIN_INTERVAL_MS, keeping the later SV. */
function collapseShortIntervals(readings) {
  const out = [];
  for (const x of readings) {
    const prev = out[out.length - 1];
    if (prev && ms(x.t) - ms(prev.t) < MIN_INTERVAL_MS) out[out.length - 1] = x;
    else out.push(x);
  }
  return out;
}

/** Every derived figure for one alliance. Nothing here is stored — all computed. */
function derive(s, datumT) {
  const r = collapseShortIntervals(s.readings.filter((x) => x.sv != null).sort((a, b) => ms(a.t) - ms(b.t)));
  if (!r.length) return null;

  const last = r[r.length - 1];
  const prev = r.length > 1 ? r[r.length - 2] : null;

  // CURRENT PACE — over the exact interval between the last two uploads.
  let currentPace = null;
  let intervalMs = null;
  if (prev) {
    intervalMs = ms(last.t) - ms(prev.t);
    currentPace = intervalMs >= MIN_INTERVAL_MS ? (last.sv - prev.sv) / (intervalMs / DAY_MS) : null;
  }

  // AVERAGE PACE — over the exact elapsed time since the datum.
  const sinceDatumMs = ms(last.t) - ms(datumT);
  const avgPace =
    s.datumSv != null && sinceDatumMs > 0 ? (last.sv - s.datumSv) / (sinceDatumMs / DAY_MS) : null;

  // The pace series the chart plots: one point per interval, at its closing time.
  const paceSeries = [];
  for (let i = 1; i < r.length; i++) {
    const dt = ms(r[i].t) - ms(r[i - 1].t);
    if (dt < MIN_INTERVAL_MS) continue;
    paceSeries.push({
      t: ms(r[i].t),
      pace: (r[i].sv - r[i - 1].sv) / (dt / DAY_MS),
      intervalMs: dt,
      sv: r[i].sv,
    });
  }

  // Move on the most recent interval, against the interval before it.
  const n = paceSeries.length;
  const movePct =
    n > 1 && paceSeries[n - 2].pace ? ((paceSeries[n - 1].pace - paceSeries[n - 2].pace) / Math.abs(paceSeries[n - 2].pace)) * 100 : null;

  return {
    ...s,
    last,
    prev,
    sv: last.sv,
    currentPace,
    intervalMs,
    avgPace,
    sinceDatumMs,
    vsAvg: currentPace != null && avgPace != null ? currentPace - avgPace : null,
    paceSeries,
    movePct,
  };
}

function decollide(items, minGap, top, bottom) {
  const a = items.map((it) => ({ ...it })).sort((p, q) => p.y - q.y);
  for (let i = 1; i < a.length; i++) if (a[i].y - a[i - 1].y < minGap) a[i].y = a[i - 1].y + minGap;
  const over = a.length ? a[a.length - 1].y - bottom : 0;
  if (over > 0) for (const it of a) it.y -= over;
  if (a.length && a[0].y < top) {
    const under = top - a[0].y;
    for (const it of a) it.y += under;
  }
  return a;
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 900, h: 520 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}

/* --------------------------------------------------------- placeholder data */
/* Upload stamps. Deliberately not 24 hours apart — that is the whole point. */
const STAMPS = ["2026-08-01T22:15:00Z", "2026-08-02T21:40:00Z", "2026-08-05T10:47:00Z", "2026-08-06T09:12:00Z"];

/* Real: the 10 Jan datum share value, the 5 Aug share value, and the current
   pace off the cards. The intermediate share values are BUILT BACKWARDS from
   the final one at plausible rates, so every derived pace lands in the real
   $1.6—$8.4 band instead of an invented number. Shape only — replace wholesale. */
const A = (name, colour, group, datumSv, finalSv, pace, us) => {
  const paces = [pace * 0.94, pace * 1.05, pace];
  const readings = [{ t: STAMPS[STAMPS.length - 1], sv: finalSv }];
  for (let i = STAMPS.length - 2; i >= 0; i--) {
    const dtDays = (ms(STAMPS[i + 1]) - ms(STAMPS[i])) / DAY_MS;
    const sv = readings[0].sv - paces[i] * dtDays;
    readings.unshift({ t: STAMPS[i], sv: Math.round(sv * 100) / 100 });
  }
  return { name, colour, group, us: !!us, datumSv, readings };
};

const PLACEHOLDER_SERIES = [
  A("Valiant Air", "#4ade80", 1, 6018.47, 7637.7, 8.328),
  A("Free Flying", "#2dd4bf", 1, 4431.18, 6049.76, 8.238),
  A("독도(Dokdo)", "#fbbf24", 1, 7094.15, 8605.93, 7.301),
  A("Beagle Global", "#f0b429", 1, 2179.67, 3319.72, 7.076, true),
  A("Per Aspera…", "#fb923c", 1, 4515.21, 5586.87, 4.586),
  A("Grizzly Group", "#3b82f6", 1, 4896.57, 5817.35, 4.456),
  A("Happy Skies 2.0", "#f43f5e", 1, 3339.55, 4200.23, 4.216),
  A("GERMAN ALLIANCE", "#a855f7", 1, 3774.81, 4620.68, 4.205),
  A("SpaceX", "#34d399", 1, 2632.89, 4095.0, 4.103),
  A("Sky Wings", "#ec4899", 1, 2451.45, 3270.63, 4.016),
  A("Indonesia Unity", "#fb7185", 2, 3976.07, 3934.0, 3.937),
  A("Alpha Vikings", "#a78bfa", 2, 2370.93, 3769.0, 3.764),
  A("🇧🇷 BRASIL GT", "#4ade80", 2, 2550.15, 3270.79, 3.663),
  A("CODESHARE", "#818cf8", 2, 2907.55, 3714.58, 3.486),
  A("STARFLEET", "#38bdf8", 2, 3031.45, 3734.32, 3.208),
  A("Star Alliance", "#fbbf24", 2, 2350.81, 3007.1, 2.895),
  A("ClearSky Group", "#22d3ee", 2, 2690.46, 3262.58, 2.723),
  A("JetSTAR", "#fb923c", 2, 2724.48, 3236.64, 2.484),
  A("Russian Wings", "#f87171", 2, 3041.19, 3651.43, 2.315),
  A("Mixer World", "#94a3b8", 2, 2809.26, 3145.0, 1.628),
];

/* =========================================================== the trend chart */
function PaceDailyTrend({ series = PLACEHOLDER_SERIES, datumT = DATUM_T, placeholder = true }) {
  const [group, setGroup] = useState(1);
  const [hidden, setHidden] = useState(() => new Set());
  const [isolated, setIsolated] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [playT, setPlayT] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });

  const plotRef = useRef(null);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const { w, h } = useSize(plotRef);
  const reduced = useReducedMotion();

  const rows = useMemo(() => series.map((s) => derive(s, datumT)).filter(Boolean), [series, datumT]);
  const inGroup = useMemo(() => rows.filter((r) => r.group === group), [rows, group]);
  const visible = useMemo(
    () => inGroup.filter((r) => !hidden.has(r.name) && (!isolated || r.name === isolated)),
    [inGroup, hidden, isolated]
  );

  /* time domain across every reading in the group */
  const [t0, t1] = useMemo(() => {
    let a = Infinity;
    let b = -Infinity;
    for (const r of inGroup)
      for (const p of r.paceSeries) {
        if (p.t < a) a = p.t;
        if (p.t > b) b = p.t;
      }
    return isFinite(a) ? [a, b] : [0, 1];
  }, [inGroup]);

  /* RULING: value domain spans every series in the group, hidden or not, so no
     line can fall outside the panel and hiding one doesn't rescale the chart. */
  const [lo, hi] = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of inGroup)
      for (const p of r.paceSeries) {
        if (p.pace < min) min = p.pace;
        if (p.pace > max) max = p.pace;
      }
    if (!isFinite(min)) return [0, 1];
    const pad = Math.max((max - min) * 0.14, 0.05);
    return [min - pad, max + pad];
  }, [inGroup]);

  const GAP = 19;
  const NAME_W = 214;
  const PAD = { l: 72, r: GAP + NAME_W + 12, t: 46, b: 66 };
  const iw = Math.max(80, w - PAD.l - PAD.r);
  const ih = Math.max(80, h - PAD.t - PAD.b);
  const xFor = (t) => PAD.l + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
  const yFor = (v) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

  /* calendar days in the window, and which of them carry no upload at all */
  const dayCols = useMemo(() => {
    const out = [];
    if (!isFinite(t0)) return out;
    const start = new Date(t0);
    start.setUTCHours(0, 0, 0, 0);
    for (let d = start.getTime(); d <= t1 + DAY_MS; d += DAY_MS) {
      const has = inGroup.some((r) => r.paceSeries.some((p) => p.t >= d && p.t < d + DAY_MS));
      out.push({ d, has });
    }
    return out;
  }, [t0, t1, inGroup]);

  /* playhead */
  useEffect(() => {
    if (!playing) return;
    if (reduced) {
      setPlayT(1);
      setPlaying(false);
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 2600);
      setPlayT(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced]);

  const replay = () => {
    setPinned(null);
    setPlayT(0);
    setPlaying(true);
  };
  const resetView = () => setView({ k: 1, tx: 0, ty: 0 });
  useEffect(() => {
    resetView();
    setPinned(null);
    setIsolated(null);
  }, [group]);

  /* zoom / pan */
  const clampK = (k) => Math.min(8, Math.max(1, k));
  const zoomAt = (cx, cy, f) =>
    setView((v) => {
      const k = clampK(v.k * f);
      const s = k / v.k;
      return { k, tx: cx - s * (cx - v.tx), ty: cy - s * (cy - v.ty) };
    });
  const onWheel = (e) => {
    e.preventDefault();
    const r = plotRef.current.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };
  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinchRef.current = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
      dragRef.current = null;
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const r = plotRef.current.getBoundingClientRect();
      zoomAt((a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top, d / pinchRef.current.d);
      pinchRef.current.d = d;
    }
  };
  const onTouchEnd = (e) => {
    if (e.touches.length < 2) pinchRef.current = null;
  };

  /* all distinct reading times in the group, for pinning */
  const stamps = useMemo(() => {
    const set = new Set();
    for (const r of inGroup) for (const p of r.paceSeries) set.add(p.t);
    return [...set].sort((a, b) => a - b);
  }, [inGroup]);

  const onPlotClick = (e) => {
    if (dragRef.current?.moved || !stamps.length) return;
    const r = plotRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left - view.tx) / view.k;
    const t = t0 + ((px - PAD.l) / (iw || 1)) * (t1 - t0);
    let best = stamps[0];
    for (const s of stamps) if (Math.abs(s - t) < Math.abs(best - t)) best = s;
    setPlaying(false);
    setPinned((p) => (p === best ? null : best));
  };

  const readT = pinned != null ? pinned : t0 + playT * (t1 - t0);
  const revealX = xFor(readT);
  const showChips = pinned != null || (playing && !reduced);

  const chipScale = Math.min(view.k, 2.6);
  const chipFont = 13 * chipScale;
  const chipH = 22 * chipScale;
  const chipPadX = 8 * chipScale;
  const playX = xFor(readT) * view.k + view.tx;
  const chipGap = 12 * chipScale;

  const chips = useMemo(() => {
    if (!showChips) return [];
    const raw = [];
    for (const r of visible) {
      let p = null;
      for (const q of r.paceSeries) if (q.t <= readT + 1) p = q;
      if (!p) continue;
      raw.push({ key: r.name, colour: r.colour, pace: p.pace, intervalMs: p.intervalMs, y: yFor(p.pace) * view.k + view.ty });
    }
    return decollide(raw, chipH + 3, PAD.t + chipH, PAD.t + ih);
  }, [showChips, visible, readT, lo, hi, ih, view.k, view.ty, chipH]);

  const endLabels = useMemo(() => {
    const raw = [];
    for (const r of visible) {
      const p = r.paceSeries[r.paceSeries.length - 1];
      if (!p) continue;
      const rank = inGroup.indexOf(r) + (group === 1 ? 1 : 11);
      raw.push({
        key: r.name,
        colour: r.colour,
        us: r.us,
        rank,
        name: r.name,
        pace: p.pace,
        anchorY: yFor(p.pace) * view.k + view.ty,
        y: yFor(p.pace) * view.k + view.ty,
      });
    }
    return decollide(raw, 20, PAD.t + 10, PAD.t + ih - 6);
  }, [visible, inGroup, group, lo, hi, ih, view.k, view.ty]);

  const ticks = useMemo(() => Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4), [lo, hi]);
  const readInterval = useMemo(() => {
    for (const r of visible) for (const p of r.paceSeries) if (p.t === readT) return p.intervalMs;
    return null;
  }, [visible, readT]);

  const toggle = (name) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <div style={S.page}>
      {placeholder && <PlaceholderNotice />}

      <header style={S.head}>
        <div style={S.headLeft}>
          <h2 style={S.title}>Alliance pace · trend</h2>
          <p style={S.sub}>
            Each point is share value gained since the previous upload, divided by the exact time between them · all
            times UTC
          </p>
        </div>
        <div style={S.switch} role="tablist" aria-label="Alliance group">
          {[1, 2].map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={group === g}
              onClick={() => setGroup(g)}
              style={{ ...S.switchBtn, ...(group === g ? S.switchBtnOn : null) }}
            >
              {g === 1 ? "1 — 10" : "11 — 20"}
            </button>
          ))}
        </div>
        <div style={S.actions}>
          <button style={S.btn} onClick={replay}>Replay</button>
          <button style={{ ...S.btn, ...(view.k > 1 ? S.btnLive : null) }} onClick={resetView}>
            Reset zoom{view.k > 1 ? \` · \${view.k.toFixed(1)}×\` : ""}
          </button>
        </div>
      </header>

      <p style={S.hint}>
        Wheel or pinch to zoom · drag to pan · tap an upload for every alliance's pace · tap a line to isolate · tap a
        legend name to hide
        {pinned != null && (
          <button style={S.clearPin} onClick={() => setPinned(null)}>
            Clear {fmtStamp(new Date(pinned).toISOString())}
          </button>
        )}
        {isolated && (
          <button style={S.clearPin} onClick={() => setIsolated(null)}>
            Show all lines
          </button>
        )}
      </p>

      <div
        ref={plotRef}
        style={S.plot}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onPlotClick}
      >
        <svg width={w} height={h} style={{ display: "block", touchAction: "none" }}>
          <defs>
            <clipPath id="pt-reveal">
              <rect x={0} y={0} width={revealX + 2} height={h} />
            </clipPath>
            <clipPath id="pt-frame">
              <rect x={PAD.l - 1} y={0} width={iw + PAD.r} height={h} />
            </clipPath>
          </defs>

          <g transform={\`translate(\${view.tx},\${view.ty}) scale(\${view.k})\`}>
            {dayCols.map(
              (c) =>
                !c.has && (
                  <rect
                    key={"nil" + c.d}
                    x={xFor(c.d)}
                    y={PAD.t}
                    width={Math.max(2, xFor(c.d + DAY_MS) - xFor(c.d))}
                    height={ih}
                    fill={T.nil}
                  />
                )
            )}
            {ticks.map((v, i) => (
              <line
                key={"g" + i}
                x1={PAD.l}
                x2={PAD.l + iw}
                y1={yFor(v)}
                y2={yFor(v)}
                stroke={T.grid}
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <g clipPath="url(#pt-reveal)">
              {visible.map((r) => {
                if (!r.paceSeries.length) return null;
                const d = r.paceSeries.map((p, i) => (i ? "L" : "M") + xFor(p.t) + " " + yFor(p.pace)).join(" ");
                const dim = isolated && r.name !== isolated;
                return (
                  <path
                    key={r.name}
                    d={d}
                    fill="none"
                    stroke={r.colour}
                    strokeWidth={r.us ? 3 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={dim ? 0.18 : 1}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsolated((c) => (c === r.name ? null : r.name));
                    }}
                  />
                );
              })}
            </g>

            <g clipPath="url(#pt-reveal)">
              {visible.map((r) =>
                r.paceSeries.map((p) => (
                  <circle
                    key={r.name + p.t}
                    cx={xFor(p.t)}
                    cy={yFor(p.pace)}
                    r={r.us ? 3.6 : 2.8}
                    fill={r.colour}
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaying(false);
                      setPinned(p.t);
                    }}
                  />
                ))
              )}
            </g>
          </g>

          {ticks.map((v, i) => (
            <text key={"yt" + i} x={PAD.l - 12} y={yFor(v) * view.k + view.ty + 4} style={S.axisText} textAnchor="end">
              {fmtAxis(v)}
            </text>
          ))}

          {dayCols.map((c) => (
            <g key={"xt" + c.d}>
              <text x={xFor(c.d) * view.k + view.tx} y={PAD.t + ih + 22} style={S.axisText} textAnchor="middle">
                {fmtDayShort(c.d)}
              </text>
              {!c.has && (
                <text x={xFor(c.d) * view.k + view.tx} y={PAD.t + ih + 40} style={S.nilText} textAnchor="middle">
                  no upload
                </text>
              )}
            </g>
          ))}

          {(showChips || playing) && (
            <line x1={playX} x2={playX} y1={PAD.t} y2={PAD.t + ih} stroke={T.gold} strokeDasharray="4 4" opacity={0.75} />
          )}

          {showChips && (
            <>
              <text x={playX - chipGap} y={PAD.t - 24} style={S.chipHead} textAnchor="end">
                Pace at {fmtStamp(new Date(readT).toISOString())}
              </text>
              {readInterval != null && (
                <text x={playX - chipGap} y={PAD.t - 11} style={S.chipSub} textAnchor="end">
                  measured over {fmtInterval(readInterval)}
                </text>
              )}
            </>
          )}

          <g clipPath="url(#pt-frame)">
            {chips.map((c) => {
              const label = fmtMoney(c.pace);
              const wpx = label.length * chipFont * 0.62 + chipPadX * 2;
              const x = playX - chipGap - wpx;
              return (
                <g key={"c" + c.key} pointerEvents="none">
                  <rect
                    x={x}
                    y={c.y - chipH / 2}
                    width={wpx}
                    height={chipH}
                    rx={4 * chipScale}
                    fill="#0a0e18"
                    stroke={c.colour}
                    strokeWidth={1.4}
                  />
                  <text x={x + chipPadX} y={c.y + chipFont * 0.36} style={{ ...S.chipText, fontSize: chipFont, fill: c.colour }}>
                    {label}
                  </text>
                </g>
              );
            })}
          </g>

          <text x={PAD.l + iw + GAP} y={PAD.t - 18} style={S.colHead}>
            Current pace · latest upload
          </text>
          <line
            x1={PAD.l + iw + GAP}
            x2={PAD.l + iw + GAP + NAME_W}
            y1={PAD.t - 8}
            y2={PAD.t - 8}
            stroke={T.goldDim}
            opacity={0.55}
          />

          {endLabels.map((l) => (
            <g key={"e" + l.key} pointerEvents="none">
              {Math.abs(l.y - l.anchorY) > 2 && (
                <path
                  d={\`M \${PAD.l + iw} \${l.anchorY} L \${PAD.l + iw + GAP - 6} \${l.y}\`}
                  stroke={l.colour}
                  fill="none"
                  opacity={0.45}
                />
              )}
              <text x={PAD.l + iw + GAP} y={l.y + 4} style={{ ...S.endText, fill: l.colour, fontWeight: l.us ? 700 : 500 }}>
                {l.rank}. {l.name} {fmtMoney(l.pace)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div style={S.legend}>
        {inGroup.map((r, i) => {
          const off = hidden.has(r.name);
          return (
            <button key={r.name} onClick={() => toggle(r.name)} style={{ ...S.legendItem, opacity: off ? 0.32 : 1 }} aria-pressed={!off}>
              <span style={{ ...S.swatch, background: r.colour }} />
              <span style={{ color: off ? T.inkFaint : T.ink, fontWeight: r.us ? 700 : 400 }}>
                {i + (group === 1 ? 1 : 11)}. {r.name}
              </span>
              <span style={S.legendVal}>{r.currentPace == null ? "—" : fmtMoney(r.currentPace)}</span>
            </button>
          );
        })}
      </div>

      <p style={S.foot}>
        Shaded columns are calendar days with no upload from anyone. Lines bridge them in the alliance's own colour and
        the day prints "no upload" — nothing is smoothed into a value. Every pace is divided by the exact time between
        uploads, so an upload that lands late does not inflate or deflate the figure.
      </p>
    </div>
  );
}

/* ====================================================== the standings table */
function PaceStandings({ series = PLACEHOLDER_SERIES, datumT = DATUM_T }) {
  const [sortKey, setSortKey] = useState("pace");

  const rows = useMemo(() => {
    const base = series.map((s) => derive(s, datumT)).filter(Boolean);

    const worstFirst = base
      .filter((r) => r.movePct != null)
      .sort((a, b) => a.movePct - b.movePct)
      .map((r) => r.name);
    base.forEach((r) => {
      const i = worstFirst.indexOf(r.name);
      r.moveRank = i < 0 ? null : i + 1;
    });

    const byPace = base
      .filter((r) => r.currentPace != null)
      .sort((a, b) => b.currentPace - a.currentPace)
      .map((r) => r.name);
    base.forEach((r) => {
      const i = byPace.indexOf(r.name);
      r.paceRank = i < 0 ? null : i + 1;
    });

    const cmp = {
      pace: (a, b) => (b.currentPace ?? -Infinity) - (a.currentPace ?? -Infinity),
      move: (a, b) => (a.movePct ?? Infinity) - (b.movePct ?? Infinity),
      avg: (a, b) => (b.avgPace ?? -Infinity) - (a.avgPace ?? -Infinity),
    }[sortKey];
    return [...base].sort(cmp);
  }, [series, datumT, sortKey]);

  const totalRanked = rows.filter((r) => r.moveRank != null).length;
  const sinceMs = rows.length ? rows[0].sinceDatumMs : 0;

  const Head = ({ k, children, align = "right", sub }) => (
    <th
      style={{ ...S.th, textAlign: align, color: sortKey === k ? T.gold : T.inkDim, cursor: "pointer" }}
      onClick={() => setSortKey(k)}
    >
      {children}
      {sortKey === k ? " ·" : ""}
      {sub && <div style={S.thSub}>{sub}</div>}
    </th>
  );

  return (
    <div style={S.page}>
      <header style={S.head}>
        <div style={S.headLeft}>
          <h2 style={S.title}>Alliance standings</h2>
          <p style={S.sub}>
            Datum {fmtStamp(datumT)} · {fmtInterval(sinceMs)} elapsed · tap a heading to sort · all times UTC
          </p>
        </div>
      </header>

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, textAlign: "left" }}>Alliance</th>
              <Head k="pace" sub="drives the projections">
                Current pace
              </Head>
              <th style={{ ...S.th, textAlign: "right", color: T.inkDim }}>
                Measured over
                <div style={S.thSub}>time since last upload</div>
              </th>
              <Head k="move" sub="worst first">
                Move on last pace
              </Head>
              <Head k="avg" sub={\`since \${fmtStamp(datumT)}\`}>
                Average pace
              </Head>
              <th style={{ ...S.th, textAlign: "right", color: T.inkDim }}>
                vs average
                <div style={S.thSub}>above or below</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} style={r.us ? S.trUs : S.tr}>
                <td style={{ ...S.td, textAlign: "left" }}>
                  <span style={{ ...S.swatch, background: r.colour, marginRight: 9 }} />
                  <span style={{ color: r.colour, fontWeight: r.us ? 700 : 500 }}>
                    {r.paceRank ? r.paceRank + ". " : ""}
                    {r.name}
                  </span>
                </td>
                <td style={{ ...S.tdNum, color: T.ink, fontWeight: 700 }}>
                  {r.currentPace == null ? "—" : fmtMoney(r.currentPace)}
                </td>
                <td style={{ ...S.tdNum, color: T.inkDim, fontSize: 12.5 }}>
                  {r.intervalMs == null ? "—" : fmtInterval(r.intervalMs)}
                </td>
                <td style={S.tdNum}>
                  {r.movePct == null ? (
                    <span style={{ color: T.inkFaint }}>—</span>
                  ) : (
                    <>
                      <span style={{ color: r.movePct >= 0 ? T.up : T.down, fontWeight: 700 }}>
                        {r.movePct >= 0 ? "+" : "−"}
                        {Math.abs(r.movePct).toFixed(1)}%
                      </span>
                      <span
                        style={{
                          marginLeft: 10,
                          color: r.moveRank <= 3 ? T.warn : T.inkDim,
                          fontWeight: r.moveRank <= 3 ? 700 : 400,
                        }}
                      >
                        #{r.moveRank}
                      </span>
                    </>
                  )}
                </td>
                <td style={{ ...S.tdNum, color: T.ink }}>{r.avgPace == null ? "—" : fmtMoney(r.avgPace)}</td>
                <td style={{ ...S.tdNum, color: r.vsAvg == null ? T.inkFaint : r.vsAvg >= 0 ? T.up : T.down, fontWeight: 700 }}>
                  {r.vsAvg == null ? "—" : (r.vsAvg >= 0 ? "▲" : "▼") + Math.abs(r.vsAvg).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={S.foot}>
        <strong style={{ color: T.ink }}>Current pace is the projection figure</strong> — crossovers and who passes whom
        are calculated from it, on the assumption the alliance holds this rate. It is share value gained since the last
        upload divided by the exact time between the two, which is why the interval is shown beside it: an upload 31
        hours after the last one is not a day, and calling it daily pace would be wrong.
      </p>
      <p style={S.foot}>
        <strong style={{ color: T.ink }}>Average pace is the health check</strong> — total share value gained since{" "}
        {fmtStamp(datumT)} divided by the exact elapsed time. An alliance running above its average is accelerating,
        below it is fading. Move rank runs worst to best across all {totalRanked}: #1 is the heaviest drop in the field.
      </p>
    </div>
  );
}

/* ============================================== the two pages, with the tabs */
function PacePages({ series: propSeries = PLACEHOLDER_SERIES, datumT: propDatumT = DATUM_T, placeholder: propPlaceholder = true }) {
  const [tab, setTab] = useState("trend");
  const [days, setDays] = useState(7);
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    fetch("/api/pace-readings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.series) && d.series.some((s) => (s.readings || []).length >= 2)) setFetched(d);
      })
      .catch(() => {});
  }, []);

  const series = fetched ? fetched.series : propSeries;
  const datumT = fetched ? fetched.datumT : propDatumT;
  const placeholder = fetched ? false : propPlaceholder;

  const windowPresets = [
    { label: "2D", days: 2 },
    { label: "1W", days: 7 },
    { label: "2W", days: 14 },
    { label: "1M", days: 30 },
    { label: "2M", days: 60 },
    { label: "ALL", days: null },
  ];

  const windowedSeries = useMemo(() => {
    if (days == null) return series;
    let latest = -Infinity;
    for (const s of series) {
      for (const r of s.readings || []) {
        const t = ms(r.t);
        if (t > latest) latest = t;
      }
    }
    if (!isFinite(latest)) return series;
    const cutoff = latest - days * DAY_MS;
    const filtered = series.map((s) => {
      const sorted = [...(s.readings || [])].sort((a, b) => ms(a.t) - ms(b.t));
      const firstInside = sorted.findIndex((r) => ms(r.t) >= cutoff);
      if (firstInside === -1) {
        const last = sorted[sorted.length - 1];
        return { ...s, readings: last ? [last] : [] };
      }
      const start = Math.max(0, firstInside - 1);
      return { ...s, readings: sorted.slice(start) };
    });
    return filtered.filter((s) => s.readings.length >= 2);
  }, [series, days]);

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <nav style={{ ...S.tabs, flexWrap: "wrap" }}>
        {[
          ["trend", "Pace trend"],
          ["standings", "Standings"],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(tab === k ? S.tabOn : null) }} aria-current={tab === k}>
            {label}
          </button>
        ))}
        {tab === "trend" && (
          <>
            <div style={{ flex: 1, minWidth: 12 }} />
            {windowPresets.map((p) => (
              <button
                key={p.label}
                onClick={() => setDays(p.days)}
                style={{ ...S.tab, ...(days === p.days ? S.tabOn : null) }}
                aria-pressed={days === p.days}
              >
                {p.label}
              </button>
            ))}
          </>
        )}
      </nav>
      {tab === "trend" ? (
        <PaceDailyTrend key={days} series={windowedSeries} datumT={datumT} placeholder={placeholder} />
      ) : (
        <PaceStandings series={series} datumT={datumT} />
      )}
    </div>
  );
}

function PlaceholderNotice() {
  return (
    <div style={S.notice}>
      <strong style={{ color: T.warn }}>Part-placeholder readings.</strong> The datum share values (10 Jan 2026) and the
      final reading are real; the two intermediate uploads are shape only. Replace <code style={S.code}>READINGS</code>{" "}
      with the History Store, which must supply share value and an exact UTC timestamp per upload — never stored pace.
    </div>
  );
}

/* --------------------------------------------------------------------- styles */
const S = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: T.bg,
    color: T.ink,
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
    padding: "18px 20px 14px",
    boxSizing: "border-box",
    gap: 10,
  },
  notice: {
    border: \`1px solid \${T.warn}\`,
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    color: T.inkDim,
    background: "rgba(255,112,67,.07)",
  },
  head: { display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" },
  headLeft: { flex: "1 1 260px", minWidth: 0 },
  title: { margin: 0, fontSize: 19, letterSpacing: ".14em", textTransform: "uppercase", color: T.gold, fontWeight: 700 },
  sub: { margin: "4px 0 0", fontSize: 12.5, color: T.inkDim },
  switch: { display: "flex", border: \`1px solid \${T.panelEdge}\`, borderRadius: 6, overflow: "hidden" },
  switchBtn: {
    padding: "9px 20px",
    background: "transparent",
    border: "none",
    color: T.inkDim,
    fontFamily: T.mono,
    fontSize: 13,
    letterSpacing: ".08em",
    cursor: "pointer",
  },
  switchBtnOn: { background: T.gold, color: "#12100a", fontWeight: 700 },
  actions: { display: "flex", gap: 8 },
  btn: {
    padding: "8px 14px",
    background: T.panel,
    border: \`1px solid \${T.panelEdge}\`,
    borderRadius: 5,
    color: T.inkDim,
    fontFamily: T.mono,
    fontSize: 12,
    letterSpacing: ".06em",
    cursor: "pointer",
  },
  btnLive: { color: T.gold, borderColor: T.goldDim },
  hint: {
    margin: 0,
    fontSize: 11.5,
    color: T.inkFaint,
    letterSpacing: ".04em",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  clearPin: {
    background: "transparent",
    border: \`1px solid \${T.goldDim}\`,
    color: T.gold,
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: T.mono,
  },
  plot: {
    flex: "1 1 auto",
    minHeight: 360,
    border: \`1px solid \${T.panelEdge}\`,
    borderRadius: 8,
    background: T.panel,
    overflow: "hidden",
    cursor: "grab",
    userSelect: "none",
  },
  axisText: { fontFamily: T.mono, fontSize: 11.5, fill: T.inkDim },
  nilText: { fontFamily: T.mono, fontSize: 10.5, fill: T.inkFaint, fontStyle: "italic" },
  chipText: { fontFamily: T.mono, fontWeight: 700 },
  chipHead: { fontFamily: T.mono, fontSize: 11, fill: T.gold, letterSpacing: ".08em", textTransform: "uppercase" },
  chipSub: { fontFamily: T.mono, fontSize: 10, fill: T.inkFaint },
  endText: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 12.5 },
  colHead: {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 11,
    fill: T.gold,
    letterSpacing: ".12em",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  legend: { display: "flex", flexWrap: "wrap", gap: "6px 16px" },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "transparent",
    border: "none",
    padding: "2px 0",
    fontSize: 12.5,
    cursor: "pointer",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  swatch: { width: 9, height: 9, borderRadius: "50%", flex: "0 0 auto", display: "inline-block" },
  legendVal: { fontFamily: T.mono, color: T.inkDim, fontSize: 12 },
  foot: { margin: 0, fontSize: 11.5, color: T.inkFaint, letterSpacing: ".02em", lineHeight: 1.5 },
  code: { fontFamily: T.mono, color: T.gold },
  tabs: { display: "flex", gap: 2, padding: "12px 20px 0", borderBottom: \`1px solid \${T.panelEdge}\`, background: T.bg },
  tab: {
    padding: "11px 26px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: T.inkDim,
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 13,
    letterSpacing: ".12em",
    textTransform: "uppercase",
    cursor: "pointer",
  },
  tabOn: { color: T.gold, borderBottom: \`2px solid \${T.gold}\`, fontWeight: 700 },
  tableWrap: { flex: "1 1 auto", border: \`1px solid \${T.panelEdge}\`, borderRadius: 8, background: T.panel, overflow: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontFamily: "Inter, system-ui, sans-serif" },
  th: {
    position: "sticky",
    top: 0,
    background: T.panel,
    padding: "12px 18px",
    fontSize: 11,
    letterSpacing: ".12em",
    textTransform: "uppercase",
    fontWeight: 700,
    borderBottom: \`1px solid \${T.goldDim}\`,
    whiteSpace: "nowrap",
    verticalAlign: "bottom",
  },
  thSub: { fontSize: 9.5, letterSpacing: ".06em", textTransform: "none", color: T.inkFaint, fontWeight: 400, marginTop: 3 },
  tr: { borderBottom: \`1px solid \${T.grid}\` },
  trUs: { borderBottom: \`1px solid \${T.grid}\`, background: "rgba(224,168,46,.07)" },
  td: { padding: "11px 18px", fontSize: 14, whiteSpace: "nowrap" },
  tdNum: { padding: "11px 18px", fontSize: 14, textAlign: "right", fontFamily: T.mono, whiteSpace: "nowrap" },
};
ReactDOM.createRoot(document.getElementById("root")).render(<PacePages />);

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
