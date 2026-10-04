// ATL-160: renders the approved v5 Most Improved GIF (scripts/most_improved_gif.py,
// matplotlib) from an award-engine result. Python deps live in ./.pydeps on Render
// (installed by scripts/install-gif-deps.js at npm install).
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { dm } = require('./mostImproved');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'most_improved_gif.py');
const PYDEPS = path.join(__dirname, '..', '.pydeps');

function gifSpec(result) {
  const [c0, end] = result.currentWindow;
  return {
    data: result.eligible.slice(0, 6).map(r => [r.name, Math.round(r.baseline), Math.round(r.current)]),
    weekEnding: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(end).getUTCDay()] + ' ' + dm(end, true),
    window: dm(c0) + ' - ' + dm(end),
    dpi: 80,
  };
}

function caption(result) {
  const w = result.winner;
  return '🏆 Most Improved this week: ' + w.name + ', ' + (w.pct >= 0 ? '+' : '') + w.pct.toFixed(1) + '%';
}

function render(result) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-gif-'));
  const specFile = path.join(dir, 'spec.json'), out = path.join(dir, 'most_improved.gif');
  fs.writeFileSync(specFile, JSON.stringify(gifSpec(result)));
  const env = { ...process.env, MPLBACKEND: 'Agg', MPLCONFIGDIR: dir,
    PYTHONPATH: PYDEPS + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : '') };
  return new Promise((resolve, reject) => {
    execFile('python3', [SCRIPT, specFile, out], { env, timeout: 180000 }, (err, _so, se) => {
      try {
        if (err) return reject(new Error('GIF render failed: ' + (String(se || '').trim().split('\n').pop() || err.message)));
        resolve(fs.readFileSync(out));
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    });
  });
}

module.exports = { gifSpec, caption, render };
