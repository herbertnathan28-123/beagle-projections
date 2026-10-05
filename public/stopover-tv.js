'use strict';

(() => {
  const dialog = document.getElementById('tvDialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const screen = document.getElementById('tvScreen');
  const title = document.getElementById('tvTitle');
  const help = document.getElementById('tvHelp');
  const vimeo = document.getElementById('tvVimeo');
  const fullscreen = document.getElementById('tvFullscreen');
  const videoIds = new Set(['1044641347', '1044641389', '290476004']);
  fullscreen.hidden = typeof screen.requestFullscreen !== 'function';

  document.querySelectorAll('.tv-watch').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const id = link.dataset.video;
      if (!videoIds.has(id)) return;
      dialog.showModal();
      event.preventDefault();
      title.textContent = link.dataset.title;
      help.textContent = 'Recorded NATS visualisation. Not live air traffic.';
      vimeo.href = link.href;
      const player = document.createElement('iframe');
      player.title = link.dataset.title + ' — Vimeo player';
      player.src = `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`;
      player.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      player.allowFullscreen = true;
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      screen.replaceChildren(player);
    });
  });

  document.getElementById('tvClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    screen.replaceChildren();
    if (document.fullscreenElement === screen) document.exitFullscreen().catch(() => {});
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  fullscreen.addEventListener('click', async () => {
    try {
      await screen.requestFullscreen();
    } catch (_) {
      help.textContent = 'Use the Vimeo player’s fullscreen control, or open the video on Vimeo.';
    }
  });
})();
