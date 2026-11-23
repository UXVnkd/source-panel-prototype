// video.js — "Product launch" video timeline, made for frame-by-frame rendering.
//
// Open index.html#video to watch it in real time (preview).
// render.js opens it with a paused clock and steps it 1/60 s at a time,
// so every frame is exact (4K / 60 fps master).
//
// Style: snappy camera zooms toward each click, bold punch-in captions,
// short beats (~2 s), hard cut to an end card.
// Envato assets: set VIDEO_ASSETS below (font / background) once uploaded.

(function () {
  if (location.hash !== '#video') return;

  const VIDEO_ASSETS = {
    fontUrl: 'video-assets/Dongra.otf',   // Envato font (licensed for this video; not deployed)
    fontName: 'Dongra',
    fontWeight: 400,                       // Dongra is already heavy; avoid faux bold
    background: null        // e.g. 'assets/background.jpg' (end card + intro)
  };

  const TEXT = {
    hook:     '“Check important info.”\nBut who actually checks?',
    open:     'The source comes to the claim.',
    link:     'Same color, same claim.',
    compare:  '“1% of people” vs “1% of all visits”',
    flag:     'One tap to confirm the check.',
    match:    'It shows what holds up too.',
    endTitle: 'Bring the source to the claim.',
    endLabel: 'Unofficial concept for Claude — not an Anthropic product',
    endByline: (window.PROTOTYPE_DATA.demo && window.PROTOTYPE_DATA.demo.endCard.byline) || ''
  };

  // ---------- Setup ----------
  document.body.classList.add('demo-mode', 'video-mode');

  // Load the caption font before the timeline starts (falls back if the file is missing).
  let fontReady = Promise.resolve();
  if (VIDEO_ASSETS.fontUrl) {
    const f = new FontFace(VIDEO_ASSETS.fontName, `url(${VIDEO_ASSETS.fontUrl})`);
    fontReady = f.load().then(face => {
      document.fonts.add(face);
      const root = document.documentElement.style;
      root.setProperty('--video-font', `"${VIDEO_ASSETS.fontName}", var(--font-sans)`);
      root.setProperty('--video-font-weight', String(VIDEO_ASSETS.fontWeight));
      root.setProperty('--video-font-scale', '1.3');      // condensed face: set it larger
    }).catch(() => {});
  }
  if (VIDEO_ASSETS.background) {
    document.documentElement.style.setProperty('--video-bg', `url(${VIDEO_ASSETS.background}) center / cover`);
  }

  // Everything the camera moves lives in a "stage"; overlays stay outside it.
  const stage = document.createElement('div');
  stage.className = 'video-stage';
  [...document.body.children].forEach(n => { if (n.tagName !== 'SCRIPT') stage.appendChild(n); });
  document.body.prepend(stage);

  // Cursor lives inside the stage so it zooms with the content.
  const cursor = document.createElement('div');
  cursor.className = 'demo-cursor is-on';
  cursor.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + window.ICONS['mouse-pointer-2'] + '</svg>';
  stage.appendChild(cursor);

  const caption = document.createElement('div');
  caption.className = 'video-caption';
  document.body.appendChild(caption);

  const end = document.createElement('div');
  end.className = 'video-end';
  end.innerHTML = '<p class="video-end-title"></p><p class="video-end-label"></p><p class="video-end-byline"></p>';
  end.querySelector('.video-end-title').textContent = TEXT.endTitle;
  end.querySelector('.video-end-label').textContent = TEXT.endLabel;
  end.querySelector('.video-end-byline').textContent = TEXT.endByline;
  document.body.appendChild(end);

  // Smooth scrolling is browser-timed; in video mode we tween it ourselves
  // so it follows the (possibly paused) page clock.
  const nativeScrollTo = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function (opts) {
    if (!opts || typeof opts !== 'object' || opts.behavior !== 'smooth') return nativeScrollTo.apply(this, arguments);
    const elx = this, from = elx.scrollTop;
    const to = Math.max(0, Math.min(opts.top ?? from, elx.scrollHeight - elx.clientHeight));
    tween(420, t => nativeScrollTo.call(elx, { top: from + (to - from) * t }));
  };
  Element.prototype.scrollIntoView = function () {
    const body = this.closest('.panel-body');
    if (!body) return;
    const r = this.getBoundingClientRect(), b = body.getBoundingClientRect();
    const delta = r.bottom > b.bottom ? r.bottom - b.bottom + 16 : (r.top < b.top ? r.top - b.top - 16 : 0);
    if (delta) body.scrollTo({ top: body.scrollTop + delta, behavior: 'smooth' });
  };

  // ---------- Timing helpers (all driven by setTimeout / rAF, so a paused clock controls them) ----------
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const ease = t => 1 - Math.pow(1 - t, 4);                       // strong ease-out
  const easeInOut = t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

  function tween(ms, step, curve = ease) {
    return new Promise(resolve => {
      const t0 = performance.now();
      (function frame(now) {
        const t = Math.min(1, (now - t0) / ms);
        step(curve(t));
        if (t < 1) requestAnimationFrame(frame); else resolve();
      })(t0);
    });
  }

  // ---------- Camera ----------
  const cam = { x: 0, y: 0, s: 1 };
  function applyCam() { stage.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`; }

  // Stage-local (unzoomed) center of an element
  function localCenter(sel) {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { x: (r.left + r.width / 2 - cam.x) / cam.s, y: (r.top + r.height / 2 - cam.y) / cam.s };
  }

  // Zoom so the target sits at the center, clamped so the stage still covers the frame.
  function zoomTo(sel, s, ms = 420) {
    const W = innerWidth, H = innerHeight, c = localCenter(sel);
    const tx = Math.min(0, Math.max(W - W * s, W / 2 - c.x * s));
    const ty = Math.min(0, Math.max(H - H * s, H / 2 - c.y * s));
    const from = { ...cam };
    return tween(ms, t => {
      cam.x = from.x + (tx - from.x) * t; cam.y = from.y + (ty - from.y) * t; cam.s = from.s + (s - from.s) * t;
      applyCam();
    });
  }
  const zoomOut = (ms = 420) => {
    const from = { ...cam };
    return tween(ms, t => { cam.x = from.x * (1 - t); cam.y = from.y * (1 - t); cam.s = from.s + (1 - from.s) * t; applyCam(); });
  };

  // ---------- Cursor ----------
  const pos = { x: innerWidth * 0.78, y: innerHeight * 0.86 };
  function placeCursor() { cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`; }
  function moveTo(sel, ms = 600, fx = 0.5, fy = 0.5) {
    const r = document.querySelector(sel).getBoundingClientRect();
    const tx = (r.left + r.width * fx - cam.x) / cam.s, ty = (r.top + r.height * fy - cam.y) / cam.s;
    const from = { ...pos };
    return tween(ms, t => { pos.x = from.x + (tx - from.x) * t; pos.y = from.y + (ty - from.y) * t; placeCursor(); }, easeInOut);
  }
  async function click(sel) {
    const el = document.querySelector(sel);
    cursor.classList.add('is-pressing'); el.classList.add('is-pressed');
    await wait(100);
    cursor.classList.remove('is-pressing'); el.classList.remove('is-pressed');
    el.click();
  }
  const hover = sel => { const el = document.querySelector(sel);
    el.dispatchEvent(new MouseEvent('mouseenter')); el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); };
  const unhover = sel => { const el = document.querySelector(sel);
    el.dispatchEvent(new MouseEvent('mouseleave')); el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })); };

  // ---------- Captions ----------
  function say(text) {
    caption.classList.remove('is-on');
    void caption.offsetWidth;                                     // restart the punch-in
    caption.textContent = text;
    caption.classList.add('is-on');
  }
  const unsay = () => caption.classList.remove('is-on');

  // ---------- Timeline (~24 s) ----------
  async function play() {
    placeCursor();
    await wait(150);

    // 0–2.2s  hook
    say(TEXT.hook);
    await wait(2100);
    unsay();

    // 2.2–4.4s  zoom toward the chip, click
    zoomTo('.cite-chip[data-claim="C1"]', 1.6, 500);
    await moveTo('.cite-chip[data-claim="C1"]', 700);
    hover('.cite-chip[data-claim="C1"]');
    await wait(250);
    await click('.cite-chip[data-claim="C1"]');
    unhover('.cite-chip[data-claim="C1"]');

    // 4.4–7.4s  panel slides in; zoom out to see both highlights, hold
    await wait(120);
    await zoomOut(480);
    say(TEXT.open);
    await wait(2400);

    // 7.4–9.4s  hover the source line → claim pulses
    unsay();
    await moveTo('.source-line', 650, 0.55, 0.35);
    hover('.source-line');
    say(TEXT.link);
    await wait(1500);
    unhover('.source-line');

    // 9.4–12.6s  "See what changed"
    unsay();
    zoomTo('.verdict-toggle', 1.5, 500);
    await moveTo('.verdict-toggle', 600, 0.3, 0.5);
    await click('.verdict-toggle');
    await wait(450);
    await zoomTo('.compare-card', 1.45, 450);
    say(TEXT.compare);
    await wait(1900);

    // 12.6–14.6s  flag it
    unsay();
    document.getElementById('panel-body').scrollTo({ top: 9999, behavior: 'smooth' });
    await wait(450);
    await zoomTo('.feedback', 1.5, 420);
    await moveTo('.btn-secondary[data-value="agree"]', 500);
    await click('.btn-secondary[data-value="agree"]');
    say(TEXT.flag);
    await wait(1300);

    // 14.6–17.4s  switch to the claim that matches
    unsay();
    await zoomOut(420);
    await moveTo('.cite-chip[data-claim="C2"]', 650);
    await click('.cite-chip[data-claim="C2"]');
    await wait(350);
    say(TEXT.match);
    await wait(1900);

    // 17.4–24s  hard cut to the end card
    unsay();
    end.classList.add('is-on');
    await wait(6200);
    window.__videoDone = true;
  }

  // Start once fonts are ready so the first frame is final.
  Promise.all([fontReady, document.fonts.ready]).then(() => setTimeout(play, 100));
})();
