// api/check.js — POST {claims: [{id, text, sentence, url}], rate: [{id, host, title}]}
//   → { checks: [{id, sourceLine, verdict, claimPhrases, sourcePhrases, note}],
//       sites: [{id, rating, reason}], passages: {url: text} }
//
// Reads each cited page on the server, then one separate model call (no web
// search, no memory of the answer call) compares every claim with its page.
// The browser still verifies that each quoted line really is in the page.

const { send, readBody, overLimit, openai, messageOf, parseJson, readPage, safeUrl } = require('./_lib');

const MAX_CLAIMS = 8, MAX_PAGES = 5;

function prompt(claims, pages, rate) {
  const list = claims.map(c => `<claim id="${c.id}">\nClaim: ${c.text}\nIn the sentence: ${c.sentence}\n` +
    `Source page (${c.url}):\n${pages[c.url] || '(this page could not be read)'}\n</claim>`).join('\n\n');
  return `You check whether claims in an AI answer say the same thing as their cited web page. ` +
`For each claim, find the ONE sentence (or clause) on the page that the claim relies on, and compare meaning: numbers, units, ` +
`who or what was counted, scope, certainty words ("up to", "about", "only"), and time.

${list}

For each claim reply with:
- "id": the claim id
- "sourceLine": the supporting text copied EXACTLY, word for word, from the page (one sentence or clause; never paraphrase). Empty string if the page has nothing relevant or could not be read.
- "verdict": "match" if the claim keeps the meaning, "mismatch" if any of the above changed or the page doesn't support it
- "claimPhrases": for a mismatch, 1-3 short phrases copied exactly from the claim that changed; else []
- "sourcePhrases": for a mismatch, the matching 1-3 short phrases copied exactly from sourceLine; else []
- "note": one or two neutral sentences. For a match: "Same meaning as the source." For a mismatch: what the page says and how the claim differs, without blame.` +
  (rate.length ? `

Also rate each of these websites as a source (the site in general, not this page or claim):
${rate.map(r => `- ${r.id}: ${r.host} ("${r.title}")`).join('\n')}
Use "reputable" only for well-known, established publishers with editorial standards, official organizations, or peer-reviewed research. ` +
`Use "not_sure" for anything you don't clearly recognize: blogs, forums, user-generated sites, marketing or SEO pages, content farms. When in doubt, "not_sure".` : '') + `

Reply with only one JSON object: {"checks":[{"id":"L1","sourceLine":"...","verdict":"match","claimPhrases":[],"sourcePhrases":[],"note":"Same meaning as the source."}],"sites":[{"id":"S1","rating":"reputable","reason":"one short sentence on why"}]}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const body = readBody(req);
  const claims = (Array.isArray(body.claims) ? body.claims : []).slice(0, MAX_CLAIMS).map(c => ({
    id: String(c.id || '').slice(0, 8), text: String(c.text || '').slice(0, 600),
    sentence: String(c.sentence || '').slice(0, 900), url: safeUrl(c.url)
  })).filter(c => c.id && c.text && c.url);
  const rate = (Array.isArray(body.rate) ? body.rate : []).slice(0, MAX_PAGES).map(r => ({
    id: String(r.id || '').slice(0, 8), host: String(r.host || '').slice(0, 120), title: String(r.title || '').slice(0, 160)
  }));
  if (!claims.length) return send(res, 400, { error: 'no_claims' });
  if (overLimit(req, 1)) return send(res, 429, { error: 'rate_limited' });

  const urls = [...new Set(claims.map(c => c.url))].slice(0, MAX_PAGES);
  const texts = await Promise.all(urls.map(readPage));
  const pages = Object.fromEntries(urls.map((u, i) => [u, texts[i]]));
  const usable = claims.filter(c => pages[c.url] !== undefined);
  try {
    const data = await openai({ reasoning: { effort: 'low' }, input: prompt(usable, pages, rate) });
    const parsed = parseJson(messageOf(data).text) || {};
    return send(res, 200, {
      checks: Array.isArray(parsed) ? parsed : (parsed.checks || []),
      sites: parsed.sites || [],
      passages: pages
    });
  } catch (e) {
    return send(res, e.code === 'missing_key' ? 503 : e.code === 'rate_limited' ? 429 : 502, { error: e.code || 'upstream_error' });
  }
};
