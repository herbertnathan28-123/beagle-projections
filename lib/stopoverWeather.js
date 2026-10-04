'use strict';
// Real-world rain for the /stopover map: NASA GIBS "IMERG Early Run" 30-minute
// precipitation rate. GIBS serves it as a global EPSG:4326 (plate carrée) PNG,
// the same projection as the page's map, so frames overlay without reprojection.
// Frames are fetched server-side and cached in memory; the page only talks to us.

const GIBS = 'https://gibs.earthdata.nasa.gov';
const LAYER = 'IMERG_Precipitation_Rate_30min';
const FRAMES = 8;                 // 8 × 30 min = the last 4 hours of movement
const STEP_MS = 30 * 60 * 1000;
const WIDTH = 1440, HEIGHT = 720; // 4 px per degree
const REFRESH_MS = 15 * 60 * 1000;
const MIN_BYTES = 10000;          // GIBS answers a missing time with a blank ~4 KB PNG

function domainUrl(nowMs) {
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  return `${GIBS}/wmts/epsg4326/best/1.0.0/${LAYER}/default/250m/all/`
    + `${day(nowMs - 2 * 86400000)}--${day(nowMs + 86400000)}.xml`;
}

function frameUrl(ms) {
  return `${GIBS}/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0`
    + `&LAYERS=${LAYER}&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=${WIDTH}&HEIGHT=${HEIGHT}`
    + `&FORMAT=image/png&TRANSPARENT=true&TIME=${new Date(ms).toISOString().replace('.000Z', 'Z')}`;
}

// DescribeDomains returns e.g. <Domain>2026-10-03/2026-10-04T02:30:00Z/PT30M</Domain>
function latestFromDomain(xml) {
  const m = /<Domain>([^<]+)<\/Domain>/.exec(xml || '');
  if (!m) return null;
  const parts = m[1].trim().split(',').pop().split('/');
  const t = Date.parse(parts.length >= 2 ? parts[1] : parts[0]);
  return Number.isFinite(t) ? Math.floor(t / STEP_MS) * STEP_MS : null;
}

function createWeather(opts) {
  opts = opts || {};
  const fetchImpl = opts.fetchImpl || ((u) => fetch(u, { signal: AbortSignal.timeout(30000) }));
  const now = opts.now || Date.now;
  const cache = new Map(); // epoch ms -> PNG Buffer
  let times = [], checkedAt = 0, error = null, inflight = null;

  async function refresh() {
    const xml = await (await fetchImpl(domainUrl(now()))).text();
    const latest = latestFromDomain(xml);
    if (!latest) throw new Error('no IMERG time domain from GIBS');
    const want = [];
    for (let i = FRAMES - 1; i >= 0; i--) want.push(latest - i * STEP_MS);
    for (const t of want) {
      if (cache.has(t)) continue;
      const r = await fetchImpl(frameUrl(t));
      const type = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
      const buf = Buffer.from(await r.arrayBuffer());
      if (r.ok && /image\/png/.test(type) && buf.length >= MIN_BYTES) cache.set(t, buf);
    }
    for (const t of [...cache.keys()]) if (!want.includes(t)) cache.delete(t);
    times = want.filter((t) => cache.has(t));
    error = null;
  }

  async function index() {
    if (now() - checkedAt >= REFRESH_MS || !times.length) {
      if (!inflight) {
        checkedAt = now();
        inflight = refresh().catch((e) => { error = String(e && e.message || e); })
          .finally(() => { inflight = null; });
      }
      await inflight;
    }
    return {
      source: 'NASA GIBS',
      product: 'IMERG Early Run precipitation rate, 30 min',
      layer: LAYER,
      bbox: [-180, -90, 180, 90],
      width: WIDTH, height: HEIGHT,
      frames: times.map((t) => ({ t: new Date(t).toISOString(), url: `/api/stopover/weather/frame/${t}.png` })),
      error,
    };
  }

  function frame(t) { return cache.get(Number(t)) || null; }

  return { index, frame };
}

const shared = createWeather();
module.exports = {
  index: shared.index, frame: shared.frame,
  createWeather, _internal: { latestFromDomain, frameUrl, domainUrl, FRAMES, STEP_MS, MIN_BYTES },
};
