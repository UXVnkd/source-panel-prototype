// shots-capture.js — puts the real prototype into each case-study state and
// screenshots it at high resolution. shots-compose.py then places each
// capture on a warm gradient (4K). Output: shots/raw/*.png + shots/raw/shots.json
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'file://' + path.resolve(__dirname, 'index.html');
const OUT = path.resolve(__dirname, 'shots/raw');

// Each shot: viewport, zoom (device scale), how to set up the state, which
// elements to center on, and optionally an element to cut out and float.
// clip: union of anchors + pad [left, top, right, bottom] in CSS px;
// edge: extend the clip to the real window edge on these sides.
const open1 = async p => { await p.click('.cite-chip[data-claim="C1"]'); };
const expand1 = async p => { await open1(p); await p.waitForTimeout(400); await p.click('.verdict-toggle'); };
const SHOTS = [
  { id: '1-pair', vw: 1280, vh: 760, dsf: 2.8, setup: open1, scrollTo: '.source-line', full: true },
  { id: '2-chips', vw: 1280, vh: 760, dsf: 4.4, setup: async () => {},
    anchors: ['.msg-assistant p:not(.answer-note)'], pad: [44, 40, 44, 40] },
  { id: '3-verdict', vw: 1280, vh: 760, dsf: 4.0, setup: open1, scrollTo: '.source-line',
    anchors: ['.source-line', '.verdict-toggle'], pad: [22, 30, 0, 44], edge: ['right'] },
  { id: '4-what-changed', vw: 1280, vh: 760, dsf: 3.0, setup: open1, scrollTo: '.source-line',
    anchors: ['.source-line', '.verdict-toggle'], pad: [22, 90, 0, 36], edge: ['right'],
    float: { setup: expand1, sel: '.compare-card', below: '.verdict-toggle', scale: 1.2 } },
  { id: '5-site-label', vw: 1280, vh: 760, dsf: 4.4, setup: open1,
    anchors: ['.panel-header'], pad: [10, 0, 0, 120], edge: ['top', 'right'] },
  { id: '6-feedback', vw: 1280, vh: 900, dsf: 5.4,
    setup: async p => { await expand1(p); await p.waitForTimeout(400); await p.click('.btn-secondary[data-value="agree"]'); },
    scrollTo: '.feedback', anchors: ['.feedback'], pad: [22, 10, 56, 44] },
  { id: '7-mobile', vw: 390, vh: 844, dsf: 2.4, mobile: true,
    setup: async p => { await p.tap('.cite-chip[data-claim="C1"]'); }, full: true },
];

async function prepare(browser, s, setup, scrollTo) {
  const ctx = await browser.newContext({ viewport: { width: s.vw, height: s.vh }, deviceScaleFactor: s.dsf, hasTouch: !!s.mobile });
  const p = await ctx.newPage();
  await p.goto(URL); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await setup(p);
  await p.waitForTimeout(900);
  await p.evaluate(sel => {
    document.activeElement && document.activeElement.blur();
    const el = sel && document.querySelector(sel);
    const body = el && el.closest('.panel-body');
    if (body) { const r = el.getBoundingClientRect(), b = body.getBoundingClientRect();
      body.scrollTop += (r.top - b.top) - 60; }
  }, scrollTo || null);
  await p.mouse.move(-10, -10);
  await p.waitForTimeout(250);
  return { ctx, p };
}
const unionOf = (p, sels) => p.evaluate(q => q.map(x => { const r = document.querySelector(x).getBoundingClientRect();
  return [r.left, r.top, r.right, r.bottom]; }).reduce((a, r) => [Math.min(a[0], r[0]), Math.min(a[1], r[1]), Math.max(a[2], r[2]), Math.max(a[3], r[3])]), sels);

(async () => {
  const browser = await chromium.launch();
  const meta = {};
  for (const s of SHOTS) {
    const { ctx, p } = await prepare(browser, s, s.setup, s.scrollTo);
    let clip = [0, 0, s.vw, s.vh];
    if (!s.full) {
      const u = await unionOf(p, s.anchors);
      clip = [u[0] - s.pad[0], u[1] - s.pad[1], u[2] + s.pad[2], u[3] + s.pad[3]];
      for (const e of (s.edge || [])) { if (e === 'right') clip[2] = s.vw; if (e === 'top') clip[1] = 0; if (e === 'left') clip[0] = 0; if (e === 'bottom') clip[3] = s.vh; }
      clip = [Math.max(0, clip[0]), Math.max(0, clip[1]), Math.min(s.vw, clip[2]), Math.min(s.vh, clip[3])];
    }
    const m = { dsf: s.dsf, clip, mobile: !!s.mobile };
    if (s.float) m.floatBelow = await unionOf(p, [s.float.below]);
    await p.screenshot({ path: `${OUT}/${s.id}.png`, clip: { x: clip[0], y: clip[1], width: clip[2] - clip[0], height: clip[3] - clip[1] } });
    await ctx.close();
    if (s.float) {
      const f = await prepare(browser, { ...s, dsf: s.dsf * s.float.scale }, s.float.setup, s.scrollTo);
      await (await f.p.$(s.float.sel)).screenshot({ path: `${OUT}/${s.id}-float.png` });
      m.floatScale = s.float.scale;
      await f.ctx.close();
    }
    meta[s.id] = m;
    console.log('captured', s.id, clip.map(Math.round).join(','));
  }
  fs.writeFileSync(`${OUT}/shots.json`, JSON.stringify(meta, null, 2));
  await browser.close();
})();
