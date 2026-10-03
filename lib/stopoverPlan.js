// Stopover Finder optimiser (ATL-148 Phase 3, amended 3 Oct 2026): the search axis is
// FLIGHT TIME. Every flight-time row the Contribution Calculator offers is evaluated per
// aircraft per day — departures (the calculator's 48 h rule), C/D (calculator formula),
// per-flight demand at that total frequency, the capped seat config, revenue, cost and
// profit. Costs and contributions stay server-side.
const { AIRCRAFT_DATA, CALC_TIMES } = require('../config');
const { _calc } = require('./calculator');
const { REV, FUEL_P, CO2_P } = require('./calcCosts');

const SP = { y: 1, j: 2, f: 3 };
const ORD = { FJY: ['f', 'j', 'y'], FYJ: ['f', 'y', 'j'], JFY: ['j', 'f', 'y'], JYF: ['j', 'y', 'f'], YFJ: ['y', 'f', 'j'], YJF: ['y', 'j', 'f'] };
const PRICE = {
  easy: { y: [0.4, 170], j: [0.8, 560], f: [1.2, 1200] },
  realism: { y: [0.3, 150], j: [0.6, 500], f: [0.9, 1000] },
};
const BOOSTS = ['0', '4x1', '4x2', '4x3', '4x4', '4x5', '4x6', 'b1', 'b24'];

function paxOrder(d, mode) {
  if (mode === 'easy') return d < 14425 ? 'FJY' : d < 14812.5 ? 'FYJ' : d < 15200 ? 'YFJ' : 'YJF';
  return d < 13888.8888 ? 'FJY' : d < 15694.4444 ? 'JFY' : d < 17500 ? 'JYF' : 'YJF';
}
// Same whole-dollar optimal tickets as the page (ATL-147), on the direct distance.
function tickets(d, mode) {
  const c = PRICE[mode];
  return { y: Math.floor((c.y[0] * d + c.y[1]) * 1.10), j: Math.floor((c.j[0] * d + c.j[1]) * 1.08), f: Math.floor((c.f[0] * d + c.f[1]) * 1.06) };
}
// Cap first, fill second (ATL-148, 4 Oct): each class ≤ its per-flight demand, filled in yield order.
function capFill(caps, cap, ord) {
  const c = {}; let rem = cap;
  for (const k of ord) { c[k] = Math.min(caps[k], Math.floor(rem / SP[k])); rem -= c[k] * SP[k]; }
  return c;
}
// Calculator 4× options (views/calc.js boostCfg).
function boostCfg(v) {
  if (!v || v === '0') return { win: 0, n: 0 };
  if (v === 'b1') return { win: 60, n: 1 };
  if (v === 'b24') return { win: 1440, n: 1 };
  const [h, n] = v.split('x').map(Number); return { win: h * 60, n: n * 2 };
}
// Calculator departures rule: full cycles (flight time + 3 min) inside 48 h less 30 min
// maintenance and the 26 min buffer, plus the final departure.
function departures48(t, maint, boost) {
  const avail = 2880 - (maint ? 30 : 0) - 26, cyc = t * 60 + 3, b = boostCfg(boost);
  if (!b.win) return cyc > avail ? 1 : Math.floor(avail / cyc) + 1;
  const fast = t * 15 + 3;
  const perWin = Math.floor(b.win / fast) + 1;
  const winTime = perWin * fast;
  let boosted = 0, used = 0;
  for (let i = 0; i < b.n; i++) { if (used + winTime > avail) break; boosted += perWin; used += winTime; }
  const normal = Math.max(0, Math.floor((avail - used) / cyc));
  return boosted + normal + 1;
}

function plan({ dem, spec, mode, buf, direct, flown, nAc = 1, boost = '0', maint = true }) {
  const calcAc = AIRCRAFT_DATA.find((a) => a.name === spec.name);
  const speed = calcAc ? (mode === 'easy' ? calcAc.easy : calcAc.realism) : (mode === 'easy' ? spec.easy : spec.realism);
  const Mode = mode === 'easy' ? 'Easy' : 'Realism';
  const cargo = spec.cat === 'cargo';
  const rev = cargo ? null : REV[spec.name] || null;
  const tk = tickets(direct, mode);
  const ord = ORD[paxOrder(direct, mode)];
  const tMin = flown / speed;
  const rows = [];
  for (const t of CALC_TIMES) {
    if (t < tMin) continue;
    const ci = (2000 / 7) * (direct / (speed * t)) - (600 / 6.9);
    const cdF = _calc(direct, t, speed, Mode);
    if (cdF === 'X' || ci < 0) continue;
    const dep48 = departures48(t, maint, boost);
    const depsDay = dep48 / 2;
    const freq = depsDay * nAc;
    const row = { t, ci: Math.round(ci), dep48, depsDay, freq, cdDay: cdF * depsDay };
    if (cargo) {
      const dl = Math.floor(dem.l / freq), dh = Math.floor(dem.h / freq), lcap = spec.cap * 0.7;
      const l = Math.min(100, Math.floor(dl / lcap * 100)), h = 100 - l;
      row.perFlight = { l: dl, h: dh };
      row.cfg = { l, h };
      row.load = Math.min(1, (Math.min(dl, lcap * l / 100) + Math.min(dh, spec.cap * h / 100)) / (lcap * l / 100 + spec.cap * h / 100));
      row.revDay = row.profitDay = null;
    } else {
      const caps = { y: Math.floor(dem.y / freq), j: Math.floor(dem.j / freq), f: Math.floor(dem.f / freq) };
      const c = capFill(caps, spec.cap, ord);
      row.perFlight = caps;
      row.cfg = c;
      row.pax = c.y + c.j + c.f;
      row.load = (c.y + 2 * c.j + 3 * c.f) / spec.cap;
      const revF = c.y * Math.max(0, tk.y - buf) + c.j * Math.max(0, tk.j - buf) + c.f * Math.max(0, tk.f - buf);
      row.revDay = revF * depsDay;
      if (rev) {
        const ciF = Math.max(0, Math.min(200, (2000 / 7) * (direct / (speed * t)) - 600 / 7));
        const fuel = rev.cf * flown * (ciF / 500 + 0.6) * FUEL_P / 1000;
        const co2 = (rev.ccS != null ? rev.ccS * flown * (c.y + c.j + c.f) : rev.cc * flown * ((c.y + 2 * c.j + 3 * c.f) + (c.y + c.j + c.f))) * (ciF / 2000 + 0.9) * CO2_P / 1000;
        const chk = rev.acheckH * Math.ceil(t);
        row.profitDay = (revF - fuel - co2 - chk - rev.repair) * depsDay;
      } else row.profitDay = null;
    }
    rows.push(row);
  }
  const best = (k) => rows.reduce((b, r) => (r[k] == null ? b : !b || r[k] > b[k] || (r[k] === b[k] && r.dep48 < b.dep48) ? r : b), null);
  const bc = best('cdDay'), bm = rev ? best('profitDay') : null;
  // Combined score: each row's C/D and profit as a % of the route's best, averaged 50/50.
  let ba = null;
  if (bc && bm) {
    for (const r of rows) r.score = 50 * r.cdDay / bc.cdDay + (bm.profitDay > 0 ? 50 * r.profitDay / bm.profitDay : 0);
    ba = best('score');
  }
  return { money: !!rev, speed, tMin, rows, bestCd: bc && bc.t, bestMoney: bm && bm.t, bestAll: ba && ba.t };
}

// Query-string front door shared by server.js and preview.js.
function planFromQuery(q, stopoverData) {
  const spec = stopoverData.aircrafts().find((a) => a.name === q.acft);
  const dem = stopoverData.demand(q.from, q.to);
  const direct = +q.direct, flown = +q.flown, nAc = Math.floor(+q.ac || 1), buf = +q.buf;
  if (!spec || !dem) return null;
  if (!(direct > 0 && direct <= 25000 && flown >= direct - 1 && flown <= 50000)) return null;
  if (!(nAc >= 1 && nAc <= 200) || ![0, 5, 10].includes(buf)) return null;
  const boost = BOOSTS.includes(q.boost) ? q.boost : '0';
  return plan({ dem, spec, mode: q.mode === 'realism' ? 'realism' : 'easy', buf, direct, flown, nAc, boost });
}

module.exports = { plan, planFromQuery, departures48, capFill, tickets, paxOrder, BOOSTS };
