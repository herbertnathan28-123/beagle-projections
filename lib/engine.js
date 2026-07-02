// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE PROJECTION ENGINE — player-level scoring & trend analysis
// Pure functions: (players, snapshots) -> analysed metrics. No side effects.
// ═══════════════════════════════════════════════════════════════════════════
const { MERIT_WEIGHTS } = require('../config');

function _nk(name) {
  return (name || '').replace(/^[\s.]+/, '').replace(/[\s.]+$/, '').trim().toUpperCase();
}

function _stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sq = arr.reduce((a, v) => a + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(sq);
}

function calcPlayerCDRate(player, snapshots) {
  const key = _nk(player.name);
  const rates = [];
  for (let i = 1; i < snapshots.length; i++) {
    const curr = snapshots[i];
    const prev = snapshots[i - 1];
    const cp = curr.players.find(p => _nk(p.name) === key);
    const pp = prev.players.find(p => _nk(p.name) === key);
    if (!cp || !pp) continue;
    const days = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 86400000;
    if (days <= 0) continue;
    const cd = (cp.lastContrib - pp.lastContrib);
    if (cd >= 0) rates.push({ cd, days, rate: cd / days, ts: curr.timestamp });
  }
  return rates;
}

function calcMomentumScore(player, snapshots) {
  const rates = calcPlayerCDRate(player, snapshots);
  if (rates.length < 2) {
    return { momentumScore: null, momentumLabel: 'NO DATA', previousCD: null, currentCD: null, cdChangePercent: null };
  }
  const half = Math.floor(rates.length / 2);
  const recentRates = rates.slice(half);
  const olderRates = rates.slice(0, half);
  const currentCD = recentRates.reduce((s, r) => s + r.rate, 0) / recentRates.length;
  const previousCD = olderRates.reduce((s, r) => s + r.rate, 0) / olderRates.length;
  if (previousCD === 0 && currentCD === 0) {
    return { momentumScore: 0, momentumLabel: 'INACTIVE', previousCD: 0, currentCD: 0, cdChangePercent: 0 };
  }
  if (previousCD === 0) {
    return { momentumScore: 80, momentumLabel: 'SURGING', previousCD: 0, currentCD: Math.round(currentCD), cdChangePercent: 100 };
  }
  const cdChangePercent = (currentCD - previousCD) / Math.abs(previousCD);
  let label;
  if (cdChangePercent >= 0.20) label = 'SURGING';
  else if (cdChangePercent >= 0.05) label = 'RISING';
  else if (cdChangePercent >= -0.05) label = 'STABLE';
  else if (cdChangePercent >= -0.20) label = 'DROPPING';
  else label = 'COLLAPSING';
  const momentumScore = Math.max(0, Math.min(100, 50 + (cdChangePercent * 250)));
  return {
    momentumScore: Math.round(momentumScore * 10) / 10,
    momentumLabel: label,
    previousCD: Math.round(previousCD),
    currentCD: Math.round(currentCD),
    cdChangePercent: Math.round(cdChangePercent * 100),
  };
}

function calcEfficiencyScore(player, snapshots) {
  const key = _nk(player.name);
  const first = snapshots.length > 0 ? snapshots[0].players.find(p => _nk(p.name) === key) : null;
  const last = snapshots.length > 0 ? snapshots[snapshots.length - 1].players.find(p => _nk(p.name) === key) : null;
  if (!first || !last) {
    const cpf = player.flights > 0 ? player.lastContrib / player.flights : null;
    const score = cpf != null ? Math.max(0, Math.min(100, ((cpf - 50) / 100) * 100)) : null;
    return { efficiencyScore: score != null ? Math.round(score * 10) / 10 : null, contPerFlight: cpf };
  }
  const flightDelta = (last.flights || 0) - (first.flights || 0);
  const contDelta = last.lastContrib - first.lastContrib;
  const cpf = flightDelta > 0 ? contDelta / flightDelta : (player.flights > 0 ? player.lastContrib / player.flights : null);
  const score = cpf != null ? Math.max(0, Math.min(100, ((cpf - 50) / 100) * 100)) : null;
  return { efficiencyScore: score != null ? Math.round(score * 10) / 10 : null, contPerFlight: cpf != null ? Math.round(cpf * 100) / 100 : null };
}

function calcConsistencyScore(player, snapshots, cdScore) {
  const key = _nk(player.name);
  const cdValues = [];
  let gapCount = 0;
  let totalAppearances = 0;
  for (let i = 1; i < snapshots.length; i++) {
    const curr = snapshots[i];
    const prev = snapshots[i - 1];
    const cp = curr.players.find(p => _nk(p.name) === key);
    const pp = prev.players.find(p => _nk(p.name) === key);
    if (!cp) { gapCount++; continue; }
    if (!pp) continue;
    totalAppearances++;
    const days = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 86400000;
    if (days <= 0) continue;
    const cd = (cp.lastContrib - pp.lastContrib) / days;
    if (cd >= 0) cdValues.push(cd);
  }
  if (cdValues.length < 2) {
    return { consistencyScore: null, consistencyLabel: 'LOW DATA', cdVariation: null, observationGaps: gapCount };
  }
  const mean = cdValues.reduce((a, b) => a + b, 0) / cdValues.length;
  const std = _stdDev(cdValues);
  const cv = mean > 0 ? std / mean : 0;
  // INVERTED: active contribution = high score. Inactivity = low score.
  // Regularity component: low variance = good (max 50 pts)
  const regularityScore = Math.max(0, 50 - Math.min(50, cv * 50));
  // Activity component: higher mean C/D relative to group = good (max 50 pts)
  // Use cdScore (0-100 normalised) to scale activity component
  const activityComponent = cdScore != null ? (cdScore / 100) * 50 : 0;
  let score = regularityScore + activityComponent;
  // Penalty for observation gaps
  const gapPenalty = Math.min(15, gapCount * 3);
  score -= gapPenalty;
  // Penalty for spikes
  const spikeCount = cdValues.filter(v => v > mean * 3).length;
  score -= Math.min(10, spikeCount * 3);
  // Floor for inactive players: if mean C/D is near zero, cap at INACTIVE
  if (mean < 100) score = Math.min(score, 14);
  score = Math.max(0, Math.min(100, score));
  let label;
  if (score >= 85) label = 'ELITE';
  else if (score >= 70) label = 'STRONG';
  else if (score >= 55) label = 'BUILDING';
  else if (score >= 35) label = 'DEVELOPING';
  else if (score >= 15) label = 'INCONSISTENT';
  else label = 'INACTIVE';
  return {
    consistencyScore: Math.round(score * 10) / 10,
    consistencyLabel: label,
    cdVariation: Math.round(cv * 1000) / 10,
    observationGaps: gapCount,
  };
}

function calcActivityScore(player) {
  const mins = player.lastSeenMins;
  const contrib = player.lastContrib;
  if (mins < 60 && contrib > 50000) return { activityScore: 95, activityLabel: 'ACTIVE' };
  if (mins < 60 && contrib > 0) return { activityScore: 80, activityLabel: 'ACTIVE' };
  if (mins < 180 && contrib > 50000) return { activityScore: 75, activityLabel: 'ONLINE' };
  if (mins < 180 && contrib > 0) return { activityScore: 60, activityLabel: 'ONLINE' };
  if (mins < 360 && contrib > 0) return { activityScore: 40, activityLabel: 'IDLE' };
  if (mins < 720) return { activityScore: 20, activityLabel: 'AWAY' };
  if (contrib === 0) return { activityScore: 5, activityLabel: 'OFFLINE' };
  return { activityScore: 15, activityLabel: 'AWAY' };
}

function calcConfidenceScore(player, snapshots) {
  const key = _nk(player.name);
  let score = 100;
  let snapCount = 0;
  for (const s of snapshots) {
    if (s.players.find(p => _nk(p.name) === key)) snapCount++;
  }
  if (snapCount < 2) score -= 30;
  else if (snapCount < 5) score -= 15;
  if (player.lastContrib === 0) score -= 20;
  if (player.sv === 0) score -= 15;
  if (player.flights === 0) score -= 10;
  score = Math.max(0, Math.min(100, score));
  let level;
  if (score >= 80) level = 'HIGH';
  else if (score >= 55) level = 'MEDIUM';
  else if (score >= 30) level = 'LOW';
  else level = 'SPARSE';
  return { confidenceScore: score, confidenceLevel: level };
}

function calcMeritScore(cdScore, effScore, momScore, consScore, actScore, confScore) {
  const w = MERIT_WEIGHTS;
  const cd   = cdScore  != null ? cdScore  : 0;
  const eff  = effScore != null ? effScore : 0;
  const mom  = momScore != null ? momScore : 50;
  const cons = consScore!= null ? consScore: 50;
  const act  = actScore != null ? actScore : 50;
  const conf = confScore!= null ? confScore: 50;
  let merit = (cd*w.cd) + (eff*w.eff) + (mom*w.mom) + (cons*w.cons) + (act*w.act) + (conf*w.conf);
  return Math.max(0, Math.min(100, Math.round(merit * 10) / 10));
}

function analyseAllPlayers(players, snapshots) {
  const maxContrib = Math.max(...players.map(p => p.lastContrib), 1);
  const analysed = players.map(p => {
    const cdScore = p.lastContrib > 0 ? Math.min(100, (p.lastContrib / maxContrib) * 100) : 0;
    const efficiency = calcEfficiencyScore(p, snapshots);
    const momentum = calcMomentumScore(p, snapshots);
    const consistency = calcConsistencyScore(p, snapshots, cdScore);
    const activity = calcActivityScore(p);
    const confidence = calcConfidenceScore(p, snapshots);
    const meritScore = calcMeritScore(
      cdScore,
      efficiency.efficiencyScore,
      momentum.momentumScore,
      consistency.consistencyScore,
      activity.activityScore,
      confidence.confidenceScore
    );
    return {
      name: p.name,
      sv: p.sv,
      lastContrib: p.lastContrib,
      allianceContrib: p.allianceContrib,
      flights: p.flights || 0,
      lastSeenStr: p.lastSeenStr,
      lastSeenMins: p.lastSeenMins,
      cdScore: Math.round(cdScore * 10) / 10,
      efficiency,
      momentum,
      consistency,
      activity,
      confidence,
      meritScore,
    };
  });
  analysed.sort((a, b) => b.meritScore - a.meritScore);
  analysed.forEach((p, i) => { p.meritRank = i + 1; });
  return analysed;
}

function calcMostImproved(snapshots) {
  if (snapshots.length < 2) return [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const recentSnaps = snapshots.filter(s => new Date(s.timestamp) >= sevenDaysAgo);
  if (recentSnaps.length < 2) {
    const oldest = snapshots[0];
    const newest = snapshots[snapshots.length - 1];
    return calcImprovementBetween(oldest, newest);
  }
  return calcImprovementBetween(recentSnaps[0], recentSnaps[recentSnaps.length - 1]);
}

function calcImprovementBetween(oldSnap, newSnap) {
  const results = [];
  for (const np of newSnap.players) {
    const op = oldSnap.players.find(p => _nk(p.name) === _nk(np.name));
    if (!op || op.sv <= 0) continue;
    const svChange = np.sv - op.sv;
    const svPct = (svChange / op.sv) * 100;
    results.push({
      name: np.name,
      svStart: op.sv,
      svEnd: np.sv,
      svChange: Math.round(svChange * 100) / 100,
      svPct: Math.round(svPct * 100) / 100,
    });
  }
  results.sort((a, b) => b.svPct - a.svPct);
  return results;
}

module.exports = { _nk, analyseAllPlayers, calcMostImproved, calcImprovementBetween };
