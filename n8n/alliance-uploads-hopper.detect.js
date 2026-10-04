const input = $input.first().json;
const body = input.body || {};
const rawText = body.rawText ? body.rawText : (input.rawText || '');
const uploader = body.discordUsername || body.uploader || 'unknown';
const forwardedFrom = body.forwardedFrom || null;
const now = new Date();

const UPLOADS_WEBHOOK = $vars.UPLOADS_DISCORD_WEBHOOK;
const PACE_CH_WEBHOOK = $vars.PACE_CHANNEL_DISCORD_WEBHOOK;
const PROJ_URL = 'https://beagle-projections.onrender.com/api/update';
const HQ_URL = 'https://beagle-projections.onrender.com/api/hq-update';
const TOKEN = $vars.N8N_TOKEN;
const HQ_TOKEN = $vars.HQ_N8N_TOKEN;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Server POST with one retry after 45s (covers Render cold starts). Never hides the outcome.
const postServer = async (url, payload) => {
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await this.helpers.httpRequest({ method: 'POST', url: url, headers: { 'Content-Type': 'application/json' }, body: payload, json: true, timeout: 120000 });
      return { ok: true, response: response };
    } catch (e) {
      lastErr = (e && e.message) ? e.message : String(e);
      if (attempt === 1) await sleep(45000);
    }
  }
  return { ok: false, error: lastErr };
};

// Confirmation/alert to Discord: uploads-channel webhook first, pace-upload channel as fallback.
const notify = async (content) => {
  const hooks = [UPLOADS_WEBHOOK, PACE_CH_WEBHOOK];
  for (let i = 0; i < hooks.length; i++) {
    try {
      await this.helpers.httpRequest({ method: 'POST', url: hooks[i], headers: { 'Content-Type': 'application/json' }, body: { content: content }, json: true, timeout: 30000 });
      return true;
    } catch (e) { /* dead webhook — try next */ }
  }
  return false;
};

const stamp = now.toUTCString().slice(17, 25) + ' UTC';
const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
const hasFlights = lines.some(l => l.startsWith('Flights:'));
const hasAirlines = lines.some(l => l.startsWith('Airlines:'));
const hasSVPattern = lines.some(l => /\$[\d,]+\.\d{2}/.test(l));
const hasPlayerCols = lines.some(l => (l.match(/\$/g)||[]).length >= 4);
// Member table pasted without its "Flights:" header (e.g. message.txt): rows with 4+ $ columns and "… ago" ages.
const hasMemberRows = lines.some(l => (l.match(/\$/g)||[]).length >= 4 && /\d+\s+\w+\s+ago\b/.test(l));

let contentType = 'UNKNOWN';
if (hasPlayerCols && (hasFlights || hasMemberRows)) contentType = 'PLAYER_PACE';
else if (hasSVPattern && (hasAirlines || hasPlayerCols)) contentType = 'ALLIANCE_RANKINGS';

let result = { contentType, uploader, forwardedFrom, timestamp: now.toISOString(), lines: lines.length };

if (contentType === 'ALLIANCE_RANKINGS') {
  const alliances = [];
  let rank = 0;
  for (const line of lines) {
    if (/^(Flights:|Airlines:|\$1,000|\$0\.00)/.test(line)) continue;
    const dollarIdx = line.lastIndexOf('$');
    if (dollarIdx < 0) continue;
    const svPart = line.substring(dollarIdx + 1);
    const namePart = line.substring(0, dollarIdx).trim();
    if (!/^\d{1,3}(?:,\d{3})*\.\d+$/.test(svPart)) continue;
    if (!namePart || namePart.length > 60) continue;
    if (/^(Flights:|Airlines:|\*|Points|http)/.test(namePart)) continue;
    rank++;
    alliances.push({ rank, name: namePart, sv: parseFloat(svPart.replace(/,/g,'')) });
  }
  result.allianceCount = alliances.length;
  if (alliances.length === 0) {
    await notify('⚠️ **RANKINGS UPLOAD from ' + uploader + '** — 0 alliances parsed. Nothing logged. ' + stamp);
  } else if (forwardedFrom === 'alliance-projections') {
    result.skippedPush = 'alliance-projections workflow already pushed these rankings';
  } else {
    const beagle = alliances.find(a => a.name.toLowerCase().includes('beagle'));
    const r = await postServer(PROJ_URL, { token: TOKEN, timestamp: now.toISOString(), uploader, beagleSV: beagle ? beagle.sv : null, beagleRank: beagle ? beagle.rank : null, beaglePace: null, alliances: alliances.filter(a => !a.name.toLowerCase().includes('beagle')).map(a => ({ rank: a.rank, name: a.name, sv: a.sv, pace: null })) });
    result.serverPush = r;
    if (r.ok) await notify('✅ **ALLIANCE RANKINGS** from ' + uploader + ' — ' + alliances.length + ' alliances logged to projections server. ' + stamp);
    else await notify('⚠️ **RANKINGS UPLOAD FAILED** from ' + uploader + ' — projections server push failed after 2 attempts (' + r.error + '). Data NOT logged — please re-upload. ' + stamp);
  }
} else if (contentType === 'PLAYER_PACE') {
  // FIX: the server parses the raw paste itself (parsePaceUpload) — it needs rawText, not a pre-parsed players array.
  const r = await postServer(HQ_URL, { token: HQ_TOKEN, timestamp: now.toISOString(), uploader, rawText: rawText, alliancePace: body.alliancePace || null });
  result.serverPush = r;
  const count = (r.ok && r.response && r.response.players) ? r.response.players : null;
  result.playerCount = count;
  if (r.ok) await notify('✅ **PLAYER PACE DATA** from ' + uploader + ' — ' + (count || '?') + ' players logged to HQ. ' + stamp);
  else await notify('⚠️ **PLAYER DATA FAILED** from ' + uploader + ' — HQ push failed after 2 attempts (' + r.error + '). Data NOT logged — please re-upload. ' + stamp);
} else {
  await notify('⚠️ **UNKNOWN TYPE** from ' + uploader + ' — ' + lines.length + ' lines received. Nothing logged. ' + stamp);
}

return [{ json: result }];