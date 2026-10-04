// node --test — ATL-160 Most Improved trophy
const test = require('node:test');
const assert = require('node:assert');
const MI = require('../lib/mostImproved');

const DAY = 86400e3, AT = Date.parse('2026-10-04T12:00:00Z');
const iso = t => new Date(t).toISOString();

// Uploads every `step` days from `from` days before the award up to the award;
// rate(n) is $/day for the interval that starts n days before the award.
function history(players, { step = 2, from = 36 } = {}) {
  const snaps = [], tot = {};
  for (let d = from; d >= 0; d -= step) {
    const t = AT - d * DAY;
    snaps.push({ timestamp: iso(t), players: players.map(p => {
      tot[p.name] = (tot[p.name] || 1e6) + (d < from ? p.rate(d + step) * step : 0);
      return { name: p.name, contributed: tot[p.name], cd: p.cd || 0 };
    }) });
  }
  return snaps;
}

const flat = r => () => r;
const jump = (base, cur) => n => (n <= 7 ? cur : base);

test('improvement % = (7-day avg − prior 28-day avg) ÷ prior 28-day avg, windows split exactly at the edges', () => {
  const snaps = history([{ name: 'A', rate: jump(50000, 80000) }], { step: 1 });
  const r = MI.computeMostImproved(snaps, { awardAt: iso(AT), rules: { ...MI.RULES, excludeTopRaw: 0 } });
  const a = r.rows[0];
  assert.strictEqual(Math.round(a.baseline), 50000);
  assert.strictEqual(Math.round(a.current), 80000);
  assert.strictEqual(a.pct.toFixed(1), '60.0');
  assert.deepStrictEqual(r.currentWindow, ['2026-09-27T12:00:00.000Z', '2026-10-04T12:00:00.000Z']);
  assert.deepStrictEqual(r.baselineWindow, ['2026-08-30T12:00:00.000Z', '2026-09-27T12:00:00.000Z']);
});

test('irregular uploads are time-weighted, not averaged per reading', () => {
  const t0 = AT - 7 * DAY;
  const pts = [{ t: t0, c: 0 }, { t: t0 + 6 * DAY, c: 6 * 10000 }, { t: t0 + 6.25 * DAY, c: 6 * 10000 + 0.25 * 90000 }];
  const w = MI.windowRate(pts, t0, t0 + 6.25 * DAY);
  assert.strictEqual(Math.round(w.avg), Math.round((60000 + 22500) / 6.25));
});

test('an interval crossing the window edge is split by time', () => {
  const pts = [{ t: 0, c: 0 }, { t: 2 * DAY, c: 200 }];
  assert.strictEqual(MI.windowRate(pts, DAY, 2 * DAY).avg, 100);
  assert.strictEqual(MI.windowRate(pts, 0, DAY).readings, 0);
});

test('top 10 raw (game C/D) and Hunter Elite names are excluded, not penalised', () => {
  const ps = Array.from({ length: 12 }, (_, i) => ({ name: 'P' + i, cd: 1000 - i, rate: jump(30000, 45000 + i) }));
  ps.push({ name: 'Hunted', cd: 1, rate: jump(30000, 90000) });
  const r = MI.computeMostImproved(history(ps), { awardAt: iso(AT), hunterNames: new Set(['hunted']) });
  assert.deepStrictEqual(r.eligible.map(e => e.name), ['P11', 'P10']);
  assert.ok(r.rows.find(x => x.name === 'P0').excluded.includes('top-10 raw'));
  assert.ok(r.rows.find(x => x.name === 'Hunted').excluded.includes('Hunter Elite'));
});

test('minimum readings, baseline span/coverage and $25k/day floor', () => {
  const rules = { ...MI.RULES, excludeTopRaw: 0 };
  const sparse = MI.computeMostImproved(history([{ name: 'S', rate: flat(20000) }], { step: 4 }), { awardAt: iso(AT), rules });
  assert.ok(sparse.rows[0].excluded.some(w => /this week \d<4|baseline \d<10/.test(w)));
  const low = MI.computeMostImproved(history([{ name: 'L', rate: jump(24000, 50000) }], { step: 1 }), { awardAt: iso(AT), rules });
  assert.ok(low.rows[0].excluded.includes('baseline <$25k/day'));
  const late = history([{ name: 'N', rate: flat(20000) }], { step: 1, from: 20 });
  const lr = MI.computeMostImproved(late, { awardAt: iso(AT), rules });
  assert.ok(lr.rows[0].excluded.includes('baseline not fully covered'));
});

test('strict coverage needs readings on 21 separate days; span needs 21 days first→last', () => {
  const rules = { ...MI.RULES, excludeTopRaw: 0 };
  const snaps = history([{ name: 'A', rate: jump(30000, 45000) }], { step: 2 });
  assert.strictEqual(MI.computeMostImproved(snaps, { awardAt: iso(AT), rules, coverage: 'span' }).eligible.length, 1);
  const strict = MI.computeMostImproved(snaps, { awardAt: iso(AT), rules, coverage: 'strict' });
  assert.strictEqual(strict.eligible.length, 0);
  assert.match(strict.rows[0].excluded.join(), /baseline reading-days 14<21/);
});

test('uploads after the award time are ignored', () => {
  const rules = { ...MI.RULES, excludeTopRaw: 0 };
  const snaps = history([{ name: 'A', rate: flat(20000) }], { step: 1 });
  snaps.push({ timestamp: iso(AT + DAY), players: [{ name: 'A', contributed: 9e9, cd: 0 }] });
  assert.strictEqual(Math.round(MI.computeMostImproved(snaps, { awardAt: iso(AT), rules }).rows[0].current), 20000);
});

test('award post: winner, baseline → this week, %, top 5 runners-up', () => {
  const ps = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => ({ name: n, rate: jump(40000, 80000 - i * 4000) }));
  const r = MI.computeMostImproved(history(ps, { step: 1 }), { awardAt: iso(AT), rules: { ...MI.RULES, excludeTopRaw: 0 } });
  assert.strictEqual(MI.formatAwardPost(r), [
    '🏆 **Beagle Most Improved — week ending Sun 4 Oct 2026**', '',
    '**A** 🏆', '$40,000/day → $80,000/day this week · **+100.0%**', '',
    'Runners-up', '2. B · +90.0%', '3. C · +80.0%', '4. D · +70.0%', '5. E · +60.0%', '6. F · +50.0%', '',
    'Raw contribution/day: this week (27 Sep–4 Oct, 12:00 UTC) vs the 28 days before. The top 10 of the raw ranking aren\'t eligible.',
  ].join('\n'));
  assert.strictEqual(MI.formatAwardPost({ ...r, winner: null }), null);
});

test('trophy store: tally per player across weeks, box blank until a win', () => {
  const store = { awards: {} };
  MI.recordAward(store, { weekKey: '2026-10-04', awardAt: '2026-10-04T12:00:00Z', winner: { name: 'Air Sorchy', pct: 80, baseline: 1, current: 2 }, eligible: [] });
  MI.recordAward(store, { weekKey: '2026-10-11', awardAt: '2026-10-11T12:00:00Z', winner: { name: 'air sorchy ', pct: 10, baseline: 1, current: 2 }, eligible: [] });
  const tally = MI.trophyTally(store);
  assert.strictEqual(MI.trophyBox(tally, 'Air Sorchy'), '🏆×2');
  assert.strictEqual(MI.trophyBox(tally, 'Stihl air'), '⬜');
});

test('scheduler: Sunday 12:00–12:59 UTC only, once per week, not before the first scheduled week', () => {
  const store = { awards: {} };
  assert.strictEqual(MI.dueAwardAt(Date.parse('2026-10-11T12:00:30Z'), store, '2026-10-11'), '2026-10-11T12:00:00.000Z');
  assert.strictEqual(MI.dueAwardAt(Date.parse('2026-10-11T13:00:00Z'), store, '2026-10-11'), null);
  assert.strictEqual(MI.dueAwardAt(Date.parse('2026-10-12T12:00:00Z'), store, '2026-10-11'), null);
  assert.strictEqual(MI.dueAwardAt(Date.parse('2026-10-04T12:10:00Z'), store, '2026-10-11'), null);
  store.awards['2026-10-11'] = { player: 'A' };
  assert.strictEqual(MI.dueAwardAt(Date.parse('2026-10-11T12:30:00Z'), store, '2026-10-11'), null);
});

test('ATL-161 improvementScores: percentile over every scored player incl. top 10; thin data and sub-floor normals score 50', () => {
  const players = [
    { name: 'Top', cd: 9e6, rate: jump(200000, 300000) },
    { name: 'Mid', rate: jump(50000, 60000) },
    { name: 'Low', rate: jump(80000, 64000) },
    { name: 'Small', rate: jump(10000, 30000) },
  ];
  const r = MI.computeMostImproved(history(players, { step: 1 }), { awardAt: iso(AT), rules: { ...MI.RULES, excludeTopRaw: 1 } });
  assert.ok(r.rows.find(x => x.name === 'Top').excluded.includes('top-1 raw'));
  const s = MI.improvementScores(r);
  assert.strictEqual(s.Top, 100, 'top raw is excluded from the award but still scored');
  assert.strictEqual(s.Mid, 50);
  assert.strictEqual(s.Low, 0);
  assert.strictEqual(s.Small, 50, 'normal under $25k/day is neutral');
  const thin = MI.computeMostImproved(history(players, { step: 1 }).slice(-3), { awardAt: iso(AT) });
  assert.ok(Object.values(MI.improvementScores(thin)).every(v => v === 50), 'too little data is neutral');
});

test('ATL-161 rating weights: Most Improved 15%, the other six × 0.85; missing score is neutral 50', () => {
  const { calcMeritScore } = require('../lib/engine');
  assert.strictEqual(calcMeritScore(100, 100, 100, 100, 100, 100, 100), 100);
  assert.strictEqual(calcMeritScore(0, 0, 0, 0, 0, 100, 100), 23.5);
  assert.strictEqual(calcMeritScore(0, 0, 0, 0, 0, 100), 16);
});
