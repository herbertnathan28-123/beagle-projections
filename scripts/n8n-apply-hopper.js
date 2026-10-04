// Pushes n8n/alliance-uploads-hopper.detect.js into the live ALLIANCE UPLOADS HOPPER
// workflow's "Detect Content and Route" node (ATL-160). Usage: N8N_API_KEY=... node scripts/n8n-apply-hopper.js [--dry]
const fs = require('fs');
const path = require('path');
const BASE = process.env.N8N_BASE_URL || 'https://atlas-nathan28.app.n8n.cloud';
const WF = process.env.HOPPER_WORKFLOW_ID || 'NXIRSUocjrXmvWxz';
const NODE = 'Detect Content and Route';
const key = process.env.N8N_API_KEY;
if (!key) { console.error('N8N_API_KEY required'); process.exit(1); }
const h = { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' };
(async () => {
  const wf = await (await fetch(BASE + '/api/v1/workflows/' + WF, { headers: h })).json();
  const node = (wf.nodes || []).find(n => n.name === NODE);
  if (!node) throw new Error('node "' + NODE + '" not found in ' + WF);
  const code = fs.readFileSync(path.join(__dirname, '..', 'n8n', 'alliance-uploads-hopper.detect.js'), 'utf8');
  if (node.parameters.jsCode === code) return console.log('already up to date');
  node.parameters.jsCode = code;
  if (process.argv.includes('--dry')) return console.log('dry run: would update', NODE);
  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: (wf.settings || {}).executionOrder || 'v1' } };
  const r = await fetch(BASE + '/api/v1/workflows/' + WF, { method: 'PUT', headers: h, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('PUT ' + r.status + ': ' + (await r.text()).slice(0, 300));
  console.log('updated', NODE, 'in', WF, '(active:', (await r.json()).active + ')');
})().catch(e => { console.error(e.message); process.exit(1); });
