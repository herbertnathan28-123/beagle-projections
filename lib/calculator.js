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

// Build the single-leg + stopover contribution grids for one aircraft/mode.
function computeCalc(ac, mode) {
  const speed = mode === 'Easy' ? ac.easy : ac.realism;
  const maxRange = ac.maxRange;
  const stopoverMax = Math.min(maxRange * 2, 20000);
  const singleDists = ALL_DISTANCES.filter(d => d <= maxRange);
  const stopoverDists = ALL_DISTANCES.filter(d => d > maxRange && d <= stopoverMax);
  const singleGrid = CALC_TIMES.map(t => singleDists.map(d => _calc(d, t, speed, mode)));
  const stopoverGrid = CALC_TIMES.map(t => stopoverDists.map(d => _calc(d / 2, t, speed, mode)));
  return { singleGrid, singleDists, stopoverGrid, stopoverDists, maxRange, stopoverMax };
}

module.exports = { _m, _calc, computeCalc };
