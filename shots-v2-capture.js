// shots-v2-capture.js — case-study screenshots for the pill + popover design.
// Same approach as shots-capture.js; output: shots/v2/raw/*.png + shots.json
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = 'file://' + path.resolve(__dirname, 'index.html');
const OUT = path.resolve(__dirname, 'shots/v2/raw');

const P1 = '.cite-chip[data-claim="G:C2,C1"]', P2 = '.cite-chip[data-claim="G:C3,C4"]';
const popC2 = async p => { await p.click(P1); };
const popC1 = async p => { await p.click(P1); await p.waitForTimeout(350); await p.click('[aria-label="Next source"]'); };
const panelC1 = async p => { await popC1(p); await p.waitForTimeout(350); await p.click('.sp-foot .sp-link:last-child'); };
const expandC1 = async p => { await panelC1(p); await p.waitForTimeout(500); await p.click('.verdict-toggle'); };

const SHOTS = [
  { id: 'hero', vw: 1280, vh: 760, dsf: 2.8, setup: popC1, full: true },
  { id: 'd-pair', vw: 1280, vh: 760, dsf: 2.8, setup: panelC1, scrollTo: '.source-line', full: true },
  { id: 'd-pills', vw: 1280, vh: 760, dsf: 4.4, setup: async p => { await p.hover(P2); },
    anchors: ['.msg-assistant p:not(.answer-note)'], pad: [44, 40, 44, 40] },
  { id: 'd-logos', vw: 1280, vh: 760, dsf: 6, setup: async () => {}, anchors: [P1, P2], pad: [40, 30, 40, 30] },
  { id: 'd-popover', vw: 1280, vh: 760, dsf: 3.4, setup: popC1, anchors: ['.src-pop', P1], pad: [40, 30, 40, 40] },
  { id: 'd-quiet', vw: 1280, vh: 760, dsf: 4.4, setup: popC2, anchors: ['.sp-body'], pad: [0, 10, 0, 10] },
  { id: 'd-verdict', vw: 1280, vh: 760, dsf: 4.0, setup: panelC1, scrollTo: '.source-line',
    anchors: ['.source-line', '.verdict-toggle'], pad: [22, 30, 0, 44], edge: ['right'] },
  { id: 'd-attrib', vw: 1280, vh: 760, dsf: 3.0, setup: panelC1, scrollTo: '.source-line',
    anchors: ['.source-line', '.verdict-toggle'], pad: [22, 90, 0, 36], edge: ['right'],
    float: { setup: expandC1, sel: '.compare-card', below: '.verdict-toggle', scale: 1.2 } },
  { id: 'd-site', vw: 1280, vh: 760, dsf: 4.4, setup: panelC1, anchors: ['.panel-header'], pad: [16, 16, 0, 16], edge: ['right'] },
  { id: 'd-badge', vw: 390, vh: 844, dsf: 4, mobile: true, setup: async p => { await p.tap(P2); },
    anchors: ['.group-list'], pad: [8, 8, 8, 8] },
  { id: 'd-feedback', vw: 1280, vh: 900, dsf: 5.4,
    setup: async p => { await expandC1(p); await p.waitForTimeout(400); await p.click('.btn-secondary[data-value="agree"]'); },
    scrollTo: '.feedback', anchors: ['.feedback'], pad: [22, 10, 56, 44] },
  { id: 'mobile', vw: 390, vh: 844, dsf: 2.4, mobile: true, setup: async p => { await p.tap(P1); }, full: true },
  // Iteration "after" images (window crops; composed like the earlier g-* pairs)
  { id: 'i-pills', vw: 1440, vh: 900, dsf: 2, setup: async () => {}, anchors: ['.msg-assistant p:not(.answer-note)'], pad: [40, 34, 40, 34] },
  { id: 'i-chips', chips: true, vw: 1440, vh: 900, dsf: 2, setup: async () => {}, anchors: ['.msg-assistant p:not(.answer-note)'], pad: [40, 34, 40, 34] },
  { id: 'i-panel', vw: 1440, vh: 900, dsf: 2, setup: panelC1, full: true },
  { id: 'i-popover', vw: 1440, vh: 900, dsf: 2, setup: popC1, full: true },
];

async function prepare(browser, s, setup, scrollTo) {
  const ctx = await browser.newContext({ viewport: { width: s.vw, height: s.vh }, deviceScaleFactor: s.dsf, hasTouch: !!s.mobile });
  const p = await ctx.newPage();
  if (s.chips) await p.route('**/data.js', async r => {   // the earlier design: one chip per claim, no pills
    const body = fs.readFileSync(path.resolve(__dirname, 'data.js'), 'utf8')
      .replace(/, chip: false/g, '').replace(/\n\s*\{ pill: \[[^\]]*\] \},?/g, '\n');
    r.fulfill({ contentType: 'text/javascript', body });
  });
  await p.goto(URL); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await setup(p); await p.waitForTimeout(900);
  await p.evaluate(sel => {
    const el = sel && document.querySelector(sel); const body = el && el.closest('.panel-body');
    if (body) { const r = el.getBoundingClientRect(), b = body.getBoundingClientRect(); body.scrollTop += (r.top - b.top) - 60; }
  }, scrollTo || null);
  if (!s.id || s.id !== 'd-pills') { await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.mouse.move(-10, -10); }
  await p.waitForTimeout(300);
  return { ctx, p };
}
const unionOf = (p, sels) => p.evaluate(q => q.map(x => { const r = document.querySelector(x).getBoundingClientRect();
  return [r.left, r.top, r.right, r.bottom]; }).reduce((a, r) => [Math.min(a[0], r[0]), Math.min(a[1], r[1]), Math.max(a[2], r[2]), Math.max(a[3], r[3])]), sels);

(async () => {
  const browser = await chromium.launch(); const meta = {};
  const only = process.argv.slice(2);
  for (const s of SHOTS) {
    if (only.length && !only.includes(s.id)) continue;
    const { ctx, p } = await prepare(browser, s, s.setup, s.scrollTo);
    let clip = [0, 0, s.vw, s.vh];
    if (!s.full) {
      const u = await unionOf(p, s.anchors);
      clip = [u[0] - s.pad[0], u[1] - s.pad[1], u[2] + s.pad[2], u[3] + s.pad[3]];
      if (s.fixed) clip = [clip[0], clip[1], clip[0] + s.fixed[0], clip[1] + s.fixed[1]];
      for (const e of (s.edge || [])) { if (e === 'right') clip[2] = s.vw; if (e === 'top') clip[1] = 0; }
      clip = [Math.max(0, clip[0]), Math.max(0, clip[1]), Math.min(s.vw, clip[2]), Math.min(s.vh, clip[3])];
    }
    const m = { dsf: s.dsf, clip, mobile: !!s.mobile };
    if (s.float) m.floatBelow = await unionOf(p, [s.float.below]);
    await p.screenshot({ path: `${OUT}/${s.id}.png`, clip: { x: clip[0], y: clip[1], width: clip[2] - clip[0], height: clip[3] - clip[1] } });
    await ctx.close();
    if (s.float) {
      const f = await prepare(browser, { ...s, dsf: s.dsf * s.float.scale }, s.float.setup, s.scrollTo);
      await (await f.p.$(s.float.sel)).screenshot({ path: `${OUT}/${s.id}-float.png` });
      m.floatScale = s.float.scale; await f.ctx.close();
    }
    meta[s.id] = m; console.log('captured', s.id, clip.map(Math.round).join(','));
  }
  const prev = fs.existsSync(`${OUT}/shots.json`) ? JSON.parse(fs.readFileSync(`${OUT}/shots.json`)) : {};
  fs.writeFileSync(`${OUT}/shots.json`, JSON.stringify({ ...prev, ...meta }, null, 2));
  await browser.close();
})();
