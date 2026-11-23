// live.js — "Ask it live": the composer sends a real question to Claude.
//
// Runs only inside a Claude artifact viewer, through the page's built-in
// `sample` capability (the viewer's own Claude account; no API key, no server).
// Anywhere else the composer stays the static demo and nothing changes.
//
// Sources: when the viewer has the Firecrawl connector, the page searches the
// web and reads the top pages first (the viewer's own Firecrawl, via the `mcp`
// capability). Otherwise it uses the three real sources in data.js.
//
// Two separate calls, so the check is independent of the writing:
//   1. WRITE  — Claude answers from the three sources in data.js and marks
//               which words in each sentence make a claim, and from which source.
//   2. CHECK  — a fresh call sees only each claim and its source passage,
//               picks the exact supporting line, and says match / possible change.
// The page then verifies every quoted line really is in the source (word for
// word) before showing it, and renders the result with the normal pills,
// popover and panel.

(function () {
  if (!window.claude || typeof window.claude.use !== 'function') return;   // not in a Claude viewer

  const DATA = window.PROTOTYPE_DATA;
  const EXAMPLE = {                                      // to restore the scripted demo
    question: DATA.question, answer: DATA.answer, claims: DATA.claims, answerNote: DATA.answerNote, sources: DATA.sources
  };
  const BASE = DATA.sources;                             // the three built-in sources
  const FC = 'Firecrawl';                                // connector display name
  let SRC = BASE;                                        // sources for the current question
  const COLORS = ['amber', 'sage', 'lavender', 'rose'];
  const MAX_CLAIMS = 4;
  // Saving Firecrawl credits (free plan): read 2 pages, reuse results for a day,
  // and stop trying web search for the day once the credits run out.
  const PAGES = 2;
  const DAY = 24 * 60 * 60 * 1000;
  const REUSE = { staleTime: DAY, gcTime: DAY };          // connector calls: same input = no new credits
  const OUT_KEY = 'source-panel:firecrawl-out';
  const today = () => new Date().toISOString().slice(0, 10);
  const creditsOutToday = () => { try { return localStorage.getItem(OUT_KEY) === today(); } catch (e) { return false; } };
  const markCreditsOut = () => { try { localStorage.setItem(OUT_KEY, today()); } catch (e) {} };
  const isOutOfCredits = e => !!e && e.code === 'tool_error' &&
    /credit|402|payment required|insufficient|quota|upgrade your plan/i.test(String(e.message || '') + ' ' + (() => { try { return JSON.stringify(e.result || ''); } catch (x) { return ''; } })());

  let sample = null, mcp = null, webReady = false, ctl = null, busy = false;

  // ---------- text helpers ----------
  // Normalise quotes, dashes and spaces so "word for word" survives typography.
  const norm = s => String(s || '')
    .replace(/[‘’‛]/g, "'").replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();

  // Find `needle` in `hay` ignoring typography; return the original-cased slice or null.
  function findIn(hay, needle) {
    const n = norm(needle);
    if (!n) return null;
    // Build a map from normalised index back to original index.
    let out = '', map = [];
    for (let i = 0; i < hay.length; i++) {
      let c = hay[i];
      c = c.replace(/[‘’‛]/, "'").replace(/[“”‟]/, '"').replace(/[–—]/, '-');
      if (/\s/.test(c)) { if (out.endsWith(' ') || !out.length) continue; c = ' '; }
      out += c; map.push(i);
    }
    let at = out.indexOf(n);
    if (at < 0) at = out.toLowerCase().indexOf(n.toLowerCase());
    if (at < 0) return null;
    return hay.slice(map[at], map[at + n.length - 1] + 1);
  }

  // Fallback: the passage sentence sharing the most words with `text`.
  function bestSentence(passage, text) {
    const words = new Set(norm(text).toLowerCase().match(/[a-z0-9%.]+/g) || []);
    const parts = passage.split(/(?<=[.!?])\s+/).filter(s => s.length > 12 && !s.includes('[…]'));
    let best = parts[0], score = -1;
    for (const s of parts) {
      const w = norm(s).toLowerCase().match(/[a-z0-9%.]+/g) || [];
      const sc = w.filter(x => words.has(x)).length;
      if (sc > score) { score = sc; best = s; }
    }
    return best;
  }

  const sourcesBlock = () => Object.entries(SRC).map(([id, s]) =>
    `<source id="${id}" name="${s.name}" date="${s.date}">\n${s.passage}\n</source>`).join('\n\n');

  // ---------- web: search and read pages (viewer's Firecrawl connector) ----------
  const cleanMd = md => String(md || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')                 // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')                // links -> their text
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')                      // heading marks
    .replace(/^\s*[-*+]\s+/gm, '')                           // bullet marks
    .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, '$1')         // emphasis
    .replace(/`+/g, '').replace(/\|/g, ' ')
    .replace(/\s+/g, ' ').trim();

  function siteLabel(host) {
    const parts = host.replace(/^www\./, '').split('.');
    if (parts.length < 2) return host;
    let i = parts.length - 2;
    if (['co', 'com', 'org', 'gov', 'ac', 'net'].includes(parts[i]) && i > 0) i--;
    return parts[i];
  }
  function monthYear(meta) {
    const raw = meta && (meta.publishedTime || meta['article:published_time'] || meta.modifiedTime || meta['article:modified_time']);
    const d = raw ? new Date(raw) : null;
    return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Read just now';
  }

  // Trust, step 1: rules the page can check itself. Anything else is left for
  // the AI rating in the check call, which is labeled as such.
  function ruleTrust(host, label, question) {
    const h = host.replace(/^www\./, '');
    if (/\.(gov|mil)(\.[a-z]{2})?$|\.gouv\.|\.gob\./.test(h)) return ['Government site', 'A government website, going by its web address.'];
    if (/\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$/.test(h)) return ['Academic site', 'A university or academic website, going by its web address.'];
    if (/\.int$/.test(h)) return ['International body', 'An international organization’s website, going by its web address.'];
    if (label.length >= 3 && new RegExp('\\b' + label.replace(/[^a-z0-9]/gi, '') + '\\b', 'i').test(question)) {
      const name = label.charAt(0).toUpperCase() + label.slice(1);
      return ['Official site', `${name}’s own website, and the question is about ${name}.`];
    }
    return null;
  }

  async function webSources(question, signal, status) {
    const objective = 'Find and read sources to answer a question in a citation-checking prototype.';
    const res = await mcp.callTool(FC, 'firecrawl_search',
      { query: question, limit: 5, sources: ['web'], domainTools: false, objective }, { signal, cache: REUSE });
    const p = res.payload || {};
    const list = ((p.data && p.data.web) || p.web || []).filter(r => r && typeof r.url === 'string' && /^https?:/.test(r.url));
    const picked = [], hosts = new Set();
    for (const r of list) {
      let host; try { host = new URL(r.url).hostname; } catch (e) { continue; }
      if (hosts.has(host)) continue;
      hosts.add(host); picked.push({ ...r, host });
      if (picked.length === PAGES) break;
    }
    if (!picked.length) throw { code: 'no_results' };
    status.textContent = `Reading ${picked.length} page${picked.length > 1 ? 's' : ''} from the web…`;
    const pages = await Promise.all(picked.map(r =>
      mcp.callTool(FC, 'firecrawl_scrape', { url: r.url, formats: ['markdown'], onlyMainContent: true, objective }, { signal, cache: REUSE })
        .then(x => ({ r, p: x.payload }), e => { if (e && (e.code === 'cancelled' || isOutOfCredits(e))) throw e; return { r, p: null }; })));
    const out = {};
    pages.forEach(({ r, p }, i) => {
      const md = p && (p.markdown || (p.data && p.data.markdown) || (typeof p === 'string' ? p : ''));
      let text = cleanMd(md);
      const desc = cleanMd(r.description);
      if (text.length < 200 && desc.length > text.length) text = desc;   // page unreadable: use the search excerpt
      if (text.length < 40) return;
      const meta = (p && (p.metadata || (p.data && p.data.metadata))) || {};
      const label = siteLabel(r.host), rule = ruleTrust(r.host, label, question);
      out['S' + (Object.keys(out).length + 1)] = {
        label, name: String(r.title || meta.title || r.host).slice(0, 120),
        type: 'Web page', siteLabel: r.host, icon: 'globe',
        trusted: !!rule, trustBy: rule ? 'rule' : null,
        trustLabel: rule ? rule[0] : '', trustReason: rule ? rule[1] : '',
        about: rule ? rule[1] : 'Found by a live web search just now. Not rated yet.',
        date: monthYear(meta), url: r.url, passage: text.slice(0, 12000)
      };
    });
    if (!Object.keys(out).length) throw { code: 'no_results' };
    return out;
  }

  // Long pages: show only the stretch around the lines the claims rely on.
  function trimPassages(claims) {
    const lines = {};
    Object.values(claims).forEach(c => (lines[c.source] = lines[c.source] || []).push(c.sourceLine));
    Object.entries(SRC).forEach(([id, src]) => {
      const t = src.passage, idx = (lines[id] || []).map(l => [t.indexOf(l), l.length]).filter(x => x[0] >= 0);
      if (!idx.length || t.length < 1400) { if (!idx.length) src.passage = t.slice(0, 900) + (t.length > 900 ? ' …' : ''); return; }
      let a = Math.max(0, Math.min(...idx.map(x => x[0])) - 450), b = Math.min(t.length, Math.max(...idx.map(x => x[0] + x[1])) + 450);
      const s0 = t.lastIndexOf('. ', a); a = a === 0 ? 0 : (s0 >= 0 ? s0 + 2 : a);
      const s1 = t.indexOf('. ', b); b = s1 >= 0 ? s1 + 1 : t.length;
      src.passage = (a > 0 ? '… ' : '') + t.slice(a, b) + (b < t.length ? ' …' : '');
    });
  }

  // ---------- call 1: write the answer ----------
  function writePrompt(question) {
    return `You are the assistant in a chat app. Answer the user's question using ONLY the sources below. ` +
`Do not use outside knowledge. If the sources don't cover the question, say so briefly and make no claims.

${sourcesBlock()}

User question: ${question}

Write 2 to 4 short sentences in plain language (under 90 words total). Mark at most ${MAX_CLAIMS} factual claims that come from a source. ` +
`A claim's "quote" must be an exact, contiguous run of words copied from your own sentence (not from the source), and "source" is the id of the source it comes from.

Reply with only JSON in this shape:
{"sentences":[{"text":"One full sentence.","claims":[{"quote":"exact words from that sentence","source":"S1"}]}]}`;
  }

  // ---------- call 2: check each claim (independent of call 1) ----------
  function checkPrompt(items, rateIds) {
    const list = items.map(c =>
      `<claim id="${c.id}">\nClaim: ${c.text}\nIn the sentence: ${c.sentence}\nSource passage (${SRC[c.source].name}):\n${SRC[c.source].passage}\n</claim>`).join('\n\n');
    return `You check whether claims in an AI answer say the same thing as their cited source. ` +
`For each claim, find the ONE passage sentence (or clause) that the claim relies on, and compare meaning: numbers, units, ` +
`who or what was counted, scope, certainty words ("up to", "about", "only"), and time.

${list}

For each claim reply with:
- "id": the claim id
- "sourceLine": the supporting text copied EXACTLY, word for word, from the passage (one sentence or clause; never paraphrase; never include "[…]")
- "verdict": "match" if the claim keeps the meaning, "mismatch" if any of the above changed or the passage doesn't support it
- "claimPhrases": for a mismatch, 1-3 short phrases copied exactly from the claim that changed; else []
- "sourcePhrases": for a mismatch, the matching 1-3 short phrases copied exactly from sourceLine; else []
- "note": one or two neutral sentences. For a match: "Same meaning as the source." For a mismatch: what the source says and how the claim differs, without blame.

Reply with only a JSON array, e.g. [{"id":"C1","sourceLine":"...","verdict":"match","claimPhrases":[],"sourcePhrases":[],"note":"Same meaning as the source."}]` +
    (rateIds.length ? `

ALSO rate each of these websites as a source (the site in general, not this page or claim):
${rateIds.map(id => `- ${id}: ${SRC[id].siteLabel} ("${SRC[id].name}")`).join('\n')}
Use "reputable" only for well-known, established publishers with editorial standards, official organizations, or peer-reviewed research. ` +
`Use "not_sure" for anything you don't clearly recognize: blogs, forums, user-generated sites, marketing or SEO pages, content farms. When in doubt, "not_sure".
In that case reply with one JSON object instead: {"checks":[...the array above...],"sites":[{"id":"S1","rating":"reputable","reason":"one short sentence on why"}]}` : '');
  }

  // Trust, step 2: the AI rating, applied only where no rule did, and labeled.
  function applySiteRatings(sites) {
    const byId = {};
    (Array.isArray(sites) ? sites : []).forEach(x => { if (x && x.id) byId[String(x.id)] = x; });
    Object.entries(SRC).forEach(([id, src]) => {
      if (src.trustBy === 'rule' || src.trustBy === undefined) return;   // rule-rated, or a built-in source
      const r = byId[id], reason = String((r && r.reason) || '').trim().replace(/\.?$/, '.');
      if (r && r.rating === 'reputable') {
        Object.assign(src, { trusted: true, trustBy: 'ai', trustLabel: 'Reputable · rated by AI',
          trustReason: `${reason} Rated by AI, so confirm on the site.` });
        src.about = src.trustReason;
      } else {
        src.about = 'Not rated: no rule applied, and the AI wasn’t confident about this site.';
      }
    });
  }

  // ---------- build DATA from the two replies ----------
  function buildAnswer(written) {
    const sentences = Array.isArray(written && written.sentences) ? written.sentences : [];
    const pieces = [], items = [];
    sentences.forEach((s, si) => {
      let text = String(s.text || '').trim();
      if (!text) return;
      if (pieces.length) pieces.push(' ');
      // Place each claim's quote inside the sentence, in reading order.
      const spans = [];
      for (const c of (Array.isArray(s.claims) ? s.claims : [])) {
        if (items.length + spans.length >= MAX_CLAIMS) break;
        const src = String(c.source || '');
        if (!SRC[src]) continue;
        const exact = findIn(text, c.quote);
        if (!exact) continue;
        const at = text.indexOf(exact);
        if (spans.some(p => at < p.end && at + exact.length > p.start)) continue;   // overlapping quote
        spans.push({ start: at, end: at + exact.length, text: exact, source: src });
      }
      spans.sort((a, b) => a.start - b.start);
      let pos = 0; const ids = [];
      for (const sp of spans) {
        if (sp.start > pos) pieces.push(text.slice(pos, sp.start));
        const id = 'L' + (items.length + 1);
        items.push({ id, text: sp.text, source: sp.source, sentence: text });
        pieces.push({ claim: id, chip: false });
        ids.push(id); pos = sp.end;
      }
      const rest = text.slice(pos);
      // Closing punctuation stays with the last claim so the pill sits after the period.
      if (ids.length && /^[\s.,;:!?)"\u201D\u2019']*$/.test(rest)) pieces[pieces.length - 1].after = rest.trim();
      else if (rest) pieces.push(rest);
      if (ids.length) pieces.push({ pill: ids });
    });
    return { pieces, items };
  }

  function buildClaims(items, checks) {
    const byId = {};
    (Array.isArray(checks) ? checks : []).forEach(c => { if (c && c.id) byId[String(c.id)] = c; });
    const claims = {};
    items.forEach((it, i) => {
      const passage = SRC[it.source].passage;
      const c = byId[it.id] || {};
      // The quoted line must really be in the source. If not, fall back to the
      // closest sentence and say so, rather than show an invented quote.
      let line = findIn(passage, c.sourceLine);
      let verdict = c.verdict === 'match' ? 'match' : 'mismatch';
      let note = String(c.note || '').trim() || (verdict === 'match' ? 'Same meaning as the source.' : 'The check found a difference.');
      if (!line || line.includes('[…]')) {
        line = bestSentence(passage, it.text);
        verdict = 'mismatch';
        note = 'The check couldn’t quote a supporting line from this passage, so this is the closest sentence. Read the source to confirm.';
      }
      const keep = (arr, inText) => (Array.isArray(arr) ? arr : []).map(p => findIn(inText, p)).filter(Boolean).slice(0, 3);
      claims[it.id] = {
        text: it.text, source: it.source, sourceLine: line, color: COLORS[i % COLORS.length], verdict,
        flags: verdict === 'mismatch' ? { answer: keep(c.claimPhrases, it.text), source: keep(c.sourcePhrases, line) } : { answer: [], source: [] },
        note
      };
    });
    return claims;
  }

  // ---------- error copy ----------
  function copyFor(code) {
    switch (code) {
      case 'not_granted': case 'sampling_disabled': case 'not_declared': case 'capability_disabled':
        return 'Live answers aren’t available in this view.';
      case 'rate_limited': return 'Too many requests right now. Try again in a minute.';
      case 'session_expired': return 'Please sign in to Claude again, then retry.';
      case 'refused': return 'Claude couldn’t answer that one. Try a different question.';
      case 'invalid_json': return 'The answer came back in an unexpected format. Try again.';
      default: return 'Something went wrong. Try again.';
    }
  }
  function webFailCopy(e) {
    switch (e && e.code) {
      case 'needs_reauth': return 'Web search needs you to reconnect Firecrawl in Claude settings, so this answer uses the three built-in sources.';
      case 'server_not_connected': case 'selection_required': return 'Web search needs the Firecrawl connector, so this answer uses the three built-in sources.';
      case 'not_in_manifest': case 'approval_required': case 'blocked_by_policy': return 'Web search wasn’t allowed, so this answer uses the three built-in sources.';
      case 'credits_out': return 'Your free Firecrawl credits have run out, so this answer uses the three built-in sources.';
      case 'no_results': return 'The web search found nothing readable, so this answer uses the three built-in sources.';
      default: return 'Web search didn’t work just now, so this answer uses the three built-in sources.';
    }
  }
  const HIDE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

  // ---------- the flow ----------
  async function ask(question) {
    if (busy || !question.trim()) return;
    busy = true; setBusy(true);
    ctl = new AbortController();
    const status = window.SourcePanel.pending(question);
    SRC = BASE; let mode = 'base', webNote = '';
    try {
      if (webReady) {
        status.textContent = 'Searching the web…';
        try { SRC = await webSources(question, ctl.signal, status); mode = 'web'; }
        catch (e) {
          if (e && e.code === 'cancelled') throw e;
          if (isOutOfCredits(e)) { markCreditsOut(); webReady = false; e = { code: 'credits_out' }; updateHint(); }
          webNote = webFailCopy(e);
          SRC = BASE;
        }
      }
      status.textContent = mode === 'web' ? 'Writing an answer from those pages…' : 'Writing an answer from the three sources…';
      const written = await sample.json(writePrompt(question), { signal: ctl.signal, cache: { gcTime: DAY } });
      const { pieces, items } = buildAnswer(written);
      if (!pieces.length) throw { code: 'invalid_json' };
      let claims = {};
      if (items.length) {
        status.textContent = `Checking ${items.length === 1 ? 'the claim' : `${items.length} claims`} against the sources…`;
        const rateIds = mode === 'web' ? Object.keys(SRC).filter(id => !SRC[id].trusted) : [];
        const reply = await sample.json(checkPrompt(items, rateIds), { signal: ctl.signal, cache: { gcTime: DAY } });
        const checks = Array.isArray(reply) ? reply : (reply && reply.checks);
        claims = buildClaims(items, checks);
        if (mode === 'web') applySiteRatings(reply && reply.sites);
      }
      if (mode === 'web') trimPassages(claims);
      const from = mode === 'web' ? `${Object.keys(SRC).length} web page${Object.keys(SRC).length > 1 ? 's' : ''} Claude read just now` : 'the three built-in sources';
      Object.assign(DATA, {
        question, answer: pieces, claims, sources: SRC,
        answerNote: (webNote ? webNote + ' ' : '') + (items.length
          ? `Live answer by Claude, written only from ${from}. A separate Claude call checked each claim.`
          : `Live answer by Claude. ${mode === 'web' ? 'The pages it found' : 'The sources'} didn’t cover this, so there is nothing to check.`)
      });
      window.SourcePanel.render();
      resetLink.hidden = false;
    } catch (e) {
      if (e && e.code === 'cancelled') { restoreExample(); }
      else {
        status.textContent = copyFor(e && e.code);
        if (e && HIDE.has(e.code)) disableLive();
        resetLink.hidden = false;
      }
    } finally {
      busy = false; setBusy(false); ctl = null;
    }
  }

  function restoreExample() {
    Object.assign(DATA, EXAMPLE);
    SRC = BASE;
    window.SourcePanel.render();
    resetLink.hidden = true;
  }

  // ---------- composer ----------
  let form, input, send, resetLink, hintSpan;
  function updateHint() {
    if (hintSpan) hintSpan.textContent = creditsOutToday()
      ? 'Live: Firecrawl’s free credits are used up for today, so Claude answers from the three sources, then a second call checks each claim.'
      : hintText();
    if (input) input.placeholder = webReady ? 'Ask anything, Claude will search the web…' : 'Ask about AI citations, live…';
  }
  function buildComposer() {
    const old = document.querySelector('.composer');
    form = document.createElement('form');
    form.className = 'composer is-live';
    form.setAttribute('aria-label', 'Ask a question live');
    input = document.createElement('input');
    input.type = 'text'; input.className = 'composer-input'; input.maxLength = 300;
    input.placeholder = webReady ? 'Ask anything, Claude will search the web…' : 'Ask about AI citations, live…';
    input.setAttribute('aria-label', 'Your question');
    send = document.getElementById('composer-send');
    const btn = document.createElement('button');
    btn.type = 'submit'; btn.className = 'composer-send'; btn.id = 'composer-send';
    btn.setAttribute('aria-label', 'Send');
    btn.innerHTML = send.innerHTML;
    send = btn;
    form.append(input, send);
    old.replaceWith(form);

    const hint = document.createElement('p');
    hint.className = 'composer-hint';
    hintSpan = document.createElement('span'); hintSpan.textContent = hintText(); hint.appendChild(hintSpan);
    resetLink = document.createElement('button');
    resetLink.type = 'button'; resetLink.className = 'composer-reset'; resetLink.textContent = 'Back to the example';
    resetLink.hidden = true;
    resetLink.addEventListener('click', () => { if (ctl) ctl.abort(); else restoreExample(); });
    hint.appendChild(resetLink);
    form.after(hint);

    input.addEventListener('input', () => form.classList.toggle('has-text', !!input.value.trim()));
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (busy) { if (ctl) ctl.abort(); return; }
      const q = input.value.trim();
      if (!q) return;
      input.value = ''; form.classList.remove('has-text');
      ask(q);
    });
  }
  function setBusy(on) {
    form.classList.toggle('is-busy', on);
    send.setAttribute('aria-label', on ? 'Stop' : 'Send');
    input.disabled = on;
  }
  function disableLive() {
    input.disabled = true; send.disabled = true;
    input.placeholder = 'Live answers aren’t available in this view.';
  }

  // Signed out (or Claude unavailable here): keep the static demo and say how to try it live.
  function showSignInHint() {
    const composer = document.querySelector('.composer');
    if (!composer || document.querySelector('.composer-hint')) return;
    const hint = document.createElement('p');
    hint.className = 'composer-hint is-signin';
    const text = document.createElement('span');
    text.textContent = 'Want to ask your own question? ';
    const a = document.createElement('a');
    a.href = 'https://claude.ai/login'; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Sign in to Claude';
    text.append(a, document.createTextNode(', then reopen this page to try it live.'));
    hint.appendChild(text);
    composer.after(hint);
  }

  const hintText = () => webReady
    ? 'Live: Claude searches the web with your Firecrawl, answers from the pages it reads, then a second call checks each claim. Repeat questions reuse earlier results for a day.'
    : 'Live: Claude answers from the three sources, then a second call checks each claim. Uses your Claude account.';

  // Web search is optional: on only when this viewer has the Firecrawl connector.
  async function detectWeb() {
    try {
      mcp = await window.claude.use('mcp');
      if (!mcp) return false;
      const { servers } = await mcp.listTools(FC);
      const fc = (servers || []).find(x => x.server === FC);
      return !!(fc && fc.authStatus !== 'needs_reauth' && (fc.tools || []).some(t => t.name === 'firecrawl_search'));
    } catch (e) { return false; }
  }

  Promise.all([window.claude.use('sample'), detectWeb()]).then(([s, web]) => {
    if (!s) { showSignInHint(); return; }               // not available here: keep the static demo
    sample = s; webReady = web && !creditsOutToday();
    buildComposer();
    updateHint();
  }).catch(showSignInHint);
})();
