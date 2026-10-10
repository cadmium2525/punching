// ミニゲームの描画（判定は models.js）
import Phaser from 'phaser';
import { C, txt, burst, GRADE_STYLE } from '../ui.js';
import { gradeOf } from '../core/scoring.js';
import { JustBarModel, StopRingModel, GaugeModel, MashModel, StopwatchModel, TargetModel, SpinModel } from './models.js';
import { thumbKey } from '../characters.js';
import { sfx } from '../audio/sfx.js';

export const CX = 360;
export const CY = 885;

class View {
  constructor(scene, model) {
    this.scene = scene;
    this.model = model;
    this.c = scene.add.container(CX, CY);
    this.c.setAlpha(0).setScale(0.9);
    scene.tweens.add({ targets: this.c, alpha: 1, scale: 1, duration: 160, ease: 'Back.Out' });
  }
  add(...objs) {
    this.c.add(objs);
    return objs[0];
  }
  onStart() {}
  render() {}
  onInput() {}
  destroy() {
    const c = this.c;
    this.scene.tweens.add({ targets: c, alpha: 0, duration: 120, onComplete: () => c.destroy() });
  }
}

class JustBarView extends View {
  constructor(scene, model) {
    super(scene, model);
    const half = 300;
    const g = scene.add.graphics();
    const th = JustBarModel.TH;
    g.fillStyle(0x0a0f2a, 1).fillRoundedRect(-half - 10, -50, half * 2 + 20, 100, 24);
    g.fillStyle(0x27346b, 1).fillRoundedRect(-half, -36, half * 2, 72, 18);
    g.fillStyle(0x2f5bb5, 1).fillRect(-half * th.o, -36, half * th.o * 2, 72);
    g.fillStyle(0xffb800, 1).fillRect(-half * th.g, -36, half * th.g * 2, 72);
    g.fillStyle(0x3ddc84, 1).fillRect(-half * th.p, -36, half * th.p * 2, 72);
    this.add(g);
    this.glow = this.add(scene.add.image(0, 0, 'spark').setScale(1.6, 2).setTint(0x3ddc84).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6));
    this.needle = this.add(scene.add.rectangle(-half, 0, 14, 140, 0xffffff).setStrokeStyle(4, 0x111111));
    this.half = half;
    this.add(txt(scene, 0, 100, '▲ まん中でタップ ▲', 26, { color: '#3ddc84' }));
  }
  render(now) {
    if (this.model.t0 == null) return;
    this.needle.x = this.model.pos(now) * this.half;
    this.glow.setAlpha(0.4 + 0.4 * (1 - Math.min(1, Math.abs(this.model.pos(now)) * 3)));
  }
  onInput() {
    this.needle.setFillStyle(0xffd23f);
  }
}

class StopRingView extends View {
  constructor(scene, model) {
    super(scene, model);
    this.R = 120;
    const th = StopRingModel.TH;
    const g = scene.add.graphics();
    g.fillStyle(0x0a0f2a, 0.8).fillCircle(0, 0, this.R * 1.5);
    g.lineStyle(this.R * th.g * 2, 0xffb800, 0.25).strokeCircle(0, 0, this.R);
    g.lineStyle(this.R * th.p * 2, 0xffd23f, 0.6).strokeCircle(0, 0, this.R);
    g.lineStyle(4, 0xffffff, 1).strokeCircle(0, 0, this.R);
    this.add(g);
    this.core = this.add(scene.add.image(0, 0, 'spark').setScale(2.2).setTint(0x4cc9f0).setBlendMode(Phaser.BlendModes.ADD));
    this.ring = this.add(scene.add.graphics());
  }
  render(now) {
    if (this.model.t0 == null) return;
    const s = this.model.size(now);
    this.ring.clear();
    const near = Math.abs(s - 1) < 0.08;
    this.ring.lineStyle(12, near ? 0x3ddc84 : 0x4cc9f0, 1).strokeCircle(0, 0, Math.max(2, this.R * s));
    this.core.setScale(1.6 + Math.sin(now / 80) * 0.15);
  }
}

class MashView extends View {
  constructor(scene, model) {
    super(scene, model);
    this.fist = this.add(scene.add.image(0, -40, 'glove').setScale(0.9));
    this.count = this.add(txt(scene, 0, -40, '0', 120, { title: true, color: '#ffffff', stroke: '#c1121f', strokeThickness: 14 }));
    const w = 560;
    this.w = w;
    const g = scene.add.graphics();
    g.fillStyle(0x0a0f2a, 1).fillRoundedRect(-w / 2 - 6, 116, w + 12, 48, 16);
    this.add(g);
    this.bar = this.add(scene.add.graphics());
    const M = MashModel.MARKS;
    const marks = [
      [M.GOOD, 'GOOD', '#7ee8ff'],
      [M.GREAT, 'GREAT', '#ff9a3c'],
      [M.PERFECT, 'PERFECT', '#ffd23f'],
    ];
    for (const [n, label, col] of marks) {
      const x = -w / 2 + (n / M.MAX) * w;
      this.add(scene.add.rectangle(x, 140, 4, 52, 0xffffff, 0.8));
      this.add(txt(scene, x, 186, `${label}\n${n}回`, 18, { color: col, lineSpacing: -4 }));
    }
  }
  render(now) {
    const c = this.model.count;
    this.bar.clear();
    const M = MashModel.MARKS;
    const col = c >= M.PERFECT ? 0xffd23f : c >= M.GREAT ? 0xff9a3c : c >= M.GOOD ? 0x4cc9f0 : 0x6c7bd1;
    this.bar.fillStyle(col, 1).fillRoundedRect(-this.w / 2, 122, Math.max(12, (Math.min(M.MAX, c) / M.MAX) * this.w), 36, 12);
    this.fist.setAngle(Math.sin(now / 40) * (c > 0 ? 6 : 2));
  }
  onInput(t, counted, pointer) {
    if (!counted) return;
    const c = this.model.count;
    this.count.setText(String(c));
    this.scene.tweens.add({ targets: this.count, scale: { from: 1.4, to: 1 }, duration: 120 });
    this.scene.tweens.add({ targets: this.fist, scale: { from: 1.05 + Math.min(0.5, c * 0.025), to: 0.9 + Math.min(0.4, c * 0.02) }, duration: 120 });
    burst(this.scene, pointer?.x ?? CX, pointer?.y ?? CY, { count: 8, tint: c >= MashModel.MARKS.PERFECT ? [0xffd23f, 0xffffff] : [0xffffff, 0x4cc9f0], speed: [120, 380], life: 350, scale: [0.5, 0] });
    sfx.jab(0.35 + Math.min(0.5, c * 0.03));
    this.scene.smallHit?.(c);
    if (c === MashModel.MARKS.PERFECT) {
      this.scene.flashText?.('PERFECTライン突破！', '#ffd23f');
    }
  }
}

class GaugeView extends View {
  constructor(scene, model) {
    super(scene, model);
    this.h = 320;
    const g = scene.add.graphics();
    g.fillStyle(0x0a0f2a, 1).fillRoundedRect(-70, -this.h / 2 - 12, 140, this.h + 24, 22);
    g.fillStyle(0x27346b, 1).fillRoundedRect(-56, -this.h / 2, 112, this.h, 14);
    const th = GaugeModel.TH;
    g.fillStyle(0xffd23f, 0.35).fillRect(-56, -this.h / 2, 112, this.h * th.p);
    g.lineStyle(4, 0xffd23f, 1).strokeRect(-60, -this.h / 2 - 2, 120, this.h * th.p + 4);
    this.add(g);
    this.fill = this.add(scene.add.graphics());
    this.add(txt(scene, 120, -this.h / 2 + 4, 'MAX!', 34, { title: true, color: '#ffd23f', origin: [0, 0.5] }));
    this.arrow = this.add(txt(scene, -110, 0, '▶', 40, { color: '#ffffff' }));
  }
  render(now) {
    if (this.model.t0 == null) return;
    const v = this.model.value(now);
    const hh = v * this.h;
    const col = v > 0.95 ? 0xffd23f : v > 0.85 ? 0xff7a1a : v > 0.65 ? 0xe63946 : 0x3ddc84;
    this.fill.clear();
    this.fill.fillStyle(col, 1).fillRoundedRect(-50, this.h / 2 - hh, 100, Math.max(8, hh), 10);
    this.arrow.y = this.h / 2 - hh;
  }
}

class ReactionView extends View {
  constructor(scene, model) {
    super(scene, model);
    this.bg = this.add(scene.add.rectangle(0, 0, 600, 320, 0x10183d).setStrokeStyle(4, C.line));
    this.label = this.add(txt(scene, 0, 0, 'まだだ…', 64, { title: true, color: '#6c7bd1' }));
    this.shown = false;
  }
  render(now) {
    if (this.model.t0 == null || this.model.done) return;
    if (!this.shown && this.model.isNow(now)) {
      this.shown = true;
      this.bg.setFillStyle(0xe63946).setStrokeStyle(8, 0xffd23f);
      this.label.setText('NOW!').setFontSize(170).setColor('#ffd23f').setStroke('#5a0000', 18);
      this.scene.tweens.add({ targets: this.label, scale: { from: 1.8, to: 1 }, duration: 120 });
      sfx.now();
    } else if (!this.shown) {
      const dots = '.'.repeat(1 + (Math.floor(now / 250) % 3));
      this.label.setText('まだだ' + dots);
    }
  }
  onInput() {
    if (this.model.raw?.early) {
      this.label.setText('早すぎ！').setColor('#ff8a8a');
      sfx.early();
    }
  }
}

class TripleView extends View {
  constructor(scene, model) {
    super(scene, model);
    this.xs = [-210, 0, 210];
    this.R = 70;
    const cols = [0x4cc9f0, 0x3da5ff, 0xff4fa3];
    this.base = this.xs.map((x, i) => {
      const g = scene.add.graphics();
      g.fillStyle(0x0a0f2a, 1).fillCircle(x, 0, this.R + 8);
      g.fillStyle(cols[i], 1).fillCircle(x, 0, this.R);
      g.lineStyle(5, 0xffffff, 1).strokeCircle(x, 0, this.R);
      this.add(g);
      this.add(txt(scene, x, 0, String(i + 1), 64, { title: true, color: '#ffffff', stroke: '#0a0f2a', strokeThickness: 8 }));
      return g;
    });
    this.rings = this.add(scene.add.graphics());
    this.labels = [];
  }
  render(now) {
    if (this.model.t0 == null) return;
    const e = this.model.elapsed(now);
    this.rings.clear();
    this.model.targets.forEach((tg, i) => {
      if (this.model.scores[i] !== null) {
        if (!this.labels[i]) this.judged(i);
        return;
      }
      const d = tg - e;
      if (d > 800 || d < -200) return;
      const r = this.R * (1 + Math.max(0, d) / 400);
      this.rings.lineStyle(8, Math.abs(d) < 60 ? 0x3ddc84 : 0xffffff, Math.min(1, (800 - d) / 300)).strokeCircle(this.xs[i], 0, r);
    });
  }
  judged(i) {
    const g = gradeOf(this.model.scores[i]);
    const st = GRADE_STYLE[g];
    const l = txt(this.scene, this.xs[i], -120, g, 30, { title: true, color: st.color, stroke: st.stroke, strokeThickness: 6 });
    this.add(l);
    this.labels[i] = l;
    this.scene.tweens.add({ targets: l, scale: { from: 1.6, to: 1 }, duration: 150 });
    if (g !== 'MISS') {
      burst(this.scene, CX + this.xs[i], CY, { count: 10, tint: [st.tint, 0xffffff], speed: [100, 300], life: 350 });
      sfx.jab(g === 'PERFECT' ? 0.9 : 0.6);
    }
  }
}

class StopwatchView extends View {
  constructor(scene, model) {
    super(scene, model);
    this.add(scene.add.rectangle(0, 0, 560, 300, 0x10183d).setStrokeStyle(4, C.line));
    this.add(txt(scene, 0, -100, '目標 1.00 秒', 30, { color: '#ffd23f' }));
    this.num = this.add(txt(scene, 0, 10, '0.00', 140, { title: true, color: '#ffffff', stroke: '#0a0f2a', strokeThickness: 12 }));
    this.add(txt(scene, 0, 115, '数字が消えても数え続けろ！', 24, { color: '#a9b3d9' }));
  }
  render(now) {
    if (this.model.t0 == null || this.model.done) return;
    const e = this.model.elapsed(now);
    if (e < this.model.hideAt) this.num.setText((e / 1000).toFixed(2));
    else if (this.num.text !== '?.??') {
      this.num.setText('?.??').setColor('#6c7bd1');
      this.scene.tweens.add({ targets: this.num, scale: { from: 1.3, to: 1 }, duration: 150 });
    }
  }
  onInput() {
    const ms = this.model.raw?.ms;
    if (ms == null) return;
    const diff = ms - StopwatchModel.TARGET;
    this.num.setText((ms / 1000).toFixed(2)).setColor(Math.abs(diff) <= StopwatchModel.TH.p ? '#ffd23f' : '#ffffff');
    this.add(txt(this.scene, 0, 115, `${diff >= 0 ? '+' : ''}${diff}ms`, 30, { color: '#7ee8ff', backgroundColor: '#10183d' }));
  }
}

class RhythmView extends View {
  constructor(scene, model) {
    super(scene, model);
    this.xs = [-250, -150, -50, 50, 150, 250];
    this.dots = this.xs.map((x, i) => {
      const guide = i < 3;
      const d = this.add(scene.add.circle(x, 0, 38, guide ? 0x1d4f7a : 0x10183d).setStrokeStyle(5, guide ? 0x4cc9f0 : 0xffd23f));
      this.add(txt(scene, x, 0, guide ? '♪' : 'TAP', guide ? 34 : 20, { title: true, color: guide ? '#7ee8ff' : '#ffd23f' }));
      return d;
    });
    this.add(txt(scene, -150, 80, 'お手本', 24, { color: '#7ee8ff' }));
    this.add(txt(scene, 150, 80, 'キミの番！', 24, { color: '#ffd23f' }));
    this.pulse = this.add(scene.add.circle(0, -120, 30, 0xffffff, 0.15));
    this.played = 0;
    this.labels = [];
  }
  render(now) {
    if (this.model.t0 == null) return;
    const e = this.model.elapsed(now);
    const g = this.model.guides;
    while (this.played < g.length && e >= g[this.played]) {
      const d = this.dots[this.played];
      d.setFillStyle(0x4cc9f0);
      this.scene.tweens.add({ targets: d, scale: { from: 1.4, to: 1 }, duration: 150 });
      sfx.beat();
      this.played++;
    }
    const ph = (e % this.model.iv) / this.model.iv;
    this.pulse.setScale(1 + (1 - ph) * 0.8).setAlpha(0.1 + (1 - ph) * 0.25);
    this.model.scores.forEach((sc, i) => {
      if (sc === null || this.labels[i]) return;
      const gr = gradeOf(sc);
      const st = GRADE_STYLE[gr];
      const x = this.xs[i + 3];
      this.dots[i + 3].setFillStyle(gr === 'MISS' ? 0x333a5c : st.tint);
      const l = txt(this.scene, x, -70, gr, 24, { title: true, color: st.color, stroke: st.stroke, strokeThickness: 5 });
      this.add(l);
      this.labels[i] = l;
      this.scene.tweens.add({ targets: l, scale: { from: 1.6, to: 1 }, duration: 150 });
      if (gr !== 'MISS') burst(this.scene, CX + x, CY, { count: 10, tint: [st.tint, 0xffffff], speed: [100, 300], life: 350 });
    });
  }
}

class TargetView extends View {
  constructor(scene, model) {
    super(scene, model);
    this.add(scene.add.rectangle(0, 0, 640, 360, 0x10183d, 0.6).setStrokeStyle(3, C.line));
    const R = TargetModel.R;
    this.face = this.add(scene.add.image(0, 0, thumbKey(scene.state.characterId)).setDisplaySize(R * 2, R * 2));
    const g = scene.add.graphics();
    g.lineStyle(4, 0xe63946, 1).strokeCircle(0, 0, R).strokeCircle(0, 0, R * TargetModel.TH.g);
    g.lineStyle(3, 0xffd23f, 1).strokeCircle(0, 0, R * TargetModel.TH.p);
    g.lineBetween(-R - 14, 0, -R + 18, 0).lineBetween(R - 18, 0, R + 14, 0).lineBetween(0, -R - 14, 0, -R + 18).lineBetween(0, R - 18, 0, R + 14);
    this.reticle = this.add(g);
  }
  render(now) {
    if (this.model.t0 == null || this.model.done) return;
    const p = this.model.pos(now);
    this.face.setPosition(p.x, p.y).setAngle(Math.sin(now / 90) * 10);
    this.reticle.setPosition(p.x, p.y);
  }
  onInput() {
    const r = this.model.raw;
    if (!r) return;
    const mark = this.add(txt(this.scene, r.x, r.y, '✕', 44, { title: true, color: '#ffd23f', stroke: '#000000', strokeThickness: 6 }));
    this.scene.tweens.add({ targets: mark, scale: { from: 2, to: 1 }, duration: 150 });
    burst(this.scene, CX + r.x, CY + r.y, { count: 16, tint: [0xffd23f, 0xffffff], speed: [150, 450], life: 400 });
  }
}

class SpinView extends View {
  constructor(scene, model) {
    super(scene, model);
    const R = 170;
    const g = scene.add.graphics();
    g.fillStyle(0x0a0f2a, 1).fillCircle(0, 0, R + 14);
    for (let i = 0; i < 12; i++) {
      g.fillStyle(i % 2 ? 0x27346b : 0x1d2756, 1).slice(0, 0, R, (i / 12) * Math.PI * 2 - Math.PI / 2, ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2).fillPath();
    }
    const a = model.goal - Math.PI / 2;
    const th = SpinModel.TH;
    g.fillStyle(0xff7a1a, 0.9).slice(0, 0, R, a - th.g * Math.PI, a + th.g * Math.PI).fillPath();
    g.fillStyle(0xffd23f, 1).slice(0, 0, R, a - th.p * Math.PI, a + th.p * Math.PI).fillPath();
    g.lineStyle(5, 0xffffff, 1).strokeCircle(0, 0, R);
    this.add(g);
    this.needle = this.add(scene.add.rectangle(0, 0, 10, R - 10, 0xffffff).setOrigin(0.5, 1).setStrokeStyle(3, 0x111111));
    this.add(scene.add.circle(0, 0, 18, 0xe63946).setStrokeStyle(4, 0xffffff));
  }
  render(now) {
    if (this.model.t0 == null || this.model.done) return;
    this.needle.setRotation(this.model.angle(now));
  }
  onInput() {
    this.needle.setFillStyle(0xffd23f);
  }
}

export function createView(id, scene, model) {
  const V = { justbar: JustBarView, stopring: StopRingView, mash: MashView, gauge: GaugeView, reaction: ReactionView, triple: TripleView, stopwatch: StopwatchView, rhythm: RhythmView, target: TargetView, spin: SpinView }[id];
  return new V(scene, model);
}
