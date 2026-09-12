const { AIRCRAFT_DATA, CALC_TIMES } = require('../config');

function buildCalcPage(key) {
  // A380 first and selected by default (Nathan, 6 Sep)
  const acOptions = [...AIRCRAFT_DATA.filter(a=>a.name==='A380-800'), ...AIRCRAFT_DATA.filter(a=>a.name!=='A380-800')].map(a =>
    '<option value="' + a.name + '">' + a.name + '</option>'
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AM4 Contribution Calculator — Beagle Global</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --bg:#040A14; --panel:#071426; --line:#12294A; --ink:#E6F0FF; --dim:#7F9BC0; --gold:#FFC422; --mag:#FF00CE; --cyan:#0DC1E8; --lime:#1AFF00; }
  body { background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 15px; min-height: 100vh; }
  .top-bar { background: linear-gradient(90deg,#071426 0%,#0B1E3A 60%,#071426 100%); border-bottom: 1px solid var(--line); padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 52px; position: sticky; top: 0; z-index: 100; }
  .top-bar::after { content:''; position:absolute; left:0; right:0; bottom:-2px; height:2px; background: linear-gradient(90deg,#1AFF00,#FFFF00,#FEA900,#F11501,#FF00CE); }
  .logo-block { display: flex; align-items: center; gap: 12px; }
  .logo-text { font-size: 13px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink); }
  .logo-sep { color: var(--dim); }
  .page-title { font-size: 17px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; background: linear-gradient(90deg,#1AFF00,#FFFF00,#FEA900,#F11501); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .control-bar { background: var(--panel); border-bottom: 1px solid var(--line); padding: 10px 24px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; position: sticky; top: 52px; z-index: 99; }
  .control-group { display: flex; align-items: center; gap: 10px; }
  .control-label { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); white-space: nowrap; }
  select { background: #0A1E30; border: 1px solid #2C4A6E; color: var(--ink); padding: 7px 30px 7px 12px; border-radius: 4px; font-size: 15px; font-family: inherit; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%230DC1E8'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; min-width: 160px; }
  .mode-toggle { display: flex; border-radius: 4px; overflow: hidden; border: 1px solid #2C4A6E; }
  .mode-btn { padding: 7px 18px; background: #0A1E30; border: none; color: var(--dim); font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; letter-spacing: 0.05em; }
  .mode-btn.active { background: linear-gradient(90deg,#1AFF00,#FFC422); color: #000; }
  .mode-btn:not(:last-child) { border-right: 1px solid #2C4A6E; }
  .speed-display { font-size: 13px; color: var(--dim); white-space: nowrap; }
  .speed-display span { color: var(--ink); font-weight: 700; }
  .status-msg { margin-left: auto; font-size: 13px; color: var(--cyan); font-weight: 600; white-space: nowrap; letter-spacing: .08em; }
  /* Optimizer */
  .optimizer-bar { background: var(--panel); border-bottom: 1px solid var(--line); padding: 12px 24px; display: flex; align-items: flex-start; gap: 40px; flex-wrap: wrap; }
  .opt-section-label { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--dim); margin-bottom: 8px; }
  .best-cards { display: flex; gap: 10px; flex-wrap: wrap; }
  .bcard { position: relative; background: #06121E; border: 1px solid #1A3A5A; border-radius: 6px; padding: 8px 14px; min-width: 170px; cursor: pointer; transition: transform .12s, box-shadow .12s; }
  .bcard:hover { transform: translateY(-2px); box-shadow: 0 0 18px rgba(13,193,232,.35); }
  #insp-card:hover { transform:none; box-shadow:none; }
  td.sel { box-shadow: inset 0 0 0 3px #FFF, 0 0 16px #FFF !important; z-index: 4; position: relative; }
  td.cell.num { cursor: pointer; }
  #pop { position: fixed; z-index: 300; display: none; min-width: 300px; background: rgba(6,18,30,.94); backdrop-filter: blur(6px); border: 2px solid #2C4A6E; border-radius: 8px; padding: 12px 16px; box-shadow: 0 0 28px rgba(13,193,232,.45); pointer-events: none; }
  #pop.gold { border-color: transparent; background: linear-gradient(rgba(6,18,30,.92),rgba(6,18,30,.92)) padding-box, linear-gradient(135deg,#FFC422,#FF2910,#FF00CE) border-box; }
  #pop .r { font-size: 20px; color: #FFF; font-weight: 900; letter-spacing: .06em; background: linear-gradient(90deg,#FFC422,#FF2910); -webkit-background-clip: text; background-clip: text; color: transparent; line-height: 1.15; }
  #pop .r.dz { background: none; color: var(--dim); font-size: 16px; }
  #pop .h { font-size: 25px; font-weight: 800; color: #FFF; margin: 4px 0 2px; }
  #pop .m { font-size: 15px; color: var(--dim); }
  #pop .t { font-size: 20px; font-weight: 800; color: var(--lime); margin-top: 6px; text-shadow: 0 0 8px rgba(26,255,0,.5); }
  /* Selected-cell focus — cyan so it never collides with magenta hot zones or the gold optimal row (Nathan, 10 Sep 2026) */
  #focus { position: fixed; inset: 0; z-index: 290; pointer-events: none; display: none; }
  #f-scrim { fill: rgba(4,10,20,.62); }
  #f-ring { fill: none; stroke: #0DC1E8; stroke-width: 2.5; filter: url(#fglow); animation: fpulse 1.8s ease-in-out infinite; }
  #f-lead { fill: none; stroke: #0DC1E8; stroke-width: 2; stroke-dasharray: 7 5; filter: url(#fglow); }
  #f-cell { fill: none; stroke: #FFFFFF; stroke-width: 2.5; filter: url(#fglow); }
  @keyframes fpulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
  .bcard.gold { border-color: transparent; background: linear-gradient(#06121E,#06121E) padding-box, linear-gradient(135deg,#FFC422,#FF2910,#FF00CE) border-box; box-shadow: 0 0 16px rgba(255,196,34,.25); }
  .bcard-rank { font-size: 11px; color: var(--gold); font-weight: 700; letter-spacing: 0.12em; margin-bottom: 3px; }
  #insp-rank { font-size: 17px; letter-spacing: .04em; }
  .bcard-time { font-size: 23px; font-weight: 800; color: #FFF; letter-spacing: 0.02em; }
  .bcard-meta { font-size: 13px; color: var(--dim); margin-top: 2px; }
  .bcard-total { font-size: 15px; font-weight: 800; color: var(--lime); margin-top: 5px; text-shadow: 0 0 8px rgba(26,255,0,.5); }
  .manual-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .maint-btn { padding: 6px 16px; border-radius: 4px; border: 1px solid #2C4A6E; background: #06121E; color: var(--dim); font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .maint-btn.on { background: #0E2818; border-color: var(--lime); color: var(--lime); }
  #opt-dd { min-width: 340px; background: #0A1E30; color: var(--ink); border: 1px solid #2C4A6E; border-radius: 4px; padding: 7px 12px; font-size: 14px; font-family: 'Consolas', monospace; }
  .opt-result { font-size: 15px; color: var(--gold); font-weight: 700; white-space: nowrap; }
  /* CONTRIB<->PROFIT balance slider — sized for touch (Nathan, 9 Sep 2026) */
  .wrow { gap: 14px !important; }
  .wgrp { display: flex; align-items: center; gap: 12px; flex: 1 1 280px; min-width: 0; }
  #wslider { -webkit-appearance: none; appearance: none; flex: 1 1 auto; min-width: 130px; max-width: 380px; height: 36px; background: transparent; margin: 0; padding: 0; cursor: grab; touch-action: none; }
  #wslider:active { cursor: grabbing; }
  #wslider::-webkit-slider-runnable-track { height: 14px; border-radius: 999px; border: 1px solid #2C4A6E; background: linear-gradient(90deg, var(--lime), var(--gold)); }
  #wslider::-moz-range-track { height: 14px; border-radius: 999px; border: 1px solid #2C4A6E; background: linear-gradient(90deg, var(--lime), var(--gold)); }
  #wslider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 32px; height: 32px; margin-top: -9px; border-radius: 50%; background: #FFFFFF; border: 3px solid var(--gold); box-shadow: 0 0 12px rgba(255,196,34,.75); }
  #wslider::-moz-range-thumb { width: 32px; height: 32px; border-radius: 50%; background: #FFFFFF; border: 3px solid var(--gold); box-shadow: 0 0 12px rgba(255,196,34,.75); }
  #wslider:focus { outline: none; }
  #wslider:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 5px rgba(13,193,232,.65); }
  #wslider:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 5px rgba(13,193,232,.65); }
  .wend { font-size: 14px; font-weight: 800; letter-spacing: .06em; cursor: pointer; user-select: none; padding: 6px 4px; }
  .wend:hover { text-decoration: underline; }
  #wlbl { font-size: 17px !important; min-width: 72px; text-align: center; flex: 0 0 auto; }
  /* Mini-map */
  .mini-wrap { background: var(--panel); border-bottom: 1px solid var(--line); padding: 10px 24px; display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
  #mini { image-rendering: pixelated; border: 1px solid #2C4A6E; border-radius: 4px; cursor: crosshair; box-shadow: 0 0 20px rgba(13,193,232,.15); }
  .mini-note { font-size: 12px; color: var(--dim); letter-spacing: .08em; text-transform: uppercase; max-width: 260px; line-height: 1.5; }
  /* Heat map */
  .hmap-header { background: var(--panel); padding: 7px 24px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .hmap-title { font-size: 13px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); }
  .hmap-sub { font-size: 12px; color: var(--dim); }
  .table-wrap { overflow: auto; background: var(--bg); }
  table { border-collapse: separate; border-spacing: 0; white-space: nowrap; width: 100%; min-width: 3050px; table-layout: fixed; font-size: clamp(11px, 0.76vw, 14.5px); }
  thead th { background: #0B1E3A; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 7px 2px; text-align: center; font-weight: 700; font-size: clamp(10px, 0.68vw, 12.5px); overflow: hidden; letter-spacing: 0.06em; color: var(--ink); position: sticky; top: 0; z-index: 50; }
  thead th:first-child { position: sticky; left: 0; z-index: 60; background: #0B1E3A; width: 96px; font-size: 11px; }
  th.dz { color: var(--dim) !important; }
  td.tlbl { position: sticky; left: 0; z-index: 10; background: #0B1E3A; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 5px 7px; width: 96px; font-size: clamp(10px, 0.68vw, 13px); font-weight: 600; color: var(--ink); text-align: right; }
  td.tlbl.opt { background: #1F1A00 !important; border-left: 3px solid var(--gold) !important; color: var(--gold) !important; text-shadow: 0 0 6px rgba(255,196,34,.6); }
  td.cell { border-right: 1px solid rgba(255,255,255,.06); border-bottom: 1px solid rgba(255,255,255,.06); padding: 5px 2px; text-align: center; font-size: inherit; font-weight: 500; color: #000; overflow: hidden; }
  td.cell:hover { filter: brightness(1.25); cursor: default; }
  td.lt { color: #FFF; }
  td.vx  { background: #2A0A12; color: #7A2A3A; font-weight: 700; }
  td.vng { background: #3A0A1A; color: #FF6E8A; font-weight: 600; }
  td.vem { background: #071426; }
  td.hot { font-weight: 700; }
  td.zpeak { outline: 2px solid #FFF; outline-offset: -2px; font-weight: 800; }
  td.b6, th.b6 { border-left: 2px solid #FFFFFF !important; }
  td.b10, th.b10 { border-left: 2px solid #FFFFFF !important; }
  td.opt-cell { box-shadow: inset 0 -1px 0 rgba(255,196,34,.55), inset 0 1px 0 rgba(255,196,34,.55); }
  td.blob { box-shadow: inset 0 0 0 2px rgba(255,0,206,.55); }
  td.blob2 { box-shadow: inset 0 0 0 3px var(--mag), 0 0 14px var(--mag); font-weight: 800; z-index: 2; position: relative; }
  td.top3 { background: linear-gradient(135deg,#9F00D0,#FF00CE) !important; color: #FFF !important; font-weight: 800; position: relative; box-shadow: 0 0 12px rgba(255,0,206,.6); z-index: 2; padding-left: 14px !important; }
  td.top3::after { content: attr(data-rank); position: absolute; top: 1px; left: 1px; width: 11px; height: 11px; line-height: 11px; border-radius: 2px; background: #FFF; color: #9F00D0; font-size: 8px; font-weight: 900; text-align: center; }
  .grad-bar { display: inline-block; width: 240px; height: 12px; border-radius: 3px; border: 1px solid #2C4A6E; vertical-align: middle; background: linear-gradient(90deg,#ECFCEC 0%,#96FF78 30%,#1AFF00 55%,#FFFF00 75%,#FEA900 88%,#F11501 100%); }
  .footer { padding: 14px 24px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; color: var(--dim); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; flex-wrap: wrap; gap: 8px; background: var(--panel); }
  .lg { padding:3px 9px; border-radius:3px; font-size:12px; font-weight:700; }
  #lov { position: fixed; inset: 0; background: rgba(4,10,20,0.85); display: none; align-items: center; justify-content: center; z-index: 200; font-size: 15px; letter-spacing: 0.2em; color: var(--cyan); }
  @keyframes flash { 0%,100%{ box-shadow: inset 0 0 0 3px #FFF, 0 0 22px #FFF; } 50%{ box-shadow: none; } }
  td.flash { animation: flash 0.6s ease-in-out 4; position: relative; z-index: 3; }
  /* ── MEMBER GUIDE (Nathan, 12 Sep 2026 rewrite) — the page explains itself, so a member
        who opens it cold is not guessing at what the numbers mean. ───────────── */
  /* Sits under the balance slider rather than in the top bar (Nathan, 10 Sep 2026):
     a member reading the ranking is already looking here, and a corner button was missed. */
  .guide-btn { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 10px; padding: 10px 14px; border-radius: 6px; cursor: pointer; text-align: left; font-family: inherit; background: linear-gradient(90deg,#0A2436,#0A1E30); border: 1px solid var(--cyan); color: var(--ink); box-shadow: 0 0 0 rgba(13,193,232,0); animation: gpulse 2.6s ease-in-out 3; }
  .guide-btn:hover { background: linear-gradient(90deg,#103449,#0A2436); box-shadow: 0 0 18px rgba(13,193,232,.45); }
  .guide-btn:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
  .g-q { flex: 0 0 auto; width: 26px; height: 26px; border-radius: 50%; background: var(--cyan); color: #041018; font-size: 15px; font-weight: 900; line-height: 26px; text-align: center; }
  .g-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .g-t1 { font-size: 14px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--cyan); }
  .g-t2 { font-size: 13px; color: var(--dim); line-height: 1.35; }
  .g-go { flex: 0 0 auto; margin-left: auto; font-size: 12px; font-weight: 800; letter-spacing: .12em; color: var(--cyan); white-space: nowrap; }
  @keyframes gpulse { 0%,100% { box-shadow: 0 0 0 rgba(13,193,232,0); } 50% { box-shadow: 0 0 16px rgba(13,193,232,.5); } }
  #guide { position: fixed; inset: 0; z-index: 400; display: none; background: rgba(2,6,14,.82); backdrop-filter: blur(3px); padding: 24px; }
  #guide.open { display: flex; align-items: center; justify-content: center; }
  .g-panel { background: var(--panel); border: 1px solid #2C4A6E; border-radius: 10px; box-shadow: 0 24px 70px rgba(0,0,0,.65); width: min(1080px,100%); max-height: 100%; display: flex; flex-direction: column; overflow: hidden; }
  .g-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--line); background: linear-gradient(90deg,#071426,#0B1E3A 60%,#071426); }
  .g-head::after { content:''; }
  .g-kicker { font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: var(--dim); margin-bottom: 4px; }
  .g-title { font-size: 20px; font-weight: 800; color: var(--ink); letter-spacing: .01em; }
  .g-close { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 6px; border: 1px solid #2C4A6E; background: #06121E; color: var(--dim); font-size: 20px; line-height: 1; font-family: inherit; cursor: pointer; }
  .g-close:hover { color: #FFF; border-color: var(--cyan); }
  .g-body { display: flex; gap: 0; min-height: 0; flex: 1 1 auto; }
  .g-index { flex: 0 0 258px; border-right: 1px solid var(--line); padding: 14px 10px 18px; overflow-y: auto; background: #06121E; }
  .g-index .lbl { font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--dim); padding: 0 10px 8px; }
  .g-index a { display: block; padding: 7px 10px; border-radius: 4px; border-left: 2px solid transparent; color: #A9C4E0; font-size: 14px; line-height: 1.4; text-decoration: none; cursor: pointer; }
  .g-index a:hover { background: #0A1E30; color: var(--ink); }
  .g-index a.on { background: #0A1E30; border-left-color: var(--cyan); color: var(--cyan); font-weight: 700; }
  .g-content { flex: 1 1 auto; overflow-y: auto; padding: 20px 26px 60px; scroll-behavior: smooth; }
  .g-content h3 { font-size: 17px; font-weight: 800; letter-spacing: .02em; color: var(--cyan); margin: 26px 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--line); scroll-margin-top: 8px; }
  .g-content h3:first-child { margin-top: 4px; }
  .g-content p { font-size: 15px; line-height: 1.7; color: #C8DCF0; margin: 8px 0; }
  .g-content ul { margin: 8px 0 8px 18px; }
  .g-content li { font-size: 15px; line-height: 1.65; color: #C8DCF0; margin: 5px 0; }
  .g-content li ul { margin: 4px 0 4px 16px; }
  .g-content b { color: var(--ink); font-weight: 700; }
  .g-content .lede { font-size: 15.5px; color: var(--ink); }
  .g-note { border-left: 3px solid var(--gold); background: #14100022; padding: 9px 14px; margin: 12px 0; font-size: 14.5px; line-height: 1.65; color: #E3D9B8; border-radius: 0 4px 4px 0; }
  .g-tag { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 13px; font-weight: 800; vertical-align: baseline; }
  .g-foot { padding: 10px 20px; border-top: 1px solid var(--line); font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--dim); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  @media (max-width: 860px) {
    #guide { padding: 10px; }
    .g-body { flex-direction: column; }
    .g-index { flex: 0 0 auto; max-height: 132px; border-right: none; border-bottom: 1px solid var(--line); }
    .g-content { padding: 16px 16px 40px; }
    .guide-btn { padding: 9px 11px; gap: 9px; }
    .g-go { display: none; }
    .g-t2 { font-size: 12px; }
  }
  @media print { body { display: none !important; } }
</style>
</head>
<body>
<div id="lov">CALCULATING...</div>
<div id="guide" role="dialog" aria-modal="true" aria-labelledby="g-title" onclick="if(event.target===this)closeGuide()">
  <div class="g-panel">
    <div class="g-head">
      <div>
        <div class="g-kicker">Beagle Global · member guide</div>
        <div class="g-title" id="g-title">AM4 Contribution Calculator — what it is and how it works</div>
      </div>
      <button class="g-close" onclick="closeGuide()" aria-label="Close guide">&times;</button>
    </div>
    <div class="g-body">
      <nav class="g-index" id="g-index">
        <div class="lbl">Contents</div>
        <a data-g="g1">1 · What it does</a>
        <a data-g="g2">2 · Reading the table</a>
        <a data-g="g3">3 · The hot markers</a>
        <a data-g="g4">4 · Why 48 hours and why X amount of departures</a>
        <a data-g="g5">5 · What's factored into contribution</a>
        <a data-g="g6">6 · The profit side</a>
        <a data-g="g7">7 · The one control: CONTRIB ↔ PROFIT</a>
        <a data-g="g8">8 · 4× speed</a>
        <a data-g="g9">9 · Aircraft list</a>
        <a data-g="g10">10 · What it does not do</a>
      </nav>
      <article class="g-content" id="g-content">

        <h3 id="g1">What it does</h3>
        <p>This spreadsheet has been put together after many years of data so it's like a master spreadsheet of every conceivable flight time and distance all on one sheet and depending on your selection where it actually shows you the value of setting your fleets up to achieve best contributions or best profit some 6000 and above 10,000 plus the three best overall setups for revenue and contributions.</p>
        <p>It has been built off my own extensive flight-tested numbers, not only from testing but theory and developed formulas aswell. Everything in the table has been checked against various routes, flight times, distances and multiple aircraft routes flown many times to cross check the data.</p>

        <h3 id="g2">Reading the table</h3>
        <ul>
          <li>One continuous table, <b>500 km to 20,000 km</b>, for every aircraft. 20,000 km is the practical maximum route length in AM4 — nothing useful really exists beyond it even though I have seen a few 21,000km routes they aren’t really practical.</li>
          <li>Rows are flight times, columns are distances. Each cell shows <b>contribution per day (C/D)</b> for the aircraft you have selected from the dropdown menu given a certain flight time and distance (am4help shows C/F (contribution per <i>flight</i>, which is double this number and really is not relevant for the 48 hr contributions window as it measures something different ie a Fleets Overall Efficiency.</li>
          <li>Three distance zones, marked by vertical rules:
            <ul>
              <li><b>500–6,000 km</b> — Sub 6000km routes.</li>
              <li><b>6,001–9,999 km</b> — Developer imposed dead zone. The numbers are shown but this range never displays a ranking and never gets a heat zone displayed in it. Don't forget not to utilise anything between 6001 and 9999 km as the developers have made that the dead zone and the dead zone was set to force players to choose between a short strategy or long strategy.</li>
              <li><b>10,000–20,000 km</b> — stopover routes. The full route distance counts for contribution, not the individual legs. Because the contributions formula is based off distance and speed and also an element of cost index, stopovers don't really affect the total contributions because it again looking at speed and distance so in actual fact you can have a route that is bent substantially off its straight line and still contribute really well but of course you will hurt revenue wise because of the extra off track kms that you're adding outside the direct route distance which does actually affect your total profit after ticket sales.</li>
            </ul>
          </li>
          <li>Colour runs <b>green → yellow → orange → red</b>, hottest is best. The two live zones are heat-scaled independently: the 10,000+ zone is the dominant one and reaches full red; the sub-6,000 zone runs smaller and cooler by design.</li>
        </ul>

        <h3 id="g3">The hot markers</h3>
        <p>Pick a flight-time row and the table marks three things on that row:</p>
        <ul>
          <li><b>SHORT</b> — best set up under 6,000 km.</li>
          <li><b>LONG</b> — best cell above 10,000 km which includes using a stopover if needed.</li>
          <li><b>BEST OVERALL 1 · 2 · 3</b> — the three best cells across the row, ranked by <b>48-hour total</b>, considering both revenue and C/D.  If you click on any cell it will display the results for how many flights are optimum within 48 hrs and how it ranks against all other cells on the spreadsheet.</li>
        </ul>

        <h3 id="g4">Why 48 hours and why X amount of departures</h3>
        <p>You will see that there is odd numbers of departures and weird looking flight times in the drop-down menu but what that is, is the end product of factoring in multiple takeoffs and landings plus a human stuff up time buffer within the 48 hour window all to be comfortably within the 48 hrs and not wasting any minutes of efficiency.  So by utilizing this spreadsheet you will be ahead of the 48 hour window and managing a bonus departure of contributions to add into your usual strategy.</p>
        <p>So again what would be a normal say 4 flights in 48 hours now becomes 5 flights in 48 hours, or  6 flights becomes 7 flights, or 8 becomes 9 flights and so on. That extra flight is going to boost your contributions with the amount of aircraft you depart on that last departure before the 48 hour window catches up with you.</p>
        <p>You have a buffer built in as over the years if not allowing for a buffer you will stuff up along the way and end up running over the 48hr window, so a time buffer is an absolute must to ensure you remain inside the 48hr window.</p>
        <p>Take offs, landings, daily maintenance  repairs (can be deselected if not repairing daily) and 48 hr time buffers all factored in to the flight times hence why they look a bit weird.</p>

        <h3 id="g5">What's factored into contribution</h3>
        <ul>
          <li>Route distance (including stopover routes).</li>
          <li>Aircraft type and its speed. Speed modifiers use the same rule as the game: ×1.1 for the speed mod bought on purchase, ×1.5 on top for Easy mode.</li>
          <li>Cost Index (CI). The table if utilising maximum profit is like setting your cost index to 200 / setting maximum contributions will be like utilizing a lesser C/I and using potential shorter routes depending on the Game Mode and settings you choose which is similar to utilising a lower cost index setting.</li>
          <li>Aircraft type matters: each type carries its own multiplier, which is why an A380 and a Concorde on the same route don't score the same as speed is a major factor as is distance.</li>
        </ul>

        <h3 id="g6">The profit side</h3>
        <p>Each cell also carries an estimated <b>48-hour profit</b> for the aircraft, built from:</p>
        <ul>
          <li>Ticket income by class, from a fitted model of real route exports at CI 200.</li>
          <li>Seats sold capped by realistic daily demand per class — routes reset daily and rarely exceed ~2,000 passengers a day even with full marketing unless running 4x the speed.</li>
          <li>Fuel and CO₂ burn per kilometre for the aircraft.</li>
          <li>A-check maintenance cost per flight hour and repair cost per flight.</li>
        </ul>
        <p>The profit inputs use <b>fixed, typical values</b> (fuel price, CO₂ price (ive set the generic fuel purchase cost at $600 and C02 at$130 as unless you wanted to enter those in manually each time its easier to set standard numbers for comparison purposes) Seat layout, (demand per class taken from averages across a large sample of real routes). There are deliberately no dials for these — they change constantly in-game and a dial would just let you fool yourself and not display an even likewise set of results across the spreadsheet</p>

        <h3 id="g7">The one control: CONTRIB ↔ PROFIT</h3>
        <p>A single slider, default 50/50, sets how the ranking weighs your contributions against your own profit. Slide it towards CONTRIB to display routes more designed towards contributions or slide towards PROFIT to display routes more designed towards profits. In between each of those will weight the results accordingly to what you have set on the slider. All The heat zones re-rank as you move it. The departure count is the same for both sides — one number serves money and contributions.</p>

        <h3 id="g8">4× speed</h3>
        <p>The dropdown reflects the in-game mechanics: so 1 lot of 4x gives 4× speed for 4 hours and applies to your entire fleet that is yet to depart. Options are Off, 1–6 lots of 4x speed and 6 lots obviously is the whole days worth of 4x speed utilization.per day. Contribution per flight doesn't change — only the number of departures you can fit into 48 hours does so therefore increasing your total contributions. Beware to not run out of passenger quotas. If worried use a lower tier of marketing or don’t use marketing at all.</p>

        <h3 id="g9">Aircraft list</h3>
        <p>I have only entered a certain amount of aircraft and can add more but theres a bit of work involved so I will add more but you will help collect the data required.</p>

        <h3 id="g10">What it does not do</h3>
        <ul>
          <li>It doesn't know your hubs, your routes or your actual demand — it uses typical values.</li>
          <li>It doesn't net maintenance wear (0.75% per take-off) against contributions.or if your aircraft is above 25% wear which starts to affect your contributions effectiveness.  Many-short-flight setups carry that hidden cost of excess wear as each take off incurs maintenance wear penalties. So just be aware of it.</li>
          <li>It doesn't tell you what to do. It shows you the numbers so you can decide.</li>
        </ul>
        <p>Good luck and happy hunting!</p>

      </article>
    </div>
    <div class="g-foot">
      <span>Beagle Global · figures flight-tested, not theoretical</span>
      <span>Press ESC to close</span>
    </div>
  </div>
</div>
<div id="pop"><div class="r" id="pop-rank"></div><div class="h" id="pop-head"></div><div class="m" id="pop-l1"></div><div class="m" id="pop-l2"></div><div class="t" id="pop-total"></div></div>
<div id="pop"><div class="r" id="pop-rank"></div><div class="h" id="pop-head"></div><div class="m" id="pop-l1"></div><div class="m" id="pop-l2"></div><div class="t" id="pop-total"></div></div>
<svg id="focus" aria-hidden="true">
  <defs>
    <filter id="fglow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <marker id="farrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#0DC1E8"/></marker>
    <mask id="fmask"><rect id="fmask-all" fill="#FFF"/><rect id="fmask-hole" rx="7" fill="#000"/></mask>
  </defs>
  <rect id="f-scrim" mask="url(#fmask)"/>
  <rect id="f-ring" rx="7"/>
  <rect id="f-cell" rx="2"/>
  <path id="f-lead" marker-end="url(#farrow)"/>
</svg>
<div class="top-bar">
  <div class="logo-block">
    <span class="logo-text">ATLAS FX</span><span class="logo-sep">|</span><span class="logo-text">BEAGLE GLOBAL</span>
  </div>
  <span class="page-title">AM4 CONTRIBUTION CALCULATOR</span>
  <span style="width:160px"></span>
</div>
<div class="control-bar">
  <div class="control-group">
    <span class="control-label">Aircraft</span>
    <select id="ac-sel">${acOptions}</select>
  </div>
  <div class="control-group">
    <span class="control-label">Mode</span>
    <div class="mode-toggle">
      <button class="mode-btn active" id="btn-r" onclick="setMode('Realism')">REALISM</button>
      <button class="mode-btn" id="btn-e" onclick="setMode('Easy')">EASY</button>
    </div>
  </div>
  <div class="speed-display">Speed: <span id="spd">—</span> km/h</div>
  <div class="status-msg" id="smsg">SELECT AIRCRAFT</div>
</div>

<div class="optimizer-bar">
  <div>
    <div class="opt-section-label">⚡ BEST SETUP — 48hr optimised</div>
    <div class="best-cards" id="best-cards">
      <div class="bcard" style="color:#3A6080;font-size:12px;padding:12px 16px;">Select aircraft to calculate</div>
    </div>
  </div>
  <div>
    <div class="opt-section-label">MANUAL — DEPARTURES IN 48HRS (ALWAYS ODD — THE EXTRA FLIGHT)</div>
    <div class="manual-row" style="margin-bottom:8px;">
      <span class="control-label">4X SPEED (EACH LOT = 4 HRS)</span>
      <select id="boost" style="min-width:200px;">
        <option value="0">Off</option>
        <option value="4x1">1 × 4X SPEED</option><option value="4x2">2 × 4X SPEED</option><option value="4x3">3 × 4X SPEED</option><option value="4x4">4 × 4X SPEED</option><option value="4x5">5 × 4X SPEED</option><option value="4x6">6 × 4X SPEED</option>
        <option value="b1">BONUS — 4X SPEED FOR 1 HR</option>
        <option value="b24">BONUS — 4X SPEED FOR 24 HRS</option>
      </select>
    </div>
    <div class="manual-row">
      <div class="control-group">
        <span class="control-label" style="color:#8AAABB;">Maintenance</span>
        <button class="maint-btn on" id="mbt" onclick="toggleMaint()">YES</button>
      </div>
      <div class="control-group">
        <span class="control-label" style="color:#8AAABB;">Select</span>
        <select id="opt-dd" onchange="onDDChange()">
          <option value="">— select aircraft first —</option>
        </select>
      </div>
      <div class="opt-result" id="ores">—</div>
    </div>
  </div>
  <div id="rev" style="min-width:300px;">
    <div class="opt-section-label">$ REVENUE LANE — GENERIC: 3-CLASS AVERAGES · FUEL $600 · CO₂ $130 · A-CHECK PER STARTED HOUR</div>
    <div class="manual-row wrow" style="margin-top:8px;">
      <span class="control-label">BALANCE</span>
      <span class="wgrp">
        <span class="wend" style="color:#1AFF00;" onclick="setBalance(0)" title="All contributions">CONTRIB</span>
        <input id="wslider" type="range" min="0" max="100" value="50" step="1" aria-label="Contributions to profit balance">
        <span class="wend" style="color:#FFC422;" onclick="setBalance(100)" title="All profit">PROFIT</span>
      </span>
      <span id="wlbl" style="color:#E6F0FF;font-weight:700;">50 / 50</span>
    </div>
    <div class="bcard-meta" id="revnote" style="margin-top:6px;">&nbsp;</div>
    <button class="guide-btn" id="guide-btn" onclick="openGuide()" aria-haspopup="dialog">
      <span class="g-q">?</span>
      <span class="g-txt"><span class="g-t1">How to read this calculator</span><span class="g-t2">What the numbers mean, why 48 hours, and what it does not tell you</span></span>
      <span class="g-go">OPEN &rsaquo;</span>
    </button>
  </div>
  <div id="insp" style="min-width:300px;">
    <div class="opt-section-label">◎ CELL INSPECTOR — click any number on the chart</div>
    <div class="bcard" id="insp-card" style="cursor:default;border-color:#2C4A6E;">
      <div class="bcard-rank" id="insp-rank">—</div>
      <div class="bcard-time" id="insp-head">Select a cell</div>
      <div class="bcard-meta" id="insp-l1">&nbsp;</div>
      <div class="bcard-meta" id="insp-l2">&nbsp;</div>
      <div class="bcard-total" id="insp-total">&nbsp;</div>
    </div>
  </div>
</div>

<div class="mini-wrap">
  <canvas id="mini" width="400" height="188"></canvas>
  <div class="mini-note">Thermal overview — every flight time × every distance. Three heat circles on the combined C/D + $ score — best sub-6,000, best 10,000+, top 3 overall. Dead zone stays cold. Magenta = your hot zones. Click anywhere to jump to that cell.</div>
</div>

<div class="hmap-header">
  <span class="hmap-title">CONTRIBUTION HEAT MAP</span>
  <span class="hmap-sub" id="hm1sub">—</span>
</div>
<div class="table-wrap">
  <table><thead><tr id="s-head"><th>FLIGHT TIME</th></tr></thead><tbody id="s-body"></tbody></table>
</div>

<div class="footer">
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-weight:700;">COLD</span><span class="grad-bar"></span><span style="font-weight:700;">HOT</span>
    <span class="lg" style="box-shadow:inset 0 0 0 2px #FF00CE,0 0 10px #FF00CE;color:#FF00CE;">SHORT STRATEGY — BEST SUB-6,000 · LONG STRATEGY — BEST 10,000+</span>
    <span class="lg" style="background:linear-gradient(135deg,#9F00D0,#FF00CE);color:#FFF;">1 2 3 — BEST OVERALL ($ + C/D)</span>
        <span class="lg" style="background:#3A0A1A;color:#FF6E8A;">NEGATIVE</span>
    <span class="lg" style="background:#2A0A12;color:#7A2A3A;">CI &gt; 200</span>
    <span class="lg" style="border-left:3px solid #FFC422;color:#FFC422;">★ OPTIMAL ROW</span>
  </div>
  <span>BROWSER USE ONLY — NOT FOR DOWNLOAD OR DISTRIBUTION</span>
</div>

<script>
const ACD = ${JSON.stringify(AIRCRAFT_DATA.map(a => ({n:a.name,r:a.realism,e:a.easy,mx:a.maxRange})))};
const ACM = Object.fromEntries(ACD.map(a=>[a.n,a]));
const TMS = ${JSON.stringify(CALC_TIMES)};
const KEY = '${key}';
let cMode = 'Realism', maint = true, optIdx = -1;
let sGrid = null, sDists = null, gGrid=null, gDists=null, sScale=null, vScale=null, sPeak=null, vPeak=null, topMap={};

// Flights that fit in 48h at flight time t (hours) with Nathan's buffers: 3 min per flight, 30 min maintenance (if on), 26 min human buffer.
// DEPARTURES RULE (Nathan, 5 Sep 2026): a flight counts when it DEPARTS inside the 48h window — it does not have to land.
// So departures = full cycles that fit + 1 (the final departure). Cycle = flight time + 3 min buffer.
// e.g. 11h40 → 2,824 ÷ 703 = 4 cycles → 5 departures, the whole fleet's contributions on the fifth.
function flightsIn48(t){ return departures48(t,maint); }
// ── REVENUE MODEL (fitted 5–6 Sep 2026 from am4help exports, CI 200, realism) ──────────────────
// Tickets: Y=(0.3d+150)×1.10  J=(0.6d+500)×1.08  F=(0.9d+1000)×1.06. J uses 2 Y-seats, F uses 3, so class mix barely
// moves income: income ≈ 0.94 × Ycap × Y-ticket (A380 predicts $3.198M vs bot $3.192M at 16,684km).
// Costs: fuel lb/km × price, CO₂ q/km × price, A-check $/h × ceil(flight hours at NORMAL speed), repair per flight.
// Per-aircraft data — only aircraft listed here get a revenue lane; others rank on contributions alone.
// Two shapes of per-aircraft cost data, both priced at the SAME datum (Nathan, 9 Sep 2026):
// fuel $600 per 1,000 lb, CO2 $130 per 1,000 q. Nothing is scaled or converted.
//   · cf   — fuel lb/km at CI 200, used by every aircraft. The A380/Concorde values were
//            fitted 5-6 Sep; the ATL-78 values are the game's own Consumption figure, which
//            two aircraft sheets confirmed to within 3-5% (B747SP 20.24 vs 21.127,
//            Il-96-400 27.72 vs 26.888). That column was lb/km all along, never dollars.
//   · cc   — CO2 q/km per SEAT-UNIT, times the sold+configured seat composite. A380-800 and
//            Concorde only, fitted. Unchanged.
//   · ccS  — CO2 q/km per CONFIGURED SEAT, times the fixed 285-seat config (Y 57 / J 143 /
//            F 85), per ATL-78's own note. The ATL-78 aircraft use this.
// Both CI factors equal exactly 1.0 at CI 200 — fuel ×(200/500+0.6), CO₂ ×(200/2000+0.9) —
// which is the condition the exports were taken at, so the figures drop straight in and still
// scale correctly for slower cells.
// 'spd' (export cruise, km/h) and 'priceM' (purchase price, $M) are recorded for provenance and
// deliberately NOT wired: contributions keep the game speeds in AIRCRAFT_DATA, and purchase
// price is capital cost, not per-flight cost.
// ── PROFIT LANE GATE (Codex review, 9 Sep 2026 — verified) ────────────────────
// The generic layout Y57/J143/F85 is 285 physical seats but 57 + 143x2 + 85x3 = 598
// CAPACITY UNITS, because J costs two units and F costs three. 598 units is an A380
// configuration — REV['A380-800'].ycap is 600. No smaller aircraft can hold it:
// A330-800neo 406, Il-96-400 436, B747SP 350, MC-21-400 230 are all short.
// soldPerClass() would happily sell that layout on low-frequency cells, so an aircraft
// that cannot physically seat it still books the income, and ccS charges its CO2 against
// the same impossible 285 seats. Profit, and therefore any slider position off pure
// CONTRIB, would be invalid for every aircraft except the A380.
// So the ATL-78 aircraft keep their constants but stay off the profit lane until each
// carries its own capacity. Flip this once every ccS entry has a real ycap and the layout
// is scaled to it; the fitted A380/Concorde entries are untouched either way.
const PROFIT_CAPACITY_READY = false;
const LAYOUT_CAPACITY_UNITS = 598;   // 57 + 143*2 + 85*3
// Revenue entry for an aircraft, honouring the gate above.
function revFor(name){ const r=REV[name]; if(!r) return null; return (r.ccS!=null && !PROFIT_CAPACITY_READY) ? null : r; }
const REV={
  'A380-800':     { ycap:600, cf:21.59, cc:0.0914, acheckH:28750.5, repair:1557 },   // cf = fuel lb/km at CI 200 · cc = CO₂ q/km per seat-unit at CI 200 · fitted from 902-route export   // 400 = typical configured seats after class layout (Nathan, 6 Sep); 600 is the raw purchase capacity
  'Concorde':     { ycap:128, cf:32.4,  cc:0.20,   acheckH:265693,  repair:2945 },
  // ── ATL-78 export constants ──
  'A330-200':     { cf:17.644, ccS:0.53922, acheckH:9959,  repair:294.52, spd:958,   priceM:39 },
  'A330-300':     { cf:18.682, ccS:0.53515, acheckH:13480, repair:292.48, spd:958,   priceM:39 },
  'A330-800neo':  { ycap:406, cf:11.640, ccS:0.26797, acheckH:6692,  repair:575.95, spd:801,   priceM:77 },   // ATL-78 calls it "A330-800"; the game sheet and the sibling row below both say neo
  'A330-900neo':  { cf:12.610, ccS:0.38816, acheckH:8574,  repair:737.88, spd:801,   priceM:98 },
  'A340-300':     { cf:20.758, ccS:0.44524, acheckH:15343, repair:374.42, spd:1004,  priceM:50 },
  'A340-600':     { cf:20.060, ccS:0.50014, acheckH:13674, repair:471.74, spd:871,   priceM:63 },
  'A350-900':     { cf:15.501, ccS:0.37512, acheckH:5127,  repair:475.90, spd:860,   priceM:64 },
  'A350-900R':    { cf:15.501, ccS:0.37512, acheckH:6363,  repair:558.38, spd:860,   priceM:75 },
  'B737-800':     { cf:9.118,  ccS:0.31810, acheckH:985,   repair:29.75,  spd:725,   priceM:4  },
  'B737 MAX 8':   { cf:6.994,  ccS:0.24119, acheckH:1385,  repair:121.58, spd:881,   priceM:16 },
  'B787-8':       { cf:14.744, ccS:0.35726, acheckH:3020,  repair:131.03, spd:822,   priceM:18 },
  'B787-9':       { cf:14.744, ccS:0.35726, acheckH:9800,  repair:472.49, spd:822,   priceM:63 },
  'B787-10':      { cf:18.061, ccS:0.47429, acheckH:17289, repair:491.37, spd:860,   priceM:66 },
  'B747SP':       { ycap:350, cf:21.127, ccS:0.61107, acheckH:9696,  repair:275.56, spd:990,   priceM:37 },
  'Il-96-400':    { ycap:436, cf:26.888, ccS:0.43004, acheckH:9671,  repair:272.98, spd:809,   priceM:36 }
  // B777-200 is contributions-only until an export is confirmed (ATL-78) — no entry, by design.
  // MC-21-400 likewise: its aircraft sheet gives A-check $494,428 over a 400h check
  // (= $1,236.07 per started hour) and 19.57 lb/km, but no per-flight repair figure exists
  // for it anywhere, so a partial entry would compute a profit that silently omits a cost.
  // B747-8 carries ATL-78 constants but is not in AIRCRAFT_DATA and so cannot be selected;
  // its constants stay on the issue rather than sitting here unreachable.
  //
  // Cross-checked against Nathan's in-game aircraft sheets. The A-check column proves out
  // exactly on all three sheets he sent:
  //   B747SP      $3,878,280 / 400h = $9,695.70 -> 9,696
  //   Il-96-400   $4,448,548 / 460h = $9,670.76 -> 9,671
  //   A330-800neo $3,413,028 / 510h = $6,692.21 -> 6,692
  // All three match ATL-78 to the dollar, which validates the whole A-check column.
};
let revP=null, ac_name='', gSpeed=0;
// CI of a cell from its distance and flight time (am4help: CI = 2000d/(7uT) − 600/7, same CI the contribution formula uses)
function cellCI(d,t){ return gSpeed>0?Math.max(0,Math.min(200,(2000/7)*(d/(gSpeed*t))-600/7)):200; }
// Demand cap (Nathan, 6 Sep): three separate demand pools (Y, J, F), each resets daily.
// Seats sold per flight per class = min(configured seats, class demand ÷ flights that day). Contributions unaffected (15 pax).
// Generic class numbers — averages of Nathan's 108-route sheet (Book.xlsx, 6 Sep 2026). Fixed; not player inputs.
const FUEL_P=600, CO2_P=130;             // generic $/1,000 lb and $/1,000 q — prices move every half hour in-game; a fixed point value is the doctrine. Set by Nathan, 9 Sep 2026 (CO₂ 135 -> 130).
const SEATS ={ y:57,  j:143, f:85  };   // configured seats per class
const DEMAND={ y:735, j:377, f:162 };   // route demand per day per class
const TOTAL_SEATS=SEATS.y+SEATS.j+SEATS.f;   // 285 configured seats — the basis for the ATL-78 CO₂ $/km/seat figures
function soldPerClass(t){
  const perDay=Math.max(0.5,flightsIn48(t)/2);
  return { y:Math.min(SEATS.y,DEMAND.y/perDay), j:Math.min(SEATS.j,DEMAND.j/perDay), f:Math.min(SEATS.f,DEMAND.f/perDay) };
}
function seatsSold(t){ const s=soldPerClass(t); return s.y+s.j+s.f; }
function profitPerFlight(d,t){
  if(!revP)return null;
  const s=soldPerClass(t);
  const inc=0.94*( s.y*((0.3*d+150)*1.10) + s.j*((0.6*d+500)*1.08) + s.f*((0.9*d+1000)*1.06) );
  // Fuel and CO₂ scale with CI (am4help): fuel × (CI/500 + 0.6), CO₂ × (CI/2000 + 0.9). Slower cells burn less.
  const ci=cellCI(d,t);
  const seatUnits=(s.y+2*s.j+3*s.f)+(SEATS.y+SEATS.j+SEATS.f);
  // One fuel path: lb/km at the $600 datum, for every aircraft.
  const fuel=revP.cf*d*(ci/500+0.6)*FUEL_P/1000;
  // CO2 differs only in what its per-km figure is per: a seat-unit (fitted) or a configured seat (ATL-78).
  const co2=(revP.ccS!=null ? revP.ccS*d*TOTAL_SEATS : revP.cc*d*seatUnits)*(ci/2000+0.9)*CO2_P/1000;
  const chk=revP.acheckH*Math.ceil(t);
  return inc-fuel-co2-chk-revP.repair;
}
// One count for everything: departures in 48h (Nathan's rule) — money and contributions both use flightsIn48.
function weightW(){ return (+document.getElementById('wslider').value||0)/100; }
// Rank table: every valid cell's 48h total (dead zone excluded), sorted high→low.
let rankList=[];
function buildRank(grid,dists){
  rankList=[]; grid.forEach((row,ti)=>row.forEach((v,di)=>{ if(typeof v==='number'&&v>0&&!isDZ(dists[di])){
    const t=TMS[ti], n=flightsIn48(t), pf=profitPerFlight(dists[di],t); const p48=pf==null?null:pf*n;
    rankList.push({ti,di,t48:v*n,p48}); } }));
  const maxT=Math.max(...rankList.map(r=>r.t48)), maxP=Math.max(...rankList.map(r=>r.p48==null?0:r.p48));
  const w=revP?weightW():0;
  rankList.forEach(r=>{ const cN=r.t48/maxT, pN=(r.p48==null||maxP<=0)?0:Math.max(0,r.p48)/maxP; r.score=revP?((1-w)*cN+w*pN):cN; });
  rankList.sort((a,b)=>b.score-a.score);
}
function inspect(ti,di){
  const v=gGrid[ti][di], d=gDists[di], t=TMS[ti];
  document.querySelectorAll('td.sel').forEach(x=>x.classList.remove('sel'));
  const td=document.getElementById('c-'+ti+'-'+di); if(td)td.classList.add('sel');
  const n=flightsIn48(t), t48=(typeof v==='number')?v*n:0;
  const idx=rankList.findIndex(r=>r.ti===ti&&r.di===di);
  document.getElementById('insp-head').textContent=tl(t)+' × '+d.toLocaleString()+'km';
  document.getElementById('insp-l1').textContent=(typeof v==='number'?fval(v)+' per flight':'No valid flight (CI > 200)');
  document.getElementById('insp-l2').textContent=n+' departures in 48hrs'+(maint?' (maint on)':' (maint off)')+(isDZ(d)?' · DEAD ZONE':'');
  const pf=profitPerFlight(d,t), cc=n;
  document.getElementById('insp-total').textContent=(typeof v==='number'?fval(t48)+' /48hrs':'—')+(pf==null?'':'  ·  $'+Math.round(pf*cc).toLocaleString()+' profit /48hrs');
  document.getElementById('insp-rank').textContent=idx>=0?('RANKED #'+(idx+1)+' OF '+rankList.length+(revP?' — CONTRIB/PROFIT '+(100-Math.round(weightW()*100))+'/'+Math.round(weightW()*100):' — CONTRIBUTIONS')):(isDZ(d)?'DEAD ZONE — NOT RANKED':'NOT RANKED');
  const card=document.getElementById('insp-card'); card.className='bcard'+(idx===0?' gold':'');
  // Floating copy next to the cell
  const pop=document.getElementById('pop');
  ['rank','head','l1','l2','total'].forEach(k=>document.getElementById('pop-'+k).textContent=document.getElementById('insp-'+k).textContent);
  pop.className=idx===0?'gold':'';
  document.getElementById('pop-rank').className='r'+(idx>=0?'':' dz');
  selTi=ti; selDi=di; placeSel();
}
// ── SELECTED-CELL FOCUS (Nathan, 10 Sep 2026) ─────────────────────────────
// One cell in a 2,000-cell table is unfindable on its own, so a selection draws three things:
// a focus zone around the cell and its neighbours, the rest of the map scrimmed back, and a
// leader line from the floating card to the zone. Zone size is ±2 columns, ±1 row — the same
// footprint the magenta hot-zone blob uses, so the two read as the same unit of area.
const ZONE_COLS=2, ZONE_ROWS=1;
let selTi=-1, selDi=-1;
// Where the segment from a (outside) to b (inside r) crosses r's border.
function edgeHit(ax,ay,bx,by,r){
  const dx=bx-ax, dy=by-ay; let best=1;
  const test=u=>{ if(u<0||u>=best)return; const px=ax+dx*u, py=ay+dy*u;
    if(px>=r.x1-1&&px<=r.x2+1&&py>=r.y1-1&&py<=r.y2+1) best=u; };
  if(dx){ test((r.x1-ax)/dx); test((r.x2-ax)/dx); }
  if(dy){ test((r.y1-ay)/dy); test((r.y2-ay)/dy); }
  return {x:ax+dx*best, y:ay+dy*best};
}
function placeSel(){
  const pop=document.getElementById('pop'), svg=document.getElementById('focus');
  const td=selTi<0?null:document.getElementById('c-'+selTi+'-'+selDi);
  if(!td){ if(pop)pop.style.display='none'; if(svg)svg.style.display='none'; return; }
  const r=td.getBoundingClientRect();
  pop.style.display='block';
  const pw=pop.offsetWidth||220, ph=pop.offsetHeight||90;
  let x=r.right+56, y=r.top-ph-28;                       // clear of the cell: right and above
  if(x+pw>window.innerWidth-8) x=r.left-pw-56;
  if(y<8) y=r.bottom+28;
  y=Math.max(8,Math.min(window.innerHeight-ph-8,y));
  pop.style.left=x+'px'; pop.style.top=y+'px';
  drawFocus(td,r);
}
function drawFocus(td,cr){
  const svg=document.getElementById('focus'); if(!svg)return;
  const wrap=td.closest('.table-wrap'), row=td.parentElement;
  if(!wrap){ svg.style.display='none'; return; }
  // Visible slice of the table: inside the scroller, clear of the sticky header row and time column.
  const wr=wrap.getBoundingClientRect();
  const hd=document.getElementById('s-head'), lbl=row.querySelector('td.tlbl');
  const vis={ x1:Math.max(wr.left, lbl?lbl.getBoundingClientRect().right:wr.left),
              y1:Math.max(wr.top,  hd ?hd .getBoundingClientRect().bottom:wr.top),
              x2:Math.min(wr.right, window.innerWidth), y2:Math.min(wr.bottom, window.innerHeight) };
  const cx=(cr.left+cr.right)/2, cy=(cr.top+cr.bottom)/2;
  // Scrolled out of the visible slice — the card still floats, but there is nothing to ring.
  if(cx<vis.x1||cx>vis.x2||cy<vis.y1||cy>vis.y2){ svg.style.display='none'; return; }
  let z={x1:cr.left,y1:cr.top,x2:cr.right,y2:cr.bottom};
  for(let ti=selTi-ZONE_ROWS;ti<=selTi+ZONE_ROWS;ti++)
    for(let di=selDi-ZONE_COLS;di<=selDi+ZONE_COLS;di++){
      const n=document.getElementById('c-'+ti+'-'+di); if(!n)continue;
      const b=n.getBoundingClientRect();
      z.x1=Math.min(z.x1,b.left); z.y1=Math.min(z.y1,b.top); z.x2=Math.max(z.x2,b.right); z.y2=Math.max(z.y2,b.bottom);
    }
  z={ x1:Math.max(z.x1,vis.x1), y1:Math.max(z.y1,vis.y1), x2:Math.min(z.x2,vis.x2), y2:Math.min(z.y2,vis.y2) };
  const W=window.innerWidth, H=window.innerHeight;
  svg.setAttribute('width',W); svg.setAttribute('height',H); svg.setAttribute('viewBox','0 0 '+W+' '+H);
  const set=(id,a)=>{ const e=document.getElementById(id); for(const k in a)e.setAttribute(k,a[k]); };
  set('fmask-all',{x:0,y:0,width:W,height:H});
  set('fmask-hole',{x:z.x1-4,y:z.y1-4,width:(z.x2-z.x1)+8,height:(z.y2-z.y1)+8});
  set('f-scrim',{x:vis.x1,y:vis.y1,width:Math.max(0,vis.x2-vis.x1),height:Math.max(0,vis.y2-vis.y1)});
  set('f-ring',{x:z.x1-4,y:z.y1-4,width:(z.x2-z.x1)+8,height:(z.y2-z.y1)+8});
  set('f-cell',{x:cr.left+1,y:cr.top+1,width:Math.max(0,cr.width-2),height:Math.max(0,cr.height-2)});
  // Leader line: nearest point on the card's border, in to the edge of the zone. The card is
  // normally parked right beside the cell, where a line would be a stub — it only earns its
  // keep when the card gets pushed away by a viewport edge, so it is drawn from 26px of gap up.
  const pr=document.getElementById('pop').getBoundingClientRect();
  const ax=Math.max(pr.left,Math.min(pr.right,cx)), ay=Math.max(pr.top,Math.min(pr.bottom,cy));
  const zr={x1:z.x1-4,y1:z.y1-4,x2:z.x2+4,y2:z.y2+4};
  const inside=ax>=zr.x1&&ax<=zr.x2&&ay>=zr.y1&&ay<=zr.y2;   // card sitting on the zone — nothing to point at
  const hit=edgeHit(ax,ay,cx,cy,zr);
  const gap=Math.hypot(hit.x-ax,hit.y-ay);
  set('f-lead',{d:(!inside&&gap>26)?('M'+ax+' '+ay+' L'+hit.x+' '+hit.y):''});
  svg.style.display='block';
}
function hidePop(){ const p=document.getElementById('pop'); if(p)p.style.display='none';
  const f=document.getElementById('focus'); if(f)f.style.display='none';
  selTi=-1; selDi=-1;
  document.querySelectorAll('td.sel').forEach(x=>x.classList.remove('sel')); }
// ── MEMBER GUIDE ──────────────────────────────────────────────────────────
// Opens itself once per browser on a first visit, so a member who has never seen the
// table gets the explanation without having to know to ask for it; after that it is
// the ? button in the top bar. Clearing site data brings the first visit back.
const GUIDE_SEEN='bg_am4_guide_v1';
function guideOpen(){ const g=document.getElementById('guide'); return !!g&&g.classList.contains('open'); }
function openGuide(){ const g=document.getElementById('guide'); if(!g)return; g.classList.add('open');
  const c=document.getElementById('g-content'); if(c)c.scrollTop=0; gSpy();
  try{ localStorage.setItem(GUIDE_SEEN,'1'); }catch(e){}
  const b=document.querySelector('.g-close'); if(b)b.focus(); }
function closeGuide(){ const g=document.getElementById('guide'); if(g)g.classList.remove('open');
  const b=document.getElementById('guide-btn'); if(b)b.focus(); }
// Index click -> scroll the article, not the page.
let gPin=null;   // the section you asked for, held while it is still on screen
document.querySelectorAll('#g-index a').forEach(a=>a.addEventListener('click',()=>{
  const h=document.getElementById(a.dataset.g), c=document.getElementById('g-content');
  if(h&&c) c.scrollTop += h.getBoundingClientRect().top - c.getBoundingClientRect().top - 8;
  gPin=a.dataset.g; gMark(gPin);
}));
function gMark(id){ document.querySelectorAll('#g-index a').forEach(a=>a.classList.toggle('on',a.dataset.g===id)); }
// Mark the section you are actually reading.
function gSpy(){
  const c=document.getElementById('g-content'); if(!c)return;
  const ct=c.getBoundingClientRect(), top=ct.top+30, hs=[...c.querySelectorAll('h3')]; let on=null;
  // A section you jumped to stays marked while it is on screen. The last sections can never be
  // scrolled to the top of the pane, so without this, asking for 9 would highlight 8.
  if(gPin){ const h=document.getElementById(gPin);
    if(h){ const r=h.getBoundingClientRect(); if(r.bottom>ct.top&&r.top<ct.bottom){ gMark(gPin); return; } }
    gPin=null; }
  hs.forEach(h=>{ if(h.getBoundingClientRect().top<=top) on=h.id; });
  if(!on&&hs.length) on=hs[0].id;
  gMark(on);
}
(function(){ const c=document.getElementById('g-content'); if(c)c.addEventListener('scroll',gSpy,{passive:true}); })();
(function(){ let seen=true; try{ seen=!!localStorage.getItem(GUIDE_SEEN); }catch(e){}
  if(!seen) setTimeout(openGuide,400); })();

document.addEventListener('keydown',e=>{ if(e.key!=='Escape')return; if(guideOpen()){closeGuide();return;} hidePop(); });
document.addEventListener('click',e=>{ if(e.target.closest('#guide')||e.target.closest('.guide-btn'))return;
  if(!e.target.closest('td.cell')&&!e.target.closest('.bcard')&&e.target.id!=='mini')hidePop(); });
document.querySelectorAll('.table-wrap').forEach(w=>w.addEventListener('scroll',()=>{ if(selTi>=0)placeSel(); }));
window.addEventListener('scroll',()=>{ if(selTi>=0)placeSel(); },{passive:true});
window.addEventListener('resize',()=>{ if(selTi>=0)placeSel(); });
function tl(h){ const hr=Math.floor(h); return hr+'h '+(h%1===0?'00m':'30m'); }
function fmins(m){ const h=Math.floor(m/60),mn=Math.round(m%60); return h+'h '+String(mn).padStart(2,'0')+'m'; }
function fval(v){ return typeof v==='number'?'$'+v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):String(v); }

// Departures rule (Nathan): N departures in 48h = N−1 full cycles inside the window + the final departure that only has to leave.
// N is always ODD — 3, 5, 7, 9 … — the extra flight is the point. Longest flight time that fits N: avail/(N−1) − 3 min buffer.
// 4× SPEED (Nathan, 6 Sep): one lot = 4 hours; players buy 1–6 lots a day. The 1-hour and 24-hour lots are ONE-OFF bonuses — a single window, not daily.
// Every aircraft that DEPARTS inside the window flies its whole flight at 4×, so a flight of table time t takes t/4 and,
// if that fits, departs again inside the same window. Departures after the window run at normal speed.
// 48h count = boosted departures across all windows + normal cycles in the remaining time + the final departure.
function boostCfg(){ const v=(document.getElementById('boost')||{}).value||'0'; if(v==='0')return {win:0,n:0}; if(v==='b1')return {win:60,n:1}; if(v==='b24')return {win:1440,n:1}; const [h,n]=v.split('x').map(Number); return {win:h*60,n:n*2}; }
function departures48(t,mt){
  const avail=2880-(mt?30:0)-26, cyc=t*60+3, b=boostCfg();
  if(!b.win) return cyc>avail?1:Math.floor(avail/cyc)+1;
  const fast=t*15+3;                       // boosted cycle in minutes
  const perWin=Math.floor(b.win/fast)+1;   // departures inside one window (the last only has to leave inside it)
  const winTime=perWin*fast;               // clock consumed by one window's boosted flights
  let boosted=0, used=0;
  for(let i=0;i<b.n;i++){ if(used+winTime>avail)break; boosted+=perWin; used+=winTime; }
  const normal=Math.max(0,Math.floor((avail-used)/cyc));
  return boosted+normal+1;
}
// Longest table time that still yields at least N departures in 48h.
function optMinsDep(N,mt){ let best=-1; for(let ti=TMS.length-1;ti>=0;ti--){ if(departures48(TMS[ti],mt)>=N){ best=TMS[ti]*60; break; } } return best; }
function optMins(fpd,mt){ return optMinsDep(fpd,mt); }  // legacy name — 'fpd' now carries N departures
function closestRow(om){ let b=0,bd=Infinity; TMS.forEach((t,i)=>{const d=Math.abs(t-om/60);if(d<bd){bd=d;b=i;}}); return b; }
// Departures spread over the two days. Odd counts are the no-boost norm (the extra flight that
// only has to depart); 4x speed can produce an even count, which must not render as "3.5½".
function perDay(n){ return (n%2 ? Math.floor(n/2)+'½' : String(n/2))+' a day'; }
function peakRow(g,ri,ds){ if(!g||ri<0||ri>=g.length)return 0; return Math.max(0,...g[ri].filter((v,di)=>typeof v==='number'&&!(ds&&isDZ(ds[di])))); }

function setMode(m){
  cMode=m;
  document.getElementById('btn-r').classList.toggle('active',m==='Realism');
  document.getElementById('btn-e').classList.toggle('active',m==='Easy');
  const ac=document.getElementById('ac-sel').value;
  if(ac){ const sp=ACM[ac]; document.getElementById('spd').textContent=(m==='Easy'?sp.e:sp.r).toLocaleString(); loadGrid(ac,m); }
}

function toggleMaint(){ maint=!maint; const b=document.getElementById('mbt'); b.textContent=maint?'YES':'NO'; b.className='maint-btn'+(maint?' on':''); if(sGrid){buildRank(sGrid,sDists);populateDD(sGrid,sDists);onDDChange();} }

// ── HEAT GRADIENT ─────────────────────────────────────────────────────────
// Continuous hue: white (cold) → greens → yellow → orange → red (hot).
// Colour = percentile rank of the cell within its zone (single-leg or stopover).
// Dead zone (6,001–9,999km) is coloured on the same gradient as every other cell.
const STOPS=[[0,[236,252,236]],[0.30,[150,255,120]],[0.55,[26,255,0]],[0.75,[255,255,0]],[0.88,[254,169,0]],[1,[241,21,1]]];
// HEAT MODEL (Nathan, 5 Sep): colour is centred on the picks and blends outward.
//   base  = cell's value rank across the whole table (one continuous scale, no zone cut)
//   glow  = closeness to a heat centre — the selected row's PEAK sub-6,000, PEAK 10,000+ and TOP 3,
//           plus the two whole-table zone peaks (weighted lower so the picks dominate when a row is chosen)
//   heat  = max(glow, base*0.75)  → centres are red, falling through orange → yellow → green with distance
const SIG_R=5.5, SIG_C=5.5;  // blend radius in rows / columns
function glowAt(ti,di,centres){
  let g=0; for(const c of centres){ const dr=(ti-c.ti)/SIG_R, dc=(di-c.di)/SIG_C; g=Math.max(g,c.w*Math.exp(-(dr*dr+dc*dc)/2)); } return g;
}
function heatP(base,glow){ return Math.max(glow, Math.pow(base,1.8)); }  // whole table graded by rank: cold → green → yellow → orange → red at the top
const DZ_CAP=0.42;  // dead zone (6,001–9,999km) is capped at green — never orange or red, never a heat centre
function heatArr(p){
  p=Math.max(0,Math.min(1,p));
  for(let i=1;i<STOPS.length;i++){ if(p<=STOPS[i][0]){ const [p0,c0]=STOPS[i-1],[p1,c1]=STOPS[i]; const t=(p-p0)/(p1-p0);
    return c0.map((c,k)=>Math.round(c+(c1[k]-c)*t)); } }
  return [241,21,1];
}
function heatRGB(p){ const a=heatArr(p); return 'rgb('+a.join(',')+')'; }
function isDark(p){ const a=heatArr(p); return (0.299*a[0]+0.587*a[1]+0.114*a[2])<140; }
// Sorted positive values of a column range → percentile lookup (binary search).
function zoneScale(g,dists,pred){
  const n=[]; g.forEach(row=>row.forEach((v,di)=>{ if(typeof v==='number'&&v>0&&pred(dists[di]))n.push(v); })); n.sort((a,b)=>a-b);
  return { n, pct(v){ if(!n.length)return 0; let lo=0,hi=n.length; while(lo<hi){const m=(lo+hi)>>1; if(n[m]<v)lo=m+1; else hi=m;} return n.length>1?lo/(n.length-1):1; } };
}
// Zone peak (best cell in column range, DZ excluded for single-leg) and global top-3 (both zones, DZ excluded).
function zonePeak(g,dists,pred){ let b=-Infinity,at=null; g.forEach((row,ti)=>row.forEach((v,di)=>{ if(typeof v==='number'&&v>b&&pred(dists[di])&&!isDZ(dists[di])){b=v;at=ti+':'+di;} })); return at; }
// TOP 3 across the SELECTED flight-time row only (dead zone excluded) — 21 Jun spec.
function rowTop3(g,ti,dists){
  const m={}; if(ti<0||!g[ti])return m; const all=[];
  g[ti].forEach((v,di)=>{ if(typeof v==='number'&&v>0&&!isDZ(dists[di]))all.push({v,di}); });
  all.sort((a,b)=>b.v-a.v); all.slice(0,3).forEach((x,i)=>m[ti+':'+x.di]=i+1); return m;
}
// Best cell by combined score inside a distance band (whole table or one row). rankList is score-sorted.
function scorePeak(dists,pred,ti){ const r=rankList.find(r=>pred(dists[r.di])&&(ti==null||r.ti===ti)); return r?r.ti+':'+r.di:null; }
function scoreTop3Row(ti){ const m={}; rankList.filter(r=>r.ti===ti).slice(0,3).forEach((r,i)=>m[r.ti+':'+r.di]=i+1); return m; }
function rowBestRange(g,ti,dists,pred){ let b=-Infinity,at=-1; if(!g[ti])return -1; g[ti].forEach((v,di)=>{ if(typeof v==='number'&&v>b&&pred(dists[di])){b=v;at=di;} }); return at; }

function isDZ(d){ return d>6000&&d<10000; }
function isSV(d){ return d>=10000; }
function buildHead(dists){
  const tr=document.getElementById('s-head');
  while(tr.children.length>1)tr.removeChild(tr.lastChild);
  dists.forEach(d=>{
    const th=document.createElement('th');
    th.textContent=d.toLocaleString();
    if(d===6500)th.classList.add('b6'); if(d===10000)th.classList.add('b10');
    if(isDZ(d)){ th.classList.add('dz'); th.title='Dead zone 6,001–9,999km — restricted, shown on same heat scale'; }
    tr.appendChild(th);
  });
}

function buildBody(grid,dists,sScale,vScale,optRowIdx,sPeak,vPeak,topMap){
  // Circles are ALWAYS whole-table (Nathan, 6 Sep): SHORT = best sub-6,000, LONG = best 10,000+, 1·2·3 = top 3 overall, on the balance score.
  const pkS=scorePeak(dists,d=>d<=6000), pkV=scorePeak(dists,d=>d>=10000);
  const rbS=pkS?+pkS.split(':')[1]:-1, rbV=pkV?+pkV.split(':')[1]:-1;
  const rowS=pkS?+pkS.split(':')[0]:-1, rowV=pkV?+pkV.split(':')[0]:-1;
  const centres=[];
  const pk=k=>{ if(!k)return null; const [a,b]=k.split(':').map(Number); return {ti:a,di:b}; };
  if(pkS)centres.push({ti:rowS,di:rbS,w:1}); if(pkV)centres.push({ti:rowV,di:rbV,w:1});
  topMap={}; rankList.slice(0,3).forEach((r,i)=>{ centres.push({ti:r.ti,di:r.di,w:i===0?1:0.85}); topMap[r.ti+':'+r.di]=i+1; });
  let html='';
  TMS.forEach((t,ti)=>{
    const isOpt=ti===optRowIdx; 
    html+='<tr><td class="tlbl'+(isOpt?' opt':'')+'">'+tl(t)+'</td>';
    dists.forEach((d,di)=>{
      const v=grid[ti][di]; const sv=isSV(d); let cls='',sty='',txt='',attr='';
      if(v==='X'){cls+=' vx';txt='X';}
      else if(typeof v==='number'){
        txt=v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
        if(v<0){cls+=' vng';}
        else{ let p=heatP(sScale.pct(v),glowAt(ti,di,centres)); if(isDZ(d))p=Math.min(p,DZ_CAP); sty=' style="background:'+heatRGB(p)+'"'; if(p>=0.85)cls+=' hot'; if(isDark(p))cls+=' lt'; }
        if(isOpt)cls+=' opt-cell';
        // Hot-zone blob: peak cell of the selected row ±2 cols, ±1 row (yellow); peak itself bright yellow.
        if(!isDZ(d)){
          if(pkS&&Math.abs(di-rbS)<=2&&Math.abs(ti-rowS)<=1) cls+=(ti===rowS&&di===rbS)?' blob2':' blob';
          if(pkV&&Math.abs(di-rbV)<=2&&Math.abs(ti-rowV)<=1) cls+=(ti===rowV&&di===rbV)?' blob2':' blob';
        }
        const r=topMap[ti+':'+di]; if(r){cls+=' top3';attr=' data-rank="'+r+'"';}
      }
      else{cls+=' vem';}
      html+='<td id="c-'+ti+'-'+di+'" class="cell'+cls+(typeof v==='number'?' num':'')+'"'+sty+attr+' onclick="inspect('+ti+','+di+')">'+txt+'</td>';
    });
    html+='</tr>';
  });
  document.getElementById('s-body').innerHTML=html;
  drawMini(grid,dists,sScale,centres,optRowIdx,rbS,rbV,topMap);
}

function populateDD(sg,sd){
  const sel=document.getElementById('opt-dd'); sel.innerHTML='';
  const none=document.createElement('option'); none.value='0'; none.textContent='— whole table —'; sel.appendChild(none);
  const res=[];
  const seen=new Set();
  // N here is only a search key: optMinsDep(N) returns the LONGEST time that flies AT LEAST
  // N departures. With no 4x speed that lands exactly on N, because departures fall as flight
  // time rises. With 4x speed on it does not — a boost window lets a long flight squeeze in
  // extra departures — so the row found for N=3 can really fly 8, and labelling or costing it
  // as 3 understates it by a factor of nearly three. Every count shown, and every multiplier
  // used, therefore comes from what the row ACTUALLY flies, not from N. (Nathan, 10 Sep 2026)
  for(let N=3;N<=61;N+=2){
    const om=optMinsDep(N,maint); if(om<60)break; if(seen.has(om))continue; seen.add(om);
    const ri=closestRow(om); const dep=flightsIn48(TMS[ri]); const pk=peakRow(sg,ri,sd); const t48=pk*dep;
    const lbl=fmins(om)+' = '+dep+' departures in 48hrs | '+fval(t48);
    const opt=document.createElement('option'); opt.value=N; opt.textContent=lbl; sel.appendChild(opt);
    res.push({fpd:N,dep,om,ri,pk,t48,lbl});
  }
  buildBestCards(res,sg,sd);
  return res;
}

function buildBestCards(res,sg,sd){
  // Cards rank on the same balance score as the circles: contributions/48h and profit/48h at the slider setting.
  res.forEach(r=>{ let best=null; rankList.forEach(x=>{ if(x.ti===r.ri&&(!best||x.score>best.score))best=x; }); r.score=best?best.score:0; r.bestDi=best?best.di:-1; });
  const top=[...res].sort((a,b)=>b.score-a.score).slice(0,3);
  const c=document.getElementById('best-cards'); c.innerHTML='';
  top.forEach((r,i)=>{
    let bd='—'; let bv=0; let bdi=-1;
    if(r.bestDi>=0){bdi=r.bestDi;bd=sd[bdi];bv=sg[r.ri][bdi];}
    const d=document.createElement('div'); d.className='bcard'; d.dataset.n=r.fpd;
    d.title='Click to jump to this cell on the chart';
    d.innerHTML='<div class="bcard-rank">'+(i===0?'#1 BEST':i===1?'#2':'#3')+'</div>'+
      '<div class="bcard-time">'+fmins(r.om)+'</div>'+
      '<div class="bcard-meta">'+r.dep+' departures in 48hrs · '+perDay(r.dep)+(boostCfg().n>0?' · 4× on':'')+'</div>'+
      (bd!=='—'?'<div class="bcard-meta">Best dist: '+bd.toLocaleString()+'km</div>':'')+
      '<div class="bcard-total">'+fval(bv*r.dep)+' /48hrs</div>';
    d.onclick=()=>jumpTo(r.fpd,r.ri,bdi);
    c.appendChild(d);
  });
}

// Thermal mini-map: one pixel block per cell, magenta glow on hot zones, gold line on optimal row.
function drawMini(grid,dists,sScale,centres,optRowIdx,rbS,rbV,topMap){
  const cv=document.getElementById('mini'); if(!cv)return; const ctx=cv.getContext&&cv.getContext('2d'); if(!ctx)return;
  const W=cv.width,H=cv.height,nc=dists.length,nr=grid.length,cw=W/nc,ch=H/nr;
  ctx.fillStyle='#0B1E3A'; ctx.fillRect(0,0,W,H);
  grid.forEach((row,ti)=>row.forEach((v,di)=>{
    if(typeof v==='number'&&v>0){ let p=heatP(sScale.pct(v),glowAt(ti,di,centres)); if(isDZ(dists[di]))p=Math.min(p,DZ_CAP); ctx.fillStyle=heatRGB(p); ctx.fillRect(di*cw,ti*ch,Math.ceil(cw),Math.ceil(ch)); }
    else if(v==='X'){ ctx.fillStyle='#2A0A12'; ctx.fillRect(di*cw,ti*ch,Math.ceil(cw),Math.ceil(ch)); }
  }));
  // zone rules
  ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1;
  [dists.indexOf(6500),dists.indexOf(10000)].forEach(i=>{ if(i>0){ ctx.beginPath(); ctx.moveTo(i*cw,0); ctx.lineTo(i*cw,H); ctx.stroke(); } });
  if(optRowIdx>=0){
    ctx.fillStyle='rgba(255,196,34,.35)'; ctx.fillRect(0,optRowIdx*ch,W,Math.ceil(ch));
    [rbS,rbV].forEach(di=>{ if(di>=0){ ctx.shadowColor='#FF00CE'; ctx.shadowBlur=10; ctx.strokeStyle='#FF00CE'; ctx.lineWidth=2; ctx.strokeRect(di*cw-2,optRowIdx*ch-2,cw+4,ch+4); ctx.shadowBlur=0; } });
    Object.keys(topMap).forEach(k=>{ const [ti,di]=k.split(':').map(Number); ctx.fillStyle='#FFF'; ctx.fillRect(di*cw+cw/2-1.5,ti*ch+ch/2-1.5,3,3); });
  }
  cv.onclick=e=>{ const r=cv.getBoundingClientRect(); const di=Math.floor((e.clientX-r.left)/r.width*nc), ti=Math.floor((e.clientY-r.top)/r.height*nr);
    const td=document.getElementById('c-'+ti+'-'+di); if(td){ td.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}); td.classList.remove('flash'); void td.offsetWidth; td.classList.add('flash'); inspect(ti,di); } };
}

// Best-card click: select that flights/day, highlight its row, scroll to and flash the best cell.
function jumpTo(fpd,ri,di){
  const sel=document.getElementById('opt-dd'); sel.value=String(fpd); onDDChange();
  document.querySelectorAll('.best-cards .bcard').forEach(c=>c.classList.toggle('gold',c.dataset.n===String(fpd)));
  const td=document.getElementById('c-'+ri+'-'+di); if(!td)return;
  td.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
  td.classList.remove('flash'); void td.offsetWidth; td.classList.add('flash');
  inspect(ri,di);
}

function onDDChange(){
  const fpd=parseInt(document.getElementById('opt-dd').value)||0;
  const el=document.getElementById('ores');
  if(!fpd||!sGrid){el.textContent='—';optIdx=-1;reOpt();return;}
  const om=optMins(fpd,maint); optIdx=closestRow(om);
  const dep=flightsIn48(TMS[optIdx]);   // what the row flies, not the N it was found by
  const pk=peakRow(sGrid,optIdx,sDists); el.textContent=fmins(om)+' · '+dep+' departures · '+fval(pk*dep)+' /48hrs';
  reOpt();
}

function reOpt(){
  if(!gGrid)return;
  buildBody(gGrid,gDists,sScale,vScale,optIdx,sPeak,vPeak,topMap);
}

async function loadGrid(ac,mode){
  document.getElementById('lov').style.display='flex';
  document.getElementById('smsg').textContent='LOADING...';
  try{
    const r=await fetch('/api/calc?k='+encodeURIComponent(KEY)+'&aircraft='+encodeURIComponent(ac)+'&mode='+encodeURIComponent(mode));
    const D=await r.json();
    const grid=D.grid, dists=D.dists, mx=D.maxRange;
    sGrid=grid; sDists=dists; gGrid=grid; gDists=dists;
    hidePop();
    // Order matters, and used to be wrong: populateDD() builds the BEST SETUP cards out of
    // rankList, so on a first load it ran against an empty list and every card showed
    // $0.00 with no best distance until the slider was nudged. The aircraft's revenue
    // constants and speed have to be in place before buildRank() can score profit, and
    // buildRank() has to have run before the cards are built from it.
    ac_name=ac; revP=revFor(ac); gSpeed=D.speed||0;
    document.getElementById('revnote').textContent=revP?('Revenue lane active for '+ac+' — '+revP.cf+' lb/km @CI200, CO₂ '+(revP.ccS!=null?(revP.ccS+' q/km/seat'):(revP.cc+' q/km/seat-unit'))+', A-check $'+Math.round(revP.acheckH).toLocaleString()+' per started hour, repair $'+revP.repair.toLocaleString()):((REV[ac]&&REV[ac].ccS!=null)?('Constants loaded for '+ac+' — profit lane held until it carries its own seat capacity; ranking on contributions only'):('No revenue data for '+ac+' yet — ranking on contributions only'));
    buildRank(grid,dists);
    populateDD(grid,dists);
    const fpd=parseInt(document.getElementById('opt-dd').value)||0;   // read after populateDD rebuilds the options
    optIdx=fpd?closestRow(optMins(fpd,maint)):-1;
    sScale=zoneScale(grid,dists,d=>true); vScale=sScale;  // one continuous value scale — no zone cut in the colour
    sPeak=scorePeak(dists,d=>d<=6000); vPeak=scorePeak(dists,d=>d>=10000);
    buildHead(dists);
    buildBody(grid,dists,sScale,vScale,optIdx,sPeak,vPeak,topMap);
    document.getElementById('hm1sub').textContent='500 – 6,000km · 6,001 – 9,999km dead zone · 10,000 – 20,000km · max range '+mx.toLocaleString()+'km';
    document.getElementById('smsg').textContent=ac.toUpperCase()+' — '+mode.toUpperCase();
    onDDChange();
  }catch(e){ document.getElementById('smsg').textContent='ERROR — RELOAD PAGE'; }
  finally{ document.getElementById('lov').style.display='none'; }
}

function rerank(){ if(!gGrid)return; buildRank(gGrid,gDists); populateDD(gGrid,gDists); document.getElementById('wlbl').textContent=(100-Math.round(weightW()*100))+' / '+Math.round(weightW()*100); reOpt(); if(selTi>=0)inspect(selTi,selDi); }
function setBalance(v){ const w=document.getElementById('wslider'); w.value=v; rerank(); }
document.getElementById('wslider').addEventListener('input',rerank);
document.getElementById('boost').addEventListener('change',()=>{ if(!sGrid)return; buildRank(sGrid,sDists); populateDD(sGrid,sDists); onDDChange(); });

document.getElementById('ac-sel').addEventListener('change',function(){
  const sp=ACM[this.value];
  document.getElementById('spd').textContent=(cMode==='Easy'?sp.e:sp.r).toLocaleString();
  loadGrid(this.value,cMode);
});

window.addEventListener('DOMContentLoaded',()=>{
  const sel=document.getElementById('ac-sel');
  if(sel.options.length){ const a=sel.options[0].value; document.getElementById('spd').textContent=ACM[a].r.toLocaleString(); loadGrid(a,cMode); }
});
document.addEventListener('contextmenu',e=>e.preventDefault());
</script>
</body>
</html>`;
}

module.exports = { buildCalcPage };

