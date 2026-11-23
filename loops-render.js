// loops-render.js — renders seamless 4K / 60 fps interaction loops.
//   node loops-render.js            → all loops into loops/out/<id>.mp4
//   node loops-render.js 3-verdict  → one loop
// Files are served on a virtual origin (page.route), so the loop page can
// script the prototype iframe. The clock is paused and stepped 1/60 s per frame;
// CSS animations in both documents are pinned to that virtual time.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname, ORIGIN = 'http://loop.local';
const FPS = 60, SCALE = 3;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.otf': 'font/otf' };
const ALL_OLD = ['1-pair', '2-chips', '3-verdict', '4-what-changed', '5-site-label', '6-feedback', '7-mobile'];
const ALL = ['v2-pair','v2-pills','v2-popover','v2-logos','v2-quiet','v2-verdict','v2-attrib','v2-site','v2-badge','v2-feedback','v2-mobile'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const SYNC = now => {
  for (const d of window.__docs ? window.__docs() : [document]) {
    for (const a of d.getAnimations()) {
      if (a.__v0 === undefined) { a.__v0 = now; a.pause(); }
      a.currentTime = now - a.__v0;
    }
  }
};

(async () => {
  fs.mkdirSync(path.join(ROOT, 'loops/out'), { recursive: true });
  const browser = await chromium.launch();
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE });
    page.on('pageerror', e => console.error(id, 'page error:', e.message));
    await page.route(ORIGIN + '/**', route => {
      const p = path.join(ROOT, decodeURIComponent(new URL(route.request().url()).pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p)) return route.fulfill({ status: 404, body: '' });
      route.fulfill({ status: 200, contentType: TYPES[path.extname(p)] || 'application/octet-stream', body: fs.readFileSync(p) });
    });
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await page.goto(`${ORIGIN}/loops/loops.html#${id}`);
    await page.waitForTimeout(1500);                          // real time: web fonts

    // Setup phase: advance virtual time (keeping animations pinned) until the start state is ready.
    let vnow = 0;
    const step = async () => { vnow += 1000 / FPS; await page.clock.runFor(1000 / FPS); await page.evaluate(SYNC, vnow); };
    for (let i = 0; i < 60 * 8 && !(await page.evaluate(() => window.__loopReady === true)); i++) await step();
    for (let i = 0; i < 90; i++) await step();                 // let every transition settle
    const sameClock = await page.evaluate(() => { const f = document.getElementById('app').contentWindow; return Math.abs(f.Date.now() - Date.now()) < 50; });
    if (!sameClock) console.warn(id, 'warning: iframe clock is not controlled');

    const out = path.join(ROOT, 'loops/out', `${id}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    await page.evaluate(() => window.__go());
    const t0 = Date.now(); let frames = 0;
    for (;;) {
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      frames++;
      await step();
      if (await page.evaluate(() => window.__loopDone === true) || frames > FPS * 20) break;
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log(`${id}: ${frames} frames (${(frames / FPS).toFixed(2)}s) in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
    await page.close();
  }
  await browser.close();
})();
