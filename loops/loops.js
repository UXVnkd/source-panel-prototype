// loops.js — seamless interaction loops for the case study.
// Open loops.html#<id> (served by loops-render.js). Each loop:
//   1. loads the real prototype in an iframe (its own viewport, so phone layout works),
//   2. puts it in a starting state, crops a "window" and places it on the gradient,
//   3. plays a timeline that ends in exactly the starting state (seamless loop),
//   4. sets window.__loopDone so the renderer stops on the last frame.
// All timing uses setTimeout / requestAnimationFrame, so a paused clock controls it.

(function () {
  const ID = location.hash.slice(1);
  // Square loops ("sq-<name>"): 720×720 stage (× 3 = 2160 square), a headline on
  // the gradient and the cropped interface rising from the bottom edge. They
  // replay the matching "v2-<name>" interaction.
  const SQ = ID.startsWith('sq-');
  const W = SQ ? 720 : 1280, H = 720;            // stage size in CSS px (× 3 = 4K)
  const win = document.getElementById('win');
  const frame = document.getElementById('app');
  document.getElementById('bg').style.backgroundImage = `url(bg/${ID}.jpg)`;

  // ---------- helpers ----------
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  const easeInOut = t => t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2;
  function tween(ms, step, curve = easeOut) {
    return new Promise(res => {
      const t0 = performance.now();
      (function f(now) { const t = Math.min(1, (now - t0) / ms); step(curve(t)); t < 1 ? requestAnimationFrame(f) : res(); })(t0);
    });
  }
  let A, D, Z = 1, OX = 0, OY = 0;               // app window, app document, zoom, iframe offset on stage
  const $ = sel => D.querySelector(sel);
  const rectOf = sel => $(sel).getBoundingClientRect();
  // iframe CSS px → stage CSS px
  const toStage = (x, y) => ({ x: OX + x * Z, y: OY + y * Z });

  // Smooth scroll inside the app follows our clock.
  function patchScroll() {
    const native = A.Element.prototype.scrollTo;
    A.Element.prototype.scrollTo = function (o) {
      if (!o || typeof o !== 'object' || o.behavior !== 'smooth') return native.apply(this, arguments);
      const el = this, from = el.scrollTop, to = Math.max(0, Math.min(o.top ?? from, el.scrollHeight - el.clientHeight));
      tween(420, t => native.call(el, { top: from + (to - from) * t }));
    };
    A.Element.prototype.scrollIntoView = function () {
      const body = this.closest('.panel-body'); if (!body) return;
      const r = this.getBoundingClientRect(), b = body.getBoundingClientRect();
      const d = r.bottom > b.bottom ? r.bottom - b.bottom + 16 : 0;
      if (d) body.scrollTo({ top: body.scrollTop + d, behavior: 'smooth' });
    };
  }

  // ---------- pointer (cursor, or a finger dot on mobile) ----------
  let ptr, pos = { x: W * 0.86, y: H * 0.92 }, touch = false;
  function makePointer(isTouch) {
    touch = isTouch;
    ptr = document.createElement('div');
    if (isTouch) { ptr.className = 'finger'; const s = 34; ptr.style.width = ptr.style.height = s + 'px'; ptr.style.margin = `-${s / 2}px 0 0 -${s / 2}px`; }
    else { ptr.className = 'cursor'; const s = 22; ptr.innerHTML = `<svg viewBox="0 0 24 24" width="${s}" height="${s}">${window.ICONS['mouse-pointer-2']}</svg>`; ptr.style.margin = '-3px 0 0 -3px'; }
    document.body.appendChild(ptr);
    place();
  }
  const place = () => { ptr.style.transform = `translate(${pos.x}px, ${pos.y}px)`; };
  function moveTo(sel, ms = 650, fx = 0.5, fy = 0.5) {
    const r = rectOf(sel), p = toStage(r.left + r.width * fx, r.top + r.height * fy), from = { ...pos };
    return tween(ms, t => { pos.x = from.x + (p.x - from.x) * t; pos.y = from.y + (p.y - from.y) * t; place(); }, easeInOut);
  }
  function moveToPoint(x, y, ms = 650) {
    const from = { ...pos };
    return tween(ms, t => { pos.x = from.x + (x - from.x) * t; pos.y = from.y + (y - from.y) * t; place(); }, easeInOut);
  }
  async function press(sel) {
    const el = $(sel);
    ptr.classList.add('pressing'); el.classList.add('is-pressed');
    await wait(110);
    ptr.classList.remove('pressing'); el.classList.remove('is-pressed');
    el.click();
  }
  const hover = sel => { const el = $(sel); el.dispatchEvent(new A.MouseEvent('mouseenter')); el.dispatchEvent(new A.MouseEvent('mouseover', { bubbles: true })); };
  const unhover = sel => { const el = $(sel); el.dispatchEvent(new A.MouseEvent('mouseleave')); el.dispatchEvent(new A.MouseEvent('mouseout', { bubbles: true, relatedTarget: D.body })); };
  const esc = () => D.dispatchEvent(new A.KeyboardEvent('keydown', { key: 'Escape' }));
  const scrollPanelTo = (sel, top = 40) => { const body = $('#panel-body'), r = rectOf(sel), b = body.getBoundingClientRect(); body.scrollTop += (r.top - b.top) - top; };

  // ---------- window placement ----------
  // clip = region of the app (iframe CSS px) shown in the window; at = where its center lands.
  function frameWindow({ vw, vh, zoom, clip, at, radius = 32, fade }) {
    Z = zoom;
    const cw = (clip[2] - clip[0]) * Z, ch = (clip[3] - clip[1]) * Z;
    const left = at[0] * W - cw / 2, top = at[1] * H - ch / 2;
    Object.assign(win.style, { left: left + 'px', top: top + 'px', width: cw + 'px', height: ch + 'px', '--r': radius + 'px' });
    if (fade) win.classList.add('fade-' + fade);
    Object.assign(frame.style, { width: vw + 'px', height: vh + 'px', transform: `translate(${-clip[0] * Z}px, ${-clip[1] * Z}px) scale(${Z})` });
    OX = left - clip[0] * Z; OY = top - clip[1] * Z;
  }
  const union = sels => sels.map(s => { const r = rectOf(s); return [r.left, r.top, r.right, r.bottom]; })
    .reduce((a, r) => [Math.min(a[0], r[0]), Math.min(a[1], r[1]), Math.max(a[2], r[2]), Math.max(a[3], r[3])]);

  // Undo a feedback choice in the DOM so the loop can end where it began.
  function resetFeedback() {
    D.querySelectorAll('.btn-secondary').forEach(b => { b.disabled = false; b.setAttribute('aria-pressed', 'false'); });
    const s = $('.feedback-status'); if (s) s.textContent = '';
  }

  // ---------- v2 helpers (pills + popover) ----------
  const P1 = '.cite-chip[data-claim="G:C2,C1"]', P2 = '.cite-chip[data-claim="G:C3,C4"]';
  const NEXT = '[aria-label="Next source"]', PREV = '[aria-label="Previous source"]', EXPAND = '.sp-foot .sp-link:last-child';
  const blur = () => { D.activeElement && D.activeElement.blur && D.activeElement.blur(); };
  // Open a pill's citation (page index) in the side panel, as Expand does.
  async function openPanel(pill, page) {
    $(pill).click(); await wait(300);
    for (let i = 0; i < page; i++) { $(NEXT).click(); await wait(200); }
    $(EXPAND).click(); await wait(500); blur();
  }
  const openPanelC1 = async () => { await openPanel(P1, 1); await wait(1200); blur(); };   // let the open transition and focus settle
  async function tap(sel) {
    await moveTo(sel, 1); ptr.classList.add('on'); await wait(240);
    ptr.classList.add('pressing'); await wait(110); ptr.classList.remove('pressing');
    $(sel).click(); await wait(180); ptr.classList.remove('on');
  }

  // ---------- the seven loops ----------
  // Each: viewport, setup (starting state), window framing, timeline (must end in the start state).
  const LOOPS = {
    '1-pair': {
      vw: 1280, vh: 760,
      framing: () => ({ zoom: 0.92, clip: [0, 0, 1280, 760], at: [0.43, 0.42], radius: 36 }),
      async play() {
        await wait(400);
        await moveTo('.cite-chip[data-claim="C1"]', 900); hover('.cite-chip[data-claim="C1"]'); await wait(250);
        await press('.cite-chip[data-claim="C1"]'); unhover('.cite-chip[data-claim="C1"]');
        await wait(1300);
        await moveTo('.source-line', 750, 0.55, 0.4); hover('.source-line'); await wait(1300); unhover('.source-line');
        await moveTo('#panel-close', 650); await press('#panel-close');
        await wait(500);
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(500);
      }
    },
    '2-chips': {
      vw: 1280, vh: 760,
      framing: () => { const u = union(['.msg-assistant p:not(.answer-note)']);
        return { zoom: 1.45, clip: [u[0] - 44, u[1] - 40, u[2] + 44, u[3] + 40], at: [0.5, 0.5], radius: 24 }; },
      async play() {
        await wait(400);
        for (const id of ['C2', 'C1', 'C3', 'C4']) {
          const sel = `.cite-chip[data-claim="${id}"]`;
          await moveTo(sel, 650); hover(sel); await wait(700); unhover(sel);
        }
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(500);
      }
    },
    '3-verdict': {
      vw: 1280, vh: 760,
      setup: async () => { $('.cite-chip[data-claim="C1"]').click(); await wait(900); scrollPanelTo('.source-line', 60); await wait(300); D.activeElement.blur(); },
      framing: () => ({ zoom: 1.3, clip: [892, 300, 1280, 760], at: [0.5, 0.5], radius: 30, fade: 'top' }),
      async play() {
        await wait(400);
        await moveTo('.verdict-toggle', 800, 0.35, 0.5); await press('.verdict-toggle');
        await wait(2400);
        await press('.verdict-toggle');
        await wait(700);
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(400);
      }
    },
    '4-what-changed': {
      vw: 1280, vh: 760,
      setup: async () => { $('.cite-chip[data-claim="C1"]').click(); await wait(900); D.activeElement.blur(); },
      framing: () => ({ zoom: 0.92, clip: [0, 0, 1280, 760], at: [0.5, 0.5], radius: 36 }),
      async play() {
        await wait(500);
        await moveTo('.cite-chip[data-claim="C2"]', 850); await press('.cite-chip[data-claim="C2"]');
        await wait(1800);
        await moveTo('.cite-chip[data-claim="C1"]', 750); await press('.cite-chip[data-claim="C1"]');
        await wait(1500);
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(400);
      }
    },
    '5-site-label': {
      vw: 1280, vh: 760,
      setup: async () => { $('.cite-chip[data-claim="C1"]').click(); await wait(900); D.activeElement.blur(); },
      framing: () => ({ zoom: 1.45, clip: [892, 0, 1280, 330], at: [0.5, 0.47], radius: 34, fade: 'bottom' }),
      noPointer: true,
      async play() {
        // The header switches source by source (no cursor; the chips are outside the crop).
        await wait(1400);
        for (const id of ['C4', 'C3', 'C1']) { $(`.cite-chip[data-claim="${id}"]`).click(); await wait(1700); }
      }
    },
    '6-feedback': {
      vw: 1280, vh: 900,
      setup: async () => { $('.cite-chip[data-claim="C1"]').click(); await wait(800); $('.verdict-toggle').click(); await wait(900); scrollPanelTo('.feedback', 60); await wait(200); D.activeElement.blur(); },
      framing: () => { const u = union(['.feedback']); return { zoom: 1.8, clip: [895, u[1] - 10, 1280, u[3] + 44], at: [0.5, 0.5], radius: 26 }; },
      async play() {
        await wait(500);
        await moveTo('.btn-secondary[data-value="agree"]', 850); await press('.btn-secondary[data-value="agree"]');
        await wait(1900);
        await moveToPoint(W * 0.86, H * 0.92, 800);
        resetFeedback();                                  // quietly back to the start state
        await wait(500);
      }
    },
    '7-mobile': {
      vw: 390, vh: 844, touch: true,
      framing: () => ({ zoom: 0.8, clip: [0, 0, 390, 844], at: [0.5, 0.53], radius: 44 }),
      async play() {
        const f = ptr, panel = $('#panel');
        const tap = async sel => {
          await moveTo(sel, 1); f.classList.add('on'); await wait(240);
          f.classList.add('pressing'); await wait(110); f.classList.remove('pressing');
          $(sel).click(); await wait(180); f.classList.remove('on');
        };
        // Current sheet offset (0 = large detent) and a finger drag that moves the sheet with it.
        const offset = () => panel.getBoundingClientRect().top - (A.innerHeight - panel.offsetHeight);
        async function drag(toOffset, ms) {
          await moveTo('#panel-handle', 1); f.classList.add('on'); await wait(200);
          const from = offset(), startY = pos.y;
          panel.classList.add('is-dragging');
          await tween(ms, t => { const o = from + (toOffset - from) * t; panel.style.transform = `translateY(${o}px)`; pos.y = startY + (o - from) * Z; place(); }, easeInOut);
          return () => { panel.classList.remove('is-dragging'); panel.style.transform = ''; f.classList.remove('on'); };
        }
        await wait(500);
        await tap('.cite-chip[data-claim="C1"]');            // opens at the medium detent
        await wait(1500);
        await tap('.cite-chip[data-claim="C2"]');            // the answer stays usable: switch claims
        await wait(1400);
        let release = await drag(0, 420);                     // swipe up to the large detent
        release(); $('#panel-handle').click();
        await wait(1500);
        release = await drag(panel.offsetHeight * 0.55, 380); // swipe down to dismiss
        release(); esc();
        await wait(900);
        D.activeElement && D.activeElement.blur();         // no focus ring left on the chip at the loop point
        $('.chat-scroll').scrollTop = 0;
        await wait(600);
      }
    },

    // ---------- v2: pills + popover design (case study, ten decisions + mobile) ----------
    'v2-pair': {
      vw: 1280, vh: 760,
      setup: () => openPanelC1(),
      framing: () => ({ zoom: 0.92, clip: [0, 0, 1280, 760], at: [0.43, 0.42], radius: 36 }),
      async play() {
        await wait(500);
        await moveTo('.source-line', 900, 0.55, 0.4); hover('.source-line'); await wait(1600); unhover('.source-line');
        await wait(400);
        await moveTo('[data-claim="C1"]', 800, 0.4, 0.5); await wait(1200);
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(500);
      }
    },
    'v2-pills': {
      vw: 1280, vh: 760,
      framing: () => { const u = union(['.msg-assistant p:not(.answer-note)']);
        return { zoom: 1.45, clip: [u[0] - 44, u[1] - 40, u[2] + 44, u[3] + 40], at: [0.5, 0.5], radius: 24 }; },
      async play() {
        await wait(400);
        for (const sel of [P1, P2]) { await moveTo(sel, 750); hover(sel); await wait(1300); unhover(sel); }
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(500);
      }
    },
    'v2-popover': {
      vw: 1280, vh: 760,
      framing: () => ({ zoom: 0.92, clip: [0, 0, 1280, 760], at: [0.5, 0.5], radius: 36 }),
      async play() {
        await wait(400);
        await moveTo(P1, 850); await press(P1); await wait(1400);
        await moveTo(NEXT, 600); await press(NEXT); await wait(1300);
        await moveTo(EXPAND, 700); await press(EXPAND); await wait(1700);
        await moveTo('#panel-close', 800); await press('#panel-close'); await wait(500);
        blur();
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(400);
      }
    },
    'v2-logos': {
      vw: 1280, vh: 760,
      framing: () => ({ zoom: 1.7, clip: [770, 48, 1190, 392], at: [0.5, 0.5], radius: 26 }),
      async play() {
        await wait(400);
        await moveTo(P2, 800); await press(P2); await wait(1500);
        await moveTo(NEXT, 600); await press(NEXT); await wait(1500);
        await moveTo(P2, 650); await press(P2); await wait(400); blur();
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(400);
      }
    },
    'v2-quiet': {
      vw: 1280, vh: 760,
      framing: () => ({ zoom: 1.45, clip: [540, 226, 1020, 676], at: [0.5, 0.5], radius: 26 }),
      async play() {
        await wait(400);
        await moveTo(P1, 800); await press(P1); await wait(1700);   // a match: one quiet line
        await moveTo(NEXT, 600); await press(NEXT); await wait(1500); // a possible change
        await moveTo(PREV, 500); await press(PREV); await wait(1100);
        await moveTo(P1, 600); await press(P1); await wait(400); blur();
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(400);
      }
    },
    'v2-verdict': {
      vw: 1280, vh: 760,
      setup: async () => { await openPanelC1(); scrollPanelTo('.source-line', 60); await wait(300); blur(); },
      framing: () => ({ zoom: 1.3, clip: [892, 300, 1280, 760], at: [0.5, 0.5], radius: 30, fade: 'top' }),
      async play() {
        await wait(400);
        await moveTo('.verdict-toggle', 800, 0.35, 0.5); await press('.verdict-toggle');
        await wait(2400);
        await press('.verdict-toggle'); await wait(700); blur();
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(400);
      }
    },
    'v2-attrib': {
      vw: 1280, vh: 1000,
      setup: async () => { await openPanelC1(); A.Element.prototype.scrollIntoView = () => {}; scrollPanelTo('.source-line', 24); await wait(400); blur(); },
      framing: () => { const l = rectOf('.source-line'), t = rectOf('.verdict-toggle');
        return { zoom: 1.3, clip: [892, l.top - 18, 1280, t.bottom + 230], at: [0.5, 0.5], radius: 30, fade: 'bottom' }; },
      async play() {
        await wait(400);
        await moveTo('.verdict-toggle', 800, 0.35, 0.5); await press('.verdict-toggle');
        await wait(600);
        await moveTo('.verdict-by', 700, 0.5, 0.5); await wait(2400);
        await moveTo('.verdict-toggle', 600, 0.35, 0.5); await press('.verdict-toggle'); await wait(600); blur();
        await moveToPoint(W * 0.86, H * 0.92, 800); await wait(400);
      }
    },
    'v2-site': {
      vw: 1280, vh: 760,
      setup: () => openPanelC1(),
      framing: () => ({ zoom: 1.7, clip: [893, 50, 1280, 262], at: [0.5, 0.5], radius: 30 }),
      noPointer: true,
      async play() {
        await wait(1400);
        await openPanel(P2, 1); await wait(1800);   // arXiv: no reputable badge
        await openPanel(P2, 0); await wait(1800);   // BBC
        await openPanel(P1, 1); await wait(1600);   // back to Pew
      }
    },
    'v2-badge': {
      vw: 390, vh: 844, touch: true,
      framing: () => ({ zoom: 0.8, clip: [0, 0, 390, 844], at: [0.5, 0.53], radius: 44 }),
      async play() {
        await wait(500);
        await tap(P2); await wait(2600);    // bbc +1: BBC has a check, the arXiv paper does not
        await tap(P1); await wait(2200);    // pewresearch · 2: both rated reputable
        esc(); await wait(900); blur();
        $('.chat-scroll').scrollTop = 0; await wait(500);
      }
    },
    'v2-feedback': {
      vw: 1280, vh: 900,
      setup: async () => { await openPanelC1(); A.Element.prototype.scrollIntoView = () => {}; $('.verdict-toggle').click(); await wait(900); scrollPanelTo('.feedback', 60); await wait(400); blur(); },
      framing: () => { const u = union(['.feedback']); return { zoom: 1.8, clip: [895, u[1] - 10, 1280, u[3] + 44], at: [0.5, 0.5], radius: 26 }; },
      async play() {
        await wait(500);
        await moveTo('.btn-secondary[data-value="agree"]', 850); await press('.btn-secondary[data-value="agree"]');
        await wait(1900);
        await moveToPoint(W * 0.86, H * 0.92, 800);
        resetFeedback(); await wait(500);
      }
    },
    'v2-mobile': {
      vw: 390, vh: 844, touch: true,
      framing: () => ({ zoom: 0.8, clip: [0, 0, 390, 844], at: [0.5, 0.53], radius: 44 }),
      async play() {
        const panel = $('#panel');
        const offset = () => panel.getBoundingClientRect().top - (A.innerHeight - panel.offsetHeight);
        async function drag(toOffset, ms) {
          await moveTo('#panel-handle', 1); ptr.classList.add('on'); await wait(200);
          const from = offset(), startY = pos.y;
          panel.classList.add('is-dragging');
          await tween(ms, t => { const o = from + (toOffset - from) * t; panel.style.transform = `translateY(${o}px)`; pos.y = startY + (o - from) * Z; place(); }, easeInOut);
          return () => { panel.classList.remove('is-dragging'); panel.style.transform = ''; ptr.classList.remove('on'); };
        }
        await wait(500);
        await tap(P1); await wait(1500);                       // half-height sheet: the sentence's sources
        await tap('.group-item'); await wait(1600);            // one source in full
        let release = await drag(0, 420); release(); $('#panel-handle').click(); await wait(1500);
        release = await drag(panel.offsetHeight * 0.55, 380); release(); esc();
        await wait(900); blur();
        $('.chat-scroll').scrollTop = 0; await wait(600);
      }
    }
  };

  // ---------- boot ----------
  // ---------- square framing ----------
  const SQUARE = {
    pair:     { title: 'Matching colors link claim and source at a glance.', focus: () => [520, 180, 1280, 640] },
    pills:    { title: 'One pill per sentence.', focus: () => { const u = union(['.msg-assistant p:not(.answer-note)']); return [u[0] - 28, u[1] - 26, u[2] + 28, u[3] + 26]; } },
    popover:  { title: 'Popover first, panel on demand.', focus: () => [600, 240, 1280, 700] },
    logos:    { title: 'Source names and logos that set expectations before the tap.', focus: () => [770, 48, 1190, 392] },
    quiet:    { title: 'Matches stay quiet so mismatches stand out.', focus: () => [560, 240, 1010, 676] },
    verdict:  { title: 'Verdict first, details on demand.', focus: () => { const l = rectOf('.source-line'), t = rectOf('.verdict-toggle'); return [892, l.top - 20, 1280, t.bottom + 24]; } },
    attrib:   { title: 'Verdicts that say who judged them.', focus: () => { const l = rectOf('.source-line'), t = rectOf('.verdict-toggle'); return [892, l.top - 20, 1280, t.bottom + 24]; } },
    site:     { title: 'Site labels that don’t overclaim.', focus: () => [893, 52, 1280, 262] },
    badge:    { title: 'A badge that only vouches for what it covers.', focus: () => [0, 250, 390, 844] },
    feedback: { title: 'Neutral language, feedback in context.', focus: () => { const u = union(['.compare-card', '.feedback']); return [895, u[1] - 14, 1280, u[3] + 40]; } },
    mobile:   { title: 'Mobile, following Apple’s sheet guidelines.', focus: () => [0, 150, 390, 844] },
  };
  function squareFraming(key, headline) {
    return () => {
      const f = SQUARE[key].focus(), fw = f[2] - f[0], fh = f[3] - f[1];
      const top = Math.max(H * 0.38, headline.getBoundingClientRect().bottom + 36);   // window starts under the headline
      const Zs = Math.min(W * 0.86 / fw, (H - top - 28) / fh, 1.7);
      const clipH = (H - top + 60) / Zs;                                             // runs past the bottom edge
      const clip = [f[0], f[1], f[2], f[1] + clipH];
      return { zoom: Zs, clip, at: [0.5, (top + clipH * Zs / 2) / H], radius: 30 };
    };
  }

  let L = LOOPS[ID];
  if (SQ) {
    const key = ID.slice(3);
    const h = document.createElement('h1');
    h.className = 'headline'; h.textContent = SQUARE[key].title;
    document.body.appendChild(h);
    L = { ...LOOPS['v2-' + key], framing: squareFraming(key, h) };
  }
  frame.style.width = L.vw + 'px'; frame.style.height = L.vh + 'px';
  frame.addEventListener('load', async () => {
    A = frame.contentWindow; D = frame.contentDocument;
    await D.fonts.ready; await document.fonts.ready;
    patchScroll();
    if (L.setup) await L.setup();
    frameWindow({ vw: L.vw, vh: L.vh, ...L.framing() });
    if (!L.noPointer) makePointer(!!L.touch);
    window.__loopReady = true;
    // Expose both documents so the renderer can pin CSS animations to virtual time.
    window.__docs = () => [document, D];
    await (window.__startLoop = new Promise(r => (window.__go = r)));
    await L.play();
    window.__loopDone = true;
  });
  frame.src = '../index.html';
})();
