// Web Audio による効果音・BGMの合成（音源ファイル不要）
import { settings, onSettings } from '../settings.js';

let ctx = null;
let master = null;
let sfxBus = null;
let bgmBus = null;
let noiseBuf = null;

function vol(v) {
  return (v / 10) ** 1.5;
}

/** ユーザー操作後に呼ぶ（iOS/Chrome の自動再生制限対策） */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -10;
    master.ratio.value = 6;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    bgmBus = ctx.createGain();
    sfxBus.connect(master);
    bgmBus.connect(master);
    applyVolumes();
    onSettings(applyVolumes);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function applyVolumes() {
  if (!ctx) return;
  sfxBus.gain.value = vol(settings.sfxVolume);
  bgmBus.gain.value = vol(settings.bgmVolume) * 0.55;
}

const ready = () => ctx && ctx.state === 'running';

function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(sustain, t + a + d);
}

function osc(type, freq, t, dur, peak = 0.4, { to = null, bus = sfxBus, attack = 0.005, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, attack, peak, dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
  return o;
}

function noise(t, dur, peak = 0.3, { type = 'lowpass', freq = 2000, to = null, q = 1, bus = sfxBus, attack = 0.003 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, attack, peak, dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random());
  s.stop(t + attack + dur + 0.05);
}

/** 重低音のドスッ */
function thump(t, peak = 0.9, base = 150) {
  osc('sine', base, t, 0.35, peak, { to: 40 });
  osc('triangle', base * 2, t, 0.08, peak * 0.4, { to: 60 });
  noise(t, 0.08, peak * 0.5, { freq: 1500, to: 200 });
}

const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function hz(n) {
  const m = n.match(/^([A-G])(#?)(\d)$/);
  const midi = (+m[3] + 1) * 12 + NOTES[m[1]] + (m[2] ? 1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

export const sfx = {
  click() {
    if (!ready()) return;
    const t = ctx.currentTime;
    osc('square', 880, t, 0.05, 0.12, { to: 1320 });
  },
  tap() {
    if (!ready()) return;
    const t = ctx.currentTime;
    osc('triangle', 600, t, 0.06, 0.25, { to: 300 });
  },
  jab(strength = 1) {
    if (!ready()) return;
    const t = ctx.currentTime;
    noise(t, 0.09, 0.35 * strength, { freq: 2500, to: 400 });
    osc('sine', 180, t, 0.12, 0.5 * strength, { to: 60 });
  },
  grade(g) {
    if (!ready()) return;
    const t = ctx.currentTime;
    if (g === 'PERFECT') {
      thump(t, 1);
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => osc('square', hz(n), t + 0.05 + i * 0.045, 0.22, 0.12));
      osc('sine', hz('C7'), t + 0.2, 0.4, 0.08);
    } else if (g === 'GREAT') {
      thump(t, 0.7, 130);
      ['G4', 'C5', 'E5'].forEach((n, i) => osc('square', hz(n), t + 0.04 + i * 0.05, 0.16, 0.1));
    } else if (g === 'GOOD') {
      osc('sine', 160, t, 0.2, 0.5, { to: 70 });
      osc('triangle', hz('E5'), t + 0.03, 0.12, 0.12);
    } else {
      osc('sawtooth', 300, t, 0.35, 0.15, { to: 90 });
      osc('triangle', 220, t + 0.05, 0.3, 0.15, { to: 70 });
    }
  },
  combo(n) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.12;
    const base = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
    for (let i = 0; i <= Math.min(5, n); i++) osc('sawtooth', hz(base[i]), t + i * 0.04, 0.12, 0.07, { detune: 7 });
  },
  tick(p = 0) {
    if (!ready()) return;
    osc('square', 1200 + p * 1600, ctx.currentTime, 0.03, 0.05);
  },
  timerWarn() {
    if (!ready()) return;
    osc('square', 1000, ctx.currentTime, 0.04, 0.06);
  },
  now() {
    if (!ready()) return;
    const t = ctx.currentTime;
    osc('square', hz('A5'), t, 0.15, 0.2);
    osc('square', hz('A6'), t, 0.15, 0.1);
  },
  early() {
    if (!ready()) return;
    const t = ctx.currentTime;
    osc('square', 200, t, 0.25, 0.2, { to: 120 });
  },
  vs() {
    if (!ready()) return;
    const t = ctx.currentTime;
    thump(t, 0.8, 120);
    noise(t, 0.6, 0.2, { type: 'bandpass', freq: 600, to: 3000, q: 2 });
  },
  charge(dur = 0.7) {
    if (!ready()) return;
    const t = ctx.currentTime;
    osc('sawtooth', 80, t, dur, 0.18, { to: 900, attack: 0.05 });
    osc('sawtooth', 81, t, dur, 0.14, { to: 905, attack: 0.05, detune: 12 });
    noise(t, dur, 0.15, { type: 'bandpass', freq: 300, to: 5000, q: 3, attack: 0.05 });
  },
  slowmo(dur = 0.6) {
    if (!ready()) return;
    const t = ctx.currentTime;
    osc('sine', 55, t, dur, 0.6, { attack: 0.05 });
    osc('sine', 52, t + dur * 0.5, dur * 0.5, 0.5);
    noise(t, dur, 0.18, { type: 'lowpass', freq: 400, to: 120, attack: 0.1 });
  },
  impact(god = false) {
    if (!ready()) return;
    const t = ctx.currentTime;
    thump(t, 1.2, 200);
    osc('sine', 90, t, 1.2, 1, { to: 25 });
    osc('square', 70, t, 0.4, 0.3, { to: 30 });
    noise(t, 0.9, 0.8, { freq: 6000, to: 150 });
    noise(t + 0.05, 1.4, 0.3, { type: 'bandpass', freq: 800, to: 100, q: 0.7 });
    if (god) {
      ['C5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => osc('sawtooth', hz(n), t + 0.25 + i * 0.07, 0.6, 0.06, { detune: 8 }));
    }
  },
  whoosh(dur = 0.5) {
    if (!ready()) return;
    noise(ctx.currentTime, dur, 0.3, { type: 'bandpass', freq: 400, to: 3000, q: 1.5, attack: 0.05 });
  },
  pass() {
    if (!ready()) return;
    const t = ctx.currentTime;
    osc('sine', hz('E6'), t, 0.25, 0.12);
    osc('sine', hz('B6'), t + 0.06, 0.3, 0.1);
    noise(t, 0.3, 0.12, { type: 'bandpass', freq: 1500, to: 600, q: 2 });
  },
  land() {
    if (!ready()) return;
    const t = ctx.currentTime;
    thump(t, 1, 110);
    noise(t, 0.5, 0.4, { freq: 3000, to: 200 });
    ['G5', 'C6'].forEach((n, i) => osc('triangle', hz(n), t + 0.1 + i * 0.08, 0.3, 0.12));
  },
  fanfare(big = false) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const seq = big ? ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'] : ['G4', 'C5', 'E5', 'G5'];
    seq.forEach((n, i) => {
      osc('square', hz(n), t + i * 0.09, i === seq.length - 1 ? 0.6 : 0.12, 0.12);
      osc('sawtooth', hz(n) / 2, t + i * 0.09, 0.12, 0.06);
    });
  },
};

// 飛行中の風切り音（ループ）
let wind = null;
export function windStart() {
  if (!ready() || wind) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 400;
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.3);
  s.connect(f).connect(g).connect(sfxBus);
  s.start();
  wind = { s, f, g };
}
export function windSet(intensity) {
  if (!wind) return;
  const t = ctx.currentTime;
  wind.f.frequency.setTargetAtTime(300 + intensity * 2500, t, 0.05);
  wind.g.gain.setTargetAtTime(0.05 + intensity * 0.35, t, 0.05);
}
export function windStop() {
  if (!wind) return;
  const w = wind;
  wind = null;
  w.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
  w.s.stop(ctx.currentTime + 0.5);
}

// BGM：簡単なドラム＋ベースのループ。テンポとテンションを切り替えられる。
const bgm = { on: false, mode: 'calm', step: 0, next: 0, timer: null };
const BASS = { calm: ['A2', 'A2', 'C3', 'A2', 'F2', 'F2', 'G2', 'E2'], fight: ['E2', 'E2', 'G2', 'E2', 'A2', 'A2', 'B2', 'D3'] };
const LEAD = { calm: ['E5', null, 'A5', null, 'C6', null, 'B5', 'G5'], fight: ['E5', 'G5', 'B5', 'E6', 'D6', 'B5', 'A5', 'G5'] };

function scheduleStep(t, i) {
  const fight = bgm.mode === 'fight';
  const s = i % 16;
  if (s % 4 === 0) {
    osc('sine', 120, t, 0.18, 0.7, { to: 40, bus: bgmBus });
  }
  if (fight && s % 8 === 4) noise(t, 0.15, 0.35, { type: 'bandpass', freq: 1800, q: 0.8, bus: bgmBus });
  if (!fight && s % 8 === 4) noise(t, 0.1, 0.18, { type: 'bandpass', freq: 1800, q: 0.8, bus: bgmBus });
  noise(t, 0.03, s % 2 ? 0.06 : 0.1, { type: 'highpass', freq: 7000, bus: bgmBus });
  if (s % 2 === 0) {
    const n = BASS[bgm.mode][Math.floor(i / 2) % 8];
    osc('sawtooth', hz(n), t, 0.16, 0.16, { bus: bgmBus });
  }
  const bar = Math.floor(i / 16) % 4;
  if (s % 2 === 0 && (fight || bar % 2 === 1)) {
    const n = LEAD[bgm.mode][(s / 2) % 8];
    if (n) osc('square', hz(n), t, 0.1, 0.045, { bus: bgmBus });
  }
}

function pump() {
  if (!bgm.on || !ready()) return;
  const spb = 60 / (bgm.mode === 'fight' ? 150 : 120) / 4;
  while (bgm.next < ctx.currentTime + 0.12) {
    scheduleStep(bgm.next, bgm.step++);
    bgm.next += spb;
  }
}

export function bgmPlay(mode = 'calm') {
  bgm.mode = mode;
  if (!ready()) {
    bgm.pending = mode;
    return;
  }
  if (!bgm.on) {
    bgm.on = true;
    bgm.step = 0;
    bgm.next = ctx.currentTime + 0.05;
    bgm.timer = setInterval(pump, 40);
  }
}
export function bgmStop() {
  bgm.on = false;
  bgm.pending = null;
  clearInterval(bgm.timer);
}
export function resumePendingBgm() {
  if (bgm.pending && ready()) {
    const m = bgm.pending;
    bgm.pending = null;
    bgmPlay(m);
  }
}
