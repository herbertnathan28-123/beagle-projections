// ATL-160: the n8n ALLIANCE UPLOADS HOPPER "Detect Content and Route" node, run in a stub n8n sandbox.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'n8n', 'alliance-uploads-hopper.detect.js'), 'utf8');
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');

async function runNode(rawText) {
  const posts = [];
  const helpers = { httpRequest: async req => { posts.push(req); return req.url.includes('/api/hq-update') ? { players: 3 } : {}; } };
  const fn = new Function('$input', '$vars', 'return (async function () {\n' + CODE + '\n}).call(this);');
  const out = await fn.call({ helpers }, { first: () => ({ json: { body: { rawText, discordUsername: 'tester' } } }) },
    { UPLOADS_DISCORD_WEBHOOK: 'https://discord.test/up', PACE_CHANNEL_DISCORD_WEBHOOK: 'https://discord.test/pace', N8N_TOKEN: 'n', HQ_N8N_TOKEN: 'hq' });
  return { result: out[0].json, posts };
}

test('member table pasted without a "Flights:" line routes to /api/hq-update as PLAYER_PACE', async () => {
  const raw = fx('hopper-member-table.txt');
  assert.ok(!/^Flights:/m.test(raw));
  const { result, posts } = await runNode(raw);
  assert.strictEqual(result.contentType, 'PLAYER_PACE');
  const hq = posts.find(p => p.url.endsWith('/api/hq-update'));
  assert.ok(hq, 'posted to HQ');
  assert.strictEqual(hq.body.rawText, raw);
  assert.strictEqual(hq.body.token, 'hq');
});

test('member table with a "Flights:" header still routes as PLAYER_PACE', async () => {
  const { result } = await runNode('Flights: 1,234\n' + fx('hopper-member-table.txt'));
  assert.strictEqual(result.contentType, 'PLAYER_PACE');
});

test('alliance rankings paste is unchanged (ALLIANCE_RANKINGS → /api/update)', async () => {
  const { result, posts } = await runNode(fx('hopper-rankings.txt'));
  assert.strictEqual(result.contentType, 'ALLIANCE_RANKINGS');
  assert.ok(posts.some(p => p.url.endsWith('/api/update')));
  assert.ok(!posts.some(p => p.url.endsWith('/api/hq-update')));
});

test('unrelated text stays UNKNOWN', async () => {
  const { result, posts } = await runNode('hello team\nsee you at 20:00');
  assert.strictEqual(result.contentType, 'UNKNOWN');
  assert.ok(!posts.some(p => /onrender\.com/.test(p.url)));
});
