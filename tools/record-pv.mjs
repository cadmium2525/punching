// PV（宣伝動画）を書き出す：node tools/record-pv.mjs <出力フォルダ>
// ゲーム内の時計を 1/30 秒ずつ進めてコマを撮り、鳴った音を同じ音源で WAV に書き出す。
// 事前に `npm run build` と `npx vite preview --port 4173` を起動しておく。
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const OUT = process.argv[2] || 'pv-out';
const FPS = 30;
const URL = 'http://127.0.0.1:4173/?pv&bot=perfect&games=justbar,target,mash,spin,reaction';
mkdirSync(`${OUT}/frames`, { recursive: true });

const exe = '/opt/pw-browsers/chromium';
const b = await chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const p = await b.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.addInitScript(() => {
  // 仮想時計と、手動で進める requestAnimationFrame
  let vt = 0;
  performance.now = () => vt;
  const q = [];
  window.requestAnimationFrame = (cb) => (q.push(cb), q.length);
  window.cancelAnimationFrame = () => {};
  window.__pvStep = (ms) => {
    vt += ms;
    q.splice(0).forEach((cb) => cb(vt));
  };
  // 初回ヒントは出さない
  for (const id of ['justbar', 'stopring', 'mash', 'gauge', 'reaction', 'triple', 'stopwatch', 'rhythm', 'target', 'spin']) localStorage.setItem('pf.flag.hint.' + id, '1');
});
await p.goto(URL);
// 起動（画像読み込みなど）を待ちながら時計を進める
for (let i = 0; i < 600; i++) {
  const ok = await p.evaluate(() => {
    window.__pvStep?.(1000 / 30);
    return window.__pvStarted != null;
  });
  if (ok) break;
  await p.waitForTimeout(20);
}
const startMs = await p.evaluate(() => window.__pvStarted);
let n = 0;
while (n < 60 * FPS) {
  const res = await p.evaluate((fps) => {
    const c = window.__pf.game.canvas;
    const out = [];
    for (let i = 0; i < 6; i++) {
      window.__pvStep(1000 / fps);
      out.push(c.toDataURL('image/jpeg', 0.93));
      if (window.__pvDone) break;
    }
    return { out, done: !!window.__pvDone };
  }, FPS);
  for (const d of res.out) writeFileSync(`${OUT}/frames/${String(n++).padStart(5, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
  if (res.done) break;
  if (n % 150 < 6) console.log(`${(n / FPS).toFixed(1)}s`);
}
const dur = n / FPS;
console.log(`frames: ${n} (${dur.toFixed(2)}s), rendering audio…`);
const log = await p.evaluate((s) => window.__pv.log.filter((e) => e.t >= s - 1).map((e) => ({ ...e, t: e.t - s })), startMs);
writeFileSync(`${OUT}/log.json`, JSON.stringify(log));
const wav = await p.evaluate(([s, d]) => window.__pv.renderAudio(s, d), [startMs, dur]);
writeFileSync(`${OUT}/audio.wav`, Buffer.from(wav, 'base64'));
await b.close();
console.log('done');
