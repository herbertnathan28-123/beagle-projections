const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const gif = require('../lib/mostImprovedGif');

const AT = Date.parse('2026-10-04T12:00:00Z');
const row = (name, baseline, current) => ({ name, baseline, current, pct: (current - baseline) / baseline * 100 });
const eligible = [row('Air Sorchy', 41582.4, 74843.2), row('Stihl air', 67081, 119897), row("Sith'ari Airways", 85137, 146335),
  row('Duck_a_lot', 101597, 147486), row('Blom airlines', 114179, 164214), row('Pablo El Pistons Airline', 12865, 18346), row('Seventh', 20000, 26000)];
const result = { weekKey: '2026-10-04', currentWindow: [AT - 7 * 86400e3, AT], eligible, winner: eligible[0] };

test('GIF spec: top 6 eligible, rounded $/day, week-ending + window dates', () => {
  assert.deepStrictEqual(gif.gifSpec(result), {
    data: [['Air Sorchy', 41582, 74843], ['Stihl air', 67081, 119897], ["Sith'ari Airways", 85137, 146335],
      ['Duck_a_lot', 101597, 147486], ['Blom airlines', 114179, 164214], ['Pablo El Pistons Airline', 12865, 18346]],
    weekEnding: 'Sun 4 Oct 2026', window: '27 Sep - 4 Oct', dpi: 80,
  });
});

test('caption is the ruled one-liner', () => {
  assert.strictEqual(gif.caption(result), '🏆 Most Improved this week: Air Sorchy, +80.0%');
});

let havePy = true;
try { execFileSync('python3', ['-c', 'import matplotlib, PIL, numpy'], { stdio: 'ignore', env: { ...process.env, PYTHONPATH: require('path').join(__dirname, '..', '.pydeps') } }); } catch (_) { havePy = false; }

test('renders an animated GIF (115 frames, 960x592)', { skip: !havePy && 'python3 + matplotlib not available' }, async () => {
  const buf = await gif.render({ ...result, eligible: eligible.slice(0, 3) });
  assert.strictEqual(buf.slice(0, 6).toString(), 'GIF89a');
  assert.strictEqual(buf.readUInt16LE(6), 960);
  assert.strictEqual(buf.readUInt16LE(8), 592);
  assert.ok(buf.length > 200e3);
});
