// api/_lib.js — shared helpers for the Vercel functions (files starting with
// "_" are not routes). No dependencies: Node 18+ fetch only.
//
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   OPENAI_API_KEY   required. Never sent to the browser.
//   OPENAI_MODEL     optional, default "gpt-6-luna" (supports web search and reasoning effort)
//   HOURLY_LIMIT     optional, questions per visitor per hour (default 10)

const MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna';
const HOURLY_LIMIT = Number(process.env.HOURLY_LIMIT || 10);

// ---------- requests ----------
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

// Best-effort limit per visitor. It lives in one function instance's memory,
// so it slows abuse down but isn't a hard cap: also set a monthly spending
// limit in your OpenAI account.
const hits = new Map();
function overLimit(req, cost = 1) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now(), hour = 60 * 60 * 1000;
  const list = (hits.get(ip) || []).filter(t => now - t < hour);
  if (list.length + cost > HOURLY_LIMIT * 2) { hits.set(ip, list); return true; }   // answer + check = 2 calls per question
  for (let i = 0; i < cost; i++) list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

// ---------- OpenAI Responses API ----------
async function openai(body, timeoutMs = 55000) {
  if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error('missing_key'), { code: 'missing_key' });
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, ...body }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data.error && data.error.message) || `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { code: r.status === 429 ? 'rate_limited' : 'upstream_error', status: r.status });
  }
  return data;
}

// The assistant message: its text and url_citation annotations.
function messageOf(data) {
  for (const item of (data.output || [])) {
    if (item.type !== 'message') continue;
    const part = (item.content || []).find(c => c.type === 'output_text');
    if (part) return { text: part.text || '', annotations: part.annotations || [] };
  }
  return { text: data.output_text || '', annotations: [] };
}

// Tolerant JSON: the whole text, a fenced block, or the outermost {…}/[…].
function parseJson(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch (e) {} }
  const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}

// ---------- reading a cited page ----------
// Only public http(s) pages: no IP addresses, no localhost, no internal names.
function safeUrl(u) {
  let url; try { url = new URL(u); } catch (e) { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  const h = url.hostname;
  if (!h.includes('.') || h === 'localhost' || /^[\d.]+$/.test(h) || h.includes(':') || /\.(local|internal|lan)$/i.test(h)) return null;
  return url.toString();
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };
function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|aside|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (m, e) => e[0] === '#'
      ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : (ENT[e.toLowerCase()] ?? m))
    .replace(/\s+/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ')
    .trim();
}

async function readPage(u) {
  const url = safeUrl(u);
  if (!url) return '';
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SourcePanelPrototype/1.0)', Accept: 'text/html,text/plain' },
      redirect: 'follow', signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) return '';
    const type = r.headers.get('content-type') || '';
    if (!/text\/html|text\/plain|xhtml/.test(type)) return '';
    const raw = (await r.text()).slice(0, 2_000_000);
    const body = raw.match(/<body[\s\S]*<\/body>/i);
    return (type.includes('plain') ? raw : htmlToText(body ? body[0] : raw)).slice(0, 14000);
  } catch (e) { return ''; }
}

module.exports = { MODEL, send, readBody, overLimit, openai, messageOf, parseJson, readPage, safeUrl };
