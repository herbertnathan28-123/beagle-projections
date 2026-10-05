'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/stopover.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../public/stopover-tv.js'), 'utf8');
const ids = ['1044641347', '1044641389', '290476004'];
const titles = ['North Atlantic Skies', 'London 24', 'Europe 24'];

function setup({ modal = true, fullscreen = true, denyFullscreen = false } = {}) {
  function element() {
    return {
      events: {}, children: [], textContent: '',
      addEventListener(name, fn) { this.events[name] = fn; },
      replaceChildren(...children) { this.children = children; },
    };
  }
  const elements = Object.fromEntries(['tvDialog', 'tvScreen', 'tvTitle', 'tvHelp', 'tvVimeo', 'tvFullscreen', 'tvClose'].map(id => [id, element()]));
  const dialog = elements.tvDialog;
  const screen = elements.tvScreen;
  const links = ids.map((id, i) => Object.assign(element(), { dataset: { video: id, title: titles[i] }, href: `https://vimeo.com/${id}` }));
  let fullscreenRequests = 0;
  const document = {
    getElementById: id => elements[id],
    querySelectorAll: () => links,
    createElement: () => element(),
    fullscreenElement: null,
    exitFullscreen: async () => { document.fullscreenElement = null; },
  };
  if (modal) dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.events.close(); };
  dialog.getBoundingClientRect = () => ({ left: 10, top: 10, right: 900, bottom: 600 });
  if (fullscreen) screen.requestFullscreen = async () => {
    fullscreenRequests++;
    if (denyFullscreen) throw new Error('Fullscreen unavailable');
    document.fullscreenElement = screen;
  };
  vm.runInNewContext(source, { document });
  function click(i = 0, overrides = {}) {
    const event = { prevented: false, preventDefault() { this.prevented = true; }, ...overrides };
    links[i].events.click?.(event);
    return event;
  }
  return { elements, links, document, click, fullscreenRequests: () => fullscreenRequests };
}

test('gallery contains the three requested films, fallback links and lazy thumbnails, not eager players', () => {
  assert.match(html, /AIRSPACE <span>TV<\/span>/);
  assert.match(html, /RECORDED VISUALISATIONS · NOT LIVE/);
  for (const id of ids) {
    assert.match(html, new RegExp(`data-video="${id}"`));
    assert.equal(html.split(`href="https://vimeo.com/${id}"`).length - 1, 2);
  }
  assert.equal((html.match(/class="tv-watch"/g) || []).length, 3);
  assert.equal((html.match(/loading="lazy" decoding="async"/g) || []).length, 3);
  assert.doesNotMatch(html, /<iframe\b/);
  assert.match(html, /<script src="\/stopover-tv\.js" defer><\/script>/);
  assert.match(html, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(html, /@media\(max-width:700px\)\{\.tv-grid\{grid-template-columns:minmax\(0,1fr\)/);
});

test('clicking each film opens the correct accessible, fullscreen-enabled Vimeo player', () => {
  for (let i = 0; i < ids.length; i++) {
    const app = setup();
    assert.equal(app.elements.tvScreen.children.length, 0);
    assert.equal(app.click(i).prevented, true);
    assert.equal(app.elements.tvDialog.open, true);
    assert.equal(app.elements.tvTitle.textContent, titles[i]);
    assert.equal(app.elements.tvVimeo.href, `https://vimeo.com/${ids[i]}`);
    const player = app.elements.tvScreen.children[0];
    assert.equal(player.src, `https://player.vimeo.com/video/${ids[i]}?autoplay=1&dnt=1`);
    assert.equal(player.title, titles[i] + ' — Vimeo player');
    assert.equal(player.allowFullscreen, true);
    assert.match(player.allow, /fullscreen/);
    assert.match(player.allow, /picture-in-picture/);
    assert.equal(player.referrerPolicy, 'strict-origin-when-cross-origin');
  }
});

test('closing the dialog removes the player to stop playback, and reopening uses the selected film', () => {
  const app = setup();
  app.click();
  app.elements.tvClose.events.click();
  assert.equal(app.elements.tvDialog.open, false);
  assert.equal(app.elements.tvScreen.children.length, 0);
  app.click(2);
  assert.match(app.elements.tvScreen.children[0].src, /290476004/);
  app.elements.tvDialog.events.close();
  assert.equal(app.elements.tvScreen.children.length, 0);
});

test('fullscreen targets the player and is exited when the viewer closes', async () => {
  const app = setup();
  app.click();
  await app.elements.tvFullscreen.events.click();
  assert.equal(app.fullscreenRequests(), 1);
  assert.equal(app.document.fullscreenElement, app.elements.tvScreen);
  app.elements.tvClose.events.click();
  assert.equal(app.document.fullscreenElement, null);
});

test('unsupported or denied fullscreen preserves Vimeo fallback controls', async () => {
  const unsupported = setup({ fullscreen: false });
  assert.equal(unsupported.elements.tvFullscreen.hidden, true);
  unsupported.click();
  assert.equal(unsupported.elements.tvScreen.children[0].allowFullscreen, true);
  const denied = setup({ denyFullscreen: true });
  denied.click();
  await denied.elements.tvFullscreen.events.click();
  assert.match(denied.elements.tvHelp.textContent, /open the video on Vimeo/);
});

test('older browsers and modifier clicks retain ordinary Vimeo navigation', () => {
  const older = setup({ modal: false });
  assert.equal(older.click().prevented, false);
  for (const key of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    const app = setup();
    assert.equal(app.click(0, { [key]: true }).prevented, false);
    assert.equal(app.elements.tvScreen.children.length, 0);
  }
});

test('unexpected video IDs do not create an embedded player', () => {
  const app = setup();
  app.links[0].dataset.video = 'untrusted';
  assert.equal(app.click().prevented, false);
  assert.equal(app.elements.tvScreen.children.length, 0);
});

test('backdrop click closes the viewer but clicks inside its bounds do not', () => {
  const app = setup();
  const dialog = app.elements.tvDialog;
  app.click();
  dialog.events.click({ target: dialog, clientX: 30, clientY: 30 });
  assert.equal(dialog.open, true);
  dialog.events.click({ target: dialog, clientX: 2, clientY: 2 });
  assert.equal(dialog.open, false);
  assert.equal(app.elements.tvScreen.children.length, 0);
});
