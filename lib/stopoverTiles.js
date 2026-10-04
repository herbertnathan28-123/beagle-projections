'use strict';
// Zoomable imagery for the /stopover map: NASA GIBS WMTS tiles in EPSG:4326
// (plate carrée, the page's projection). Blue Marble shaded relief for the
// satellite base map, IMERG rain at higher zoom, and live Band 13 infrared
// clouds from GOES-East, GOES-West and Himawari. GIBS sends no CORS
// headers, so tiles are fetched here and kept in a bounded in-memory cache.

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';
const COLS = [2, 3, 5, 10, 20, 40, 80, 160];
const ROWS = [1, 2, 3, 5, 10, 20, 40, 80];
const KINDS = {
  bm: { layer: 'BlueMarble_ShadedRelief_Bathymetry', set: '500m', maxZ: 7, ext: 'jpeg', maxAge: 30 * 86400 },
  rain: { layer: 'IMERG_Precipitation_Rate_30min', set: '2km', maxZ: 5, ext: 'png', maxAge: 86400, timed: true },
  ge: { layer: 'GOES-East_ABI_Band13_Clean_Infrared', set: '2km', maxZ: 5, ext: 'png', maxAge: 86400, timed: true, step: 600000, keep: 86400000 },
  gw: { layer: 'GOES-West_ABI_Band13_Clean_Infrared', set: '2km', maxZ: 5, ext: 'png', maxAge: 86400, timed: true, step: 600000, keep: 86400000 },
  hi: { layer: 'Himawari_AHI_Band13_Clean_Infrared', set: '2km', maxZ: 5, ext: 'png', maxAge: 86400, timed: true, step: 600000, keep: 86400000 },
};
const CLOUD_KINDS = ['ge', 'gw', 'hi'];
const STEP_MS = 30 * 60 * 1000;
const MAX_AGE_MS = 3 * 86400000;

function tileUrl(kind, z, r, c, t) {
  const k = KINDS[kind];
  const time = k.timed ? `${new Date(t).toISOString().replace('.000Z', 'Z')}/` : '';
  return `${GIBS}/${k.layer}/default/${time}${k.set}/${z}/${r}/${c}.${k.ext}`;
}

function parse(kind, z, r, c, t, nowMs) {
  const k = Object.prototype.hasOwnProperty.call(KINDS, kind) ? KINDS[kind] : null;
  if (!k) return null;
  const [Z, R, C] = [z, r, c].map((v) => (/^\d{1,3}$/.test(String(v)) ? Number(v) : NaN));
  if (!(Z >= 0 && Z <= k.maxZ && R >= 0 && R < ROWS[Z] && C >= 0 && C < COLS[Z])) return null;
  let ms = null;
  if (k.timed) {
    ms = /^\d{13}$/.test(String(t)) ? Number(t) : NaN;
    if (!(ms % (k.step || STEP_MS) === 0 && ms <= nowMs && nowMs - ms <= (k.keep || MAX_AGE_MS))) return null;
  }
  return { z: Z, r: R, c: C, t: ms };
}

function createTiles(opts) {
  opts = opts || {};
  const fetchImpl = opts.fetchImpl || ((u) => fetch(u, { signal: AbortSignal.timeout(20000) }));
  const now = opts.now || Date.now;
  const max = opts.max || 3000;
  const cache = new Map();
  const inflight = new Map();

  function tile(kind, z, r, c, t) {
    const p = parse(kind, z, r, c, t, now());
    if (!p) return Promise.resolve(null);
    const key = `${kind}/${p.t || 0}/${p.z}/${p.r}/${p.c}`;
    const hit = cache.get(key);
    if (hit) { cache.delete(key); cache.set(key, hit); return Promise.resolve(hit); }
    if (inflight.has(key)) return inflight.get(key);
    const job = (async () => {
      // GIBS sometimes 404s a tile it serves a moment later, so try twice.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetchImpl(tileUrl(kind, p.z, p.r, p.c, p.t));
          const type = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
          if (!res.ok || !/^image\//.test(type)) continue;
          const out = { buf: Buffer.from(await res.arrayBuffer()), type, maxAge: KINDS[kind].maxAge };
          cache.set(key, out);
          while (cache.size > max) cache.delete(cache.keys().next().value);
          return out;
        } catch (e) { /* retry */ }
      }
      return null;
    })().finally(() => inflight.delete(key));
    inflight.set(key, job);
    return job;
  }

  function handler(kind) {
    return async (req, res) => {
      const q = req.params;
      const out = await tile(kind, q.z, q.r, q.c, q.t);
      if (!out) return res.status(404).end();
      res.type(out.type).set('Cache-Control', `public, max-age=${out.maxAge}, immutable`).send(out.buf);
    };
  }

  return { tile, handler, _cache: cache };
}

const shared = createTiles();
module.exports = { tile: shared.tile, handler: shared.handler, createTiles, CLOUD_KINDS, _internal: { tileUrl, parse, COLS, ROWS, KINDS } };
