'use strict';
// Newest scan time per geostationary satellite for the /stopover live cloud
// layer (NASA GIBS Band 13 clean infrared, 10-minute scans). The tiles
// themselves go through lib/stopoverTiles.js.

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0';
const TILES = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';
// probe = z0 tile column holding the satellite's sub-point (z0 columns are 288° wide from -180°).
const SATS = [
  { id: 'ge', name: 'GOES-East', layer: 'GOES-East_ABI_Band13_Clean_Infrared', lon: -75.2, probe: 0 },
  { id: 'gw', name: 'GOES-West', layer: 'GOES-West_ABI_Band13_Clean_Infrared', lon: -137.2, probe: 0 },
  { id: 'hi', name: 'Himawari', layer: 'Himawari_AHI_Band13_Clean_Infrared', lon: 140.7, probe: 1 },
];
const PROBE_STEPS = 6;
const REFRESH_MS = 5 * 60 * 1000;
const MAX_LAG_MS = 3 * 3600 * 1000;
const STEP_MS = 10 * 60 * 1000;

const day = (ms) => new Date(ms).toISOString().slice(0, 10);
function domainsUrl(layer, nowMs) {
  return `${GIBS}/${layer}/default/2km/all/${day(nowMs - 86400000)}--${day(nowMs + 86400000)}.xml`;
}

function probeUrl(s, t) {
  return `${TILES}/${s.layer}/default/${new Date(t).toISOString().replace('.000Z', 'Z')}/2km/0/0/${s.probe}.png`;
}

// GIBS DescribeDomains lists times as "start/end/PT10M" ranges or single instants.
function latest(xml, nowMs) {
  let best = null;
  for (const m of String(xml).matchAll(/<Domain>([^<]*)<\/Domain>/g)) {
    for (const part of m[1].split(',')) {
      const seg = part.trim().split('/');
      const t = Date.parse(seg.length >= 2 ? seg[1] : seg[0]);
      if (Number.isFinite(t) && t % STEP_MS === 0 && t <= nowMs && (best === null || t > best)) best = t;
    }
  }
  return best;
}

function createClouds(opts) {
  opts = opts || {};
  const fetchImpl = opts.fetchImpl || ((u) => fetch(u, { signal: AbortSignal.timeout(20000) }));
  const now = opts.now || Date.now;
  const times = {};
  let fetchedAt = 0;
  let inflight = null;

  async function refresh() {
    const nowMs = now();
    await Promise.all(SATS.map(async (s) => {
      try {
        const res = await fetchImpl(domainsUrl(s.layer, nowMs));
        if (!res.ok) return;
        const t = latest(await res.text(), nowMs);
        if (t === null) return;
        // GIBS lists a scan before its tiles are served; step back to the newest one that renders.
        for (let k = 0; k < PROBE_STEPS; k++) {
          const at = t - k * STEP_MS;
          if (times[s.id] && at <= times[s.id]) return;
          const img = await fetchImpl(probeUrl(s, at));
          if (img.ok) { times[s.id] = at; return; }
        }
      } catch (e) { /* keep the previous scan time */ }
    }));
    fetchedAt = nowMs;
  }

  async function index() {
    if (now() - fetchedAt >= REFRESH_MS) {
      if (!inflight) inflight = refresh().finally(() => { inflight = null; });
      await inflight;
    }
    const nowMs = now();
    return {
      source: 'NASA GIBS',
      product: 'Band 13 clean infrared (10.3 µm), 10-minute scans',
      sats: SATS.filter((s) => times[s.id] && nowMs - times[s.id] <= MAX_LAG_MS)
        .map((s) => ({ id: s.id, name: s.name, lon: s.lon, t: new Date(times[s.id]).toISOString() })),
    };
  }

  return { index };
}

const shared = createClouds();
module.exports = { index: shared.index, createClouds, _internal: { latest, domainsUrl, probeUrl, SATS } };
