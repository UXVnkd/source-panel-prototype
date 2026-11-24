// api/answer.js — POST {question} → a full answer written with live web search.
//
// One OpenAI Responses call with the hosted web_search tool. The answer reads
// like a normal assistant reply (general knowledge plus what it found), and
// each url_citation annotation is attached to the sentence it supports.
// Returns: { model, blocks: [{type: 'p'|'h'|'li', sentences: [{text, cites: [i]}]}], sources: [{url, title}] }

const { MODEL, send, readBody, overLimit, openai, messageOf } = require('./_lib');

const INSTRUCTIONS = `You are a helpful AI assistant in a chat app. Answer the user's question the way you normally would: ` +
`clear, complete and well organized, in plain language, using your own knowledge together with what you find on the web. ` +
`Search the web and cite sources inline for specific facts, numbers, dates, quotes and recent information. ` +
`Use short paragraphs; use a short list or a heading only when it genuinely helps. Aim for roughly 120 to 300 words unless the question needs less.`;

// Mark each citation with a private-use token, then rebuild the answer as
// blocks of sentences, each carrying the source indexes it cites.
function toBlocks(text, annotations) {
  const sources = [], index = new Map();
  const cites = (annotations || [])
    .filter(a => a && a.type === 'url_citation' && typeof a.url === 'string')
    .sort((a, b) => b.start_index - a.start_index);              // replace from the end
  let t = text;
  for (const a of cites) {
    const url = a.url.replace(/[?&]utm_source=openai\b/, '').replace(/\?$/, '');
    if (!index.has(url)) { index.set(url, sources.length); sources.push({ url, title: String(a.title || '').slice(0, 160) }); }
    const s = Math.max(0, a.start_index), e = Math.max(s, a.end_index);
    t = t.slice(0, s) + `${index.get(url)}` + t.slice(e);
  }
  // Tidy what citation links leave behind, and inline markdown.
  t = t.replace(/\(\s*((?:\d+\s*,?\s*)+)\)/g, '$1')       // ( [marker] ) -> marker
       .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')              // other links -> their text
       .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '$1$2')
       .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
       .replace(/`([^`]+)`/g, '$1');

  const blocks = [];
  for (const raw of t.split(/\n+/)) {
    let line = raw.trim();
    if (!line || /^[-*_]{3,}$/.test(line)) continue;
    let type = 'p';
    if (/^#{1,6}\s+/.test(line)) { type = 'h'; line = line.replace(/^#{1,6}\s+/, ''); }
    else if (/^([-*+•]|\d+[.)])\s+/.test(line)) { type = 'li'; line = line.replace(/^([-*+•]|\d+[.)])\s+/, ''); }
    // Sentences; a marker right after a sentence's end belongs to that sentence.
    const parts = line.split(/(?<=[.!?]["”’)]?)\s+(?=[A-Z0-9“"(])/);
    const sentences = [];
    for (const part of parts) {
      const lead = part.match(/^((?:\d+\s*)+)/);
      let body = part;
      if (lead && sentences.length) {
        sentences[sentences.length - 1].raw += ' ' + lead[1];
        body = part.slice(lead[1].length);
      }
      if (body.trim()) sentences.push({ raw: body });
    }
    const out = sentences.map(s => {
      const ids = [...s.raw.matchAll(/(\d+)/g)].map(m => +m[1]);
      const clean = s.raw.replace(/\s*\d+\s*/g, ' ').replace(/\s+([.,;:!?])/g, '$1').replace(/\s+/g, ' ').trim();
      return { text: clean, cites: [...new Set(ids)] };
    }).filter(s => s.text);
    if (out.length) blocks.push({ type, sentences: out });
  }
  // Number sources in reading order.
  const order = [];
  blocks.forEach(b => b.sentences.forEach(s => s.cites.forEach(i => { if (!order.includes(i)) order.push(i); })));
  const remap = new Map(order.map((old, i) => [old, i]));
  blocks.forEach(b => b.sentences.forEach(s => { s.cites = s.cites.map(i => remap.get(i)); }));
  return { blocks, sources: order.map(i => sources[i]) };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const { question } = readBody(req);
  const q = String(question || '').trim().slice(0, 500);
  if (!q) return send(res, 400, { error: 'empty_question' });
  if (overLimit(req, 1)) return send(res, 429, { error: 'rate_limited' });
  try {
    const data = await openai({
      reasoning: { effort: 'low' },
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',                       // the point of the prototype: real sources
      input: `${INSTRUCTIONS}\n\nUser question: ${q}`
    });
    const { text, annotations } = messageOf(data);
    if (!text.trim()) return send(res, 502, { error: 'empty_answer' });
    return send(res, 200, { model: data.model || MODEL, ...toBlocks(text, annotations) });
  } catch (e) {
    return send(res, e.code === 'missing_key' ? 503 : e.code === 'rate_limited' ? 429 : 502, { error: e.code || 'upstream_error' });
  }
};

module.exports.toBlocks = toBlocks;                 // for local tests
