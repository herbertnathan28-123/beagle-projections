'use strict';
// Regression tests for public/stopover.html — drives the page's own solve()
// against DOM stubs so the tests exercise the shipped code, not a copy.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'stopover.html'), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

// ATL-148: the page fetches aircraft specs and route demand from the server.
const ACFT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'stopover-aircrafts.json'), 'utf8'));
// Demand responses for the work order's reference routes (server output shape).
const DEMANDS = {
  'VVNB>SPIM': { y: 1193, j: 222, f: 277, l: 597000, h: 222000 },
  'ZGSZ>SCEL': { y: 841, j: 639, f: 220, l: 421000, h: 639000 },
  // Remaining ATL-148 reference pairs (ICAO>ICAO keys; cargo values unused by pax tests)
  'RPLL>SGAS': { y: 1077, j: 498, f: 161, l: 539000, h: 498000 },
  'MROC>WIII': { y: 1523, j: 477, f: 169, l: 762000, h: 477000 },
  'VMMC>SGAS': { y: 1881, j: 355, f: 167, l: 941000, h: 355000 },
  'ZGSZ>SLLP': { y: 1150, j: 463, f: 216, l: 575000, h: 463000 },
  'VMMC>SCEL': { y: 813, j: 812, f: 105, l: 407000, h: 812000 },
  'SCEL>ZHHH': { y: 1389, j: 220, f: 88, l: 695000, h: 220000 },
  'SVMI>WIII': { y: 966, j: 685, f: 309, l: 483000, h: 685000 },
  // ATL-153 reference route JFK→MEL (via ROW on the A380-800)
  'KJFK>YMML': { y: 660, j: 270, f: 147, l: 330000, h: 270000 },
  // ATL-148 4 Oct defect route JFK→AKL (direct on the A380-800)
  'KJFK>NZAA': { y: 905, j: 142, f: 129, l: 453000, h: 142000 },
  // Synthetic thin route for the contribution-floor flag
  'VHHH>WPEC': { y: 40, j: 10, f: 5, l: 20000, h: 10000 },
};

// Generic canvas-2d stand-in: every method returns another stub, property sets are swallowed.
function fakeCtx() {
  return new Proxy({}, {
    get: (t, k) => (k === 'canvas' ? null : (...a) => fakeCtx()),
    set: () => true,
  });
}

function el(id) {
  const o = {
    id, value: '', textContent: '', innerHTML: '', className: '', style: {},
    children: [], clientWidth: 1000, clientHeight: 400, type: '', label: '',
    setAttribute() {}, getAttribute() { return null; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, getContext() { return fakeCtx(); },
    click() {}, onclick: null,
  };
  o.classList = {
    contains: (c) => o.className.split(' ').includes(c),
    add: (c) => {
      const a = o.className.split(' ').filter(Boolean);
      if (!a.includes(c)) { a.push(c); o.className = a.join(' '); }
    },
    remove: (c) => {
      const a = o.className.split(' ').filter(Boolean);
      const i = a.indexOf(c);
      if (i >= 0) { a.splice(i, 1); o.className = a.join(' '); }
    },
  };
  return o;
}

let lastUrl = '';
const ELS = {};
const documentStub = {
  getElementById: (id) => ELS[id] || (ELS[id] = el(id)),
  createElement: (tag) => el(tag),
  createDocumentFragment: () => ({ appendChild() {} }),
  documentElement: {},
  addEventListener() {},
  hidden: false,
  fonts: { ready: Promise.resolve() },
};

const ctx = vm.createContext({
  document: documentStub,
  matchMedia: () => ({ matches: true }), // prefers-reduced-motion: skips animation frames
  getComputedStyle: () => ({ getPropertyValue: () => '#123456' }),
  IntersectionObserver: class { observe() {} },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  performance,
  devicePixelRatio: 1,
  history: { replaceState(_s, _t, u) { lastUrl = String(u); } },
  location: { search: '' },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  URLSearchParams,
  fetch: (u) => {
    const url = String(u);
    if (url.startsWith('/api/stopover/aircrafts'))
      return Promise.resolve({ ok: true, json: async () => ACFT });
    if (url.startsWith('/api/stopover/demand')) {
      const q = new URLSearchParams(url.split('?')[1]);
      const d = DEMANDS[`${q.get('from')}>${q.get('to')}`] || null;
      return Promise.resolve({ ok: !!d, json: async () => d });
    }
    return Promise.resolve({ ok: false, json: async () => null });
  },
  setTimeout, clearTimeout, setInterval, clearInterval,
  addEventListener() {},
  console,
});
vm.runInContext(src, ctx);

function drive({ from, to, range, rwy }) {
  ELS.from.value = from;
  ELS.to.value = to;
  ELS.range.value = range;
  ELS.rwy.value = rwy;
  ctx.solve(0);
  return ELS.msg;
}

test('HKG→MEL, range "14,500" km, runway "9,680" ft → fly direct, no stopover (ATL-150 regression)', () => {
  const msg = drive({ from: 'HKG', to: 'MEL', range: '14,500', rwy: '9,680' });
  assert.match(msg.className, /ok/);
  assert.match(msg.innerHTML, /Fly it direct/);
  assert.match(ELS.nS.textContent, /No stopover needed/);
  assert.match(ELS.sRange.innerHTML, /14,500/, 'the page must use the entered 14,500 km range');
});

test('plain digits parse the same', () => {
  const msg = drive({ from: 'HKG', to: 'MEL', range: '14500', rwy: '9680' });
  assert.match(msg.className, /ok/);
  assert.match(msg.innerHTML, /Fly it direct/);
});

test('range below the requirement still shows the Range too short panel', () => {
  const msg = drive({ from: 'HKG', to: 'MEL', range: '2036', rwy: '9680' });
  assert.match(msg.className, /err/);
  assert.match(msg.innerHTML, /Range too short/);
});

const flush = () => new Promise((r) => setImmediate(r));

// ATL-148: demand + best seat configuration lines (WO reference table, A388 Realism).
test('VVNB\u2192SPIM shows the WO reference demand and best config', async () => {
  await flush(); await flush(); // let the aircraft-specs fetch apply A380-800
  ctx.setMode('realism', false);
  drive({ from: 'VVNB', to: 'SPIM', range: '14,500', rwy: '9,680' });
  await flush(); await flush();
  assert.match(ELS.demV.innerHTML, /Y 1,193 \/ J 222 \/ F 277/);
  assert.match(ELS.cfgV.innerHTML, /Y 317 \/ J 59 \/ F 55/);
  assert.match(ELS.cfgV.innerHTML, /1 dep\/day \u00d7 4 A\/C/);
});

test('ZGSZ\u2192SCEL matches its WO reference too', async () => {
  drive({ from: 'ZGSZ', to: 'SCEL', range: '14500', rwy: '9680' });
  await flush(); await flush();
  assert.match(ELS.demV.innerHTML, /Y 841 \/ J 639 \/ F 220/);
  assert.match(ELS.cfgV.innerHTML, /Y 223 \/ J 169 \/ F 13/);
});

// ATL-152: expected load factor per class + overall, all 9 WO reference cases
// (A380-800, Realism). Expected values computed from the spec formula:
// per-class load = (daily demand / total departures) / configured seats, capped at 100%;
// overall = (Y + 2J + 3F carried) / (Y + 2J + 3F seats); unconfigured class shows —.
test('load factor per class + overall for all 9 ATL-148 reference cases', async () => {
  await flush(); await flush();
  ctx.setMode('realism', false);
  const cases = [
    ['VVNB', 'SPIM', 'Y 94% \u00b7 J 94% \u00b7 F 100% \u00b7 overall 96%'],
    ['RPLL', 'SGAS', 'Y 94% \u00b7 J 94% \u00b7 F 100% \u00b7 overall 95%'],
    ['MROC', 'WIII', 'Y 94% \u00b7 J 94% \u00b7 F 100% \u00b7 overall 95%'],
    ['VMMC', 'SGAS', 'Y 94% \u00b7 J 95% \u00b7 F 100% \u00b7 overall 95%'],
    ['ZGSZ', 'SLLP', 'Y 94% \u00b7 J 94% \u00b7 F 100% \u00b7 overall 95%'],
    ['VMMC', 'SCEL', 'Y 94% \u00b7 J 100% \u00b7 F \u2014 \u00b7 overall 98%'],
    ['ZGSZ', 'SCEL', 'Y 94% \u00b7 J 95% \u00b7 F 100% \u00b7 overall 95%'],
    ['SCEL', 'ZHHH', 'Y 94% \u00b7 J 100% \u00b7 F \u2014 \u00b7 overall 95%'],
    ['SVMI', 'WIII', 'Y 94% \u00b7 J 94% \u00b7 F 100% \u00b7 overall 95%'],
  ];
  for (const [from, to, expected] of cases) {
    drive({ from, to, range: '14,500', rwy: '9,680' });
    await flush(); await flush();
    assert.strictEqual(ELS.loadV.textContent, expected, `${from}->${to}`);
  }
});

test('a freighter shows the L/H cargo load factor', async () => {
  await flush();
  ctx.applyAcft('A380F', false);
  drive({ from: 'VVNB', to: 'SPIM', range: '14,500', rwy: '9,680' });
  await flush(); await flush();
  assert.match(ELS.loadV.textContent, /L \d+% \u00b7 H \d+% \u00b7 overall \d+%/);
  ctx.applyAcft('A380-800', false);
});

test('a freighter shows cargo demand and the best L/H split', async () => {
  await flush();
  ctx.applyAcft('A380F', false); // keep the entered range/runway
  drive({ from: 'VVNB', to: 'SPIM', range: '14,500', rwy: '9,680' });
  await flush(); await flush();
  assert.match(ELS.demV.innerHTML, /L 597,000 \/ H 222,000/);
  assert.match(ELS.cfgV.innerHTML, /L \d+% \/ H \d+% .*dep\/day \u00d7 \d+ A\/C/);
  ctx.applyAcft('A380-800', false);
});

// ATL-151: runway-short endpoints, IATA/ICAO resolution, distance displays.
test('HKG→BCH shows a runway-short warning, not "Fly it direct" (ATL-151 regression)', async () => {
  await flush(); ctx.applyAcft('A380-800', false);
  const msg = drive({ from: 'HKG', to: 'BCH', range: '14,500', rwy: '9,680' });
  assert.match(msg.className, /warn/);
  assert.match(msg.innerHTML, /BCH runway \(8,233 ft\) is shorter than the .+ minimum \(9,680 ft\)/);
  assert.doesNotMatch(msg.innerHTML, /Fly it direct/);
});

test('ICAO codes resolve identically to IATA (VHHH→YMML ≡ HKG→MEL)', () => {
  drive({ from: 'HKG', to: 'MEL', range: '14,500', rwy: '9,680' });
  const iata = { msg: ELS.msg.innerHTML, flown: ELS.sActual.innerHTML };
  const msg = drive({ from: 'VHHH', to: 'YMML', range: '14,500', rwy: '9,680' });
  assert.strictEqual(msg.innerHTML, iata.msg);
  assert.strictEqual(ELS.sActual.innerHTML, iata.flown);
  assert.match(ELS.fromHint.textContent, /HKG \/ VHHH/);
  assert.match(ELS.toHint.textContent, /MEL \/ YMML/);
});

test('mixed IATA→ICAO search works (VHHH→BCH) and hints show both codes', () => {
  drive({ from: 'VHHH', to: 'BCH', range: '14,500', rwy: '9,680' });
  assert.doesNotMatch(ELS.msg.innerHTML, /Airport not found|No AM4 airport/);
  assert.match(ELS.toHint.textContent, /BCH \/ WPEC/);
});

test('an unmatched code is reported plainly', () => {
  drive({ from: 'HKG', to: 'ZZZZ', range: '14,500', rwy: '9,680' });
  assert.match(ELS.toHint.textContent, /No AM4 airport with code ZZZZ/);
  assert.match(ELS.msg.innerHTML, /No AM4 airport with code ZZZZ/);
});

test('live distance chip shows the great-circle distance once both ends resolve', () => {
  drive({ from: 'HKG', to: 'MEL', range: '14,500', rwy: '9,680' });
  assert.match(ELS.dchip.textContent, /7,412 km/);
});

test('a stopover result card states the total distance per leg', () => {
  drive({ from: 'VVNB', to: 'SPIM', range: '14,500', rwy: '9,680' });
  assert.match(ELS.msg.className, /ok/);
  assert.match(ELS.msg.innerHTML, /Your stopover is \w{3}/);
  assert.match(ELS.msg.innerHTML, /Total [\d,]+ km \(leg 1 [\d,]+ km \+ leg 2 [\d,]+ km\)/);
});

// ATL-153: flights-per-day selector (Optimum + 1–30 departures by one aircraft).
const QX = /<span class="qx"[^>]*>[^<]*<\/span>/g;
const cfgText = () => ELS.cfgV.innerHTML.replace(QX, '');
const quotaClasses = () => [...ELS.cfgV.innerHTML.matchAll(/([YJFLH]) [\d]+%?<span class="qx"/g)].map((m) => m[1]).join('');

test('Optimum leaves all 9 ATL-148 reference configs exactly as before', async () => {
  await flush(); await flush();
  ctx.applyAcft('A380-800', false);
  ctx.setMode('realism', false);
  ctx.setFpd(0, false);
  const cases = [
    ['VVNB', 'SPIM', 'Y 317 / J 59 / F 55', '1 dep/day \u00d7 4 A/C'],
    ['RPLL', 'SGAS', 'Y 286 / J 132 / F 16', '1 dep/day \u00d7 4 A/C'],
    ['MROC', 'WIII', 'Y 324 / J 101 / F 24', '1 dep/day \u00d7 5 A/C'],
    ['VMMC', 'SGAS', 'Y 400 / J 75 / F 16', '1 dep/day \u00d7 5 A/C'],
    ['ZGSZ', 'SLLP', 'Y 305 / J 123 / F 16', '1 dep/day \u00d7 4 A/C'],
    ['VMMC', 'SCEL', 'Y 216 / J 192 / F 0', '1 dep/day \u00d7 4 A/C'],
    ['ZGSZ', 'SCEL', 'Y 223 / J 169 / F 13', '1 dep/day \u00d7 4 A/C'],
    ['SCEL', 'ZHHH', 'Y 492 / J 54 / F 0', '1 dep/day \u00d7 3 A/C'],
    ['SVMI', 'WIII', 'Y 205 / J 145 / F 35', '1 dep/day \u00d7 5 A/C'],
  ];
  for (const [from, to, cfg, dep] of cases) {
    drive({ from, to, range: '14,500', rwy: '9,680' });
    await flush(); await flush();
    assert.strictEqual(ELS.cfgV.innerHTML, `${cfg} <span class="sm">${dep}</span>`, `${from}->${to}`);
    assert.strictEqual(ELS.flagRow.style.display, 'none', `${from}->${to} Optimum shows no flags`);
  }
});

test('JFK\u2192MEL via ROW on A380 (Easy): Optimum unchanged; fixed 2 is capped at per-flight demand', async () => {
  ctx.setMode('easy', false);
  ctx.setFpd(0, false);
  drive({ from: 'JFK', to: 'MEL', range: '14,500', rwy: '9,680' });
  await flush(); await flush();
  assert.match(ELS.msg.innerHTML, /Your stopover is ROW/);
  assert.strictEqual(ELS.cfgV.innerHTML, 'Y 351 / J 124 / F 0 <span class="sm">2 dep/day \u00d7 1 A/C</span>');
  assert.strictEqual(ELS.loadV.textContent, 'Y 94% \u00b7 J 100% \u00b7 F \u2014 \u00b7 overall 96%');
  assert.match(ELS.demV.innerHTML, /Y 660 \/ J 270 \/ F 147 <span class="sm">per flight Y 330 \/ J 135 \/ F 73<\/span>/);

  ctx.setFpd(2, false);
  drive({ from: 'JFK', to: 'MEL', range: '14,500', rwy: '9,680' });
  await flush(); await flush();
  assert.strictEqual(ELS.cfgV.innerHTML, 'Y 330 / J 135 / F 0 <span class="sm">2 dep/day \u00d7 1 A/C</span>');
  assert.strictEqual(ELS.loadV.textContent, 'Y 100% \u00b7 J 100% \u00b7 F \u2014 \u00b7 overall 100%');
  assert.strictEqual(ELS.flagRow.style.display, 'none');
  ctx.setFpd(0, false);
});

test('JFK\u2192AKL (Easy, A380, 2/day): cap first, fill second \u2014 Y 266 / J 71 / F 64, no quota flag (ATL-148 4 Oct)', async () => {
  ctx.setMode('easy', false);
  ctx.setFpd(2, false);
  drive({ from: 'JFK', to: 'AKL', range: '14,500', rwy: '9,680' });
  await flush(); await flush();
  assert.match(ELS.msg.innerHTML, /Fly it direct/);
  assert.strictEqual(ELS.demV.innerHTML, 'Y 905 / J 142 / F 129 <span class="sm">per flight Y 452 / J 71 / F 64</span>');
  assert.strictEqual(ELS.cfgV.innerHTML, 'Y 266 / J 71 / F 64 <span class="sm">2 dep/day \u00d7 1 A/C</span>');
  assert.doesNotMatch(ELS.cfgV.innerHTML, /Quota exceeded/);
  assert.strictEqual(ELS.loadV.textContent, 'Y 100% \u00b7 J 100% \u00b7 F 100% \u00b7 overall 100%');
  ctx.setFpd(0, false);
});

test('no fixed flights-per-day pax config ever exceeds per-flight demand (every aircraft, 1\u201330)', async () => {
  ctx.setMode('easy', false);
  for (const a of ACFT.filter((x) => x.cat !== 'cargo')) {
    ctx.applyAcft(a.name, false);
    for (let n = 1; n <= 30; n++) {
      ctx.setFpd(n, false);
      drive({ from: 'JFK', to: 'AKL', range: '14,500', rwy: '9,680' });
      await flush(); await flush();
      assert.doesNotMatch(ELS.cfgV.innerHTML, /Quota exceeded/, `${a.name} fpd ${n}`);
      const [y, j, f] = ELS.cfgV.innerHTML.match(/\d+/g).map(Number);
      assert.ok(y + 2 * j + 3 * f <= a.cap, `${a.name} fpd ${n} within seat budget`);
    }
  }
  ctx.applyAcft('A380-800', false);
  ctx.setFpd(0, false);
});

test('JFK\u2192MEL fixed 1, 4 and 30 give capped configs, recalculated loads and aircraft counts', async () => {
  ctx.setMode('easy', false);
  const want = {
    1: ['Y 600 / J 0 / F 0 <span class="sm">1 dep/day \u00d7 1 A/C</span>', 'Y 100% \u00b7 J \u2014 \u00b7 F \u2014 \u00b7 overall 100%'],
    4: ['Y 165 / J 67 / F 36 <span class="sm">4 dep/day on 2 A/C</span>', 'Y 100% \u00b7 J 100% \u00b7 F 100% \u00b7 overall 100%'],
    30: ['Y 22 / J 9 / F 4 <span class="sm">30 dep/day on 15 A/C</span>', 'Y 100% \u00b7 J 100% \u00b7 F 100% \u00b7 overall 100%'],
  };
  for (const n of [1, 4, 30]) {
    ctx.setFpd(n, false);
    drive({ from: 'JFK', to: 'MEL', range: '14,500', rwy: '9,680' });
    await flush(); await flush();
    assert.strictEqual(ELS.cfgV.innerHTML, want[n][0], `fpd ${n}`);
    assert.strictEqual(ELS.loadV.textContent, want[n][1], `fpd ${n}`);
  }
  assert.match(ELS.flagV.innerHTML, /One aircraft flies up to 2 a day on this distance/);
  ctx.setFpd(1, false);
  drive({ from: 'JFK', to: 'MEL', range: '14,500', rwy: '9,680' });
  await flush(); await flush();
  assert.strictEqual(ELS.flagRow.style.display, 'none', '100% load, no quota breach: no flags');
  ctx.setFpd(0, false);
});

test('ticket prices do not change with flights per day', async () => {
  ctx.setMode('easy', false);
  const prices = [];
  for (const n of [0, 1, 7, 30]) {
    ctx.setFpd(n, false);
    drive({ from: 'JFK', to: 'MEL', range: '14,500', rwy: '9,680' });
    await flush();
    prices.push([ELS.tY.textContent, ELS.tJ.textContent, ELS.tF.textContent].join());
  }
  assert.strictEqual(new Set(prices).size, 1);
  ctx.setFpd(0, false);
});

test('under 15 pax per flight raises the contribution flag', async () => {
  ctx.setMode('easy', false);
  ctx.setFpd(30, false);
  drive({ from: 'HKG', to: 'BCH', range: '14,500', rwy: '0' });
  await flush(); await flush();
  assert.match(ELS.flagV.innerHTML, /Under 15 pax per flight \(\d+ expected\): contribution below maximum/);
  ctx.setFpd(0, false);
});

test('every aircraft (pax and cargo) gives a config and load for Optimum and 1\u201330', async () => {
  ctx.setMode('easy', false);
  for (const a of ACFT) {
    ctx.applyAcft(a.name, false);
    for (let n = 0; n <= 30; n++) {
      ctx.setFpd(n, false);
      drive({ from: 'JFK', to: 'MEL', range: '14,500', rwy: '0' });
      await flush(); await flush();
      const t = ELS.cfgV.innerHTML + ' ' + ELS.loadV.textContent;
      assert.doesNotMatch(t, /NaN|undefined|Infinity|\u2013/, `${a.name} fpd ${n}`);
      assert.match(t, a.cat === 'cargo' ? /^L \d+%.* \/ H \d+%.*dep\/day/ : /^Y \d+.* \/ J \d+.* \/ F \d+.*dep\/day/, `${a.name} fpd ${n}`);
      assert.match(ELS.cfgV.innerHTML, new RegExp(`>${n || '\\d+'} dep/day`), `${a.name} fpd ${n}`);
    }
  }
  ctx.applyAcft('A380-800', false);
  ctx.setFpd(0, false);
});

test('flights per day is kept across route/aircraft changes and carried in the link', async () => {
  ctx.setFpd(4, false);
  drive({ from: 'JFK', to: 'MEL', range: '14,500', rwy: '9,680' });
  assert.match(lastUrl, /[?&]fpd=4(&|$)/);
  ctx.applyAcft('B747-8F', false);
  drive({ from: 'VVNB', to: 'SPIM', range: '14,500', rwy: '9,680' });
  await flush(); await flush();
  assert.match(lastUrl, /[?&]fpd=4(&|$)/);
  assert.match(ELS.cfgV.innerHTML, />4 dep\/day/);
  ctx.applyAcft('A380-800', false);
  ctx.setFpd(0, false);
  drive({ from: 'JFK', to: 'MEL', range: '14,500', rwy: '9,680' });
  assert.doesNotMatch(lastUrl, /fpd=/, 'Optimum keeps the link clean');

  for (const [q, v] of [['?fpd=12', '12'], ['?fpd=31', '0'], ['?fpd=abc', '0'], ['', '0']]) {
    ctx.location.search = q;
    ctx.readUrl();
    assert.strictEqual(ELS.fpd.value, v, q);
  }
  ctx.location.search = '';
  ctx.setFpd(0, false);
});
