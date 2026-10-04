'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createTiles, _internal } = require('../lib/stopoverTiles');

const NOW = Date.parse('2026-10-04T10:00:00Z');
const T = Date.parse('2026-10-04T02:30:00Z');

function fakeFetch(log, opts) {
  opts = opts || {};
  return async (u) => {
    log.push(u);
    if (opts.fail) throw new Error('down');
    const type = opts.type || (u.endsWith('.png') ? 'image/png' : 'image/jpeg');
    return { ok: !opts.status, status: opts.status || 200, headers: { get: () => type }, arrayBuffer: async () => Buffer.from('img:' + u) };
  };
}

test('tile URLs follow the GIBS EPSG:4326 WMTS layout', () => {
  assert.strictEqual(_internal.tileUrl('bm', 5, 7, 17),
    'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/5/7/17.jpeg');
  assert.strictEqual(_internal.tileUrl('rain', 3, 1, 5, T),
    'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/IMERG_Precipitation_Rate_30min/default/2026-10-04T02:30:00Z/2km/3/1/5.png');
});

test('rejects tiles outside the matrix, unknown layers and bad rain times', () => {
  const p = _internal.parse;
  assert.deepStrictEqual(p('bm', '7', '79', '159', undefined, NOW), { z: 7, r: 79, c: 159, t: null });
  assert.strictEqual(p('bm', '8', '0', '0', undefined, NOW), null);
  assert.strictEqual(p('bm', '2', '3', '0', undefined, NOW), null);
  assert.strictEqual(p('bm', '2', '0', '5', undefined, NOW), null);
  assert.strictEqual(p('bm', '-1', '0', '0', undefined, NOW), null);
  assert.strictEqual(p('bm', '1.5', '0', '0', undefined, NOW), null);
  assert.strictEqual(p('toString', '0', '0', '0', undefined, NOW), null);
  assert.strictEqual(p('rain', '6', '0', '0', String(T), NOW), null);
  assert.deepStrictEqual(p('rain', '5', '19', '39', String(T), NOW), { z: 5, r: 19, c: 39, t: T });
  assert.strictEqual(p('rain', '3', '0', '0', String(T + 60000), NOW), null);
  assert.strictEqual(p('rain', '3', '0', '0', String(NOW + 1800000), NOW), null);
  assert.strictEqual(p('rain', '3', '0', '0', String(T - 4 * 86400000), NOW), null);
  assert.strictEqual(p('rain', '3', '0', '0', 'abc', NOW), null);
});

test('caches tiles, shares in-flight fetches and evicts the oldest', async () => {
  const log = [];
  const t = createTiles({ fetchImpl: fakeFetch(log), now: () => NOW, max: 2 });
  const [a, b] = await Promise.all([t.tile('bm', 1, 0, 0), t.tile('bm', 1, 0, 0)]);
  assert.strictEqual(a, b);
  assert.strictEqual(a.type, 'image/jpeg');
  assert.strictEqual(log.length, 1);
  await t.tile('bm', 1, 0, 0);
  assert.strictEqual(log.length, 1);
  await t.tile('bm', 1, 0, 1);
  await t.tile('rain', 2, 0, 0, String(T));
  assert.strictEqual(t._cache.size, 2);
  await t.tile('bm', 1, 0, 0);
  assert.strictEqual(log.length, 4);
});

test('upstream failures return null and are not cached', async () => {
  for (const o of [{ fail: true }, { status: 503 }, { type: 'text/xml' }]) {
    const log = [];
    const t = createTiles({ fetchImpl: fakeFetch(log, o), now: () => NOW });
    assert.strictEqual(await t.tile('bm', 0, 0, 0), null);
    assert.strictEqual(t._cache.size, 0);
  }
  const log = [];
  const t = createTiles({ fetchImpl: fakeFetch(log), now: () => NOW });
  assert.strictEqual(await t.tile('bm', 9, 0, 0), null);
  assert.strictEqual(log.length, 0);
});

test('live cloud tiles take 10-minute scan times up to a day old', () => {
  const p = _internal.parse, t = Date.parse('2026-10-04T09:50:00Z');
  assert.deepStrictEqual(p('ge', '5', '19', '39', String(t), NOW), { z: 5, r: 19, c: 39, t });
  assert.strictEqual(p('hi', '3', '0', '0', String(t + 300000), NOW), null);
  assert.strictEqual(p('gw', '3', '0', '0', String(NOW - 86400000 - 600000), NOW), null);
  assert.strictEqual(p('gw', '6', '0', '0', String(t), NOW), null);
  assert.strictEqual(_internal.tileUrl('hi', 2, 1, 4, t),
    'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/Himawari_AHI_Band13_Clean_Infrared/default/2026-10-04T09:50:00Z/2km/2/1/4.png');
});
