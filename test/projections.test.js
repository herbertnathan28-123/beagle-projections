// node --test test/*.test.js — projections page display rules (ATL-154)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../lib/pace');
const { HTML, HTML_COMPILED } = require('../views/projections');

const src = f => fs.readFileSync(path.join(__dirname, '..', 'views', f), 'utf8');

test('share value carries no invented M/B unit anywhere on the page', () => {
  for (const f of ['projections-app.jsx', 'projections.js']) {
    const s = src(f);
    assert.doesNotMatch(s, /fmtSvM/, f);
    assert.doesNotMatch(s, /\+ ?'[MB]'/, f + ': a value suffixed with M or B');
    assert.doesNotMatch(s, /\}M</, f + ': a JSX value followed by a literal M');
  }
});

test('current pace is the first tab, opens on load, and is the pace graph with a 1–10 / 11–20 toggle', () => {
  assert.match(src('projections.js'), /const \[tab,setTab\]=useState\('pace'\);/);
  const tabs = HTML.slice(HTML.indexOf('function TopTabs'));
  const first = tabs.indexOf('>CURRENT PACE 1\u201420</button>'), proj = tabs.indexOf('>PROJECTIONS</button>');
  assert.ok(first > 0 && proj > first, 'CURRENT PACE tab precedes PROJECTIONS');
  assert.ok(tabs.includes("tab==='pace'?<window.PaceBoard/>"), 'the pace tab renders the graph');
  const board = src('pace-board.jsx');
  assert.ok(board.includes("[[0, '1 \\u2014 10'], [1, '11 \\u2014 20']]"), 'two-position toggle');
  assert.ok(!/TrendPanel|PaceList/.test(HTML), 'the stacked panels and the 20-row tables are gone');
  assert.ok(HTML_COMPILED.includes('PaceBoard') && !HTML_COMPILED.includes('__PACE_BOARD__'), 'compiles');
});

test('the pace window is named the same way as the canonical label', () => {
  assert.strictEqual(P.fmtWindow(1.014), '24.3 h');
  assert.strictEqual(P.fmtWindow(3), '3.0 d');
});
