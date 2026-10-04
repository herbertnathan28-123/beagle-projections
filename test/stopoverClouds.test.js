'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createClouds, _internal } = require('../lib/stopoverClouds');

const NOW = Date.parse('2026-10-04T13:32:00Z');
const XML = (end) => `<Domains><DimensionDomain><Domain>2026-10-03T00:00:00Z/2026-10-03T23:50:00Z/PT10M,2026-10-04T00:00:00Z/${end}/PT10M</Domain></DimensionDomain></Domains>`;

test('latest scan is the newest range end, never in the future or off the 10-min grid', () => {
  assert.strictEqual(_internal.latest(XML('2026-10-04T13:10:00Z'), NOW), Date.parse('2026-10-04T13:10:00Z'));
  assert.strictEqual(_internal.latest('<Domain>2026-10-04T13:20:00Z,2026-10-04T13:40:00Z</Domain>', NOW), Date.parse('2026-10-04T13:20:00Z'));
  assert.strictEqual(_internal.latest('<Domain>2026-10-04T13:15:00Z</Domain>', NOW), null);
  assert.strictEqual(_internal.latest('nothing', NOW), null);
  assert.ok(_internal.domainsUrl('GOES-East_ABI_Band13_Clean_Infrared', NOW)
    .endsWith('/GOES-East_ABI_Band13_Clean_Infrared/default/2km/all/2026-10-03--2026-10-05.xml'));
});

test('index lists each satellite with its newest scan, caches, and drops stale or failed ones', async () => {
  let t = NOW; const log = [];
  const fetchImpl = async (u) => {
    if (u.endsWith('.png')) return { ok: !u.includes('T13:10:00Z') };
    log.push(u);
    if (u.includes('Himawari')) throw new Error('down');
    const end = u.includes('GOES-West') ? '2026-10-04T09:00:00Z' : '2026-10-04T13:10:00Z';
    return { ok: true, text: async () => XML(end) };
  };
  const c = createClouds({ fetchImpl, now: () => t });
  const a = await c.index();
  assert.deepStrictEqual(a.sats.map((s) => [s.id, s.t]), [['ge', '2026-10-04T13:00:00.000Z']]);
  assert.strictEqual(a.source, 'NASA GIBS');
  assert.strictEqual(log.length, 3);
  t += 60000; await c.index();
  assert.strictEqual(log.length, 3);
  t += 5 * 60000; await c.index();
  assert.strictEqual(log.length, 6);
});

test('a failed refresh keeps the previous scan time', async () => {
  let fail = false;
  const c = createClouds({ now: () => NOW + (fail ? 6 * 60000 : 0),
    fetchImpl: async (u) => { if (fail) throw new Error('down'); return { ok: true, text: async () => XML('2026-10-04T13:10:00Z') }; } });
  assert.strictEqual((await c.index()).sats.length, 3);
  fail = true;
  assert.strictEqual((await c.index()).sats.length, 3);
});

test('probe URL is the z0 tile over the satellite', () => {
  const [ge, , hi] = _internal.SATS, t = Date.parse('2026-10-04T13:10:00Z');
  assert.ok(_internal.probeUrl(ge, t).endsWith('/GOES-East_ABI_Band13_Clean_Infrared/default/2026-10-04T13:10:00Z/2km/0/0/0.png'));
  assert.ok(_internal.probeUrl(hi, t).endsWith('/2km/0/0/1.png'));
});
