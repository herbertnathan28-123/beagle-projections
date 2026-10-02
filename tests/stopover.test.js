'use strict';
// Regression tests for public/stopover.html — drives the page's own solve()
// against DOM stubs so the tests exercise the shipped code, not a copy.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'stopover.html'), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

// Generic canvas-2d stand-in: every method returns another stub, property sets are swallowed.
function fakeCtx() {
  return new Proxy({}, {
    get: (t, k) => (k === 'canvas' ? null : (...a) => fakeCtx()),
    set: () => true,
  });
}

function el(id) {
  return {
    id, value: '', textContent: '', innerHTML: '', className: '', style: {},
    children: [], clientWidth: 1000, clientHeight: 400, type: '', label: '',
    setAttribute() {}, getAttribute() { return null; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, getContext() { return fakeCtx(); },
    click() {}, onclick: null,
  };
}

const ELS = {};
const documentStub = {
  getElementById: (id) => ELS[id] || (ELS[id] = el(id)),
  createElement: (tag) => el(tag),
  createDocumentFragment: () => ({ appendChild() {} }),
  documentElement: {},
  addEventListener() {},
  hidden: false,
  fonts: { ready: Promise.resolve() },
};

const ctx = vm.createContext({
  document: documentStub,
  matchMedia: () => ({ matches: true }), // prefers-reduced-motion: skips animation frames
  getComputedStyle: () => ({ getPropertyValue: () => '#123456' }),
  IntersectionObserver: class { observe() {} },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  performance,
  devicePixelRatio: 1,
  history: { replaceState() {} },
  location: { search: '' },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  URLSearchParams,
  setTimeout, clearTimeout, setInterval, clearInterval,
  addEventListener() {},
  console,
});
vm.runInContext(src, ctx);

function drive({ from, to, range, rwy }) {
  ELS.from.value = from;
  ELS.to.value = to;
  ELS.range.value = range;
  ELS.rwy.value = rwy;
  ctx.solve(0);
  return ELS.msg;
}

test('HKG→MEL, range "14,500" km, runway "9,680" ft → fly direct, no stopover (ATL-150 regression)', () => {
  const msg = drive({ from: 'HKG', to: 'MEL', range: '14,500', rwy: '9,680' });
  assert.match(msg.className, /ok/);
  assert.match(msg.innerHTML, /Fly it direct/);
  assert.match(ELS.nS.textContent, /No stopover needed/);
  assert.match(ELS.sRange.innerHTML, /14,500/, 'the page must use the entered 14,500 km range');
});

test('plain digits parse the same', () => {
  const msg = drive({ from: 'HKG', to: 'MEL', range: '14500', rwy: '9680' });
  assert.match(msg.className, /ok/);
  assert.match(msg.innerHTML, /Fly it direct/);
});

test('range below the requirement still shows the Range too short panel', () => {
  const msg = drive({ from: 'HKG', to: 'MEL', range: '2036', rwy: '9680' });
  assert.match(msg.className, /err/);
  assert.match(msg.innerHTML, /Range too short/);
});
