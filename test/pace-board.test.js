// node --test — CURRENT PACE graph data (ATL-154 rework) and the projection chart model
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('esbuild');
const P = require('../lib/pace');

const jsx = f => esbuild.transformSync(fs.readFileSync(path.join(__dirname, '..', 'views', f), 'utf8'), { loader: 'jsx' }).code;
function boardLib() {
  const window = { PaceLib: P };
  vm.runInNewContext(jsx('pace-board.jsx'), { window, React: {} });
  return window.PaceBoardLib;
}
function appCtx() {
  const ctx = { window: { PaceLib: P, addEventListener() {} }, React: { createElement: () => ({}), Fragment: 'f' }, ReactDOM: { createRoot: () => ({ render() {} }) }, document: { getElementById: () => ({}) } };
  vm.runInNewContext(jsx('projections-app.jsx'), ctx);
  return ctx;
}

const ASOF = '2026-10-03T14:43:59.602Z';
const T = h => new Date(Date.parse(ASOF) - h * 3600000).toISOString();
function fixture() {
  // 20 alliances; Beagle is pace #3 and SV #13. Every rival gets a stored history.
  const al = [];
  for (let i = 0; i < 20; i++) {
    const isBeagle = i === 2;
    al.push({ name: isBeagle ? 'Beagle Global' : 'Team ' + i, isBeagle, sv: isBeagle ? 3706.16 : 9000 - i * 300, pace: 9 - i * 0.4, paceRank: i + 1, rank: isBeagle ? 13 : i + 1, windowDays: 1.014 });
  }
  const beagle = al[2];
  for (const r of al) if (!r.isBeagle) { r.gap = r.sv - beagle.sv; const cd = r.gap > 0 ? P.catchDay(beagle, r) : P.catchDay(r, beagle); r.catchDaysLinear = cd == null ? null : Math.round(cd * 10) / 10; }
  const labels = ['1 Oct', '2 Oct', '3 Oct'];
  const hist = { end: '2026-10-03', labels, teams: al.map(r => ({ name: r.name, points: [{ y: r.pace - 0.2 }, { y: null }, { y: r.isBeagle ? 7.545 : r.pace }] })) };
  const rd = { series: al.map((r, i) => ({ name: r.name, readings: [{ t: T(48.5), sv: r.sv - 2 * r.pace - (i % 3) }, { t: T(24.3), sv: r.sv - r.pace }, { t: ASOF, sv: r.sv }] })) };
  return { board: { asOf: ASOF, alliances: al }, hist, rd };
}

test('rows: pace-rank order, two halves of ten, Beagle gold, ten distinct neon colours per half', () => {
  const L = boardLib(), f = fixture();
  const rows = L.buildRows(f.board, f.hist, f.rd);
  assert.deepStrictEqual(Array.from(rows.map(r => r.paceRank)), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.strictEqual(rows.filter(r => r.half === 0).length, 10);
  assert.strictEqual(rows.find(r => r.isBeagle).color, L.GOLD);
  for (const h of [0, 1]) { const c = rows.filter(r => r.half === h).map(r => r.color); assert.strictEqual(new Set(c).size, 10); }
});

test('TODAY is the latest daily point; a day with no upload stays nil (never filled)', () => {
  const L = boardLib(), f = fixture();
  const b = L.buildRows(f.board, f.hist, f.rd).find(r => r.isBeagle);
  assert.strictEqual(b.today, 7.545);
  assert.strictEqual(b.pts[1], null);
  assert.deepStrictEqual(Array.from(L.nilDaysOf(f.hist)), [1]);
});

test('average since 10 Jan 2026 = share value gained since the datum ÷ exact days', () => {
  const L = boardLib(), f = fixture();
  const b = L.buildRows(f.board, f.hist, f.rd).find(r => r.isBeagle);
  const days = (Date.parse(ASOF) - Date.parse(L.DATUM_T)) / 86400000;
  assert.ok(Math.abs(b.avg - (3706.16 - 2179.67) / days) < 1e-9);
});

test('last move is the % change of the latest pace on the one before; rank #1 = worst move', () => {
  const L = boardLib(), f = fixture();
  const rows = L.buildRows(f.board, f.hist, f.rd);
  const worst = rows.slice().sort((a, b) => a.move - b.move)[0];
  assert.strictEqual(worst.moveRank, 1);
  assert.deepStrictEqual(Array.from(rows.map(r => r.moveRank)).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  const pct = L.lastMove([{ t: T(48), sv: 100 }, { t: T(24), sv: 110 }, { t: ASOF, sv: 121 }]);
  assert.ok(Math.abs(pct - 10) < 1e-9);
});

test('days / date to pass use today’s pace, straight line', () => {
  const L = boardLib(), f = fixture();
  const rows = L.buildRows(f.board, f.hist, f.rd);
  const b = rows.find(r => r.isBeagle);
  const next = f.board.alliances.filter(a => !a.isBeagle && a.sv > b.sv).sort((x, y) => x.sv - y.sv)[0];
  assert.ok(b.pass.txt.startsWith('passes #' + next.rank + ' · '), b.pass.txt);
  assert.strictEqual(b.pass.who, next.name);
  assert.ok(Math.abs(b.pass.days - (next.sv - b.sv) / (b.pace - next.pace)) < 1e-9);
  const ahead = rows.find(r => !r.isBeagle && r.gap > 0 && r.catchDaysLinear != null);
  assert.match(ahead.pass.txt, /^Beagle passes \d+d · \d+ \w{3}$/);
  assert.strictEqual(L.hmm(1.014), '24:20');
});

test('OVERTAKE: Beagle climbs from 0 at NOW (not pinned flat); dots sit on Beagle’s line', () => {
  const ctx = appCtx(), f = fixture();
  const m = ctx.buildModel(f.board, { view: 'gap', days: 182.6, focus: 'all', trend: false, log: false, colorOf: () => '#fff' });
  const b = m.series.find(s => s.isBeagle);
  assert.strictEqual(b.pts[0][1], 0);
  assert.ok(Math.abs(b.pts[b.pts.length - 1][1] - 8.2 * 182.6) < 1e-6, 'Beagle carries its projected climb');
  assert.ok(m.markers.length > 0);
  for (const mk of m.markers) assert.ok(Math.abs(mk.y - 8.2 * mk.x) < 1e-6);
});

test('right-edge labels: projected rank at the horizon, current rank secondary', () => {
  const ctx = appCtx(), f = fixture();
  for (const view of ['gap', 'rank', 'sv']) for (const days of [20, 30.4, 60.9, 91.3, 182.6, 365.2]) {
    const m = ctx.buildModel(f.board, { view, days, focus: 'all', trend: false, log: false, colorOf: () => '#fff' });
    const proj = f.board.alliances.map(r => ({ n: r.name, v: P.projectSV(r.sv, r.pace, 0, days) })).sort((a, b) => b.v - a.v);
    const rk = m.rankAt(days);
    proj.forEach((p, i) => assert.strictEqual(rk.get(p.n), i + 1));
  }
  const src = fs.readFileSync(path.join(__dirname, '..', 'views', 'projections-app.jsx'), 'utf8');
  assert.match(src, /const txt = \(pr \? '#' \+ pr \+ ' ' : ''\)/);
  assert.match(src, /'now #' \+ s\.rank/);
});
