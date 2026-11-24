// api/health.js — GET → { ok, model }. Lets the page know live mode is set up.
// Never returns the key, only whether one is configured.
const { MODEL, send } = require('./_lib');

module.exports = (req, res) => send(res, 200, { ok: !!process.env.OPENAI_API_KEY, model: MODEL });
