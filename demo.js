// demo.js — autoplay walkthrough for recording the demo video.
//
// Open:   index.html?demo  (or #demo)            → press Space to start
//         index.html?demo=auto  (or #demo-auto)  → starts by itself after 1.5s
// (#demo works where query strings don't pass through, e.g. a Claude artifact.)
// Replay: press R (reloads and plays again).
//
// The demo drives the REAL prototype (it clicks the real chips and buttons),
// adds a smooth on-screen cursor, timed captions and an end card.
// Captions and the end card text live in data.js → demo.
// Best recorded at 1920×1080 with browser zoom 150%.

(function () {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.slice(1);
  const inDemo = params.has('demo') || hash === 'demo' || hash === 'demo-auto';
  if (!inDemo) return;                                    // normal use: do nothing
  const autoStart = params.get('demo') === 'auto' || hash === 'demo-auto';

  const TEXT = window.PROTOTYPE_DATA.demo;
  document.body.classList.add('demo-mode');               // hides the real cursor

  // ---------- Overlay elements ----------

  function make(tag, className, parent) {
    const n = document.createElement(tag);
    n.className = className;
    (parent || document.body).appendChild(n);
    return n;
  }

  // Cursor (Lucide mouse-pointer-2, filled)
  const cursor = make('div', 'demo-cursor');
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' + window.ICONS['mouse-pointer-2'] + '</svg>';

  // Caption: lives in the chat column so it stays centered over the chat
  const caption = make('div', 'demo-caption', document.getElementById('chat'));
  caption.setAttribute('aria-hidden', 'true');

  // End card
  const end = make('div', 'demo-end');
  end.innerHTML =
    '<p class="demo-end-title"></p>' +
    '<p class="demo-end-label">Unofficial concept for Claude — not an Anthropic product</p>' +
    '<p class="demo-end-byline"></p>';
  end.querySelector('.demo-end-title').textContent = TEXT.endCard.title;
  end.querySelector('.demo-end-byline').textContent = TEXT.endCard.byline;

  // Start hint (tiny, top-right; disappears on start, trim it from the recording)
  const hint = make('div', 'demo-hint');
  hint.textContent = 'Space to play · R to replay';

  // ---------- Helpers ----------

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = sel => document.querySelector(sel);
  let pos = { x: window.innerWidth * 0.82, y: window.innerHeight * 0.9 };

  function placeCursor(x, y, ms) {
    cursor.style.transitionDuration = ms + 'ms';
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    pos = { x, y };
  }

  // Glide the cursor to an element (center, or a point given as fractions).
  async function moveTo(sel, ms = 900, fx = 0.5, fy = 0.5) {
    const r = $(sel).getBoundingClientRect();
    placeCursor(r.left + r.width * fx, r.top + r.height * fy, ms);
    await wait(ms);
  }

  // Press: cursor dips, the target shows its pressed state, then a real click.
  async function click(sel) {
    const el = $(sel);
    cursor.classList.add('is-pressing');
    el.classList.add('is-pressed');
    await wait(110);
    cursor.classList.remove('is-pressing');
    el.classList.remove('is-pressed');
    el.click();
  }

  function hover(sel) {
    const el = $(sel);
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }
  function unhover(sel) {
    const el = $(sel);
    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
  }

  async function say(text, ms) {
    caption.textContent = text;
    caption.classList.add('is-on');
    if (ms) { await wait(ms); unsay(); await wait(220); }
  }
  function unsay() { caption.classList.remove('is-on'); }

  function scrollPanelTo(sel, offset = 16) {
    const body = $('#panel-body');
    const target = sel ? $(sel).offsetTop - offset : 0;
    body.scrollTo({ top: target, behavior: 'smooth' });
    return wait(650);
  }

  // ---------- The walkthrough (about 32s) ----------

  async function play() {
    hint.remove();
    placeCursor(pos.x, pos.y, 0);
    cursor.classList.add('is-on');
    await wait(400);

    // 0–3s: hook
    await say(TEXT.captions.hook, 2800);

    // 3–6s: glide to the sentence pill; its claims get the faint tint
    const PILL = '.cite-chip[data-claim="G:C2,C1"]';
    await moveTo(PILL, 1300);
    hover(PILL);
    await wait(700);

    // 6–11s: the pill opens a popover with the exact source line; page to the 1% claim
    await click(PILL);
    unhover(PILL);
    await wait(900);
    await say(TEXT.captions.match, 1800);
    await moveTo('[aria-label="Next source"]', 700);
    await click('[aria-label="Next source"]');
    await wait(600);
    await say(TEXT.captions.open, 2000);

    // Expand into the full side panel for the deep comparison
    await moveTo('.sp-foot .sp-link:last-child', 800);
    await click('.sp-foot .sp-link:last-child');
    await wait(700);

    // 11–14s: hover the source line → the claim pulses
    await moveTo('.source-line', 1000, 0.55, 0.3);
    hover('.source-line');
    await say(TEXT.captions.link, 2200);
    unhover('.source-line');

    // 14–20s: open "See what changed"
    await moveTo('.verdict-toggle', 900, 0.3, 0.5);
    await click('.verdict-toggle');
    await wait(500);
    await say(TEXT.captions.compare, 3400);

    // 20–23s: flag it
    await scrollPanelTo('.feedback', 140);
    await moveTo('.btn-secondary[data-value="agree"]', 800);
    await click('.btn-secondary[data-value="agree"]');
    await say(TEXT.captions.feedback, 2200);


    // 27–32s: close, end card
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    placeCursor(window.innerWidth * 0.82, window.innerHeight * 0.9, 900);
    await wait(900);
    cursor.classList.remove('is-on');
    end.classList.add('is-on');
  }

  // ---------- Controls ----------

  let started = false;
  function start() { if (!started) { started = true; play(); } }

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !started) { e.preventDefault(); start(); }
    if (e.key === 'r' || e.key === 'R') {
      // Reload and replay (hash form when that's how demo mode was opened)
      if (params.has('demo')) location.search = '?demo=auto';
      else { location.hash = 'demo-auto'; location.reload(); }
    }
  });
  if (autoStart) setTimeout(start, 1500);
})();
