// script.js — interactions.
// Step 10: ... + motion polish (FLIP chat shift, sequenced highlights, sheet damping).

(function () {
  const DATA = window.PROTOTYPE_DATA;
  const thread = document.getElementById('thread');
  const panel = document.getElementById('panel');
  const panelTitle = document.getElementById('panel-title');
  const panelMeta = document.getElementById('panel-meta');
  const panelAbout = document.getElementById('panel-about');
  const panelBody = document.getElementById('panel-body');
  const closeBtn = document.getElementById('panel-close');
  const backdrop = document.getElementById('panel-backdrop');

  // Which claim the panel is showing (null = closed), and the chip that opened it.
  let activeClaimId = null;
  let openerChip = null;

  // Feedback given per claim this session: { C1: 'match' | 'mismatch' }.
  // Not saved anywhere (out of scope); it resets on reload.
  const feedback = {};

  // Small helper: create an element with a class and optional text.
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Build an inline Lucide icon (all icons come from icons.js).
  // Decorative: hidden from screen readers; the text next to it carries the meaning.
  function icon(name, className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon' + (className ? ' ' + className : ''));
    svg.innerHTML = window.ICONS[name];
    return svg;
  }

  // Element with an icon followed by text.
  function withIcon(tag, className, iconName, text) {
    const node = el(tag, className);
    node.appendChild(icon(iconName));
    node.appendChild(el('span', null, text));
    return node;
  }

  // ---------- Rendering ----------

  // User question: right-aligned bubble.
  function renderQuestion() {
    const wrap = el('div', 'msg-user');
    wrap.appendChild(el('p', null, DATA.question));
    thread.appendChild(wrap);
  }

  // One cited claim: highlighted text + citation chip button.
  // The claim's LAST word, its punctuation and the chip sit together in a
  // no-wrap group, so the chip never drops onto a line by itself.
  // The highlight is therefore two spans (head + tail) with the same data-claim.
  function renderClaim(piece) {
    const claim = DATA.claims[piece.claim];
    const source = DATA.sources[claim.source];
    const frag = document.createDocumentFragment();

    const words = claim.text.split(' ');
    const tailText = words.pop();
    const headText = words.length ? words.join(' ') + ' ' : '';

    function part(text, extra) {
      const span = el('span', 'claim ' + extra, text);
      span.dataset.claim = piece.claim;
      span.dataset.color = claim.color;
      return span;
    }
    if (headText) frag.appendChild(part(headText, 'claim-head'));

    const group = el('span', 'cite-group');
    group.appendChild(part(tailText, headText ? 'claim-tail' : ''));

    // Punctuation sits outside the highlight, before the chip.
    if (piece.after) group.appendChild(document.createTextNode(piece.after));

    // The chip: a real button showing the source's short name.
    const chip = el('button', 'cite-chip', source.label);
    chip.type = 'button';
    chip.dataset.claim = piece.claim;
    chip.setAttribute('aria-label', `Show source ${source.name} for: ${claim.text}`);
    chip.setAttribute('aria-controls', 'panel');
    chip.setAttribute('aria-expanded', 'false');
    group.appendChild(chip);

    frag.appendChild(group);
    return frag;
  }

  // Assistant answer: plain serif paragraph built from text + claim pieces.
  function renderAnswer() {
    const wrap = el('div', 'msg-assistant');
    const p = el('p');
    DATA.answer.forEach(piece => {
      p.appendChild(typeof piece === 'string' ? document.createTextNode(piece) : renderClaim(piece));
    });
    wrap.appendChild(p);
    thread.appendChild(wrap);
  }

  // ---------- Hover: faint tint on the chip's claim ----------

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  // First piece of a claim (used for scroll position).
  function claimEl(claimId) {
    return thread.querySelector(`.claim[data-claim="${claimId}"]`);
  }
  // Every piece of a claim (head + tail), for adding/removing state classes.
  function claimParts(claimId) {
    return [...thread.querySelectorAll(`.claim[data-claim="${claimId}"]`)];
  }

  function bindChipHover() {
    thread.querySelectorAll('.cite-chip').forEach(chip => {
      const on = () => claimParts(chip.dataset.claim).forEach(c => c.classList.add('is-hover'));
      const off = () => claimParts(chip.dataset.claim).forEach(c => c.classList.remove('is-hover'));
      // Mouse hover only: on touch screens a tap fires mouseenter too,
      // which would leave a stuck tint.
      chip.addEventListener('mouseenter', () => { if (canHover.matches) on(); });
      chip.addEventListener('mouseleave', off);
      // Keyboard focus gets the same preview. Mouse clicks and the focus we
      // return on close don't, so no tint is left behind after closing.
      chip.addEventListener('focus', () => { if (chip.matches(':focus-visible')) on(); });
      chip.addEventListener('blur', off);
    });
  }

  // ---------- Panel ----------

  // Header: source name, type badge, date.
  function renderPanelHeader(source) {
    panelTitle.textContent = source.name;
    panelMeta.innerHTML = '';
    panelMeta.appendChild(el('span', 'type-badge', source.type));
    panelMeta.appendChild(el('span', 'meta-date', source.date));

    // Source-type label: what kind of site this is, with a one-line
    // description and a reminder that it rates the site, not the claim.
    panelAbout.innerHTML = '';
    const label = el('div', 'site-label');
    label.appendChild(icon(source.icon, 'site-label-icon'));
    label.appendChild(el('span', null, source.siteLabel));
    panelAbout.appendChild(label);
    const about = el('p', 'site-about', source.about + ' ');
    about.appendChild(el('span', 'site-caveat', 'Describes the site, not this claim.'));
    panelAbout.appendChild(about);
  }

  // Passage: the source text, with the claim's source line wrapped in its
  // own span (same data-claim as the claim in the answer).
  function renderPassage(claimId) {
    const claim = DATA.claims[claimId];
    const passage = DATA.sources[claim.source].passage;
    const i = passage.indexOf(claim.sourceLine);

    const block = el('div', 'passage');
    block.appendChild(el('div', 'passage-label', 'From the source'));
    const p = el('p', 'passage-text');
    p.appendChild(document.createTextNode(passage.slice(0, i)));
    const line = el('mark', 'source-line', claim.sourceLine);
    line.dataset.claim = claimId;
    line.dataset.color = claim.color;
    p.appendChild(line);
    p.appendChild(document.createTextNode(passage.slice(i + claim.sourceLine.length)));
    block.appendChild(p);
    return block;
  }

  // ---------- Compare section ----------

  // Return a fragment of `text` with each phrase in `phrases` wrapped in a
  // flag mark (dotted warning underline).
  function markPhrases(text, phrases) {
    const frag = document.createDocumentFragment();
    // Find where each phrase sits, then walk the text in order.
    const hits = phrases
      .map(ph => ({ start: text.indexOf(ph), end: text.indexOf(ph) + ph.length }))
      .filter(h => h.start >= 0)
      .sort((a, b) => a.start - b.start);
    let pos = 0;
    hits.forEach(h => {
      frag.appendChild(document.createTextNode(text.slice(pos, h.start)));
      const m = el('mark', 'flag', text.slice(h.start, h.end));
      m.title = 'Changed meaning';
      frag.appendChild(m);
      pos = h.end;
    });
    frag.appendChild(document.createTextNode(text.slice(pos)));
    return frag;
  }

  // One stacked row: "In the answer:" / "In the source:" + text with flags.
  function compareRow(label, text, phrases, color) {
    const row = el('div', 'compare-row');
    row.dataset.color = color;
    row.appendChild(el('div', 'compare-label', label));
    const q = el('p', 'compare-text');
    q.appendChild(markPhrases(text, phrases));
    row.appendChild(q);
    return row;
  }

  // Compare block: verdict tag, the two rows, and a plain-language note.
  function renderCompare(claimId) {
    const claim = DATA.claims[claimId];
    const mismatch = claim.verdict === 'mismatch';

    const section = el('section', 'compare ' + (mismatch ? 'is-mismatch' : 'is-match'));
    section.setAttribute('aria-label', 'Compare the answer with the source');

    const head = el('div', 'compare-head');
    head.appendChild(el('h3', 'compare-title', 'Compare'));
    head.appendChild(mismatch
      ? withIcon('span', 'verdict-tag verdict-warn', 'triangle-alert', 'Changed meaning')
      : withIcon('span', 'verdict-tag verdict-ok', 'check', 'Matches'));
    section.appendChild(head);

    section.appendChild(compareRow('In the answer:', claim.text, claim.flags.answer, claim.color));
    section.appendChild(compareRow('In the source:', claim.sourceLine, claim.flags.source, claim.color));

    section.appendChild(el('p', 'compare-note', claim.note));
    return section;
  }

  // ---------- Open original ----------

  // Link to the source with a text fragment, so a real page scrolls to and
  // highlights the exact line: https://site/page#:~:text=<encoded line>
  function buildFragmentUrl(url, text) {
    // '-' has special meaning in text fragments, so encode it too.
    const encoded = encodeURIComponent(text).replace(/-/g, '%2D');
    return `${url}#:~:text=${encoded}`;
  }

  function renderOpenOriginal(claimId) {
    const claim = DATA.claims[claimId];
    const source = DATA.sources[claim.source];
    const wrap = el('div', 'open-original');
    const a = el('a', 'btn-primary');
    a.appendChild(el('span', null, 'Open original'));
    a.appendChild(icon('arrow-up-right'));
    a.href = buildFragmentUrl(source.url, claim.sourceLine);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', `Open original: ${source.name} (opens in a new tab)`);
    wrap.appendChild(a);
    wrap.appendChild(el('span', 'open-original-host', new URL(source.url).host));
    return wrap;
  }

  // ---------- Feedback ----------

  function renderFeedback(claimId) {
    const section = el('div', 'feedback');
    section.appendChild(el('p', 'feedback-q', 'Does the answer match the source?'));

    const row = el('div', 'feedback-row');
    const options = [['match', 'Matches'], ['mismatch', 'Doesn’t match']];
    const buttons = options.map(([value, label]) => {
      const b = el('button', 'btn-secondary');
      b.appendChild(icon('check', 'chosen-icon'));   // visible only on the chosen option
      b.appendChild(el('span', null, label));
      b.type = 'button';
      b.dataset.value = value;
      b.setAttribute('aria-pressed', 'false');
      row.appendChild(b);
      return b;
    });
    section.appendChild(row);

    // Polite live region so screen readers hear the confirmation.
    const status = el('p', 'feedback-status');
    status.setAttribute('role', 'status');
    status.tabIndex = -1;
    section.appendChild(status);

    // Lock buttons + show confirmation. Used on click and when revisiting a claim.
    function lock(value) {
      buttons.forEach(b => {
        b.disabled = true;
        b.setAttribute('aria-pressed', String(b.dataset.value === value));
      });
      status.textContent = 'Thanks — noted';
    }

    buttons.forEach(b => b.addEventListener('click', () => {
      feedback[claimId] = b.dataset.value;
      lock(b.dataset.value);
      status.focus({ preventScroll: true });   // disabled button drops focus; keep it nearby
    }));

    if (feedback[claimId]) lock(feedback[claimId]);
    return section;
  }

  // Fill the panel for one claim.
  function renderPanel(claimId) {
    const source = DATA.sources[DATA.claims[claimId].source];
    renderPanelHeader(source);
    panelBody.innerHTML = '';
    panelBody.appendChild(renderPassage(claimId));
    panelBody.appendChild(renderOpenOriginal(claimId));
    panelBody.appendChild(renderCompare(claimId));
    panelBody.appendChild(renderFeedback(claimId));
  }

  // ---------- Highlights ----------

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isMobile = window.matchMedia('(max-width: 899px)');

  function sourceLineEl() {
    return panelBody.querySelector('.source-line');
  }

  // Solid highlight on the claim in the answer AND its line in the panel.
  // Both use the claim's color, so they read as one pair.
  function highlightClaim(claimId) {
    clearHighlights();
    claimParts(claimId).forEach(c => c.classList.add('is-active'));
    const line = sourceLineEl();
    if (!line) return;
    if (reduceMotion.matches) { line.classList.add('is-active'); return; }
    // The claim lights up first; its source line follows a beat later,
    // so the eye reads it as cause → effect.
    const delay = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--line-delay')) || 0;
    setTimeout(() => line.classList.add('is-active'), delay);
  }

  // Only the chip whose claim is showing reads as "expanded".
  function syncChipState() {
    thread.querySelectorAll('.cite-chip').forEach(c =>
      c.setAttribute('aria-expanded', String(c.dataset.claim === activeClaimId)));
  }

  function clearHighlights() {
    thread.querySelectorAll('.claim.is-active, .claim.is-linked')
      .forEach(c => c.classList.remove('is-active', 'is-linked'));
  }

  // Scroll the panel so the highlighted source line sits in view (about 1/3 down).
  // On mobile, also nudge the chat so the claim isn't hidden behind the sheet.
  function scrollToSourceLine(claimId) {
    const behavior = reduceMotion.matches ? 'auto' : 'smooth';
    const line = sourceLineEl();
    if (line) {
      const target = line.offsetTop - panelBody.clientHeight / 3;
      panelBody.scrollTo({ top: Math.max(0, target), behavior });
    }
    if (isMobile.matches) {
      const chatScroll = document.querySelector('.chat-scroll');
      const claim = claimEl(claimId);
      const top = claim.getBoundingClientRect().top - chatScroll.getBoundingClientRect().top + chatScroll.scrollTop;
      chatScroll.scrollTo({ top: Math.max(0, top - 24), behavior });
    }
  }

  // ---------- Chat shift (desktop) ----------
  // The chat column changes size when the panel opens/closes. Instead of
  // animating layout (slow), we use FLIP: record where the thread and
  // composer are, apply the change, then animate them from the old spot
  // with a transform. Measuring with getBoundingClientRect includes any
  // transform in progress, so a quick open→close interrupts smoothly.
  const shiftTargets = () => [thread, document.querySelector('.composer')];

  function shiftChat(applyChange, opening) {
    if (isMobile.matches || reduceMotion.matches) { applyChange(); return; }
    const targets = shiftTargets();
    const before = targets.map(t => t.getBoundingClientRect().left);
    targets.forEach(t => { t.style.transition = 'none'; t.style.transform = ''; });
    applyChange();
    targets.forEach((t, i) => {
      const dx = before[i] - t.getBoundingClientRect().left;
      t.style.transform = `translateX(${dx}px)`;
    });
    // Force the browser to register the start position, then release to
    // the new spot in the same frame (no waiting = no stall on interrupt).
    void thread.offsetWidth;
    const dur = opening ? 'var(--dur-panel)' : 'var(--dur-panel-out)';
    targets.forEach(t => {
      t.style.transition = `transform ${dur} var(--ease-out)`;
      t.style.transform = '';
    });
  }

  // Show a claim in the panel: render content, highlight both sides, scroll.
  function showClaim(claimId) {
    renderPanel(claimId);
    highlightClaim(claimId);
    scrollToSourceLine(claimId);
  }

  // Switching claims while open crossfades the panel content.
  // swapToken guards against fast repeated clicks finishing out of order.
  let swapToken = 0;
  const SWAP_MS = 100;                              // matches --dur-swap-out

  function openPanel(claimId, chip) {
    if (chip) openerChip = chip;
    if (claimId === activeClaimId) return;         // same chip again: nothing to do

    const wasOpen = activeClaimId !== null;
    activeClaimId = claimId;

    if (!wasOpen) {
      // First open: set the open state first (on mobile this adds the chat's
      // extra bottom room, so the claim can scroll above the sheet), then fill.
      shiftChat(() => document.body.classList.add('panel-open'), true);
      panel.setAttribute('aria-hidden', 'false');
      panel.inert = false;
      showClaim(claimId);
      syncChipState();
      // Move focus into the panel: the source name is read out first,
      // and Tab continues to the close button and the panel's controls.
      panelTitle.focus({ preventScroll: true });
      return;
    }

    // Already open: move the answer highlight now, crossfade the panel.
    const token = ++swapToken;
    syncChipState();
    clearHighlights();
    claimParts(claimId).forEach(c => c.classList.add('is-active'));
    if (reduceMotion.matches) { showClaim(claimId); return; }
    panel.classList.add('is-swapping');             // fade out (CSS)
    setTimeout(() => {
      if (token !== swapToken || activeClaimId !== claimId) return;
      showClaim(claimId);
      panel.classList.remove('is-swapping');        // fade back in
    }, SWAP_MS);
  }

  function closePanel() {
    if (!activeClaimId) return;
    activeClaimId = null;
    swapToken++;                                    // cancel any pending swap
    panel.classList.remove('is-swapping');
    clearHighlights();
    shiftChat(() => document.body.classList.remove('panel-open'), false);
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;                             // closed panel can't be tabbed into
    syncChipState();
    thread.querySelectorAll('.claim.is-hover').forEach(c => c.classList.remove('is-hover'));
    if (openerChip) openerChip.focus({ preventScroll: true }); // return focus to the chip
    openerChip = null;
  }

  // Mobile only (the sheet is a modal dialog there): keep Tab inside it.
  function trapFocus(e) {
    if (!activeClaimId || !isMobile.matches) return;
    const focusable = [...panel.querySelectorAll('button:not(:disabled), a[href], [tabindex="-1"]')]
      .filter(n => n.tabIndex >= 0 || n === panelTitle);
    const tabbable = focusable.filter(n => n.tabIndex >= 0);
    if (!tabbable.length) return;
    const first = tabbable[0], last = tabbable[tabbable.length - 1];
    const inside = panel.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelTitle || !inside)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault(); first.focus();
    }
  }

  function bindPanelEvents() {
    // Chip click opens (or swaps) the panel.
    thread.addEventListener('click', e => {
      const chip = e.target.closest('.cite-chip');
      if (chip) openPanel(chip.dataset.claim, chip);
    });

    closeBtn.addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);               // mobile
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closePanel();
      if (e.key === 'Tab') trapFocus(e);
    });

    // Desktop: clicking anywhere outside the panel (and not on a chip) closes it.
    document.addEventListener('click', e => {
      if (!activeClaimId) return;
      if (panel.contains(e.target) || e.target.closest('.cite-chip')) return;
      closePanel();
    });
  }

  // ---------- Two-way linking ----------
  // Hover the source line in the panel → its claim in the answer pulses.
  // Hover the active claim in the answer → its source line brightens.

  function setLinked(claimId, on) {
    const line = sourceLineEl();
    claimParts(claimId).forEach(c => c.classList.toggle('is-linked', on));
    if (line && line.dataset.claim === claimId) line.classList.toggle('is-linked', on);
  }

  function bindLinking() {
    panelBody.addEventListener('mouseover', e => {
      const line = e.target.closest('.source-line');
      if (line) setLinked(line.dataset.claim, true);
    });
    panelBody.addEventListener('mouseout', e => {
      const line = e.target.closest('.source-line');
      if (line && !line.contains(e.relatedTarget)) setLinked(line.dataset.claim, false);
    });
    thread.addEventListener('mouseover', e => {
      const claim = e.target.closest('.claim.is-active');
      if (claim && !claim.classList.contains('is-linked')) setLinked(claim.dataset.claim, true);
    });
    thread.addEventListener('mouseout', e => {
      const claim = e.target.closest('.claim');
      if (!claim) return;
      // Moving between the claim's own head and tail isn't "leaving" it.
      const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.claim');
      if (to && to.dataset.claim === claim.dataset.claim) return;
      setLinked(claim.dataset.claim, false);
    });
  }

  // ---------- Mobile bottom sheet ----------

  // On mobile the panel is a modal sheet, so it's announced as a dialog.
  // On desktop it's a side panel next to the chat, so it isn't.
  function syncPanelRole() {
    if (isMobile.matches) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
    }
  }

  // Swipe down on the handle or header to close. The sheet follows the
  // finger; release past 25% of its height (or a quick flick) closes it,
  // otherwise it springs back.
  function bindSheetDrag() {
    let startY = 0, dy = 0, startT = 0, dragging = false;

    panel.addEventListener('pointerdown', e => {
      if (!isMobile.matches || !activeClaimId) return;
      if (!e.target.closest('.panel-handle, .panel-header') || e.target.closest('button')) return;
      dragging = true;
      startY = e.clientY; dy = 0; startT = performance.now();
      panel.classList.add('is-dragging');           // turns off the CSS transition
      panel.setPointerCapture(e.pointerId);
    });

    panel.addEventListener('pointermove', e => {
      if (!dragging) return;
      const raw = e.clientY - startY;
      // Down: follows the finger 1:1. Up: damped resistance (rubber band),
      // so the sheet gives a little instead of hitting a hard stop.
      dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 2;
      panel.style.transform = `translateY(${dy}px)`;
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      const speed = dy / Math.max(1, performance.now() - startT);  // px per ms
      panel.classList.remove('is-dragging');        // transition back on
      panel.style.transform = '';                   // animate from the current spot…
      if (dy > panel.offsetHeight * 0.25 || speed > 0.6) closePanel();  // …down and out, or back up
    }
    panel.addEventListener('pointerup', endDrag);
    panel.addEventListener('pointercancel', endDrag);
  }

  // ---------- Start ----------
  closeBtn.textContent = '';
  closeBtn.appendChild(icon('x'));
  document.getElementById('composer-send').appendChild(icon('arrow-up'));
  renderQuestion();
  renderAnswer();
  bindChipHover();
  bindPanelEvents();
  bindLinking();
  bindSheetDrag();
  syncPanelRole();
  isMobile.addEventListener('change', syncPanelRole);
})();
