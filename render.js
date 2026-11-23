// render.js — renders index.html#video frame by frame to an MP4.
//
//   node render.js                       → 4K (3840×2160), 60 fps, full length
//   node render.js --seconds 3 --out t.mp4   → quick test of the first 3 s
//
// How: the page's clock is paused (Playwright clock), then stepped exactly
// 1/60 s per frame. CSS transitions/animations are paused too and set to the
// same virtual time, so every frame is exact. Frames stream into ffmpeg.

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 60);
const SCALE = +arg('scale', 3);                 // 1280×720 layout × 3 = 3840×2160
const MAX_SECONDS = +arg('seconds', 30);
const OUT = arg('out', 'video-4k60.mp4');
const AUDIO = arg('audio', null);               // optional music file

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '#video');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);               // real time: let web fonts finish

  const ffArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
  if (AUDIO) ffArgs.push('-i', AUDIO, '-shortest', '-c:a', 'aac', '-b:a', '256k');
  ffArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', OUT);
  const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });

  const t0 = Date.now();
  let vnow = 0;
  for (let f = 0; ; f++) {
    const target = Math.round((f + 1) * 1000 / FPS);
    await page.clock.runFor(target - vnow);       // timers + rAF advance in virtual time
    vnow = target;
    // Pause every CSS animation/transition and pin it to virtual time.
    await page.evaluate(now => {
      for (const a of document.getAnimations()) {
        if (a.__v0 === undefined) { a.__v0 = now; a.pause(); }
        a.currentTime = now - a.__v0;
      }
    }, vnow);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    const done = await page.evaluate(() => window.__videoDone === true);
    if (done || vnow >= MAX_SECONDS * 1000) {
      console.log(`${f + 1} frames (${(vnow / 1000).toFixed(2)}s of video) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      break;
    }
    if (f % 60 === 59) process.stdout.write(`  ${(vnow / 1000).toFixed(0)}s rendered\r`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
})();
