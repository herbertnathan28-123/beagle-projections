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
  history: { replaceState() {} },
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
  assert.match(ELS.demV.textContent, /Y 1,193 \/ J 222 \/ F 277/);
  assert.match(ELS.cfgV.innerHTML, /Y 317 \/ J 59 \/ F 55/);
  assert.match(ELS.cfgV.innerHTML, /1 dep\/day \u00d7 4 A\/C/);
});

test('ZGSZ\u2192SCEL matches its WO reference too', async () => {
  drive({ from: 'ZGSZ', to: 'SCEL', range: '14500', rwy: '9680' });
  await flush(); await flush();
  assert.match(ELS.demV.textContent, /Y 841 \/ J 639 \/ F 220/);
  assert.match(ELS.cfgV.innerHTML, /Y 223 \/ J 169 \/ F 13/);
});

test('a freighter shows cargo demand and the best L/H split', async () => {
  await flush();
  ctx.applyAcft('A380F', false); // keep the entered range/runway
  drive({ from: 'VVNB', to: 'SPIM', range: '14,500', rwy: '9,680' });
  await flush(); await flush();
  assert.match(ELS.demV.textContent, /L 597,000 \/ H 222,000/);
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
