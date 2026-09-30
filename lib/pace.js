// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE — CANONICAL PACE (ATL-131)
//
// One function decides what "pace" means, for every alliance, on every surface:
// the dashboard header, the projection rows and chart, the alliance cards, the
// /pace page and the Discord projections post all read canonicalPace(),
// directly or through canonicalBoard(). Nothing else computes a pace for display.
//
// PACE is the Operator's definition (7 Aug 2026, recorded in views/pace.js):
//
//   CURRENT PACE = (SV this upload − SV previous upload)
//                  ÷ exact elapsed time between those two uploads
//
// "Previous upload" is the most recent stored reading at least 20 h older than
// the latest — the same 20 h floor lib/storage.js and the /pace page apply, so
// a re-paste minutes later is not mistaken for a new day. The measured interval
// is returned with the figure and printed beside it everywhere.
//
// Context, never a substitute: the same measurement over ~7 days and ~30 days.
// TREND = 7-day rate vs 30-day rate; the difference over the gap between the
// two windows' midpoints is the acceleration in $/day per day. The curved
// projection starts from the current pace and carries that acceleration forward
// with a 14-day time constant — the pace keeps moving by roughly the change it
// has shown and then holds, rather than compounding for years. The straight
// line at the current pace is always available beside it.
//
// Fallbacks, each named in the label: no reading 20 h–30 d older than the
// latest → average since the baseline datum; no datum → no pace (shown as
// "no reading", never as zero).
//
// Pure functions: readings in, numbers out. No I/O.
// ═══════════════════════════════════════════════════════════════════════════

const DAY_MS = 86400000;

const WEEK = { target: 7, min: 5, max: 10 };     // 7-day context window (days)
const LONG = { target: 30, min: 21, max: 45 };   // 30-day context window (days)
const MIN_WINDOW_DAYS = 20 / 24;                 // 20 h floor, same as lib/storage.js and /pace
const MAX_CURRENT_DAYS = 30;                     // a "previous upload" older than this is not current
const TREND_TAU_DAYS = 14;                       // acceleration time constant
const STEADY_BAND = 0.03;                        // within ±3 % of the 30-day rate reads as steady

function ms(t) { return typeof t === 'number' ? t : Date.parse(t); }

// Sorted, de-duplicated by timestamp (last value wins), numeric only.
function cleanReadings(readings) {
  const byT = new Map();
  for (const r of readings || []) {
    if (!r || r.sv == null || isNaN(r.sv)) continue;
    const t = ms(r.t != null ? r.t : r.timestamp);
    if (isNaN(t)) continue;
    byT.set(t, { t, sv: Number(r.sv) });
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

// Reading whose age (days before `last`) is inside [min, max], closest to target.
function pickAnchor(rs, last, band) {
  let best = null, bestDiff = Infinity;
  for (const r of rs) {
    if (r.t >= last.t) continue;
    const age = (last.t - r.t) / DAY_MS;
    if (age < band.min || age > band.max) continue;
    const diff = Math.abs(age - band.target);
    if (diff < bestDiff) { best = r; bestDiff = diff; }
  }
  return best;
}

// The previous upload: the most recent reading at least 20 h before the latest.
function previousUpload(rs, last) {
  for (let i = rs.length - 1; i >= 0; i--) {
    const age = (last.t - rs[i].t) / DAY_MS;
    if (age >= MIN_WINDOW_DAYS) return age <= MAX_CURRENT_DAYS ? rs[i] : null;
  }
  return null;
}

function rate(from, to) {
  const days = (to.t - from.t) / DAY_MS;
  if (!(days > 0)) return null;
  return { pace: (to.sv - from.sv) / days, days, from, to };
}

function round(v, dp) { if (v == null || !isFinite(v)) return null; const f = 10 ** dp; return Math.round(v * f) / f; }

function fmtWindow(days) {
  return days >= 2 ? days.toFixed(1) + ' d' : (days * 24).toFixed(1) + ' h';
}

// The canonical pace for one alliance.
//   readings: [{ t|timestamp, sv }] — stored SV history including the current reading
//   opts.datum: { t, sv } baseline used only when there is no previous upload
function canonicalPace(readings, opts = {}) {
  const rs = cleanReadings(readings);
  const last = rs[rs.length - 1] || null;
  const out = {
    pace: null, method: null, label: 'no reading', windowDays: null, from: null, to: last ? new Date(last.t).toISOString() : null,
    weekPace: null, weekWindowDays: null, longPace: null, longWindowDays: null, accel: null, trend: null, readings: rs.length,
  };
  if (!last) return out;

  let cur = null, method = null;
  const prev = previousUpload(rs, last);
  if (prev) { cur = rate(prev, last); method = 'current'; }
  if (!cur && opts.datum && opts.datum.sv != null) {
    const d = { t: ms(opts.datum.t), sv: Number(opts.datum.sv) };
    const r = d.t < last.t ? rate(d, last) : null;
    if (r && r.days >= MIN_WINDOW_DAYS) { cur = r; method = 'datum'; }
  }
  if (!cur) return out;

  out.pace = round(cur.pace, 3);
  out.method = method;
  out.windowDays = round(cur.days, 3);
  out.from = new Date(cur.from.t).toISOString();
  out.label = method === 'current'
    ? 'current pace · ' + fmtWindow(cur.days) + ' since previous upload'
    : 'average since ' + new Date(cur.from.t).toISOString().slice(0, 10) + ' baseline (no previous upload on record)';

  const aw = pickAnchor(rs, last, WEEK), al = pickAnchor(rs, last, LONG);
  const week = aw ? rate(aw, last) : null, long = al ? rate(al, last) : null;
  if (week) { out.weekPace = round(week.pace, 3); out.weekWindowDays = round(week.days, 2); }
  if (long) { out.longPace = round(long.pace, 3); out.longWindowDays = round(long.days, 2); }
  if (week && long && long.days > week.days + 3) {
    // Midpoint ages of the two windows; the rate difference over the gap
    // between them is the acceleration.
    const gap = (long.days - week.days) / 2;
    out.accel = round((week.pace - long.pace) / gap, 5);
    const rel = long.pace !== 0 ? (week.pace - long.pace) / Math.abs(long.pace) : 0;
    out.trend = Math.abs(rel) < STEADY_BAND ? 'steady' : rel > 0 ? 'accelerating' : 'decelerating';
  }
  return out;
}

// Projected SV `d` days ahead. With accel = 0 (or trend off) this is the
// straight line sv + pace·d. With accel the pace moves toward
// pace + accel·τ with time constant τ, and never below zero.
function projectSV(sv, pace, accel, d, tau = TREND_TAU_DAYS) {
  if (sv == null || pace == null) return null;
  let a = accel || 0;
  if (a < 0 && pace + a * tau < 0) a = -pace / tau;   // pace cannot turn negative
  if (!a) return sv + pace * d;
  return sv + pace * d + a * tau * (d - tau * (1 - Math.exp(-d / tau)));
}

function projectedPace(pace, accel, d, tau = TREND_TAU_DAYS) {
  if (pace == null) return null;
  let a = accel || 0;
  if (a < 0 && pace + a * tau < 0) a = -pace / tau;
  return pace + a * tau * (1 - Math.exp(-d / tau));
}

// First day (fractional) within `horizon` on which `chaser` reaches `leader`,
// or null. Linear mode has a closed form; trend mode is stepped daily then
// refined by bisection.
function catchDay(chaser, leader, { trend = false, horizon = 3650 } = {}) {
  if (!chaser || !leader || chaser.pace == null || leader.pace == null) return null;
  const gap0 = leader.sv - chaser.sv;
  if (gap0 <= 0) return 0;
  if (!trend) {
    const closing = chaser.pace - leader.pace;
    if (closing <= 0) return null;
    const d = gap0 / closing;
    return d <= horizon ? d : null;
  }
  const g = d => projectSV(leader.sv, leader.pace, leader.accel, d) - projectSV(chaser.sv, chaser.pace, chaser.accel, d);
  let prev = 0;
  for (let d = 1; d <= horizon; d++) {
    if (g(d) <= 0) {
      let lo = prev, hi = d;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (g(m) <= 0) hi = m; else lo = m; }
      return hi;
    }
    prev = d;
  }
  return null;
}

// Every alliance measured the same way. Input:
//   { asOf, beagle: { name, sv, rank, readings, memberCdPace, memberCdAt },
//     alliances: [{ name, sv, rank, readings, datum }], datum }
function canonicalBoard(input) {
  const rows = [];
  const add = (a, isBeagle) => {
    const cp = canonicalPace(a.readings, { datum: a.datum || input.datum });
    rows.push({
      name: a.name, rank: a.rank ?? null, sv: a.sv, isBeagle: !!isBeagle,
      pace: cp.pace, accel: cp.accel, trend: cp.trend, weekPace: cp.weekPace, longPace: cp.longPace,
      method: cp.method, label: cp.label, windowDays: cp.windowDays, weekWindowDays: cp.weekWindowDays, longWindowDays: cp.longWindowDays,
      from: cp.from, to: cp.to, readings: cp.readings,
    });
  };
  if (input.beagle) add(input.beagle, true);
  for (const a of input.alliances || []) add(a, false);
  rows.sort((x, y) => (x.rank ?? 999) - (y.rank ?? 999) || y.sv - x.sv);
  const withPace = rows.filter(r => r.pace != null).sort((x, y) => y.pace - x.pace);
  withPace.forEach((r, i) => { r.paceRank = i + 1; });
  const beagle = rows.find(r => r.isBeagle) || null;
  for (const r of rows) {
    if (!beagle || r.isBeagle) continue;
    r.gap = round(r.sv - beagle.sv, 2);                  // + = ahead of Beagle
    r.closing = r.pace != null && beagle.pace != null ? round(beagle.pace - r.pace, 3) : null; // + = Beagle gaining
    if (r.gap > 0) {
      r.catchDaysLinear = round(catchDay(beagle, r), 1);
      r.catchDaysTrend = round(catchDay(beagle, r, { trend: true }), 1);
    } else {
      r.catchDaysLinear = round(catchDay(r, beagle), 1);   // days until they re-pass Beagle
      r.catchDaysTrend = round(catchDay(r, beagle, { trend: true }), 1);
    }
  }
  return {
    asOf: input.asOf || null,
    method: 'current',
    methodLabel: 'Pace = current pace: share value gained since the previous upload ÷ the exact time between the two uploads (Operator definition, 7 Aug). Same method for every alliance.',
    trendLabel: 'Trend = 7-day rate vs 30-day rate; the curved projection starts at the current pace and carries that change forward once (14-day time constant), then holds.',
    tauDays: TREND_TAU_DAYS,
    beagle,
    memberCd: input.beagle && input.beagle.memberCdPace != null
      ? { pace: round(input.beagle.memberCdPace, 3), at: input.beagle.memberCdAt || null, label: 'member C/D today (sum of contribution ÷ $1M) — reference only' }
      : null,
    alliances: rows,
  };
}

// The Discord projections post, written from the board so the channel and the
// dashboard print the same numbers. Same layout as the post n8n used to
// build: five above Beagle, three below, then the chart link.
function formatProjectionsPost(board, { now = new Date(), chartUrl = null } = {}) {
  const b = board && board.beagle;
  if (!b || b.pace == null) return null;
  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fD = d => d.getUTCDate() + ' ' + MO[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  const p2 = n => String(n).padStart(2, '0');
  const money = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const trendWord = r => r.trend === 'accelerating' ? ' ↗' : r.trend === 'decelerating' ? ' ↘' : '';
  const eta = d => { const t = new Date(now.getTime() + d * DAY_MS); return Math.round(d) + ' days (' + fD(t) + ')'; };

  const out = [];
  out.push(p2(now.getUTCHours()) + ':' + p2(now.getUTCMinutes()) + ':' + p2(now.getUTCSeconds()) + ' UTC ' + fD(now));
  out.push('Beagle Global #' + b.rank + ' — ' + money(b.sv) + ' — Pace ' + money(b.pace) + '/day (' + b.label + ')');
  if (b.weekPace != null || b.longPace != null) out.push('7-day ' + (b.weekPace != null ? money(b.weekPace) : '—') + ' · 30-day ' + (b.longPace != null ? money(b.longPace) : '—') + ' · trend ' + (b.trend || 'n/a') + trendWord(b));
  if (board.memberCd) out.push('Member C/D today: ' + money(board.memberCd.pace) + '/day (reference)');
  out.push('');
  const others = board.alliances.filter(r => !r.isBeagle);
  const above = others.filter(r => r.rank != null && r.rank < b.rank).sort((x, y) => y.rank - x.rank).slice(0, 5);
  const below = others.filter(r => r.rank != null && r.rank > b.rank).sort((x, y) => x.rank - y.rank).slice(0, 3);
  const days = (lin, trd) => {
    // The curved (trend) projection is the headline; the straight line is shown
    // when the two disagree so the post never silently switches method.
    if (trd != null) return ' — ETA ' + eta(trd) + (lin == null ? ' (on trend; not at today\'s pace)' : '');
    if (lin != null) return ' — no catch on current trend (straight line: ' + Math.round(lin) + ' days)';
    return '';
  };
  for (const a of above) {
    const head = '#' + a.rank + ' ' + a.name + ' — ' + money(a.sv) + ' — Gap ' + money(a.gap);
    if (a.closing == null) out.push(head + ' — pace unknown');
    else if (a.closing > 0.005) out.push(head + ' — Closing ' + money(a.closing) + '/day' + days(a.catchDaysLinear, a.catchDaysTrend));
    else if (a.closing < -0.005) out.push(head + ' — Gap widening ' + money(-a.closing) + '/day' + (a.catchDaysTrend != null ? ' — catch on trend in ' + eta(a.catchDaysTrend) : ''));
    else out.push(head + ' — Pace matched' + days(a.catchDaysLinear, a.catchDaysTrend));
  }
  out.push('');
  for (const a of below) {
    const gap = -a.gap;
    const head = '#' + a.rank + ' ' + a.name + ' — ' + money(a.sv) + ' — Gap ' + money(gap);
    if (a.closing != null && a.closing < -0.005) out.push(head + ' — Closing ' + money(-a.closing) + '/day' + days(a.catchDaysLinear, a.catchDaysTrend));
    else if (a.catchDaysTrend != null) out.push(head + ' — Beagle clear today; they catch on trend in ' + eta(a.catchDaysTrend));
    else out.push(head + ' — Beagle clear');
  }
  out.push('');
  out.push('Pace = SV gained since the previous upload ÷ exact time between uploads, same method for every alliance. ETA = curved projection (7-day vs 30-day trend).');
  if (chartUrl) out.push('📊 ' + chartUrl);
  return out.join('\n');
}

module.exports = {
  canonicalPace, canonicalBoard, projectSV, projectedPace, catchDay, formatProjectionsPost, cleanReadings,
  WEEK, LONG, MIN_WINDOW_DAYS, TREND_TAU_DAYS,
};
