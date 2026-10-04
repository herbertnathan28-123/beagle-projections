'use strict';
// World synoptic chart for the /stopover map:
//  - isobars + H/L centres contoured from NOAA GFS mean-sea-level pressure (1°, latest analysis)
//  - fronts and troughs from NOAA WPC's coded surface bulletin (CODSUS: N. Pacific, N. America, N. Atlantic)
// Both are public-domain NOAA products, fetched server-side and cached in memory.

const NOMADS = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_1p00.pl';
const CODSUS = 'https://tgftp.nws.noaa.gov/data/raw/as/asus01.kwbc.cod.sus.txt';
const REFRESH_MS = 30 * 60 * 1000;
const STEP_HPA = 4;

// ---------- GRIB2 (grid template 3.0, data templates 5.0 / 5.3) ----------
const sm16 = (b, o) => { const v = b.readUInt16BE(o); return v & 0x8000 ? -(v & 0x7fff) : v; };
const sm32 = (b, o) => { const v = b.readUInt32BE(o); return v & 0x80000000 ? -(v & 0x7fffffff) : v; };
const smN = (b, o, n) => { let v = 0; for (let k = 0; k < n; k++) v = v * 256 + b[o + k]; const top = 2 ** (8 * n - 1); return v >= top ? -(v - top) : v; };

function bitReader(buf, byteOff) {
  let pos = byteOff * 8;
  return {
    read(n) { let v = 0; for (let k = 0; k < n; k++, pos++) v = v * 2 + ((buf[pos >> 3] >> (7 - (pos & 7))) & 1); return v; },
    align() { pos = Math.ceil(pos / 8) * 8; },
  };
}

function decodeGrib2(buf) {
  if (buf.toString('latin1', 0, 4) !== 'GRIB') throw new Error('not GRIB');
  let i = 16; const sec = {};
  while (i < buf.length - 4 && buf.toString('latin1', i, i + 4) !== '7777') {
    const len = buf.readUInt32BE(i); sec[buf[i + 4]] = i; i += len;
  }
  const s3 = sec[3], s5 = sec[5], s6 = sec[6], s7 = sec[7];
  if (buf.readUInt16BE(s3 + 12) !== 0) throw new Error('grid template not 3.0');
  if (s6 != null && buf[s6 + 5] !== 255) throw new Error('bitmap not supported');
  const grid = {
    ni: buf.readUInt32BE(s3 + 30), nj: buf.readUInt32BE(s3 + 34),
    la1: sm32(buf, s3 + 46) / 1e6, lo1: sm32(buf, s3 + 50) / 1e6,
    di: buf.readUInt32BE(s3 + 63) / 1e6, dj: buf.readUInt32BE(s3 + 67) / 1e6, scan: buf[s3 + 71],
  };
  const n = buf.readUInt32BE(s5 + 5), tmpl = buf.readUInt16BE(s5 + 9);
  const R = buf.readFloatBE(s5 + 11), E = sm16(buf, s5 + 15), D = sm16(buf, s5 + 17), nb = buf[s5 + 19];
  const Y = new Float64Array(n);
  if (tmpl === 0) {
    const br = bitReader(buf, s7 + 5);
    for (let k = 0; k < n; k++) Y[k] = nb ? br.read(nb) : 0;
  } else if (tmpl === 3) {
    if (buf[s5 + 22] !== 0) throw new Error('missing-value management not supported');
    const NG = buf.readUInt32BE(s5 + 31), wref = buf[s5 + 35], wbits = buf[s5 + 36];
    const lref = buf.readUInt32BE(s5 + 37), linc = buf[s5 + 41], lastLen = buf.readUInt32BE(s5 + 42), lbits = buf[s5 + 46];
    const order = buf[s5 + 47], ndes = buf[s5 + 48];
    let o = s7 + 5;
    const ival1 = smN(buf, o, ndes); o += ndes;
    const ival2 = order === 2 ? smN(buf, o, ndes) : 0; if (order === 2) o += ndes;
    const minsd = smN(buf, o, ndes); o += ndes;
    const br = bitReader(buf, o);
    const gref = new Array(NG), gw = new Array(NG), gl = new Array(NG);
    for (let g = 0; g < NG; g++) gref[g] = br.read(nb); br.align();
    for (let g = 0; g < NG; g++) gw[g] = wref + br.read(wbits); br.align();
    for (let g = 0; g < NG; g++) gl[g] = lref + br.read(lbits) * linc; br.align();
    gl[NG - 1] = lastLen;
    let k = 0;
    for (let g = 0; g < NG; g++) for (let m = 0; m < gl[g]; m++) Y[k++] = gref[g] + (gw[g] ? br.read(gw[g]) : 0);
    if (order === 1) { Y[0] = ival1; for (let q = 1; q < n; q++) Y[q] = Y[q] + minsd + Y[q - 1]; }
    else if (order === 2) { Y[0] = ival1; Y[1] = ival2; for (let q = 2; q < n; q++) Y[q] = Y[q] + minsd + 2 * Y[q - 1] - Y[q - 2]; }
  } else throw new Error('data template 5.' + tmpl + ' not supported');
  const scale = 2 ** E, dec = 10 ** -D, values = new Float32Array(n);
  for (let q = 0; q < n; q++) values[q] = (R + Y[q] * scale) * dec;
  return { ...grid, values };
}

// ---------- isobars + centres ----------
// GFS 1° grid: row j = lat 90 - j, col i = lon i (0..359). Re-index to lon -180..179.
function toField(g) {
  const W = g.ni, H = g.nj, f = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) f[j * W + ((i + W / 2) % W)] = g.values[j * W + i] / 100;
  return { W, H, f, lon0: -180, lat0: g.la1, d: g.di };
}
function smooth(F, passes) {
  const { W, H } = F; let a = F.f;
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let s = 0, c = 0;
      for (let dj = -1; dj <= 1; dj++) { const jj = j + dj; if (jj < 0 || jj >= H) continue;
        for (let di = -1; di <= 1; di++) { s += a[jj * W + ((i + di + W) % W)]; c++; } }
      b[j * W + i] = s / c;
    }
    a = b;
  }
  return { ...F, f: a };
}

function contours(F, level, jMin, jMax) {
  const { W, f, lon0, lat0, d } = F;
  const v = (i, j) => f[j * W + ((i % W) + W) % W];
  const P = (i, j) => [lon0 + i * d, lat0 - j * d];
  const segs = [];
  const edge = (ka, pa, va, kb, pb, vb) => { const t = (level - va) / (vb - va); return { k: ka + '|' + kb, p: [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t] }; };
  for (let j = jMin; j < jMax; j++) for (let i = 0; i < W; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), e = v(i, j + 1);
    const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (e > level ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const I1 = (i + 1) % W;
    const top = () => edge(`${i},${j}`, P(i, j), a, `${I1},${j}`, P(i + 1, j), b);
    const right = () => edge(`${I1},${j}`, P(i + 1, j), b, `${I1},${j + 1}`, P(i + 1, j + 1), c);
    const bottom = () => edge(`${i},${j + 1}`, P(i, j + 1), e, `${I1},${j + 1}`, P(i + 1, j + 1), c);
    const left = () => edge(`${i},${j}`, P(i, j), a, `${i},${j + 1}`, P(i, j + 1), e);
    const add = (x, y) => segs.push([x(), y()]);
    const mid = (a + b + c + e) / 4 > level;
    switch (idx) {
      case 1: case 14: add(left, bottom); break;
      case 2: case 13: add(bottom, right); break;
      case 3: case 12: add(left, right); break;
      case 4: case 11: add(top, right); break;
      case 6: case 9: add(top, bottom); break;
      case 7: case 8: add(left, top); break;
      case 5: if (mid) { add(left, top); add(bottom, right); } else { add(left, bottom); add(top, right); } break;
      case 10: if (mid) { add(left, bottom); add(top, right); } else { add(left, top); add(bottom, right); } break;
    }
  }
  // join segments sharing an edge key into polylines
  const byKey = new Map();
  segs.forEach((s, n) => s.forEach((e) => { (byKey.get(e.k) || byKey.set(e.k, []).get(e.k)).push(n); }));
  const used = new Uint8Array(segs.length), lines = [];
  const near = (p, ref) => { let x = p[0]; while (x - ref[0] > 180) x -= 360; while (x - ref[0] < -180) x += 360; return [x, p[1]]; };
  const extend = (pts, key, fwd) => {
    for (;;) {
      const n = (byKey.get(key) || []).find((q) => !used[q]); if (n == null) return;
      used[n] = 1; const s = segs[n], other = s[0].k === key ? s[1] : s[0];
      const p = near(other.p, fwd ? pts[pts.length - 1] : pts[0]);
      if (fwd) pts.push(p); else pts.unshift(p);
      key = other.k;
    }
  };
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue; used[n] = 1;
    const s = segs[n], pts = [s[0].p, near(s[1].p, s[0].p)];
    extend(pts, s[1].k, true); extend(pts, s[0].k, false);
    if (pts.length >= 4) lines.push(pts);
  }
  return lines;
}

function centres(F, jMin, jMax) {
  const { W, f, lon0, lat0, d } = F, R = 8, out = [];
  for (let j = jMin; j <= jMax; j++) for (let i = 0; i < W; i++) {
    const v0 = f[j * W + i]; let isMax = true, isMin = true, lo = Infinity, hi = -Infinity;
    for (let dj = -R; dj <= R && (isMax || isMin); dj++) {
      const jj = j + dj; if (jj < 0 || jj >= F.H) continue;
      for (let di = -R; di <= R; di++) {
        if (!di && !dj) continue;
        const v = f[jj * W + ((i + di + W) % W)];
        if (v > v0 || (v === v0 && (dj < 0 || (dj === 0 && di < 0)))) isMax = false;
        if (v < v0 || (v === v0 && (dj < 0 || (dj === 0 && di < 0)))) isMin = false;
        if (v < lo) lo = v; if (v > hi) hi = v;
      }
    }
    const pt = { lat: lat0 - j * d, lon: lon0 + i * d, p: Math.round(v0) };
    if (isMax && v0 - lo >= 4 && v0 >= 1012) out.push({ t: 'H', ...pt });
    if (isMin && hi - v0 >= 4 && v0 <= 1012) out.push({ t: 'L', ...pt });
  }
  return out;
}

function analyse(grib) {
  const F = smooth(toField(grib), 2);
  const jMin = Math.round((F.lat0 - 84) / F.d), jMax = Math.round((F.lat0 + 78) / F.d);
  let lo = Infinity, hi = -Infinity;
  for (let j = jMin; j <= jMax; j++) for (let i = 0; i < F.W; i++) { const v = F.f[j * F.W + i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const isobars = [];
  for (let p = Math.ceil(lo / STEP_HPA) * STEP_HPA; p <= hi; p += STEP_HPA) {
    for (const line of contours(F, p, jMin, jMax)) {
      const flat = []; for (const [x, y] of line) flat.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
      isobars.push({ p, pts: flat });
    }
  }
  const cMin = Math.round((F.lat0 - 75) / F.d), cMax = Math.round((F.lat0 + 70) / F.d);
  return { isobars, centres: centres(F, cMin, cMax) };
}

// ---------- WPC coded surface bulletin ----------
const FRONT_TYPES = new Set(['COLD', 'WARM', 'OCFNT', 'STNRY', 'TROF']);
function parseCodsus(text) {
  const out = { valid: null, fronts: [] }; let cur = null;
  const v = /VALID\s+(\d{2})(\d{2})(\d{2})Z/.exec(text || '');
  if (v) out.valid = { month: +v[1], day: +v[2], hour: +v[3] };
  for (const raw of String(text || '').split('\n')) {
    const tok = raw.trim().split(/\s+/); if (!tok[0]) continue;
    if (FRONT_TYPES.has(tok[0])) { cur = { type: tok[0], pts: [] }; out.fronts.push(cur); tok.shift(); }
    else if (/^[A-Z]/.test(tok[0])) { cur = null; continue; }
    if (!cur) continue;
    for (const t of tok) {
      if (!/^\d{4,5}$/.test(t)) continue;
      cur.pts.push(+t.slice(0, 2), -(+t.slice(2)));
    }
  }
  out.fronts = out.fronts.filter((fr) => fr.pts.length >= 4);
  return out;
}

// ---------- fetching + cache ----------
function cycleCandidates(nowMs) {
  const out = []; let t = Math.floor((nowMs - 3.5 * 3600e3) / 21600e3) * 21600e3;
  for (let k = 0; k < 4; k++, t -= 21600e3) out.push(t);
  return out;
}
// GFS 1p00 output is 3-hourly; use the step valid nearest to now so the chart is as current as the run allows.
function forecastHour(cycleMs, nowMs) {
  return Math.max(0, Math.min(12, Math.round((nowMs - cycleMs) / 3 / 3600e3) * 3));
}
function gfsUrl(cycleMs, fh) {
  const d = new Date(cycleMs), ymd = d.toISOString().slice(0, 10).replace(/-/g, ''), hh = String(d.getUTCHours()).padStart(2, '0');
  const f = String(fh || 0).padStart(3, '0');
  return `${NOMADS}?dir=%2Fgfs.${ymd}%2F${hh}%2Fatmos&file=gfs.t${hh}z.pgrb2.1p00.f${f}&var_PRMSL=on&lev_mean_sea_level=on`;
}

function createSynoptic(opts) {
  opts = opts || {};
  const fetchImpl = opts.fetchImpl || ((u) => fetch(u, { signal: AbortSignal.timeout(30000) }));
  const now = opts.now || Date.now;
  let data = null, checkedAt = 0, error = null, inflight = null;

  async function refresh() {
    let chart = null, cycle = null, step = 0, lastErr = null;
    const tries = [];
    for (const c of cycleCandidates(now())) { const fh = forecastHour(c, now()); tries.push([c, fh]); if (fh) tries.push([c, 0]); }
    for (const [c, fh] of tries) {
      if (data && data.cycleMs === c && data.fh === fh) { chart = data; cycle = c; step = fh; break; }
      try {
        const r = await fetchImpl(gfsUrl(c, fh));
        const buf = Buffer.from(await r.arrayBuffer());
        if (!r.ok || buf.toString('latin1', 0, 4) !== 'GRIB') continue;
        chart = analyse(decodeGrib2(buf)); cycle = c; step = fh; break;
      } catch (e) { lastErr = e; }
    }
    if (!chart) throw lastErr || new Error('no GFS cycle available');
    let fronts = data ? data.fronts : [], frontsValid = data ? data.frontsValid : null;
    try {
      const r = await fetchImpl(CODSUS);
      if (r.ok) { const p = parseCodsus(await r.text()); fronts = p.fronts; frontsValid = p.valid; }
    } catch (_) { /* keep previous fronts */ }
    data = { cycleMs: cycle, fh: step, isobars: chart.isobars, centres: chart.centres, fronts, frontsValid };
    error = null;
  }

  async function index() {
    if (now() - checkedAt >= REFRESH_MS || !data) {
      if (!inflight) {
        checkedAt = now();
        inflight = refresh().catch((e) => { error = String((e && e.message) || e); }).finally(() => { inflight = null; });
      }
      await inflight;
    }
    if (!data) return { source: 'NOAA', error, isobars: [], centres: [], fronts: [] };
    let frontsAt = null;
    if (data.frontsValid) {
      const c = new Date(data.cycleMs), y = c.getUTCFullYear();
      let t = Date.UTC(y, data.frontsValid.month - 1, data.frontsValid.day, data.frontsValid.hour);
      if (t - data.cycleMs > 180 * 86400e3) t = Date.UTC(y - 1, data.frontsValid.month - 1, data.frontsValid.day, data.frontsValid.hour);
      frontsAt = new Date(t).toISOString();
    }
    return {
      source: 'NOAA GFS mean-sea-level pressure (latest run, step valid nearest now) + NOAA WPC coded surface fronts',
      analysisAt: new Date(data.cycleMs).toISOString(), forecastHour: data.fh,
      validAt: new Date(data.cycleMs + data.fh * 3600e3).toISOString(), stepHpa: STEP_HPA,
      isobars: data.isobars, centres: data.centres, fronts: data.fronts, frontsAt, error,
    };
  }
  return { index };
}

const shared = createSynoptic();
module.exports = {
  index: shared.index, createSynoptic,
  _internal: { decodeGrib2, analyse, parseCodsus, cycleCandidates, gfsUrl, forecastHour, contours, toField },
};
