// node --test test/*.test.js — canonical pace (ATL-131)
const test = require('node:test');
const assert = require('node:assert');
const P = require('../lib/pace');

const DAY = 86400000, HOUR = 3600000;
const T0 = Date.parse('2026-07-01T10:00:00Z');
const series = (days, svAt) => Array.from({ length: days + 1 }, (_, i) => ({ t: new Date(T0 + i * DAY).toISOString(), sv: svAt(i) }));

test('current pace = SV since the previous upload ÷ exact elapsed time (Operator definition)', () => {
  const rs = series(40, d => 1000 + 5 * d);
  rs.push({ t: T0 + 40 * DAY + 26 * HOUR, sv: 1200 + 6.5 * 26 / 24 });  // 26 h later, faster day
  const cp = P.canonicalPace(rs);
  assert.strictEqual(cp.method, 'current');
  assert.strictEqual(cp.pace, 6.5);
  assert.ok(Math.abs(cp.windowDays - 26 / 24) < 1e-3);
  assert.match(cp.label, /^current pace · 26\.0 h since previous upload$/);
});

test('a re-paste inside 20 h is not the previous upload', () => {
  const rs = series(10, d => 1000 + 5 * d);
  rs.push({ t: T0 + 10 * DAY + 3 * HOUR, sv: 1050.2 });   // 3 h after the last upload
  const cp = P.canonicalPace(rs);
  // previous upload is day 9 (27 h before), not day 10 (3 h before)
  assert.ok(Math.abs(cp.windowDays - 27 / 24) < 1e-3);
  assert.ok(Math.abs(cp.pace - (1050.2 - 1045) / (27 / 24)) < 1e-3);
});

test('7-day and 30-day context and a steady trend for a constant rate', () => {
  const cp = P.canonicalPace(series(60, d => 1000 + 5 * d));
  assert.strictEqual(cp.pace, 5);
  assert.strictEqual(cp.weekPace, 5);
  assert.strictEqual(cp.longPace, 5);
  assert.strictEqual(cp.trend, 'steady');
  assert.ok(Math.abs(cp.accel) < 1e-6);
});

test('accelerating alliance reads accelerating and the trend projection bends up', () => {
  const cp = P.canonicalPace(series(60, d => 1000 + 4 * d + 0.02 * d * d));
  assert.strictEqual(cp.trend, 'accelerating');
  assert.ok(cp.accel > 0);
  assert.ok(P.projectSV(1000, cp.pace, cp.accel, 90) > P.projectSV(1000, cp.pace, 0, 90));
});

test('decelerating pace never projects a falling share value', () => {
  for (let d = 0; d <= 3650; d += 30) assert.ok(P.projectedPace(2, -0.5, d) >= -1e-9);
  assert.ok(P.projectSV(1000, 2, -0.5, 3650) >= 1000);
});

test('readings under 20 h apart give no pace; baseline datum is the named fallback', () => {
  assert.strictEqual(P.canonicalPace([{ t: T0, sv: 100 }, { t: T0 + 3 * HOUR, sv: 101 }]).pace, null);
  const cp = P.canonicalPace([{ t: T0 + 20 * DAY, sv: 1100 }], { datum: { t: T0, sv: 1000 } });
  assert.strictEqual(cp.method, 'datum');
  assert.strictEqual(cp.pace, 5);
  assert.match(cp.label, /baseline/);
});

test('catchDay: linear closed form; trend catches sooner when the chaser accelerates', () => {
  const leader = { sv: 1100, pace: 5, accel: 0 };
  assert.strictEqual(P.catchDay({ sv: 1000, pace: 7 }, leader), 50);
  const t = P.catchDay({ sv: 1000, pace: 7, accel: 0.02 }, leader, { trend: true });
  assert.ok(t > 0 && t < 50);
  assert.strictEqual(P.catchDay({ sv: 1000, pace: 4 }, leader), null);
});

test('board: one method for every alliance; the post prints the board numbers', () => {
  const now = new Date(T0 + 60 * DAY);
  const board = P.canonicalBoard({
    asOf: now.toISOString(),
    beagle: { name: 'Beagle Global', rank: 3, sv: 1000 + 7 * 60, readings: series(60, d => 1000 + 7 * d), memberCdPace: 7.2 },
    alliances: [
      { name: 'Leader', rank: 1, sv: 2000 + 5 * 60, readings: series(60, d => 2000 + 5 * d) },
      { name: 'Next', rank: 2, sv: 1500 + 6 * 60, readings: series(60, d => 1500 + 6 * d) },
      { name: 'Chaser', rank: 4, sv: 900 + 8 * 60, readings: series(60, d => 900 + 8 * d) },
    ],
  });
  assert.deepStrictEqual([...new Set(board.alliances.map(r => r.method))], ['current']);
  assert.strictEqual(board.beagle.pace, 7);
  const next = board.alliances.find(r => r.name === 'Next');
  assert.strictEqual(next.closing, 1);
  assert.strictEqual(next.catchDaysLinear, 440);
  const post = P.formatProjectionsPost(board, { now, chartUrl: 'https://x/?k=K' });
  assert.match(post, /Beagle Global #3 — \$1,420\.00 — Pace \$7\.00\/day \(current pace · 24\.0 h since previous upload\)/);
  assert.match(post, /7-day \$7\.00 · 30-day \$7\.00 · trend steady/);
  assert.match(post, /#2 Next — .* Closing \$1\.00\/day — ETA 440 days/);
  assert.match(post, /#4 Chaser — .* Closing \$1\.00\/day/);
  assert.match(post, /Member C\/D today: \$7\.20\/day \(reference\)/);
});
