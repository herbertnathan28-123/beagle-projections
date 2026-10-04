'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createSynoptic, _internal } = require('../lib/stopoverSynoptic');

// Minimal GRIB2: 1° global lat/lon grid (template 3.0), simple packing (5.0), values in Pa.
function makeGrib(fn) {
  const ni = 360, nj = 181, n = ni * nj, nb = 16, D = 0, E = 0, R = 90000;
  const s = (len, num, fill) => { const b = Buffer.alloc(len); b.writeUInt32BE(len, 0); b[4] = num; fill(b); return b; };
  const s1 = s(21, 1, () => {});
  const s3 = s(72, 3, (b) => { b.writeUInt32BE(n, 6); b.writeUInt16BE(0, 12); b.writeUInt32BE(ni, 30); b.writeUInt32BE(nj, 34);
    b.writeUInt32BE(90e6, 46); b.writeUInt32BE(0, 50); b.writeUInt32BE(1e6, 63); b.writeUInt32BE(1e6, 67); });
  const s4 = s(34, 4, () => {});
  const s5 = s(21, 5, (b) => { b.writeUInt32BE(n, 5); b.writeUInt16BE(0, 9); b.writeFloatBE(R, 11); b.writeUInt16BE(E, 15); b.writeUInt16BE(D, 17); b[19] = nb; });
  const s6 = s(6, 6, (b) => { b[5] = 255; });
  const data = Buffer.alloc(n * 2);
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) data.writeUInt16BE(Math.round(fn(90 - j, i > 180 ? i - 360 : i) - R), (j * ni + i) * 2);
  const s7 = Buffer.concat([s(5, 7, () => {}), data]); s7.writeUInt32BE(s7.length, 0);
  const body = Buffer.concat([s1, s3, s4, s5, s6, s7, Buffer.from('7777')]);
  const s0 = Buffer.alloc(16); s0.write('GRIB', 0, 'latin1'); s0[7] = 2; s0.writeUInt32BE(0, 8); s0.writeUInt32BE(16 + body.length, 12);
  return Buffer.concat([s0, body]);
}
// a 990 hPa low at 50N 30W and a 1030 hPa high at 30S 100E on a 1012 hPa background
const field = (lat, lon) => 101200
  - 2200 * Math.exp(-(((lat - 50) ** 2) + ((lon + 30) ** 2)) / 120)
  + 1800 * Math.exp(-(((lat + 30) ** 2) + ((lon - 100) ** 2)) / 150);

test('decodes a GRIB2 grid to hPa on the 1° lat/lon grid', () => {
  const g = _internal.decodeGrib2(makeGrib(field));
  assert.deepStrictEqual([g.ni, g.nj, g.la1, g.lo1, g.di], [360, 181, 90, 0, 1]);
  const at = (lat, lon) => g.values[(90 - lat) * g.ni + ((lon + 360) % 360)] / 100;
  assert.ok(Math.abs(at(50, -30) - 990) < 0.6);
  assert.ok(Math.abs(at(-30, 100) - 1030) < 0.6);
});

test('contours closed isobars round the low and finds the H and L centres', () => {
  const a = _internal.analyse(_internal.decodeGrib2(makeGrib(field)));
  const L = a.centres.find((c) => c.t === 'L'), H = a.centres.find((c) => c.t === 'H');
  assert.ok(L && Math.abs(L.lat - 50) <= 1 && Math.abs(L.lon + 30) <= 1, JSON.stringify(L));
  assert.ok(H && Math.abs(H.lat + 30) <= 1 && Math.abs(H.lon - 100) <= 1, JSON.stringify(H));
  assert.strictEqual(a.centres.length, 2);
  const ring = a.isobars.find((l) => l.p === 1000);
  assert.ok(ring, 'a 1000 hPa isobar exists');
  const lats = ring.pts.filter((_, k) => k % 2), lons = ring.pts.filter((_, k) => !(k % 2));
  assert.ok(Math.min(...lats) > 40 && Math.max(...lats) < 60 && Math.min(...lons) > -40 && Math.max(...lons) < -20);
  assert.ok(a.isobars.every((l) => l.p % 4 === 0));
});

test('parses WPC coded fronts (lat, west lon) and continuation lines', () => {
  const txt = 'CODSUS\nVALID 100406Z\nHIGHS 1028 44110\nLOWS 1009 35115\nCOLD 52142 48142 43144\n 38147 34150\nWARM 4988 4887\nTROF 3631\n';
  const p = _internal.parseCodsus(txt);
  assert.deepStrictEqual(p.valid, { month: 10, day: 4, hour: 6 });
  assert.deepStrictEqual(p.fronts.map((f) => f.type), ['COLD', 'WARM']);
  assert.deepStrictEqual(p.fronts[0].pts, [52, -142, 48, -142, 43, -144, 38, -147, 34, -150]);
  assert.deepStrictEqual(p.fronts[1].pts, [49, -88, 48, -87]);
});

test('index picks the newest available GFS cycle and dates the fronts', async () => {
  const now = Date.parse('2026-10-04T08:30:00Z'), grib = makeGrib(field), asked = [];
  const fetchImpl = async (u) => {
    asked.push(u);
    if (u.includes('codsus') || u.includes('cod.sus')) return { ok: true, text: async () => 'VALID 100406Z\nCOLD 4988 4591 4393\n' };
    if (u.includes('gfs.20261004%2F00')) return { ok: true, arrayBuffer: async () => grib };
    return { ok: false, arrayBuffer: async () => Buffer.from('<html>404') };
  };
  const d = await createSynoptic({ fetchImpl, now: () => now }).index();
  assert.strictEqual(d.error, null);
  assert.strictEqual(d.analysisAt, '2026-10-04T00:00:00.000Z');
  assert.strictEqual(d.forecastHour, 9);
  assert.strictEqual(d.validAt, '2026-10-04T09:00:00.000Z');
  assert.ok(asked[0].includes('gfs.20261004%2F00') && asked[0].includes('1p00.f009'), 'starts at the newest cycle, step valid nearest now');
  assert.strictEqual(d.frontsAt, '2026-10-04T06:00:00.000Z');
  assert.strictEqual(d.fronts.length, 1);
  assert.ok(d.isobars.length > 0 && d.centres.length === 2);
});

test('index reports an error instead of throwing when NOAA is unreachable', async () => {
  const d = await createSynoptic({ fetchImpl: async () => { throw new Error('ETIMEDOUT'); } }).index();
  assert.match(d.error, /ETIMEDOUT/);
  assert.deepStrictEqual(d.isobars, []);
});

test('forecast step is the 3-hourly step nearest now, capped at +12 h', () => {
  const c = Date.parse('2026-10-04T06:00:00Z');
  assert.strictEqual(_internal.forecastHour(c, Date.parse('2026-10-04T10:00:00Z')), 3);
  assert.strictEqual(_internal.forecastHour(c, Date.parse('2026-10-04T12:45:00Z')), 6);
  assert.strictEqual(_internal.forecastHour(c, Date.parse('2026-10-05T06:00:00Z')), 12);
  assert.ok(_internal.gfsUrl(c, 6).includes('gfs.t06z.pgrb2.1p00.f006'));
});

test('falls back to the analysis when the current step is not published yet', async () => {
  const now = Date.parse('2026-10-04T08:30:00Z'), grib = makeGrib(field);
  const fetchImpl = async (u) => {
    if (u.includes('cod.sus')) return { ok: false, text: async () => '' };
    if (u.includes('gfs.20261004%2F00') && u.includes('f000')) return { ok: true, arrayBuffer: async () => grib };
    return { ok: false, arrayBuffer: async () => Buffer.from('<html>404') };
  };
  const d = await createSynoptic({ fetchImpl, now: () => now }).index();
  assert.strictEqual(d.forecastHour, 0);
  assert.strictEqual(d.validAt, '2026-10-04T00:00:00.000Z');
});
