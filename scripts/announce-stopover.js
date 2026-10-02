// ═══════════════════════════════════════════════════════════════════════════
// ATL-146 — one-off Stopover Finder announcement.
// Posts the announcement ONCE to the Discord channel behind STOP_OVER_FINDER.
// A marker in /data records the attempt BEFORE the post goes out, so it can
// never post twice — not on a redeploy, not on a restart, not on a re-run.
// The webhook value is read from the env only and is never logged.
//
// Runs from server boot (one-shot, marker-guarded) or by hand:
//   node scripts/announce-stopover.js
// ═══════════════════════════════════════════════════════════════════════════
const fs    = require('fs');
const https = require('https');

const MARKER = '/data/stopover-announced.json';
const LINK   = 'https://beagle-projections.onrender.com/stopover';

const MESSAGE = [
  '**✈️ Beagle Global Stopover Finder**',
  'Got a route your aircraft can\'t fly direct? This finds the best stopover for it.',
  '**How to use it**',
  '1. Enter your **From** and **To** airports (3-letter IATA or 4-letter ICAO, e.g. HKG / VHHH)',
  '2. Enter your aircraft\'s **range in km** (from its spec card)',
  '3. Optional: a **minimum runway** in ft, if your aircraft needs a long one',
  '4. Pick **Easy** or **Realism** for your ticket prices',
  'You\'ll get the best stopover with both leg distances, the extra distance it adds, and suggested Y / J / F ticket prices. The five best options are listed below, and tapping any of them switches the route to it.',
  '**Share a route:** tap *Copy link to this route* and paste it here. It opens straight to that route for whoever clicks it.',
  '🔗 ' + LINK,
].join('\n');

function announceStopoverOnce(done) {
  const finish = (msg) => { console.log('[STOPOVER-ANNOUNCE] ' + msg); if (done) done(msg); };
  const url = process.env.STOP_OVER_FINDER;
  if (!url) return finish('STOP_OVER_FINDER not set — skipped');
  if (fs.existsSync(MARKER)) return finish('already announced — skipped');

  // Claim the one shot first. If /data is not writable we cannot guarantee
  // once-only, so do not post at all.
  try {
    fs.writeFileSync(MARKER, JSON.stringify({ status: 'sending', at: new Date().toISOString() }), { flag: 'wx' });
  } catch (e) {
    return finish('marker not writable (' + e.code + ') — not posting');
  }
  const record = (status, extra) => {
    try { fs.writeFileSync(MARKER, JSON.stringify({ status, at: new Date().toISOString(), ...extra })); } catch (_) {}
  };

  let u;
  try { u = new URL(url); } catch (_) { record('failed', { reason: 'bad webhook url' }); return finish('webhook env is not a valid URL — not posting'); }
  const body = JSON.stringify({ content: MESSAGE, allowed_mentions: { parse: [] } });
  const req = https.request({
    hostname: u.hostname,
    path: u.pathname + '?wait=true',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => {
    let raw = '';
    res.on('data', c => { raw += c; });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let id = null;
        try { id = JSON.parse(raw).id || null; } catch (_) {}
        record('sent', { message_id: id });
        finish('posted (HTTP ' + res.statusCode + (id ? ', message ' + id : '') + ')');
      } else {
        record('failed', { http: res.statusCode });
        finish('Discord returned HTTP ' + res.statusCode + ' — not retried');
      }
    });
  });
  req.on('error', (e) => { record('failed', { reason: e.code || 'network' }); finish('network error ' + (e.code || '') + ' — not retried'); });
  req.write(body);
  req.end();
}

module.exports = { announceStopoverOnce, MESSAGE };

if (require.main === module) announceStopoverOnce();
