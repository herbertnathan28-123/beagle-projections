// AM4 contribution calculator math.
const { ALL_DISTANCES, CALC_TIMES } = require('../config');

function _m(d) {
  if (d <= 6000) return 0.0044;
  if (d <= 10000) return 0.0044 + (0.00355 - 0.0044) * (d - 6000) / 4000;
  return 0.00355 + (0.00349 - 0.00355) * (d - 10000) / 10000;
}

function _calc(dist, th, speed, mode) {
  const ef = mode === 'Easy' ? 1 / 1.5 : 1;
  const ci = (2000 / 7) * (dist / (speed * th)) - (600 / 6.9);
  if (ci > 200) return 'X';
  return Math.round((1 + (200 - ci) * 0.01) * _m(dist) * dist * ef * 100) / 100;
}

// One continuous grid, 500–20,000km for every aircraft (5 Sep 2026 ruling).
// Every column uses the full-distance formula — no ÷2 for stopover columns.
// Zones are fixed by distance: ≤6,000 single leg · 6,001–9,999 dead zone · ≥10,000 stopover.
function computeCalc(ac, mode) {
  const speed = mode === 'Easy' ? ac.easy : ac.realism;
  const dists = ALL_DISTANCES.slice();
  const grid = CALC_TIMES.map(t => dists.map(d => _calc(d, t, speed, mode)));
  return { grid, dists, maxRange: ac.maxRange, speed, mode };
}

module.exports = { _m, _calc, computeCalc };
