'use strict';
// Regression tests for public/stopover.html — drives the page's own solve()
// against DOM stubs so the tests exercise the shipped code, not a copy.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { planFromQuery } = require('../lib/stopoverPlan');

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
  // ATL-148 Phase 3 report route JFK→BCH (live dataset values)
  'KJFK>WPEC': { y: 1135, j: 464, f: 107, l: 568000, h: 464000 },
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
    _a: {}, setAttribute(k, v) { this._a[k] = String(v); }, getAttribute(k) { return k in this._a ? this._a[k] : null; },
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
    if (url.startsWith('/api/stopover/plan')) {
      const q = Object.fromEntries(new URLSearchParams(url.split('?')[1]));
      const p = planFromQuery(q, { aircrafts: () => ACFT, demand: (f, t) => DEMANDS[`${f}>${t}`] || null });
      return Promise.resolve({ ok: !!p, json: async () => JSON.parse(JSON.stringify(p)) });
    }
    return Promise.resolve({ ok: false, json: async () => null });
  },
  setTimeout, clearTimeout, setInterval, clearInterval,
  addEventListener() {},
  console,
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'stopover-facts.js'), 'utf8'), ctx);
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

const settle = async () => { for (let k = 0; k < 8; k++) await flush(); };
const planNow = () => vm.runInContext('plan', ctx);
const rowAt = (t) => planNow().rows.find((r) => r.t === t);

// ATL-148: demand line + the selected best-setup row (A388 Realism).
test('VVNB\u2192SPIM and ZGSZ\u2192SCEL show the WO reference demand', async () => {
  await settle(); // let the aircraft-specs fetch apply A380-800
  ctx.setMode('realism', false);
  drive({ from: 'VVNB', to: 'SPIM', range: '14,500', rwy: '9,680' });
  await settle();
  assert.match(ELS.demV.innerHTML, /^Y 1,193 \/ J 222 \/ F 277 <span class="sm">per flight Y \d+ \/ J \d+ \/ F \d+<\/span>$/);
  assert.match(ELS.cfgV.innerHTML, /^Y \d+ \/ J \d+ \/ F \d+ <span class="sm">\d+h [03]0m flight<\/span>$/);
  drive({ from: 'ZGSZ', to: 'SCEL', range: '14500', rwy: '9680' });
  await settle();
  assert.match(ELS.demV.innerHTML, /^Y 841 \/ J 639 \/ F 220 /);
});

test('a freighter shows cargo demand, the L/H split and its load, with no money card', async () => {
  await settle();
  ctx.applyAcft('A380F', false); // keep the entered range/runway
  drive({ from: 'VVNB', to: 'SPIM', range: '14,500', rwy: '9,680' });
  await settle();
  assert.match(ELS.demV.innerHTML, /L 597,000 \/ H 222,000 <span class="sm">per flight L [\d,]+ \/ H [\d,]+<\/span>/);
  assert.match(ELS.cfgV.innerHTML, /^L \d+% \/ H \d+% <span class="sm">/);
  assert.match(ELS.loadV.textContent, /L (\d+%|\u2014) \u00b7 H (\d+%|\u2014) \u00b7 overall \d+%/);
  assert.match(ELS.bestCd.innerHTML, /BEST FOR CONTRIBUTIONS.*C\/D/);
  assert.match(ELS.bestMoney.innerHTML, /No cost figures for this aircraft/);
  ctx.applyAcft('A380-800', false);
});

// ATL-151: runway-short endpoints, IATA/ICAO resolution, distance displays.
test('Realism: HKG→BCH shows a runway-short warning, not "Fly it direct" (ATL-151 regression)', async () => {
  await flush(); ctx.applyAcft('A380-800', false);
  ctx.setMode('realism', false);
  const msg = drive({ from: 'HKG', to: 'BCH', range: '14,500', rwy: '9,680' });
  assert.match(msg.className, /warn/);
  assert.match(msg.innerHTML, /BCH runway \(8,233 ft\) is shorter than the .+ minimum \(9,680 ft\)/);
  assert.doesNotMatch(msg.innerHTML, /Fly it direct/);
  ctx.setMode('easy', false);
});

test('Easy: no runway restriction, never a runway-short warning (Nathan, 3 Oct)', async () => {
  ctx.setMode('easy', false);
  const msg = drive({ from: 'HKG', to: 'BCH', range: '14,500', rwy: '9,680' });
  assert.doesNotMatch(msg.innerHTML, /runway/i);
  assert.match(msg.innerHTML, /Fly it direct/);
  assert.match(ELS.rwyHint.textContent, /Easy mode has no runway limit/);
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
// ---------- ATL-148 Phase 3: best setup over the calculator's flight-time rows ----------
const { departures48 } = require('../lib/stopoverPlan');
const { _calc } = require('../lib/calculator');
const { REV } = require('../lib/calcCosts');
const { AIRCRAFT_DATA, CALC_TIMES } = require('../config');
const calcPage = require('../views/calc.js');

function calcDepartures(boostValue) {
  const build = Object.values(calcPage).find((f) => typeof f === 'function');
  const page = build('K');
  const fn = page.match(/function boostCfg\(\)[\s\S]*?return boosted\+normal\+1;\n\}/)[0];
  const c = vm.createContext({ document: { getElementById: () => ({ value: boostValue }) } });
  vm.runInContext(fn, c);
  return (t, mt) => c.departures48(t, mt);
}

test('departures follow the calculator rule exactly (maintenance on/off, every 4\u00d7 option)', () => {
  for (const b of ['0', '4x1', '4x3', '4x6', 'b1', 'b24']) {
    const theirs = calcDepartures(b);
    for (const t of CALC_TIMES) for (const mt of [true, false]) {
      assert.strictEqual(departures48(t, mt, b), theirs(t, mt), `t ${t} maint ${mt} boost ${b}`);
    }
  }
});

test('the calculator page still serves the same cost constants (moved to lib/calcCosts.js)', () => {
  const build = Object.values(calcPage).find((f) => typeof f === 'function');
  const page = build('K');
  assert.deepStrictEqual(JSON.parse(page.match(/const REV=(\{.*?\});/)[1]), REV);
  assert.match(page, /const FUEL_P=600, CO2_P=130;/);
  assert.strictEqual(REV['A380-800'].cf, 21.59);
});

test('the plan route sits above the wildcard and the stopover page never sees cost constants', () => {
  const srv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(srv.indexOf("app.get('/api/stopover/plan'") > 0);
  assert.ok(srv.indexOf("app.get('/api/stopover/plan'") < srv.indexOf("app.get('*', (req"));
  assert.doesNotMatch(html, /acheckH|FUEL_P|CO2_P|_calc\(|repair:/);
});

async function route(from, to, opts = {}) {
  ctx.setMode(opts.mode || 'easy', false);
  ctx.setNac(opts.nac || 1, false);
  ctx.setBoost(opts.boost || '0', false);
  drive({ from, to, range: '14,500', rwy: opts.rwy || '9,680' });
  await settle();
  return planNow();
}

for (const [from, to, label] of [['JFK', 'AKL', 'JFK\u2192AKL'], ['JFK', 'BCH', 'JFK\u2192BCH']]) {
  test(`${label} (Easy, A380): every flight-time row is consistent and both bests are the maxima`, async () => {
    ctx.applyAcft('A380-800', false);
    const p = await route(from, to);
    const dem = DEMANDS[`KJFK>${to === 'AKL' ? 'NZAA' : 'WPEC'}`];
    const direct = vm.runInContext('current.direct', ctx);
    const sp = AIRCRAFT_DATA.find((a) => a.name === 'A380-800').easy;
    assert.ok(p.rows.length >= 10);
    assert.deepStrictEqual(p.rows.map((r) => r.t), CALC_TIMES.filter((t) => t >= direct / sp && _calc(direct, t, sp, 'Easy') !== 'X'));
    for (const r of p.rows) {
      assert.strictEqual(r.depsDay, r.dep48 / 2);
      assert.ok(Math.abs(r.cdDay - _calc(direct, r.t, sp, 'Easy') * r.dep48 / 2) < 1e-9);
      for (const k of ['y', 'j', 'f']) {
        assert.strictEqual(r.perFlight[k], Math.floor(dem[k] / r.freq));
        assert.ok(r.cfg[k] <= r.perFlight[k], `t ${r.t} ${k} capped`);
      }
      assert.ok(r.cfg.y + 2 * r.cfg.j + 3 * r.cfg.f <= 600);
    }
    const bc = rowAt(p.bestCd), bm = rowAt(p.bestMoney);
    for (const r of p.rows) {
      assert.ok(r.cdDay < bc.cdDay || (r.cdDay === bc.cdDay && r.dep48 >= bc.dep48));
      assert.ok(r.profitDay < bm.profitDay || (r.profitDay === bm.profitDay && r.dep48 >= bm.dep48));
    }
    // default selection = best for money; the route numbers show that row
    assert.strictEqual(vm.runInContext('selT', ctx), p.bestMoney);
    assert.match(ELS.cfgV.innerHTML, new RegExp(`^Y ${bm.cfg.y} / J ${bm.cfg.j} / F ${bm.cfg.f} `));
    assert.match(ELS.bestCd.innerHTML, /BEST FOR CONTRIBUTIONS/);
    assert.match(ELS.bestCd.innerHTML, /profit\/day/);
    assert.match(ELS.bestMoney.innerHTML, /BEST FOR MONEY.*\/day.*C\/D/);
    assert.strictEqual((ELS.planT.innerHTML.match(/<tr data-t=/g) || []).length, p.rows.length);
    assert.match(ELS.planT.innerHTML, /<th>Flight time<\/th><th>CI<\/th><th>Deps\/day<\/th><th>Config<\/th><th>Load<\/th><th>Revenue\/day<\/th><th class="on">Profit\/day \u25bc<\/th><th>C\/D<\/th><th>Score<\/th>/);
    assert.doesNotMatch(ELS.planT.innerHTML + ELS.bestCd.innerHTML + ELS.bestMoney.innerHTML, /NaN|undefined|Infinity/);
  });
}

test('JFK\u2192AKL A380 Easy profit matches the calculator cost model by hand', async () => {
  const p = await route('JFK', 'AKL');
  const r = rowAt(p.bestMoney);
  const d = vm.runInContext('current.direct', ctx);
  const sp = 1731, a = REV['A380-800'];
  const tk = [Math.floor((0.4 * d + 170) * 1.10), Math.floor((0.8 * d + 560) * 1.08), Math.floor((1.2 * d + 1200) * 1.06)].map((v) => v - 10);
  const rev = r.cfg.y * tk[0] + r.cfg.j * tk[1] + r.cfg.f * tk[2];
  const ci = Math.max(0, Math.min(200, (2000 / 7) * (d / (sp * r.t)) - 600 / 7));
  const fuel = a.cf * d * (ci / 500 + 0.6) * 600 / 1000;
  const co2 = a.cc * d * ((r.cfg.y + 2 * r.cfg.j + 3 * r.cfg.f) + (r.cfg.y + r.cfg.j + r.cfg.f)) * (ci / 2000 + 0.9) * 130 / 1000;
  const want = (rev - fuel - co2 - a.acheckH * Math.ceil(r.t) - a.repair) * r.dep48 / 2;
  assert.ok(Math.abs(r.profitDay - want) < 1e-6, `${r.profitDay} vs ${want}`);
  assert.ok(Math.abs(r.revDay - rev * r.dep48 / 2) < 1e-6);
});

test('aircraft count splits demand over the fleet; flights per day is derived; link round-trips', async () => {
  const one = await route('JFK', 'AKL');
  const two = await route('JFK', 'AKL', { nac: 2 });
  const t = two.bestMoney, r1 = one.rows.find((r) => r.t === t), r2 = rowAt(t);
  assert.strictEqual(r2.freq, r1.freq * 2);
  assert.strictEqual(r2.perFlight.y, Math.floor(905 / r2.freq));
  assert.match(ELS.fpdV.innerHTML, new RegExp(`a day \u00d7 2 A/C \u00b7 ${r2.dep48 * 2} in 48 h`));
  assert.match(lastUrl, /[?&]nac=2(&|$)/);
  // tapping a row shows that row and carries it in the link
  const other = two.rows[0].t;
  ctx.pickT(other);
  assert.strictEqual(vm.runInContext('selT', ctx), other);
  assert.match(ELS.cfgV.innerHTML, new RegExp(`^Y ${two.rows[0].cfg.y} / J ${two.rows[0].cfg.j} / F ${two.rows[0].cfg.f} `));
  assert.match(lastUrl, new RegExp(`[?&]ft=${other}(&|$)`));
  ctx.setBoost('4x2');
  await settle();
  assert.match(lastUrl, /[?&]boost=4x2(&|$)/);
  assert.ok(rowAt(other).dep48 >= two.rows[0].dep48);
  ctx.location.search = `?from=JFK&to=AKL&nac=3&boost=4x1&ft=${other}`;
  ctx.readUrl();
  assert.strictEqual(vm.runInContext('nAc', ctx), 3);
  assert.strictEqual(vm.runInContext('boost', ctx), '4x1');
  assert.strictEqual(vm.runInContext('selT', ctx), other);
  ctx.location.search = '';
  ctx.readUrl();
  ctx.setNac(1, false); ctx.setBoost('0', false);
});

const tableOrder = () => [...ELS.planT.innerHTML.matchAll(/<tr data-t="([\d.]+)"/g)].map((m) => +m[1]);
const optRow = () => (ELS.planT.innerHTML.match(/<tr data-t="([\d.]+)" class="opt[^"]*"><td>[^<]*<span class="tag o">OPTIMUM<\/span>/) || [])[1];

for (const to of ['AKL', 'BCH']) {
  test(`JFK\u2192${to}: each card ranks the table best to worst and the top row is the highlighted optimum`, async () => {
    ctx.applyAcft('A380-800', false);
    const p = await route('JFK', to);
    for (const [card, key, best] of [['bestMoney', 'profitDay', 'bestMoney'], ['bestCd', 'cdDay', 'bestCd'], ['bestAll', 'score', 'bestAll']]) {
      ELS[card].onclick();
      const order = tableOrder();
      assert.strictEqual(order.length, p.rows.length);
      const vals = order.map((t) => rowAt(t)[key]);
      for (let i = 1; i < vals.length; i++) assert.ok(vals[i - 1] >= vals[i], `${card} row ${i} out of order`);
      assert.strictEqual(order[0], p[best]);
      assert.strictEqual(+optRow(), p[best]);
      assert.strictEqual((ELS.planT.innerHTML.match(/OPTIMUM/g) || []).length, 1);
      assert.strictEqual(vm.runInContext('selT', ctx), p[best], 'the route numbers show the optimum');
      assert.strictEqual(ELS[card].getAttribute('aria-pressed'), 'true');
    }
    ELS.bestMoney.onclick();
  });
}

test('BEST OVERALL is the 50/50 score of C/D and profit as a % of each best', async () => {
  const p = await route('JFK', 'AKL');
  const bc = rowAt(p.bestCd), bm = rowAt(p.bestMoney);
  for (const r of p.rows) assert.ok(Math.abs(r.score - (50 * r.cdDay / bc.cdDay + 50 * r.profitDay / bm.profitDay)) < 1e-9);
  assert.ok(Math.max(...p.rows.map((r) => r.score)) === rowAt(p.bestAll).score);
  assert.ok(rowAt(p.bestAll).score <= 100);
  ELS.bestAll.onclick();
  assert.match(ELS.bestAll.innerHTML, /BEST OVERALL.*\d+\.\d score.*\/day \u00b7 [\d,.]+ C\/D/);
  assert.match(lastUrl, /[?&]sort=all(&|$)/);
  assert.doesNotMatch(lastUrl, /[?&]ft=/);
  ctx.location.search = '?from=JFK&to=AKL&sort=cd';
  ctx.readUrl();
  assert.strictEqual(vm.runInContext('sortBy', ctx), 'cd');
  const q = await route('JFK', 'BCH');
  assert.strictEqual(vm.runInContext('selT', ctx), q.bestCd, 'a new route opens on the chosen ranking\u2019s optimum');
  ctx.location.search = '';
  ctx.readUrl();
  assert.strictEqual(vm.runInContext('sortBy', ctx), 'money');
});

test('an aircraft with no cost figures ranks by C/D only', async () => {
  ctx.applyAcft('A380F', false);
  const p = await route('JFK', 'AKL');
  ELS.bestAll.onclick(); ELS.bestMoney.onclick();
  assert.strictEqual(tableOrder()[0], p.bestCd);
  assert.match(ELS.bestAll.innerHTML, /No cost figures/);
  assert.doesNotMatch(ELS.planT.innerHTML, /Score/);
  ctx.applyAcft('A380-800', false);
});

test('a new route returns to the best-for-money row', async () => {
  const p = await route('JFK', 'AKL');
  ctx.pickT(p.rows[0].t);
  const q = await route('JFK', 'BCH');
  assert.strictEqual(vm.runInContext('selT', ctx), q.bestMoney);
  assert.doesNotMatch(lastUrl, /[?&]ft=/);
});

test('manual flights per day (1\u201330) drives the route numbers; cards and ranked table stay on the recommendation', async () => {
  ctx.applyAcft('A380-800', false);
  const p = await route('JFK', 'AKL');
  const order = tableOrder(), cards = ELS.bestCd.innerHTML + ELS.bestMoney.innerHTML + ELS.bestAll.innerHTML;
  ctx.setFpd(2); await settle();
  assert.match(ELS.cfgV.innerHTML, /^Y 266 \/ J 71 \/ F 64 <span class="sm">at your 2 a day<\/span>$/);
  assert.match(ELS.demV.innerHTML, /per flight Y 452 \/ J 71 \/ F 64/);
  assert.strictEqual(ELS.loadV.textContent, 'Y 100% \u00b7 J 100% \u00b7 F 100% \u00b7 overall 100%');
  assert.match(ELS.fpdV.innerHTML, /your choice \u00b7 compare with Optimum above/);
  const bm0 = rowAt(p.bestMoney);
  const moneyTile = `<span class="h">BEST FOR MONEY</span><span class="big">3 <small>a day</small></span><span class="ln">9h 00m flight</span><span class="ln">Y ${bm0.cfg.y} / J ${bm0.cfg.j} / F ${bm0.cfg.f}</span><span class="gr">$8,354,410 profit/day \u00b7 126.51 C/D</span>`;
  assert.strictEqual(ELS.optMoney.innerHTML, moneyTile);
  assert.match(ELS.optCd.innerHTML, /^<span class="h">BEST FOR CONTRIBUTIONS<\/span><span class="big">2 <small>a day<\/small><\/span><span class="ln">15h 30m flight<\/span>.* 157\.38 C\/D<\/span>$/);
  assert.match(ELS.optAll.innerHTML, /^<span class="h">BEST OVERALL<\/span><span class="big">\d+ <small>a day/);
  assert.strictEqual(ELS.optMoney.getAttribute('aria-pressed'), 'true');
  ctx.setSort('cd'); await settle();
  assert.strictEqual(ELS.optCd.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(ELS.optMoney.getAttribute('aria-pressed'), 'false');
  assert.strictEqual(ELS.optMoney.innerHTML, moneyTile, 'all three optimums stay on screen whichever card ranks the table');
  assert.match(ELS.cfgV.innerHTML, /^Y 266 \/ J 71 \/ F 64 <span class="sm">at your 2 a day/);
  ctx.setSort('money'); await settle();
  assert.doesNotMatch(ELS.cfgV.innerHTML + ELS.flagV.innerHTML, /Quota exceeded|NaN/);
  assert.match(lastUrl, /[?&]fpd=2(&|$)/);
  assert.strictEqual(planNow().bestMoney, p.bestMoney);
  assert.deepStrictEqual(tableOrder(), order);
  assert.strictEqual(ELS.bestCd.innerHTML + ELS.bestMoney.innerHTML + ELS.bestAll.innerHTML, cards);
  ctx.setFpd(30); await settle();
  assert.match(ELS.demV.innerHTML, /per flight Y 30 \/ J 4 \/ F 4/);
  assert.match(ELS.flagV.innerHTML, /Up to 3 a day per aircraft on this distance: 10 aircraft needed for 30 a day/);
  ctx.setNac(10); await settle();
  assert.doesNotMatch(ELS.flagV.innerHTML, /aircraft needed/);
  ctx.setNac(1, false);
  ctx.location.search = '?from=JFK&to=AKL&fpd=7';
  ctx.readUrl();
  assert.strictEqual(vm.runInContext('fpd', ctx), 7);
  ctx.location.search = '?from=JFK&to=AKL&fpd=31';
  ctx.readUrl();
  assert.strictEqual(vm.runInContext('fpd', ctx), 0);
  ctx.location.search = '';
  ctx.readUrl();
  const q = await route('JFK', 'AKL');
  const bm = rowAt(q.bestMoney);
  assert.match(ELS.cfgV.innerHTML, new RegExp(`^Y ${bm.cfg.y} / J ${bm.cfg.j} / F ${bm.cfg.f} <span class="sm">9h 00m flight`));
  assert.doesNotMatch(lastUrl, /[?&]fpd=/);
  ctx.applyAcft('A380F', false);
  ctx.setFpd(4); await route('JFK', 'AKL');
  assert.match(ELS.cfgV.innerHTML, /^L \d+% \/ H \d+% <span class="sm">at your 4 a day/);
  assert.doesNotMatch(ELS.cfgV.innerHTML + ELS.loadV.textContent + ELS.demV.innerHTML, /NaN|undefined/);
  ctx.setFpd(0, false); ctx.applyAcft('A380-800', false);
});

test('flights per day are whole numbers (2\u00bd \u2192 2); the optimum flight time is unchanged', async () => {
  ctx.applyAcft('A380-800', false);
  const p = await route('JFK', 'BCH');
  const bm = rowAt(p.bestMoney);
  assert.strictEqual(bm.t, 10);
  assert.strictEqual(bm.dep48, 5);
  const shown = ELS.optMoney.innerHTML + ELS.optCd.innerHTML + ELS.optAll.innerHTML + ELS.fpdV.innerHTML + ELS.planT.innerHTML + ELS.planNote.textContent +
    ELS.bestCd.innerHTML + ELS.bestMoney.innerHTML + ELS.bestAll.innerHTML;
  assert.doesNotMatch(shown, /\u00bd/);
  assert.match(ELS.optMoney.innerHTML, /^<span class="h">BEST FOR MONEY<\/span><span class="big">2 <small>a day<\/small><\/span><span class="ln">10h 00m flight/);
  assert.match(ELS.fpdV.innerHTML, /^2 <span class="sm">2 a day \u00d7 1 A\/C \u00b7 5 in 48 h<\/span>$/);
  assert.match(ELS.planT.innerHTML, /<tr data-t="10" [^>]*><td>10h 00m.*?<\/td><td>\d+<\/td><td>2<\/td>/);
  ctx.setFpd(10); await settle();
  const m = ELS.flagV.innerHTML.match(/Up to (\d+) a day per aircraft on this distance: (\d+) aircraft needed for 10 a day/);
  assert.ok(m, ELS.flagV.innerHTML);
  assert.strictEqual(+m[1], Math.floor(planNow().manual.maxDeps));
  assert.strictEqual(+m[2], Math.ceil(10 / +m[1]));
  ctx.setFpd(0); ctx.setNac(2); await settle();
  const f2 = ELS.fpdV.innerHTML.match(/^(\d+) <span class="sm">(\d+) a day \u00d7 2 A\/C \u00b7 (\d+) in 48 h/);
  assert.ok(f2, ELS.fpdV.innerHTML);
  assert.strictEqual(+f2[1], 2 * +f2[2], 'each aircraft flies whole flights');
  assert.strictEqual(+f2[2], Math.floor(rowAt(vm.runInContext('selT', ctx)).dep48 / 2));
  assert.ok(ELS.optMoney.innerHTML.includes(`<span class="big">${f2[1]} <small>a day`));
  assert.doesNotMatch(ELS.optMoney.innerHTML + ELS.optCd.innerHTML + ELS.optAll.innerHTML + ELS.planT.innerHTML, /\u00bd/);
  ctx.setNac(1); await settle();
});

test('best stopovers lists the 3 shortest', async () => {
  drive({ from: 'JFK', to: 'AKL', range: '10,000', rwy: '9,680' });
  await settle();
  const list = vm.runInContext('current.list.map((x) => x.tot)', ctx);
  assert.strictEqual(list.length, 3);
  assert.deepStrictEqual([...list], [...list].sort((a, b) => a - b));
});

test('a first visit with no link opens on JFK \u2192 SYD with the A380-800 (needs a stopover, not a short hop)', () => {
  ctx.location.search = '';
  ctx.readUrl();
  assert.strictEqual(ELS.from.value, 'JFK');
  assert.strictEqual(ELS.to.value, 'SYD');
  assert.strictEqual(ELS.range.value, '14500');
  assert.strictEqual(vm.runInContext('acftWanted', ctx), 'A380-800');
});

test('ticket prices do not change with aircraft count, 4\u00d7 or the chosen row', async () => {
  const prices = [];
  for (const o of [{}, { nac: 3 }, { boost: '4x6' }]) {
    const p = await route('JFK', 'AKL', o);
    for (const r of p.rows.slice(0, 3)) { ctx.pickT(r.t); prices.push([ELS.tY.textContent, ELS.tJ.textContent, ELS.tF.textContent].join()); }
  }
  assert.strictEqual(new Set(prices).size, 1);
  ctx.setNac(1, false); ctx.setBoost('0', false);
});

test('under 15 pax per flight raises the contribution flag', async () => {
  await route('HKG', 'BCH', { nac: 6, rwy: '0' });
  assert.match(ELS.flagV.innerHTML, /Under 15 pax per flight \(\d+ expected\): contribution below maximum/);
  ctx.setNac(1, false);
});

test('every aircraft gives a best setup with no NaN; money card only where cost figures exist', async () => {
  for (const a of ACFT) {
    ctx.applyAcft(a.name, false);
    await route('JFK', 'MEL', { rwy: '0' });
    const p = planNow();
    assert.ok(p && p.rows.length, a.name);
    const t = ELS.cfgV.innerHTML + ' ' + ELS.loadV.textContent + ELS.bestCd.innerHTML + ELS.bestMoney.innerHTML + ELS.planT.innerHTML;
    assert.doesNotMatch(t, /NaN|undefined|Infinity/, a.name);
    const costed = a.cat !== 'cargo' && !!REV[a.name];
    assert.strictEqual(p.money, costed, a.name);
    assert.match(ELS.bestMoney.innerHTML, costed ? /\/day/ : /No cost figures for this aircraft/, a.name);
  }
  ctx.applyAcft('A380-800', false);
});

// ---------- stopover banner: "Your stopover is", flag, fact, cheeky reason ----------
const DBROWS = JSON.parse(html.match(/const DB = (\[\[[\s\S]*?\]\]);/)[1]);
const FACTS = require('../public/stopover-facts.js');

test('a stopover shows "Your stopover is" with its flag, a true fact and a quip', () => {
  drive({ from: 'JFK', to: 'SYD', range: '14,500', rwy: '9,680' });
  assert.strictEqual(ELS.rS.textContent, 'Your stopover is');
  assert.match(ELS.fS.children.map((b) => b.textContent).join(''), /TUS/);
  assert.strictEqual(ELS.flS.hidden, false);
  assert.match(ELS.flS.src, /flagcdn\.com\/w80\/us\.png$/);
  assert.strictEqual(ELS.xS.hidden, false);
  assert.match(ELS.xS.innerHTML, /Boneyard/);
  assert.ok(FACTS.quips.some((q) => ELS.xS.innerHTML.includes(q)), 'a quip is shown');
  assert.match(ELS.msg.innerHTML, /Your stopover is TUS<img class="mflag" src="https:\/\/flagcdn\.com\/w80\/us\.png"/);
});

test('a direct route hides the stopover flag and fact', () => {
  drive({ from: 'JFK', to: 'SYD', range: '14,500', rwy: '9,680' });
  drive({ from: 'HKG', to: 'MEL', range: '14,500', rwy: '9,680' });
  assert.strictEqual(ELS.rS.textContent, 'Stops at');
  assert.strictEqual(ELS.flS.hidden, true);
  assert.strictEqual(ELS.xS.hidden, true);
});

test('every country in the airport table has a flag code and a fact; airport facts name real airports', () => {
  for (const r of DBROWS) {
    const c = ctx.countryOf(r);
    assert.ok(FACTS.countries[c], `no entry for ${c} (${r[0]})`);
    assert.match(ctx.flagOf(r), /^[a-z]{2}$/, c);
    assert.ok(ctx.stopFact(r).length > 20, r[0]);
  }
  const codes = new Set(DBROWS.map((r) => r[0]));
  for (const k of Object.keys(FACTS.airports)) assert.ok(codes.has(k), `${k} is not in the airport table`);
  assert.strictEqual(ctx.countryOf(['LAS', '', 'Las Vegas', 'V Int, United States']), 'United States');
});

test('an unknown country gets no flag and a safe generic fact; markup in text is escaped', () => {
  const row = ['ZZZ', 'ZZZZ', 'Nowhere <b>', 'Atlantis', 5000, 50, 0, 0];
  assert.strictEqual(ctx.flagOf(row), '');
  assert.match(ctx.stopFact(row), /^Nowhere <b> is one of [\d,]+ airports in the game/);
  assert.strictEqual(ctx.esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
  assert.strictEqual(ctx.stopQuip(row), ctx.stopQuip(row), 'quip is stable per airport');
});

test('the fact bank is large and varied: 200+ statements, 100+ quips, 50+ different US facts', () => {
  const statements = [
    ...Object.values(FACTS.airports),
    ...Object.values(FACTS.countries).map((c) => c[1]),
    ...Object.values(FACTS.more).flat(),
    ...FACTS.quips,
  ];
  assert.ok(statements.length >= 200, `only ${statements.length} statements`);
  assert.ok(FACTS.quips.length >= 100, `only ${FACTS.quips.length} quips`);
  assert.strictEqual(new Set(FACTS.quips).size, FACTS.quips.length, 'quips are unique');
  for (const k of Object.keys(FACTS.more)) assert.ok(FACTS.countries[k], `${k} has extra facts but no country entry`);
  const us = DBROWS.filter((r) => ctx.countryOf(r) === 'United States');
  const usFacts = new Set(us.map((r) => ctx.stopFact(r)));
  assert.ok(usFacts.size >= 50, `US airports show only ${usFacts.size} different facts`);
  assert.ok(new Set(us.map((r) => ctx.stopQuip(r))).size >= 50, 'US airports share too few quips');
});

test('Wichita and Amarillo get their own facts; Tucson keeps the Boneyard; neighbouring stops differ', () => {
  const row = (code) => DBROWS.find((r) => r[0] === code);
  assert.match(ctx.stopFact(row('ICT')), /Air Capital of the World/);
  assert.match(ctx.stopFact(row('AMA')), /Cadillac Ranch/);
  assert.match(ctx.stopFact(row('TUS')), /Boneyard/);
  const near = ['ICT', 'AMA', 'OKC', 'TUL', 'DDC'].map(row);
  assert.strictEqual(new Set(near.map((r) => ctx.stopFact(r))).size, near.length, 'facts repeat');
  const noOwn = DBROWS.filter((r) => ctx.countryOf(r) === 'United States' && !FACTS.airports[r[0]]).slice(0, 40);
  assert.ok(new Set(noOwn.map((r) => ctx.stopFact(r))).size >= 20, 'US fallback facts barely vary');
  for (const r of near) assert.strictEqual(ctx.stopFact(r), ctx.stopFact(r), 'fact is stable per airport');
});
