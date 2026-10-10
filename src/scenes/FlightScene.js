import Phaser from 'phaser';
import { W, H, C, txt, go, fadeIn, burst, shake, flash, popText, shockwave } from '../ui.js';
import { addChar } from '../characters.js';
import { sfx, windStart, windSet, windStop } from '../audio/sfx.js';
import { formatKm, formatLightYears } from '../core/format.js';
import { flightLogKm, flightKm, reachedLandmarks } from '../core/stages.js';
import { DEBUG } from '../debug.js';
import { settings } from '../settings.js';

export const RAINBOW = [0xff3b3b, 0xff9a1a, 0xffe53b, 0x3ddc84, 0x3da5ff, 0x5b5bff, 0xc04bff];
const hue = (h) => Phaser.Display.Color.HSVToRGB(((h % 1) + 1) % 1, 0.85, 1).color;

const DURATION = 8;
const CHAR_Y = 640;
const BG_STOPS = [
  [0, 0x6ec6ff],
  [1, 0x2f7be0],
  [2.1, 0x0b1840],
  [3, 0x050a1c],
  [9, 0x07061a],
  [12, 0x0d0420],
  [16, 0x160430],
  [18.5, 0x24073a],
];

function bgColor(L) {
  let i = 0;
  while (i < BG_STOPS.length - 2 && L > BG_STOPS[i + 1][0]) i++;
  const [a, ca] = BG_STOPS[i];
  const [b, cb] = BG_STOPS[i + 1];
  const t = Phaser.Math.Clamp((L - a) / (b - a), 0, 1);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(ca), Phaser.Display.Color.ValueToColor(cb), 100, t * 100);
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

/** 表示距離が km に到達する時刻 */
function crossTime(km, fin) {
  const target = Math.log10(km);
  let lo = 0.5;
  let hi = 7;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (flightLogKm(mid, fin) < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

const SPRITES = {
  iss: ['iss', 0.9],
  satellite: ['satellite', 0.9],
  moon: ['moon', 1.3],
  mars: ['mars', 0.9],
  sun: ['sun', 2.4],
  jupiter: ['jupiter', 1.5],
  saturn: ['saturn', 1.2],
  neptune: ['neptune', 0.9],
  cloud: ['nebula', 1.6, 0x88aaff],
  star: ['bigstar', 1.3],
  nebula: ['nebula', 2.4],
  core: ['sun', 3.2, 0xffe2a8],
  galaxy: ['galaxy', 2.6],
  galaxy2: ['galaxy', 1.6, 0xaaccff],
};

export default class FlightScene extends Phaser.Scene {
  constructor() {
    super('Flight');
  }

  create({ state }) {
    this.state = state;
    this.fin = state.finalDistanceKm; // 飛行開始時に確定済み
    this.god = state.godPunch;
    this.t = 0;
    this.landed = false;
    this.done = false;
    this.lastTick = 0;
    fadeIn(this, 80);
    windStart();

    this.bg = this.add.rectangle(W / 2, H / 2, W, H, bgColor(0));

    // 星
    this.stars = [];
    for (let i = 0; i < 130; i++) {
      const s = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'dot').setAlpha(0);
      s.base = Phaser.Math.FloatBetween(0.4, 1);
      if (i % 2 === 0) s.setTint(RAINBOW[i % RAINBOW.length]);
      s.setScale(Phaser.Math.FloatBetween(0.4, 1.2));
      this.stars.push(s);
    }
    this.deep = this.add.image(W / 2, H / 2, 'nebula').setScale(3).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    // 虹のオーロラ
    this.aurora = this.add.tileSprite(W / 2, H / 2, W, H, 'rainbowBand').setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setTileScale(W / 64, 1.2);
    this.rainbowGain = settings.reduceFlash ? 0.45 : 1;

    // 地上
    this.ground = this.add.container(0, 0);
    this.ground.add(this.add.rectangle(W / 2, H - 60, W, 120, 0x1a2a1a));
    this.ground.add(this.add.image(W / 2, H - 110, 'city').setOrigin(0.5, 1));
    this.crater = this.add.image(W / 2, H - 120, 'boom').setScale(0.6).setAlpha(0.9);
    this.ground.add(this.crater);

    // 雲
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = this.add.image(Phaser.Math.Between(60, W - 60), -200, 'cloud').setScale(Phaser.Math.FloatBetween(1, 2)).setAlpha(0.9);
      c.at = 0.9 + i * 0.4;
      this.clouds.push(c);
    }
    this.earth = this.add.image(W / 2, H + 2000, 'earth').setScale(4.5).setVisible(false);
    // 雲を抜けると虹のアーチをくぐる
    this.arc = this.add.image(W / 2, -300, 'rainbowArc').setScale(1.3).setAlpha(0.9);

    // 通過ポイント
    const reached = reachedLandmarks(this.fin);
    this.marks = reached.map((lm, i) => ({ lm, tc: crossTime(lm.km, this.fin), side: i % 2 ? 1 : -1, obj: null, passed: false }));
    this.marks.forEach((m, i) => {
      const prev = this.marks[i - 1]?.tc ?? m.tc - 1;
      const next = this.marks[i + 1]?.tc ?? m.tc + 1;
      m.win = Phaser.Math.Clamp(Math.min(m.tc - prev, next - m.tc) * 1.6, 0.3, 0.7);
    });

    // アイツの後ろに伸びる虹の帯
    this.ribbon = this.add.graphics();
    this.hist = [];
    // アイツ
    this.trail = this.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 180 },
      angle: { min: 80, max: 100 },
      scale: { start: 1.1, end: 0 },
      lifespan: 600,
      frequency: 16,
      tint: RAINBOW,
      blendMode: 'ADD',
    });
    // 全身をくるくる回しながら飛ばす（回転の中心は体の真ん中）
    this.face = addChar(this, state.characterId, { box: { x: W / 2, y: CHAR_Y, w: 260, h: 300 } });
    this.face.setOrigin(0.5).setPosition(W / 2, CHAR_Y);
    this.baseS = this.face.base.s;
    this.trail.startFollow(this.face, 0, 60);

    // 表示
    this.counterText = txt(this, 0, 0, '0 km', 76, { title: true, color: '#ffffff', stroke: '#1b1300', strokeThickness: 12 });
    this.counter = this.add.container(W / 2, 110, [this.counterText]).setDepth(50);
    this.lyText = txt(this, W / 2, 185, '', 28, { color: '#ffffff', stroke: '#000000', strokeThickness: 6 }).setDepth(50);
    this.banner = null;
    this.skipText = txt(this, W / 2, H - 60, 'タップで演出スキップ', 26, { color: '#ffffff' }).setAlpha(0.7).setDepth(50);

    // 吹っ飛び開始の衝撃
    flash(this, 160, 0xffffff, 0.6);
    shake(this, 300, 0.02);
    shockwave(this, W / 2, H - 140, { color: 0xffd23f, scale: 6 });

    this.input.on('pointerdown', () => this.skip());
    this.input.keyboard?.on('keydown-SPACE', () => this.skip());
    if (DEBUG.fast) this.time.delayedCall(300, () => this.skip());
  }

  skip() {
    // スキップしても飛距離は不変（表示を最終状態に飛ばすだけ）
    if (this.t < 7 && !this.landed) {
      this.t = 7;
      this.marks.forEach((m) => {
        m.passed = true;
        m.obj?.destroy();
        m.obj = null;
      });
      this.banner?.destroy();
      this.banner = null;
    }
  }

  update(_, deltaMs) {
    if (this.done) return;
    const dt = Math.min(0.1, deltaMs / 1000);
    const prevL = flightLogKm(this.t, this.fin);
    this.t = Math.min(DURATION, this.t + dt);
    const t = this.t;
    const L = flightLogKm(t, this.fin);
    const dL = Math.max(0, (L - prevL) / dt);
    this.bg.setFillStyle(bgColor(L));

    // 距離表示
    const km = flightKm(t, this.fin);
    this.setCounter(km);
    this.lyText.setText(formatLightYears(km) || '');
    if (t > 0.5 && t < 7 && t - this.lastTick > 0.07) {
      this.lastTick = t;
      sfx.tick(Math.min(1, L / 18));
    }

    // 地上と雲
    const rise = t <= 0.5 ? 0 : Math.min(1600, ((t - 0.5) / 1.5) ** 2 * 1600);
    this.ground.y = rise;
    this.crater.setAlpha(Math.max(0, 0.9 - t));
    for (const c of this.clouds) {
      if (t >= c.at && t < c.at + 1.4) c.y = -200 + ((t - c.at) / 0.9) * (H + 400);
      else if (t >= c.at + 1.4) c.setVisible(false);
    }
    // 地球が遠ざかる
    if (t > 1.8 && t < 5) {
      // 大気圏を抜けると足元に地球が現れ、どんどん小さく遠ざかる
      let sc, cy;
      if (t < 2.6) {
        sc = 4.5;
        cy = 1280 - ((t - 1.8) / 0.8) * 400 + 256 * sc;
      } else {
        const u = (t - 2.6) / 2.4;
        sc = 4.5 - 3.3 * (1 - (1 - u) * (1 - u));
        cy = 880 + 256 * 4.5 + (H + 400 - (880 + 256 * 4.5)) * u;
      }
      this.earth.setVisible(true).setScale(sc).setY(cy);
    } else this.earth.setVisible(false);

    // 星（速度に応じて流れる）
    const spaceA = Phaser.Math.Clamp(L - 1.4, 0, 1);
    const speed = t < 2 ? 300 : 200 + 1600 * Math.min(1, dL / 4);
    const stretch = 1 + Math.min(14, speed / 140);
    for (const s of this.stars) {
      s.y += speed * dt * s.base;
      if (s.y > H + 20) {
        s.y = -20;
        s.x = Phaser.Math.Between(0, W);
      }
      s.setAlpha(spaceA * s.base).setScale(s.scaleX, s.scaleX * (this.landed ? 1 : stretch));
    }
    this.deep.setAlpha(Phaser.Math.Clamp((L - 11) / 6, 0, 0.6)).setAngle(t * 4);

    windSet(this.landed ? 0 : Math.min(1, (t < 2 ? 0.5 : 0.3) + dL / 5));

    // アイツ
    if (!this.landed) {
      this.face.angle += dt * (500 + dL * 200);
      this.face.x = W / 2 + Math.sin(t * 6) * 16;
    }

    this.updateMarks(t);
    this.updateRainbow(t, dt, speed, L, dL);

    if (t >= 7 && !this.landed) this.land();
    if (t >= DURATION && !this.done) {
      this.done = true;
      windStop();
      go(this, 'Result', { state: this.state }, 120);
    }
  }

  updateMarks(t) {
    for (const m of this.marks) {
      if (m.passed && !m.obj) continue;
      const rel = (t - m.tc) / m.win; // -1 で画面上端、0 でアイツの横、+1 で下へ抜ける
      if (!m.obj && rel > -1 && rel < 1.2 && !m.passed) m.obj = this.makeMark(m);
      if (m.obj) {
        m.obj.y = CHAR_Y + rel * 900;
        if (rel > 1.3) {
          m.obj.destroy();
          m.obj = null;
          m.passed = true;
        }
      }
      if (!m.bannered && t >= m.tc && t < 7) {
        m.bannered = true;
        this.showBanner(m.lm.pass);
      }
    }
  }

  makeMark(m) {
    const { kind } = m.lm;
    if (kind === 'line') {
      const c = this.add.container(W / 2, -100);
      c.add(this.add.rectangle(0, 0, W, 8, 0x7ee8ff, 0.9));
      c.add(this.add.image(0, 0, 'streak').setAngle(90).setScale(3, 3).setTint(0x7ee8ff).setBlendMode(Phaser.BlendModes.ADD));
      c.add(txt(this, W - 20, -30, m.lm.name, 24, { color: '#7ee8ff', origin: [1, 0.5] }).setX(W / 2 - 20));
      return c;
    }
    const [key, scale, tint] = SPRITES[kind] || ['bigstar', 1];
    const big = scale > 2;
    const img = this.add.image(W / 2 + m.side * (big ? 260 : 200), -200, key).setScale(scale);
    if (tint) img.setTint(tint);
    if (['sun', 'bigstar', 'nebula', 'galaxy'].includes(key)) img.setBlendMode(Phaser.BlendModes.ADD);
    this.children.moveBelow(img, this.face);
    return img;
  }

  updateRainbow(t, dt, speed, L, dL) {
    const g = this.rainbowGain;
    const cyc = t * (settings.reduceFlash ? 0.15 : 0.5);
    // 距離表示を虹色に
    this.counterText.setTint(hue(cyc), hue(cyc + 0.15), hue(cyc + 0.3), hue(cyc + 0.45));
    // 虹のアーチ（1.6〜3秒で通過）
    if (t > 1.6 && t < 3.2) this.arc.y = -300 + ((t - 1.6) / 1.4) * (H + 600);
    else this.arc.setVisible(t <= 1.6);
    // オーロラ：宇宙に出て速いほど濃く
    const a = this.landed ? 0.06 : Phaser.Math.Clamp((L - 1.6) * 0.1, 0, 0.12) + Math.min(0.14, dL * 0.03);
    this.aurora.setAlpha(a * g);
    this.aurora.tilePositionY -= speed * dt * 0.15;
    // 虹の帯
    if (!this.landed) this.hist.unshift({ x: this.face.x, y: this.face.y });
    const fall = this.landed ? 0 : Math.min(900, speed * 0.6) * dt;
    for (const p of this.hist) p.y += fall;
    while (this.hist.length > 28 || (this.hist.length && this.hist[this.hist.length - 1].y > H + 60)) this.hist.pop();
    if (this.landed) this.hist.length = Math.max(0, this.hist.length - 2);
    const r = this.ribbon.clear();
    if (this.hist.length < 2) return;
    const bw = 11;
    RAINBOW.forEach((col, i) => {
      const off = (i - 3) * bw;
      for (let j = 0; j < this.hist.length - 1; j++) {
        const p0 = this.hist[j];
        const p1 = this.hist[j + 1];
        const w0 = Math.sin(t * 14 - j * 0.45) * 10;
        const w1 = Math.sin(t * 14 - (j + 1) * 0.45) * 10;
        r.lineStyle(bw + 1, col, (1 - j / this.hist.length) * 0.95);
        r.lineBetween(p0.x + off + w0, p0.y + 30, p1.x + off + w1, p1.y + 30);
      }
    });
    // 最高速の瞬間に「RAINBOW RUSH!!」
    if (!this.rushShown && t > 4.25 && t < 6.5) {
      this.rushShown = true;
      const rt = popText(this, W / 2, 470, 'RAINBOW RUSH!!', 80, { color: '#ffffff', stroke: '#1b1300', strokeThickness: 14, hold: 700, depth: 70 });
      rt.setTint(RAINBOW[0], RAINBOW[2], RAINBOW[4], RAINBOW[6]).setAngle(-6);
      this.rainbowRings(this.face.x, this.face.y);
      sfx.combo(5);
    }
  }

  rainbowRings(x, y) {
    const n = settings.reduceFlash ? 3 : RAINBOW.length;
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 45, () => shockwave(this, x, y, { color: RAINBOW[(i * 7) / n | 0], scale: 4 + i * 0.5, duration: 520, depth: 40 }));
    }
  }

  setCounter(km) {
    const t = this.counterText.setText(formatKm(km));
    t.setScale(1);
    if (t.width > W - 40) t.setScale((W - 40) / t.width);
  }

  showBanner(msg) {
    sfx.pass();
    shake(this, 90, 0.004);
    this.banner?.destroy();
    this.passCount = (this.passCount || 0) + 1;
    const bg = '#' + RAINBOW[this.passCount % RAINBOW.length].toString(16).padStart(6, '0');
    const b = txt(this, -400, 300, msg, 38, { title: true, color: '#ffffff', stroke: '#1b1300', strokeThickness: 8, backgroundColor: bg, padding: { x: 22, y: 12 } }).setDepth(60).setAngle(-3);
    this.rainbowRings(this.face.x, this.face.y);
    this.banner = b;
    this.tweens.add({ targets: b, x: W / 2, duration: 160, ease: 'Back.Out' });
    this.tweens.add({ targets: b, alpha: 0, delay: 650, duration: 200, onComplete: () => b.destroy() });
    this.tweens.add({ targets: this.counter, scale: { from: 1.25, to: 1 }, duration: 180 });
  }

  land() {
    this.landed = true;
    this.skipText.setVisible(false);
    this.trail.stop();
    sfx.land();
    flash(this, 140, 0xffd23f, 0.4);
    shake(this, 250, 0.015);
    this.setCounter(this.fin);
    this.lyText.setText(formatLightYears(this.fin) || '');
    this.tweens.add({ targets: this.counter, scale: { from: 1.7, to: 1 }, duration: 350, ease: 'Back.Out' });
    this.tweens.add({ targets: this.face, angle: 0, scaleX: this.baseS * 1.3, scaleY: this.baseS * 0.8, duration: 120, yoyo: true, ease: 'Quad.Out' });
    this.tweens.add({ targets: this.face, x: W / 2, duration: 200 });
    burst(this, W / 2, CHAR_Y, { count: 40, tint: [0xffd23f, 0xffffff], speed: [200, 700], life: 700 });
    // ピヨピヨ
    const stars = [0, 1, 2].map(() => this.add.image(0, 0, 'star').setScale(0.5).setTint(0xffd23f));
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1000,
      repeat: -1,
      onUpdate: (tw) => {
        stars.forEach((s, i) => {
          const a = tw.getValue() * Math.PI * 2 + (i * Math.PI * 2) / 3;
          s.setPosition(this.face.x + Math.cos(a) * 110, this.face.y - this.face.displayHeight * 0.5 + Math.sin(a) * 30);
        });
      },
    });
    const reached = reachedLandmarks(this.fin);
    const last = reached[reached.length - 1];
    const msg = this.god ? '銀河の向こうまでぶっ飛んだ!!' : last ? `${last.name}の向こうまでぶっ飛んだ！` : 'ぶっ飛んだ！';
    popText(this, W / 2, 900, msg, this.god ? 50 : 44, { color: this.god ? '#ffd23f' : '#ffffff', stroke: '#000000', strokeThickness: 10, hold: 1200, from: 1.8 });
  }
}
