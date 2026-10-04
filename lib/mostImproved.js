// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE — MOST IMPROVED TROPHY (ATL-160)
// Raw contribution/day, this week vs the 28 days before. Contribution/day is
// the time-weighted rate of the cumulative "Contributed" column between
// consecutive uploads, split exactly at the window edges (UTC). Additive to the
// raw ranking; merit score is never used.
// ═══════════════════════════════════════════════════════════════════════════
const DAY = 86400e3;
const DUP_MS = 5 * 60e3;   // re-pastes within 5 min are the same reading

const RULES = {
  currentDays: 7, baselineDays: 28,
  minCurrentReadings: 4, minBaselineReadings: 10,
  minBaselineSpanDays: 21, minBaselineRate: 25000,  // $25k/day 28-day normal (Nathan, 4 Oct)
  excludeTopRaw: 10, runnersUp: 5,
};

const nk = s => String(s || '').toLowerCase().trim();

function playerSeries(snapshots, key) {
  const pts = [];
  for (const s of snapshots) {
    const t = Date.parse(s.timestamp);
    const p = (s.players || []).find(x => nk(x.name) === key);
    if (!p || !isFinite(t) || !(p.contributed > 0)) continue;
    if (pts.length && t - pts[pts.length - 1].t < DUP_MS) continue;
    pts.push({ t, c: p.contributed });
  }
  return pts;
}

function windowRate(pts, a, b) {
  let num = 0, den = 0, n = 0, first = null, last = null;
  const days = new Set();
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const ov = Math.min(b, p1.t) - Math.max(a, p0.t);
    if (ov <= 0) continue;
    num += (p1.c - p0.c) / (p1.t - p0.t) * ov;
    den += ov;
  }
  for (const p of pts) {
    if (p.t <= a || p.t > b) continue;
    n++; days.add(new Date(p.t).toISOString().slice(0, 10));
    if (first == null) first = p.t;
    last = p.t;
  }
  return {
    avg: den ? num / den * DAY : null, covered: den / (b - a), readings: n,
    readingDays: days.size, spanDays: first == null ? 0 : (last - first) / DAY,
  };
}

// coverage: 'span' — baseline readings span 21+ days and uploads cover the whole
// 28-day window; 'strict' — readings on 21+ separate UTC days.
function computeMostImproved(snapshots, { awardAt, hunterNames = new Set(), coverage = 'span', rules = RULES } = {}) {
  const at = Date.parse(awardAt);
  const snaps = (snapshots || [])
    .filter(s => Date.parse(s.timestamp) <= at)
    .sort((x, y) => Date.parse(x.timestamp) - Date.parse(y.timestamp));
  const latest = snaps[snaps.length - 1];
  if (!latest) return { awardAt: new Date(at).toISOString(), rows: [], eligible: [], winner: null };
  const c0 = at - rules.currentDays * DAY, b0 = c0 - rules.baselineDays * DAY;
  const raw = [...latest.players].sort((x, y) => (y.cd || 0) - (x.cd || 0));
  const rawRank = new Map(raw.map((p, i) => [nk(p.name), i + 1]));
  const hunters = new Set([...hunterNames].map(nk));
  const rows = latest.players.map(p => {
    const key = nk(p.name), pts = playerSeries(snaps, key);
    const cur = windowRate(pts, c0, at), base = windowRate(pts, b0, c0);
    const why = [];
    if (rawRank.get(key) <= rules.excludeTopRaw) why.push('top-' + rules.excludeTopRaw + ' raw');
    if (hunters.has(key)) why.push('Hunter Elite');
    if (cur.readings < rules.minCurrentReadings) why.push('this week ' + cur.readings + '<' + rules.minCurrentReadings + ' readings');
    if (base.readings < rules.minBaselineReadings) why.push('baseline ' + base.readings + '<' + rules.minBaselineReadings + ' readings');
    if (coverage === 'strict' && base.readingDays < rules.minBaselineSpanDays) why.push('baseline reading-days ' + base.readingDays + '<' + rules.minBaselineSpanDays);
    if (coverage !== 'strict' && base.spanDays < rules.minBaselineSpanDays) why.push('baseline span ' + base.spanDays.toFixed(1) + 'd<' + rules.minBaselineSpanDays);
    if (base.covered < 0.999) why.push('baseline not fully covered');
    if (base.avg != null && base.avg < rules.minBaselineRate) why.push('baseline <$' + rules.minBaselineRate / 1000 + 'k/day');
    const pct = base.avg > 0 && cur.avg != null ? (cur.avg - base.avg) / base.avg * 100 : null;
    if (pct == null && !why.length) why.push('no rate');
    return { name: p.name, rawRank: rawRank.get(key), baseline: base.avg, current: cur.avg, pct,
      currentReadings: cur.readings, baselineReadings: base.readings, baselineReadingDays: base.readingDays,
      baselineSpanDays: base.spanDays, excluded: why };
  });
  const eligible = rows.filter(r => !r.excluded.length).sort((x, y) => y.pct - x.pct);
  return {
    awardAt: new Date(at).toISOString(), weekKey: weekKey(at), coverage,
    currentWindow: [new Date(c0).toISOString(), new Date(at).toISOString()],
    baselineWindow: [new Date(b0).toISOString(), new Date(c0).toISOString()],
    rows, eligible, winner: eligible[0] || null,
  };
}

// ATL-161 rating factor: every player's improvement as a 0-100 percentile.
// Top-10 and Hunter exclusions are award-only; too little data or a normal
// under the floor scores neutral 50.
const AWARD_ONLY = /^(top-\d+ raw|Hunter Elite)$/;
function improvementScores(result) {
  const rows = (result && result.rows) || [];
  const scored = rows.filter(r => r.pct != null && r.excluded.every(w => AWARD_ONLY.test(w)));
  const sorted = scored.map(r => r.pct).sort((a, b) => a - b);
  const n = sorted.length;
  const out = {};
  for (const r of rows) out[r.name] = 50;
  for (const r of scored) {
    if (n < 2) continue;
    const below = sorted.filter(v => v < r.pct).length;
    const equal = sorted.filter(v => v === r.pct).length;
    out[r.name] = Math.round((below + (equal - 1) / 2) / (n - 1) * 1000) / 10;
  }
  return out;
}

function weekKey(at) { return new Date(typeof at === 'number' ? at : Date.parse(at)).toISOString().slice(0, 10); }

const money = v => '$' + Math.round(v).toLocaleString('en-US');
const signed = p => (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (iso, withYear) => { const d = new Date(iso); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + (withYear ? ' ' + d.getUTCFullYear() : ''); };

function formatAwardPost(result, rules = RULES) {
  const w = result.winner;
  if (!w) return null;
  const end = result.currentWindow[1];
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(end).getUTCDay()];
  const runners = result.eligible.slice(1, 1 + rules.runnersUp).map((r, i) => (i + 2) + '. ' + r.name + ' · ' + signed(r.pct));
  return [
    '🏆 **Beagle Most Improved — week ending ' + day + ' ' + dm(end, true) + '**',
    '',
    '**' + w.name + '** 🏆',
    money(w.baseline) + '/day → ' + money(w.current) + '/day this week · **' + signed(w.pct) + '**',
    '',
    'Runners-up',
    ...runners,
    '',
    'Raw contribution/day: this week (' + dm(result.currentWindow[0]) + '–' + dm(end) + ', ' + new Date(end).toISOString().slice(11, 16) + ' UTC) vs the 28 days before. The top ' + rules.excludeTopRaw + ' of the raw ranking aren\'t eligible.',
  ].join('\n');
}

function trophyTally(store) {
  const tally = new Map();
  for (const a of Object.values((store && store.awards) || {})) {
    if (a && a.player) tally.set(nk(a.player), (tally.get(nk(a.player)) || 0) + 1);
  }
  return tally;
}

function trophyBox(tally, name) {
  const n = tally.get(nk(name)) || 0;
  return n ? '🏆×' + n : '⬜';
}

// Weekly award: Sunday 12:00 UTC (20:00 AWST). Only inside that hour, so a
// redeploy later on a Sunday never fires a late, unreviewed post.
function dueAwardAt(now, store, autoFrom) {
  const d = new Date(now);
  if (d.getUTCDay() !== 0 || d.getUTCHours() !== 12) return null;
  const at = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
  const key = weekKey(at);
  if (autoFrom && key < autoFrom) return null;
  if (store && store.awards && store.awards[key]) return null;
  return new Date(at).toISOString();
}

// The six eligible players the award graphic shows, with their $/day and % (ATL-160 tab).
function topSix(result) {
  return result.eligible.slice(0, 6).map(r => ({ name: r.name, baseline: Math.round(r.baseline), current: Math.round(r.current), pct: Math.round(r.pct * 10) / 10 }));
}

function recordAward(store, result, sentAt) {
  store.awards = store.awards || {};
  store.awards[result.weekKey] = {
    player: result.winner ? result.winner.name : null,
    pct: result.winner ? Math.round(result.winner.pct * 10) / 10 : null,
    baseline: result.winner ? Math.round(result.winner.baseline) : null,
    current: result.winner ? Math.round(result.winner.current) : null,
    runnersUp: result.eligible.slice(1, 1 + RULES.runnersUp).map(r => ({ name: r.name, pct: Math.round(r.pct * 10) / 10 })),
    top: topSix(result),
    currentWindow: result.currentWindow,
    awardAt: result.awardAt, sentAt: sentAt || new Date().toISOString(),
  };
  return store;
}

module.exports = { RULES, dm, nk, topSix, computeMostImproved, improvementScores, formatAwardPost, trophyTally, trophyBox, dueAwardAt, recordAward, weekKey, windowRate };
