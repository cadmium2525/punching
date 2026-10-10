// 保存した音のリスト(log.json)から PV の音声だけを書き出す：node tools/render-pv-audio.mjs <log.json> <秒数> <出力.wav>
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [logPath, dur, out] = process.argv.slice(2);
const exe = '/opt/pw-browsers/chromium';
const b = await chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const p = await b.newPage();
await p.goto('http://127.0.0.1:4173/?pv');
await p.waitForFunction(() => window.__pv);
const log = JSON.parse(readFileSync(logPath, 'utf8'));
const wav = await p.evaluate(([l, d]) => window.__pv.renderAudio(0, d, l), [log, +dur]);
writeFileSync(out, Buffer.from(wav, 'base64'));
await b.close();
