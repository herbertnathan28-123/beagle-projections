// node --test test/*.test.js — fuel calculator (ATL-144)
//
// The calculator's logic lives in the page script of public/fuel-calculator.html. These
// tests lift the real functions out of that file and run them, so what is tested is what
// members run.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PAGE = fs.readFileSync(path.join(__dirname, '..', 'public', 'fuel-calculator.html'), 'utf8');

// Source of a top-level `function name(...) { ... }` in the page script.
function fnSource(name) {
  const start = PAGE.search(new RegExp('^function ' + name + '\\(', 'm'));
  assert.ok(start >= 0, name + ' not found in fuel-calculator.html');
  let depth = 0;
  for (let i = PAGE.indexOf('{', start); i < PAGE.length; i++) {
    if (PAGE[i] === '{') depth++;
    else if (PAGE[i] === '}' && --depth === 0) return PAGE.slice(start, i + 1);
  }
  throw new Error('unbalanced braces in ' + name);
}

// ── Suggested buy ────────────────────────────────────────────────────────────

const _monthOptimize = vm.runInNewContext('(' + fnSource('monthOptimize') + ')');
const monthOptimize = (...a) => Array.from(_monthOptimize(...a));   // plain array in this realm

const MIN_FUEL = 15000000;
const TANK = 1801977000;
const slot = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 2 + m / 30; };

// Day 2 (2 Oct 2026), 11:30 NOW slot, as in Nathan's screenshots. Prices are the
// live October schedule (config.FUEL_SCHEDULE); burns are the departures the
// screenshots imply, repeated each day as the page does.
const { FUEL_SCHEDULE } = require('../config');
const DEP_BURNS = {
  '11:30': 66348755, '14:00': 407044881, '14:30': 69858911,
  '15:30': 69858911, '16:30': 69858911, '20:00': 69858911,
};
const hhmm = s => String(Math.floor(s / 2)).padStart(2, '0') + ':' + (s % 2 ? '30' : '00');

// Slots from Day 2 11:30 to the end of `lastDay`: fuel prices, burns, labels.
function windowTo(lastDay) {
  const price = [], burn = [], label = [];
  for (let day = 2; day <= lastDay; day++) {
    for (let s = day === 2 ? slot('11:30') : 0; s < 48; s++) {
      price.push(FUEL_SCHEDULE[String(day)][hhmm(s)][0]);
      burn.push(DEP_BURNS[hhmm(s)] || 0);
      label.push(day + ' ' + hhmm(s));
    }
  }
  return { price, burn, label };
}

test('the October schedule holds the Day 2 prices in the screenshots', () => {
  const d = FUEL_SCHEDULE['2'];
  const want = { '11:30': 1110, '14:00': 1500, '14:30': 2190, '15:00': 850, '15:30': 2420,
    '16:30': 1920, '18:00': 870, '20:00': 2340, '21:30': 720 };
  for (const [t, p] of Object.entries(want)) assert.strictEqual(d[t][0], p, t);
});

test('Day 2: reserves lasting >24 h → no fuel suggested before the $720 slot at 21:30', () => {
  const { price, burn, label } = windowTo(2);   // the day's own window
  const sug = monthOptimize(TANK, TANK, MIN_FUEL, price, burn, []);
  const cut = label.indexOf('2 21:30');
  sug.slice(0, cut).forEach((b, i) => assert.strictEqual(b, 0, 'no buy at ' + label[i]));
  // The cheapest slot in that window is where the tank is filled to full.
  const used = burn.slice(0, cut + 1).reduce((x, y) => x + y, 0);
  assert.strictEqual(sug[cut], used, 'fill to full at 21:30');
});

test('Day 2 inside the full-month plan: nothing before 21:30, nothing at an expensive slot', () => {
  const { price, burn, label } = windowTo(31);
  const sug = monthOptimize(TANK, TANK, MIN_FUEL, price, burn, []);
  const cut = label.indexOf('2 21:30');
  sug.slice(0, cut).forEach((b, i) => assert.strictEqual(b, 0, 'no buy at ' + label[i]));
  for (const t of ['11:30', '14:00', '14:30', '15:30', '16:30', '20:00']) {
    assert.strictEqual(sug[label.indexOf('2 ' + t)], 0, 'no buy at ' + t);
  }
  // Across the month, never a buy where a cheaper slot is reachable on the reserve
  // the member already holds.
  let reserve = TANK;
  for (let i = 0; i < sug.length; i++) {
    reserve -= burn[i];
    if (sug[i] > 0) {
      let r = reserve;
      for (let j = i + 1; j < sug.length && r - burn[j] > MIN_FUEL; j++) {
        r -= burn[j];
        assert.ok(price[j] >= price[i], `bought at ${label[i]} ($${price[i]}) though ${label[j]} ($${price[j]}) was reachable`);
      }
    }
    reserve += sug[i];
  }
});

test('stepping stones: buy at the cheapest reachable slot only enough to reach the next cheaper one', () => {
  // Slots 0..5, burn 100 each, floor 10, tank 1000, starting reserve 260.
  // Prices: 0 $9, 1 $5, 2 $7, 3 $6, 4 $1 (cheapest), 5 $8.
  // Slot 0 ($9): slot 1 is cheaper and reachable (260−100 ≥ 10) → buy nothing.
  // Slot 1 ($5): next cheaper is 4 ($1). Need to cover slots 1..3 (300) above the floor:
  //   reserve 160 → buy 310 − 160 = 150. Slot 3 ($6) is not cheaper than $5, so no stop there.
  // Slot 4 ($1): cheapest in the window → fill to full.
  const price = [9, 5, 7, 6, 1, 8];
  const burn = [100, 100, 100, 100, 100, 100];
  const sug = monthOptimize(260, 1000, 10, price, burn, []);
  assert.deepStrictEqual(sug.slice(0, 4), [0, 150, 0, 0]);
  assert.strictEqual(sug[4], 1000);   // reserve 10, burn 100 → empty after burn → a full tank
  assert.strictEqual(sug[5], 0);
});

test('a stone fills to full only when even a full tank cannot reach the next cheaper slot', () => {
  // Tank 300, floor 10. Slot 1 is the next cheaper, but the demand before it (400)
  // exceeds a tank, so slot 0 fills to full; nothing more is bought at slot 0's price.
  const price = [5, 1];
  const burn = [400, 0];
  const sug = monthOptimize(10, 300, 10, price, burn, []);
  assert.strictEqual(sug[0], 300);
});

test('CO2 runs the same rule on its own prices and floor', () => {
  // Same shape as fuel: reserves last the window, cheap slot last → nothing before it.
  const price = [140, 160, 150, 100];
  const burn = [83287050, 83287050, 83287050, 0];
  const sug = monthOptimize(900000000, 1000000000, 5000000, price, burn, []);
  assert.deepStrictEqual(sug.slice(0, 3), [0, 0, 0]);
});

test('entered purchases count as supply: no double-buying around them', () => {
  const price = [9, 5, 7, 6, 1, 8];
  const burn = [100, 100, 100, 100, 100, 100];
  const sug = monthOptimize(260, 1000, 10, price, burn, [0, 150]);   // the stone already bought
  assert.deepStrictEqual(sug.slice(0, 4), [0, 0, 0, 0]);
});

test('the forecast reserves column adds entered purchases only, never a suggestion', () => {
  // An entered purchase or a Suggested Buy typed by hand; never the optimizer's figure.
  const line = PAGE.match(/const planBuy=[^\n]*/)[0];
  const co2Line = PAGE.match(/const co2PlanBuy=[^\n]*/)[0];
  assert.doesNotMatch(line, /FSUG/);
  assert.doesNotMatch(co2Line, /CSUG/);
});

// ── LANDED flash and DEP ─────────────────────────────────────────────────────

function fleetSandbox() {
  const els = {};
  const el = id => (els[id] = els[id] || { id, value: '', textContent: '', className: '', classList: { toggle() {} } });
  const ctx = {
    BOXES: [], DEFAULT_DUR: 2, NOW: Date.parse('2026-10-02T11:30:00Z'),
    document: { getElementById: el },
    speedMult: () => 1, gameNowHour: () => 0,
    pushUndo() {}, syncBoxesFromDOM() {}, saveCards() {}, recalc() {}, applyDepartClasses() {},
  };
  ctx.Date = class extends Date { static now() { return ctx.NOW; } };
  vm.createContext(ctx);
  for (const n of ['parseEtaHours', 'remainingFlightMs', 'isLanded', 'departNow', 'updateETACountdowns', 'toggleDepart', 'departAll']) {
    vm.runInContext(fnSource(n), ctx);
  }
  vm.runInContext('function boxByKey(k){ return BOXES.find(b=>b.key===k); }', ctx);
  ctx.flashing = key => { vm.runInContext('updateETACountdowns()', ctx); return /overdue/.test(el('etacd_' + key).className); };
  const H = 3600000;
  ctx.box = (key, over) => {
    const b = Object.assign({ key, dur: 2, eta: '', etaSetTime: null, departed: false, depSetTime: null, recalledAt: null }, over);
    ctx.BOXES.push(b); el('etacd_' + key); el('eta_' + key).value = b.eta;
    return b;
  };
  ctx.H = H;
  return ctx;
}

test('land → flashing; DEP → not flashing (DEP clock)', () => {
  const c = fleetSandbox();
  c.box('b1', { departed: 9, depSetTime: c.NOW });
  c.NOW += 3 * c.H;                           // a 2 h flight has landed
  assert.ok(c.flashing('b1'), 'landed fleet flashes');
  vm.runInContext("toggleDepart('b1')", c);
  assert.ok(!c.flashing('b1'), 'DEP clears the flash');
  assert.notStrictEqual(c.BOXES[0].departed, false, 'DEP on a landed fleet departs it, it does not recall it');
  c.NOW += 3 * c.H;
  assert.ok(c.flashing('b1'), 'the flash returns only when the fleet lands again');
});

test('land → flashing; DEP → not flashing (typed ETA that has run out)', () => {
  const c = fleetSandbox();
  c.box('b1', { departed: false, eta: '01:00', etaSetTime: c.NOW });
  c.NOW += 2 * c.H;
  assert.ok(c.flashing('b1'));
  vm.runInContext("toggleDepart('b1')", c);
  assert.ok(!c.flashing('b1'), 'DEP clears the flash without typing an ETA');
  assert.strictEqual(c.BOXES[0].eta, '', 'the expired ETA is cleared');
  assert.strictEqual(c.document.getElementById('eta_b1').value, '', 'and its field emptied');
});

test('DEP ALL → no fleet flashing', () => {
  const c = fleetSandbox();
  c.box('b1', { departed: 9, depSetTime: c.NOW });
  c.box('b2', { departed: false, eta: '00:30', etaSetTime: c.NOW });
  c.box('b3', { departed: 9, depSetTime: c.NOW + 2 * c.H });   // still in the air afterwards
  c.NOW += 3 * c.H;
  assert.ok(c.flashing('b1') && c.flashing('b2'));
  assert.ok(!c.flashing('b3'));
  const b3Anchor = c.BOXES[2].depSetTime;
  vm.runInContext('departAll()', c);
  for (const k of ['b1', 'b2', 'b3']) assert.ok(!c.flashing(k), k + ' not flashing');
  assert.strictEqual(c.BOXES[2].depSetTime, b3Anchor, 'a fleet still in the air keeps its departure');
});

test('DEP on a fleet still in the air recalls it, as before', () => {
  const c = fleetSandbox();
  c.box('b1', { departed: 9, depSetTime: c.NOW });
  c.NOW += 0.5 * c.H;
  vm.runInContext("toggleDepart('b1')", c);
  assert.strictEqual(c.BOXES[0].departed, false);
});

// ── Suggested Buy typed by hand ─────────────────────────────────────────────

function pathwaySandbox(nowIso, schedule) {
  const ctx = { S: schedule, Infinity };
  vm.createContext(ctx);
  vm.runInContext("const TIMES=Array.from({length:48},(_,i)=>String(Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'30':'00'));", ctx);
  vm.runInContext(`function getGameNow(){ return new Date('${nowIso}'); }
    function getGameDay(){ return getGameNow().getUTCDate(); }
    function getGameSlotIndex(){ const n=getGameNow(); return n.getUTCHours()*2+(n.getUTCMinutes()>=30?1:0); }`, ctx);
  vm.runInContext(fnSource('monthOptimize'), ctx);
  vm.runInContext(fnSource('monthPathway'), ctx);
  return (...a) => vm.runInContext('monthPathway', ctx)(...a);
}

// Day 30 of a 31-day month from 22:00: two days, one cheap slot each night.
function twoDaySchedule() {
  const S = {};
  for (const d of ['30', '31']) {
    S[d] = {};
    for (let s = 0; s < 48; s++) S[d][hhmm(s)] = [2000, 150];
    S[d]['23:00'] = [500, 100];
  }
  return S;
}

test('Suggested Buy set to 0 by hand: no buy there, the reserves do not count one, the plan moves on', () => {
  const pathway = pathwaySandbox('2026-10-30T22:00:00Z', twoDaySchedule());
  const burn = new Array(48).fill(0); burn[slot('22:30')] = 600;
  const none = new Array(48).fill(0);
  const base = pathway(700, 1000, 10, burn, 0, none);
  const s23 = slot('23:00');
  assert.ok(base.sug[s23] > 0, 'the optimizer fills at 23:00');
  const ov = new Array(48).fill(null); ov[s23] = 0;
  const set = pathway(700, 1000, 10, burn, 0, none, ov);
  assert.strictEqual(set.sug[s23], 0, 'nothing suggested at a slot the member set to 0');
  assert.strictEqual(set.resNoSugByGlobal[s23], 100, 'reserves at 23:00: 700 − 600, nothing added');
});

test('Suggested Buy set to an amount by hand counts in the reserves and is not re-suggested', () => {
  const pathway = pathwaySandbox('2026-10-30T22:00:00Z', twoDaySchedule());
  const burn = new Array(48).fill(0); burn[slot('22:30')] = 600;
  const none = new Array(48).fill(0);
  const ov = new Array(48).fill(null); ov[slot('22:00')] = 250;   // topped up by hand at an expensive slot
  const p = pathway(700, 1000, 10, burn, 0, none, ov);
  assert.strictEqual(p.sug[slot('22:00')], 0);
  assert.strictEqual(p.resNoSugByGlobal[slot('22:00')], 950, '700 + 250 by hand');
  assert.strictEqual(p.resNoSugByGlobal[slot('22:30')], 350, 'then the 600 burn');
});

test('an entered purchase wins over a hand-set Suggested Buy at the same slot', () => {
  const pathway = pathwaySandbox('2026-10-30T22:00:00Z', twoDaySchedule());
  const burn = new Array(48).fill(0);
  const bought = new Array(48).fill(0); bought[slot('22:00')] = 100;
  const ov = new Array(48).fill(null); ov[slot('22:00')] = 400;
  const p = pathway(500, 1000, 10, burn, 0, bought, ov);
  assert.strictEqual(p.resNoSugByGlobal[slot('22:00')], 600);
});

test('the table reserves count a hand-set Suggested Buy, and both Suggested columns are inputs', () => {
  assert.match(PAGE, /const planBuy=past\?0:\(\(fPur\[i\]\|\|0\)>0\?bought:fOvBuy\);/);
  assert.match(PAGE, /const co2PlanBuy=past\?0:\(\(cPur\[i\]\|\|0\)>0\?co2Bought:cOvBuy\);/);
  assert.match(PAGE, /onchange="setSugOv\(\$\{i\},this\.value\)"/);
  assert.match(PAGE, /onchange="setCO2SugOv\(\$\{i\},this\.value\)"/);
});
