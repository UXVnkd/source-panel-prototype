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
    // (Skipped when the citation is collapsed into a sentence pill.)
    if (piece.chip === false) { frag.appendChild(group); return frag; }
    const chip = el('button', 'cite-chip' + (source.trusted ? ' is-trusted' : ''));
    chip.appendChild(logo(source));
    chip.appendChild(document.createTextNode(source.label));
    if (source.trusted) chip.appendChild(icon('badge-check', 'trust-icon'));   // AI rates the site as reputable
    chip.type = 'button';
    chip.dataset.claim = piece.claim;
    chip.setAttribute('aria-label', `Show source ${source.name}${source.trusted ? ', a reputable source' : ''}, for: ${claim.text}`);
    chip.setAttribute('aria-controls', 'panel');
    chip.setAttribute('aria-expanded', 'false');
    group.appendChild(chip);

    frag.appendChild(group);
    return frag;
  }

  // ---------- Collapsed pills: several citations in one sentence ----------
  // A pill's key is "G:C2,C1". It behaves like a chip: hover tints all its claims,
  // and tapping opens a list of its sources in the panel.
  const isGroup = key => typeof key === 'string' && key.startsWith('G:');
  const groupIds = key => key.slice(2).split(',');

  // Site logo: a small tile with the source's favicon (decorative; the name is always next to it).
  function logo(source, cls) {
    const t = document.createElement('span');
    t.className = 'src-logo' + (source.logo && source.logo.wide ? ' is-wide' : '') + (cls ? ' ' + cls : '');
    if (source.logo) { const img = document.createElement('img'); img.src = source.logo.src; img.alt = ''; t.appendChild(img); }
    else { t.classList.add('is-letter'); t.textContent = (source.label || source.name || '?').trim().charAt(0).toUpperCase(); }   // live web sources
    return t;
  }

  function renderPill(ids) {
    const sources = [...new Set(ids.map(id => DATA.claims[id].source))].map(s => DATA.sources[s]);
    const first = sources[0];
    // The check means every source in the pill is rated reputable; a mixed pill shows none.
    const allTrusted = sources.every(s => s.trusted);
    const pill = el('button', 'cite-chip is-pill' + (allTrusted ? ' is-trusted' : ''));
    const stack = el('span', 'logo-stack');                 // overlapping logos, one per source
    sources.forEach(s => stack.appendChild(logo(s)));
    pill.appendChild(stack);
    pill.appendChild(document.createTextNode(first.label));
    // "+N" = more sources; "· N" = several citations from the same source
    if (sources.length > 1 || ids.length > 1)
      pill.appendChild(el('span', 'pill-more', sources.length > 1 ? `+${sources.length - 1}` : `· ${ids.length}`));
    if (allTrusted) pill.appendChild(icon('badge-check', 'trust-icon'));
    pill.type = 'button';
    pill.dataset.claim = 'G:' + ids.join(',');
    pill.setAttribute('aria-label', `Show ${ids.length} citations for this sentence, from ${sources.map(s => s.name).join(' and ')}${allTrusted ? ', all reputable sources' : ''}`);
    pill.setAttribute('aria-controls', 'panel');
    pill.setAttribute('aria-expanded', 'false');
    return pill;
  }

  // Assistant answer: plain serif paragraph built from text + claim pieces.
  function renderAnswer() {
    const wrap = el('div', 'msg-assistant');
    // Optional note above the answer (e.g. "Example answer written for this demo").
    if (DATA.answerNote) wrap.appendChild(el('p', 'answer-note', DATA.answerNote));
    // Pieces flow into the current block. Live answers add {block: 'p' | 'h' | 'li'}
    // pieces to start a paragraph, a heading or a list item.
    let p = el('p'), list = null;
    wrap.appendChild(p);
    DATA.answer.forEach(piece => {
      if (typeof piece === 'string') p.appendChild(document.createTextNode(piece));
      else if (piece.block) {
        if (piece.block === 'li') {
          if (!list) { list = el('ul', 'answer-list'); wrap.appendChild(list); }
          p = el('li'); list.appendChild(p);
        } else {
          list = null;
          p = el(piece.block === 'h' ? 'h3' : 'p', piece.block === 'h' ? 'answer-heading' : null);
          wrap.appendChild(p);
        }
      } else if (piece.pill) {
        const groups = p.querySelectorAll('.cite-group');
        (groups[groups.length - 1] || p).appendChild(renderPill(piece.pill));
      } else p.appendChild(renderClaim(piece));
    });
    wrap.querySelectorAll('p:empty').forEach(n => { if (!n.classList.contains('answer-note')) n.remove(); });
    thread.appendChild(wrap);
  }

  // ---------- Hover: faint tint on the chip's claim ----------

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  // First piece of a claim (used for scroll position).
  function claimEl(claimId) {
    if (isGroup(claimId)) claimId = groupIds(claimId)[0];
    return thread.querySelector(`.claim[data-claim="${claimId}"]`);
  }
  // Every piece of a claim (head + tail), for adding/removing state classes.
  function claimParts(claimId) {
    if (isGroup(claimId)) return groupIds(claimId).flatMap(claimParts);
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
    panelTitle.textContent = '';
    panelTitle.appendChild(logo(source, 'is-lg'));
    panelTitle.appendChild(document.createTextNode(source.name));
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
    if (source.trusted) {
      const badge = el('span', 'trust-pill');
      badge.appendChild(icon('badge-check'));
      badge.appendChild(el('span', null, source.trustLabel || 'Reputable source'));   // live web: says who rated it
      label.appendChild(badge);
    }
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
      m.title = 'Possible change';
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

  // Verdict + compare, shown progressively:
  // Verdicts come from an automatic check, so they are worded as likelihoods
  // and always say who judged them ("checked automatically").
  //  - Match:    one quiet line, "Likely matches the source". Nothing to expand.
  //  - Mismatch: "Possible change · See what changed". Tapping it
  //              reveals the side-by-side rows, the note and the feedback.
  // Keeps the first view light: the passage and its highlight do the main work.
  function renderCompare(claimId) {
    const claim = DATA.claims[claimId];
    const mismatch = claim.verdict === 'mismatch';

    const section = el('section', 'compare ' + (mismatch ? 'is-mismatch' : 'is-match'));
    section.setAttribute('aria-label', 'How the answer compares with the source');

    if (claim.verdict === 'unchecked') {               // live web: the page couldn't be read
      const n = el('p', 'verdict-ok-line');
      n.appendChild(withIcon('span', 'verdict-tag verdict-none', 'scan-search', 'Not checked'));
      n.appendChild(el('span', 'verdict-by', 'The page couldn’t be read. Open the original to confirm.'));
      section.appendChild(n);
      return section;
    }
    if (!mismatch) {
      const ok = el('p', 'verdict-ok-line');
      ok.appendChild(withIcon('span', 'verdict-tag verdict-ok', 'check', 'Likely matches the source'));
      ok.appendChild(el('span', 'verdict-by', 'Compared by AI'));
      section.appendChild(ok);
      return section;
    }

    // The toggle: verdict + "See what changed" + chevron
    const toggle = el('button', 'verdict-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'compare-detail');
    const main = el('span', 'verdict-main');
    main.appendChild(withIcon('span', 'verdict-tag verdict-warn', 'triangle-alert', 'Possible change'));
    main.appendChild(el('span', 'verdict-more', 'See what changed'));
    toggle.appendChild(main);
    toggle.appendChild(icon('chevron-down', 'verdict-chevron'));
    // Who judged it, and that it can be wrong
    toggle.appendChild(el('span', 'verdict-by', 'Compared by AI · confirm in the source'));
    section.appendChild(toggle);

    // The hidden detail. Collapsed with a grid-rows trick so it can animate;
    // `inert` keeps its buttons out of Tab order and screen readers while closed.
    const detail = el('div', 'compare-detail');
    detail.id = 'compare-detail';
    detail.inert = true;
    const inner = el('div', 'compare-detail-inner');
    const card = el('div', 'compare-card');
    card.appendChild(compareRow('In the answer:', claim.text, claim.flags.answer, claim.color));
    card.appendChild(compareRow('In the source:', claim.sourceLine, claim.flags.source, claim.color));
    card.appendChild(el('p', 'compare-note', claim.note));
    card.appendChild(el('p', 'compare-limit', 'Based on this passage. Open the original for full context.'));
    inner.appendChild(card);
    inner.appendChild(renderFeedback(claimId));
    detail.appendChild(inner);
    section.appendChild(detail);

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      section.classList.toggle('is-open', open);
      detail.inert = !open;
      // Once it has opened, bring the new content into view.
      if (open) setTimeout(() => detail.scrollIntoView({
        block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' }), 160);
    });
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
    section.appendChild(el('p', 'feedback-q', 'Does this check look right?'));

    const row = el('div', 'feedback-row');
    // Feedback is about the automatic check itself
    const options = [['agree', 'Yes'], ['disagree', 'No, it’s wrong']];
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
    if (isGroup(claimId)) { renderGroupPanel(groupIds(claimId)); return; }
    const source = DATA.sources[DATA.claims[claimId].source];
    panelAbout.hidden = false;
    renderPanelHeader(source);
    panelBody.innerHTML = '';
    if (backTo) panelBody.appendChild(renderBackLink());
    panelBody.appendChild(renderPassage(claimId));
    panelBody.appendChild(renderOpenOriginal(claimId));
    panelBody.appendChild(renderCompare(claimId));   // feedback lives inside its expandable part
  }

  // ---------- Group panel: the sources behind one collapsed pill ----------
  let backTo = null;   // group key to return to from a single source

  function renderGroupPanel(ids) {
    panelTitle.textContent = 'Sources for this sentence';
    panelMeta.innerHTML = '';
    panelMeta.appendChild(el('span', 'meta-date', `${ids.length} citations`));
    panelAbout.innerHTML = ''; panelAbout.hidden = true;
    panelBody.innerHTML = '';
    const list = el('ul', 'group-list');
    ids.forEach(id => {
      const claim = DATA.claims[id], source = DATA.sources[claim.source];
      const li = el('li');
      const b = el('button', 'group-item'); b.type = 'button'; b.dataset.color = claim.color;
      const body = el('span', 'gi-body');
      const name = el('span', 'gi-name');
      name.appendChild(logo(source));
      const nm = name.appendChild(el('span', 'gi-text', source.name + ' '));   // trust check flows inline after the last word
      if (source.trusted) nm.appendChild(icon('badge-check', 'trust-icon'));
      body.appendChild(name);
      body.appendChild(el('span', 'gi-meta', `${source.type} · ${source.date}`));
      body.appendChild(el('span', 'gi-claim', `“${claim.text}”`));
      const ok = claim.verdict !== 'mismatch', none = claim.verdict === 'unchecked';
      const vl = none ? 'Not checked' : ok ? 'Likely matches' : 'Possible change';
      body.appendChild(withIcon('span', 'gi-verdict', none ? 'scan-search' : ok ? 'check' : 'triangle-alert', vl));
      b.appendChild(body);
      b.appendChild(icon('chevron-right', 'gi-go'));
      b.setAttribute('aria-label', `${source.name}: ${claim.text}. ${vl}. Open source.`);
      b.addEventListener('click', () => { backTo = activeClaimId; openPanel(id); });
      // Hovering an item points to its claim in the answer
      b.addEventListener('mouseenter', () => claimParts(id).forEach(c => c.classList.add('is-linked')));
      b.addEventListener('mouseleave', () => claimParts(id).forEach(c => c.classList.remove('is-linked')));
      li.appendChild(b); list.appendChild(li);
    });
    panelBody.appendChild(list);
  }

  function renderBackLink() {
    const n = groupIds(backTo).length;
    const b = el('button', 'back-link'); b.type = 'button';
    b.appendChild(icon('chevron-left'));
    b.appendChild(el('span', null, `All ${n} sources for this sentence`));
    b.addEventListener('click', () => { const key = backTo; backTo = null; openPanel(key); });
    return b;
  }

  // ---------- Source popover (desktop quick check) ----------
  // Anchored under the chip or pill. One page per citation, with a ‹ 1/2 › pager.
  // Shows the exact matching line (not a generic snippet), a quiet verdict, the
  // site label, and "Expand" to open the full side panel.
  let pop = null;     // { el, anchor, ids, index }

  function openPopover(key, anchor) {
    closePopover(false);
    if (activeClaimId) closePanel();
    const ids = isGroup(key) ? groupIds(key) : [key];
    const el = document.createElement('div');
    el.className = 'src-pop';
    el.setAttribute('role', 'dialog');
    el.tabIndex = -1;
    document.querySelector('.chat-scroll').appendChild(el);
    pop = { el, anchor, ids, index: 0 };
    anchor.setAttribute('aria-expanded', 'true');
    renderPopPage();
    placePopover();
    requestAnimationFrame(() => el.classList.add('is-open'));
    el.focus({ preventScroll: true });
  }

  function closePopover(returnFocus) {
    if (!pop) return;
    const { el, anchor } = pop;
    anchor.setAttribute('aria-expanded', 'false');
    clearHighlights();
    el.classList.remove('is-open');
    setTimeout(() => el.remove(), 160);
    pop = null;
    if (returnFocus) anchor.focus({ preventScroll: true });
  }

  // Below the chip if it fits, else above; if neither, the roomier side with a
  // capped height (the card's middle scrolls). The answer itself never moves.
  function placePopover() {
    const box = document.querySelector('.chat-scroll');
    const a = pop.anchor.getBoundingClientRect(), b = box.getBoundingClientRect();
    const el = pop.el;
    el.style.maxHeight = 'none';
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = a.left - b.left + box.scrollLeft;
    left = Math.max(12, Math.min(left, box.clientWidth - w - 12));
    const roomBelow = b.bottom - a.bottom - 20, roomAbove = a.top - b.top - 20;
    const below = h <= roomBelow || (h > roomAbove && roomBelow >= roomAbove);
    const room = below ? roomBelow : roomAbove;
    const height = Math.min(h, Math.max(240, room));
    el.style.maxHeight = height + 'px';
    el.style.left = left + 'px';
    el.style.top = (below ? a.bottom - b.top + box.scrollTop + 8 : a.top - b.top + box.scrollTop - height - 8) + 'px';
    el.style.transformOrigin = below ? 'top left' : 'bottom left';
  }

  function renderPopPage() {
    const { el, ids, index } = pop;
    const id = ids[index], claim = DATA.claims[id], source = DATA.sources[claim.source];
    el.setAttribute('aria-label', `Source ${index + 1} of ${ids.length}: ${source.name}`);
    el.innerHTML = '';

    // Header: pager (when several) + source count
    const head = el.appendChild(document.createElement('div')); head.className = 'sp-head';
    if (ids.length > 1) {
      const pager = el2('div', 'sp-pager');
      const prev = popBtn('chevron-left', 'Previous source', () => stepPop(-1));
      const next = popBtn('chevron-right', 'Next source', () => stepPop(1));
      prev.disabled = index === 0; next.disabled = index === ids.length - 1;
      pager.append(prev, el2('span', 'sp-count', `${index + 1}/${ids.length}`), next);
      head.appendChild(pager);
    }
    const n = new Set(ids.map(i => DATA.claims[i].source)).size;
    head.appendChild(el2('span', 'sp-total', ids.length > 1 ? `${ids.length} citations · ${n} source${n > 1 ? 's' : ''}` : '1 source'));

    // Scrollable middle: body + site label (header and actions stay put)
    const scroll = el.appendChild(el2('div', 'sp-scroll'));
    // Source identity + the exact matching line in the claim's color
    const body = scroll.appendChild(el2('div', 'sp-body'));
    const who = el2('div', 'sp-who');
    who.appendChild(logo(source, 'is-md'));
    who.appendChild(el2('span', null, `${source.label} · ${source.type} · ${source.date}`));
    body.appendChild(who);
    body.appendChild(el2('div', 'sp-title', source.name));
    const quote = el2('blockquote', 'sp-line'); quote.dataset.color = claim.color;
    quote.textContent = claim.verdict === 'unchecked' ? claim.sourceLine : `“${claim.sourceLine}”`;
    body.appendChild(quote);

    // Verdict: quiet for matches; a mismatch expands the comparison inside the card
    const ok = claim.verdict !== 'mismatch';
    if (claim.verdict === 'unchecked') {
      const v = el2('p', 'sp-verdict');
      v.appendChild(withIcon('span', 'sp-ok', 'scan-search', 'Not checked')); v.appendChild(el2('span', 'sp-by', '· the page couldn’t be read'));
      body.appendChild(v);
    } else if (ok) {
      const v = el2('p', 'sp-verdict');
      v.appendChild(withIcon('span', 'sp-ok', 'check', 'Likely matches')); v.appendChild(el2('span', 'sp-by', '· Compared by AI'));
      body.appendChild(v);
    } else {
      const t = el2('button', 'sp-toggle'); t.type = 'button'; t.setAttribute('aria-expanded', 'false');
      t.appendChild(withIcon('span', 'verdict-tag verdict-warn', 'triangle-alert', 'Possible change'));
      t.appendChild(el2('span', 'verdict-more', 'See what changed'));
      t.appendChild(icon('chevron-down', 'verdict-chevron'));
      const d = el2('div', 'sp-detail'); d.hidden = true;
      d.appendChild(compareRow('In the answer:', claim.text, claim.flags.answer, claim.color));
      d.appendChild(compareRow('In the source:', claim.sourceLine, claim.flags.source, claim.color));
      d.appendChild(el2('p', 'compare-note', claim.note));
      d.appendChild(el2('p', 'verdict-by', 'Compared by AI · confirm in the source'));
      t.addEventListener('click', () => {
        const open = d.hidden; d.hidden = !open; t.setAttribute('aria-expanded', String(open));
        t.classList.toggle('is-open', open); placePopover();
        if (open) setTimeout(() => d.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' }), 30);
      });
      body.append(t, d);
    }

    // Site label (describes the site, not the claim)
    const site = el2('div', 'sp-site');
    const lab = el2('div', 'sp-site-label');
    if (source.trusted) { lab.appendChild(icon('badge-check', 'trust-icon')); lab.appendChild(el2('span', null, source.trustLabel || 'Reputable source')); }
    else lab.appendChild(el2('span', null, source.siteLabel));
    site.appendChild(lab);
    site.appendChild(el2('p', 'sp-site-about', (source.trusted ? source.trustReason : source.about) + ' Describes the site, not this claim.'));
    scroll.appendChild(site);

    // Actions
    const foot = el.appendChild(el2('div', 'sp-foot'));
    const open = el2('a', 'sp-link'); open.href = buildFragmentUrl(source.url, claim.sourceLine);
    open.target = '_blank'; open.rel = 'noopener noreferrer';
    open.append(el2('span', null, 'Open original'), icon('arrow-up-right'));
    const exp = el2('button', 'sp-link'); exp.type = 'button';
    exp.append(icon('panel-right-open'), el2('span', null, 'Expand'));
    exp.setAttribute('aria-label', 'Expand: open the full source panel');
    exp.addEventListener('click', () => { const a = pop.anchor; closePopover(false); openPanel(id, a); });
    foot.append(open, exp);

    // The claim on this page lights up in the answer
    clearHighlights();
    claimParts(id).forEach(c => c.classList.add('is-active'));
  }

  function stepPop(d) {
    pop.index = Math.max(0, Math.min(pop.ids.length - 1, pop.index + d));
    renderPopPage(); placePopover();
    const btn = pop.el.querySelector(d < 0 ? '[aria-label="Previous source"]' : '[aria-label="Next source"]');
    (btn && !btn.disabled ? btn : pop.el).focus({ preventScroll: true });
  }
  function el2(tag, cls, text) { return el(tag, cls, text); }
  function popBtn(ic, label, fn) {
    const b = el('button', 'sp-nav'); b.type = 'button'; b.setAttribute('aria-label', label);
    b.appendChild(icon(ic)); b.addEventListener('click', fn); return b;
  }

  // Close on Esc, outside click, or resize
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { e.stopImmediatePropagation(); closePopover(true); } }, true);
  // pointerdown (not click): the card re-renders on paging, which would detach the clicked button
  document.addEventListener('pointerdown', e => {
    if (pop && !pop.el.contains(e.target) && !e.target.closest('.cite-chip')) closePopover(false);
  });
  window.addEventListener('resize', () => pop && placePopover());

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
    if (isGroup(claimId)) panelBody.scrollTop = 0;
    const behavior = reduceMotion.matches ? 'auto' : 'smooth';
    const line = sourceLineEl();
    if (line) {
      // Medium sheet: only the top of the body is visible, so bring the line up under the header.
      const target = (isMobile.matches && detent === 'medium')
        ? line.offsetTop - 28
        : line.offsetTop - panelBody.clientHeight / 3;
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

  // ---------- iOS-style sheet detents (mobile) ----------
  // medium: half height, background visible and tappable (not modal)
  // large:  near full height, background dimmed and scaled back (modal)
  const handleBtn = document.getElementById('panel-handle');
  let detent = null;

  function setDetent(d) {
    detent = d;
    if (d) document.body.dataset.detent = d; else delete document.body.dataset.detent;
    if (handleBtn) handleBtn.setAttribute('aria-label', d === 'large' ? 'Collapse source sheet' : 'Expand source sheet');
    syncPanelRole();
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
      if (isMobile.matches) setDetent('medium');
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
    backTo = null;
    swapToken++;                                    // cancel any pending swap
    panel.classList.remove('is-swapping');
    clearHighlights();
    shiftChat(() => document.body.classList.remove('panel-open'), false);
    setDetent(null);
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;                             // closed panel can't be tabbed into
    syncChipState();
    thread.querySelectorAll('.claim.is-hover').forEach(c => c.classList.remove('is-hover'));
    if (openerChip) openerChip.focus({ preventScroll: true }); // return focus to the chip
    openerChip = null;
  }

  // Mobile only (the sheet is a modal dialog there): keep Tab inside it.
  function trapFocus(e) {
    if (!activeClaimId || !isMobile.matches || detent !== 'large') return;
    const focusable = [...panel.querySelectorAll('button:not(:disabled), a[href], [tabindex="-1"]')]
      .filter(n => !n.closest('[inert]'))            // skip collapsed (inert) content
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
      if (!chip) return;
      backTo = null;
      if (isMobile.matches) { openPanel(chip.dataset.claim, chip); return; }
      // Desktop: a popover anchored to the chip handles the quick check.
      if (pop && pop.anchor === chip) { closePopover(true); return; }
      openPopover(chip.dataset.claim, chip);
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
      if (panel.contains(e.target) || e.target.closest('.cite-chip, .src-pop')) return;
      if (isMobile.matches && detent === 'medium') return;   // iOS: an undimmed sheet stays open
      if (isMobile.matches && !e.target.closest('.panel-backdrop')) return;
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
      panel.setAttribute('aria-modal', String(detent === 'large'));   // medium leaves the answer usable
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
    }
  }

  // Drag the sheet (grabber or header; anywhere at medium). It follows the finger,
  // resists past the top, then lands on the nearest detent, projecting a flick
  // forward (as iOS does). Below medium it dismisses.
  function bindSheetDrag() {
    let startY = 0, base = 0, y = 0, lastY = 0, lastT = 0, v = 0, dragging = false, moved = false;
    const sheetH = () => panel.offsetHeight;
    const mediumOffset = () => sheetH() - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-medium')) / 100 * innerHeight || sheetH() * 0.45;
    const offsetFor = d => d === 'large' ? 0 : panel.getBoundingClientRect().top - (innerHeight - sheetH());

    panel.addEventListener('pointerdown', e => {
      if (!isMobile.matches || !activeClaimId) return;
      const onGrab = e.target.closest('.panel-handle, .panel-header');
      if (!onGrab && detent !== 'medium') return;                 // large: content scrolls instead
      if (e.target.closest('button:not(.panel-handle), a')) return;
      dragging = true; moved = false;
      startY = lastY = e.clientY; lastT = performance.now(); v = 0;
      base = offsetFor(detent); y = base;
      panel.classList.add('is-dragging');
      panel.setPointerCapture(e.pointerId);
    });

    panel.addEventListener('pointermove', e => {
      if (!dragging) return;
      const now = performance.now();
      v = (e.clientY - lastY) / Math.max(1, now - lastT); lastY = e.clientY; lastT = now;
      const raw = base + (e.clientY - startY);
      if (Math.abs(e.clientY - startY) > 6) moved = true;
      y = raw >= 0 ? raw : -Math.sqrt(-raw) * 2;                   // rubber band above large
      panel.style.transform = `translateY(${y}px)`;
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-dragging');
      panel.style.transform = '';
      if (!moved) return;                                        // a tap: the grabber's click handles it
      const projected = y + v * 220;                             // where a flick would carry it
      const stops = [['large', 0], ['medium', mediumOffset()], ['closed', sheetH()]];
      const [target] = stops.reduce((best, s) => Math.abs(s[1] - projected) < Math.abs(best[1] - projected) ? s : best);
      if (target === 'closed') closePanel(); else setDetent(target);
    }
    panel.addEventListener('pointerup', endDrag);
    panel.addEventListener('pointercancel', endDrag);

    // Tapping the grabber switches between medium and large (also works with keyboard / VoiceOver).
    if (handleBtn) handleBtn.addEventListener('click', () => {
      if (moved) { moved = false; return; }
      setDetent(detent === 'large' ? 'medium' : 'large');
    });
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

  // Live mode (live.js) swaps DATA.question / answer / claims and calls these.
  window.SourcePanel = {
    // Close anything open and draw the thread again from DATA.
    render() {
      closePopover(false);
      if (activeClaimId) closePanel();
      thread.textContent = '';
      renderQuestion();
      renderAnswer();
      bindChipHover();
    },
    // Show just the question plus a status line while Claude works.
    pending(question) {
      closePopover(false);
      if (activeClaimId) closePanel();
      thread.textContent = '';
      const q = el('div', 'msg-user'); q.appendChild(el('p', null, question)); thread.appendChild(q);
      const a = el('div', 'msg-assistant');
      const status = el('p', 'live-status'); status.setAttribute('role', 'status');
      a.appendChild(status); thread.appendChild(a);
      return status;
    }
  };
})();
