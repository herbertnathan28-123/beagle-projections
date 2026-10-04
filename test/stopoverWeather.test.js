'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createWeather, _internal } = require('../lib/stopoverWeather');

const LATEST = Date.parse('2026-10-04T02:30:00Z');
const DOMAIN = '<Domains><DimensionDomain><Domain>2026-10-03/2026-10-04T02:30:00Z/PT30M</Domain></DimensionDomain></Domains>';
const png = (n) => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => new Uint8Array(n).buffer });

function fakeFetch(blankAt) {
  const calls = [];
  const fn = async (u) => {
    calls.push(u);
    if (u.includes('/wmts/')) return { ok: true, text: async () => DOMAIN };
    const t = Date.parse(/TIME=([^&]+)/.exec(u)[1]);
    return png(t === blankAt ? 4000 : 50000);
  };
  fn.calls = calls;
  return fn;
}

test('latestFromDomain reads the end of the last range', () => {
  assert.strictEqual(_internal.latestFromDomain(DOMAIN), LATEST);
  assert.strictEqual(_internal.latestFromDomain('<Domain>2026-01-01/2026-01-02T00:00:00Z/PT30M,2026-10-03/2026-10-04T02:30:00Z/PT30M</Domain>'), LATEST);
  assert.strictEqual(_internal.latestFromDomain('nope'), null);
});

test('frame URL asks GIBS for a global plate carree PNG at the frame time', () => {
  const u = _internal.frameUrl(LATEST);
  assert.match(u, /LAYERS=IMERG_Precipitation_Rate_30min/);
  assert.match(u, /CRS=EPSG:4326&BBOX=-90,-180,90,180/);
  assert.match(u, /TIME=2026-10-04T02:30:00Z/);
});

test('index serves the last 8 half-hour frames, skipping blank ones', async () => {
  const blank = LATEST - 3 * _internal.STEP_MS;
  const f = fakeFetch(blank);
  const w = createWeather({ fetchImpl: f, now: () => LATEST + 5 * 3600e3 });
  const d = await w.index();
  assert.strictEqual(d.error, null);
  assert.strictEqual(d.frames.length, _internal.FRAMES - 1);
  assert.strictEqual(d.frames[d.frames.length - 1].t, '2026-10-04T02:30:00.000Z');
  assert.ok(!d.frames.some((x) => Date.parse(x.t) === blank));
  const ms = /frame\/(\d+)\.png/.exec(d.frames[0].url)[1];
  assert.ok(w.frame(ms).length >= _internal.MIN_BYTES);
  assert.strictEqual(w.frame(blank), null);
});

test('index is cached between refreshes and survives a GIBS outage', async () => {
  let t = LATEST + 3600e3, down = false;
  const f = fakeFetch(null);
  const fetchImpl = async (u) => { if (down) throw new Error('ECONNRESET'); return f(u); };
  const w = createWeather({ fetchImpl, now: () => t });
  await w.index();
  const n = f.calls.length;
  await w.index();
  assert.strictEqual(f.calls.length, n, 'second call inside the refresh window does not refetch');
  down = true; t += 16 * 60e3;
  const d = await w.index();
  assert.match(d.error, /ECONNRESET/);
  assert.strictEqual(d.frames.length, _internal.FRAMES, 'keeps serving the cached frames');
});
