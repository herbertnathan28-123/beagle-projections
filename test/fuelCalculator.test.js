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

// Day 2 (2 Oct 2026), 11:30 NOW slot, as in Nathan's screenshots. Burns are the
// departures the screenshots imply; prices not shown there are set at $1,800 so the
// day's cheap slots are exactly the ones named in the work order.
function day2() {
  const from = slot('11:30');
  const prices = {
    '11:30': 1110, '14:00': 1500, '14:30': 2190, '15:00': 850, '15:30': 2420,
    '16:30': 1920, '18:00': 870, '20:00': 2340, '21:30': 720,
  };
  const burns = {
    '11:30': 66348755, '14:00': 407044881, '14:30': 69858911,
    '15:30': 69858911, '16:30': 69858911, '20:00': 69858911,
  };
  const price = [], burn = [];
  for (let s = from; s < 48; s++) {
    const t = String(Math.floor(s / 2)).padStart(2, '0') + ':' + (s % 2 ? '30' : '00');
    price.push(prices[t] != null ? prices[t] : 1800);
    burn.push(burns[t] || 0);
  }
  return { from, price, burn };
}

test('Day 2: reserves lasting >24 h → no fuel suggested before the $720 slot at 21:30', () => {
  const { from, price, burn } = day2();
  const sug = monthOptimize(TANK, TANK, MIN_FUEL, price, burn, []);
  const at = t => sug[slot(t) - from];
  for (const t of ['11:30', '14:00', '14:30', '15:00', '15:30', '16:30', '18:00', '20:00']) {
    assert.strictEqual(at(t), 0, 'no buy at ' + t);
  }
  sug.forEach((b, i) => { if (i < slot('21:30') - from) assert.strictEqual(b, 0, 'no buy before 21:30'); });
  // The cheapest slot in the window is where the tank is filled to full.
  const burnBefore = burn.slice(0, slot('21:30') - from + 1).reduce((a, b) => a + b, 0);
  assert.strictEqual(at('21:30'), burnBefore, 'fill to full at the cheapest slot');
});

test('Day 2: no buy at any expensive departure slot', () => {
  const { from, price, burn } = day2();
  const sug = monthOptimize(TANK, TANK, MIN_FUEL, price, burn, []);
  for (const [t, p] of [['11:30', 1110], ['14:00', 1500], ['14:30', 2190], ['15:30', 2420], ['16:30', 1920], ['20:00', 2340]]) {
    assert.strictEqual(sug[slot(t) - from], 0, `$${p} at ${t}`);
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
  assert.match(PAGE, /const planBuy=past\?0:bought;/);
  assert.match(PAGE, /const co2PlanBuy=past\?0:co2Bought;/);
  assert.doesNotMatch(PAGE, /planBuy=past\?0:\(\(fPur\[i\]\|\|0\)>0\?bought:FSUG\[i\]\)/);
});
