import Phaser from 'phaser';
import { W, H, C, txt, go, fadeIn, burst, shake, flash, popText, shockwave } from '../ui.js';
import { addChar } from '../characters.js';
import { sfx, bgmStop } from '../audio/sfx.js';
import { formatPower } from '../core/format.js';
import { DEBUG } from '../debug.js';

/** フィニッシュパンチ（約2秒）：チャージ→超スロー→衝撃波→飛行開始 */
export default class PunchScene extends Phaser.Scene {
  constructor() {
    super('Punch');
  }

  create({ state }) {
    this.state = state;
    fadeIn(this, 80);
    bgmStop();
    const god = state.godPunch;
    const k = DEBUG.fast ? 0.35 : 1;

    // 背景：赤い放射
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x3a0610, 0x3a0610, 0x0b0410, 0x0b0410, 1).fillRect(0, 0, W, H);
    const rays = this.add.graphics().setPosition(W / 2, 520);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      rays.fillStyle(god ? 0xffd23f : 0xff3b3b, 0.12).fillTriangle(0, 0, Math.cos(a) * 1500, Math.sin(a) * 1500, Math.cos(a + 0.12) * 1500, Math.sin(a + 0.12) * 1500);
    }
    this.tweens.add({ targets: rays, angle: 30, duration: 2000 });

    // 上半身アップ（顔を画面中央に）
    const face = addChar(this, state.characterId, { face: { x: W / 2, y: 480, size: 250 } });
    this.base = face.base;
    this.tweens.add({ targets: face, x: W / 2 + 6, duration: 40, yoyo: true, repeat: -1 });

    const powerText = txt(this, W / 2, 150, `${formatPower(state.power)} POWER`, 72, { title: true, color: '#ffd23f', stroke: '#5a0000', strokeThickness: 14 });
    this.tweens.add({ targets: powerText, scale: { from: 1.6, to: 1 }, duration: 250, ease: 'Back.Out' });

    // 拳（下から）
    const glove = this.add.image(W / 2 + 60, 1180, 'glove').setScale(1.2).setAngle(-15);
    const chargeFx = this.add.particles(0, 0, 'spark', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 260), quantity: 24 },
      speed: 0,
      moveToX: 0,
      moveToY: 0,
      lifespan: 350,
      frequency: 15,
      scale: { start: 0.2, end: 0.8 },
      tint: god ? [0xffd23f, 0xffffff] : [0xff7a1a, 0xffd23f],
      blendMode: 'ADD',
    });
    chargeFx.startFollow(glove);

    // 1) チャージ 0〜0.7秒
    const charge = popText(this, W / 2, 820, 'CHARGE!!', 96, { color: '#ffd23f', stroke: '#c1121f', strokeThickness: 14, hold: 450 * k });
    charge.setAngle(-8);
    sfx.charge(0.7 * k);
    this.tweens.add({ targets: glove, y: 1250, scale: 1.5, duration: 700 * k, ease: 'Quad.In' });
    this.tweens.add({ targets: glove, angle: { from: -18, to: -12 }, duration: 50, yoyo: true, repeat: 14 * k });
    const shaker = this.time.addEvent({ delay: 60, repeat: 10, callback: () => shake(this, 60, 0.004) });

    // 2) 超スロー 0.7〜1.3秒
    this.time.delayedCall(700 * k, () => {
      shaker.remove();
      sfx.slowmo(0.6 * k);
      chargeFx.stop();
      const dark = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(5);
      this.tweens.add({ targets: dark, alpha: 0.45, duration: 200 });
      this.cameras.main.zoomTo(1.18, 600 * k, 'Sine.easeInOut');
      const slow = txt(this, W / 2, 860, god ? '神の一撃…!!' : '最強の一撃…！', 64, { title: true, color: '#ffffff', stroke: '#000000', strokeThickness: 10 }).setDepth(9).setAlpha(0);
      this.tweens.add({ targets: slow, alpha: 1, duration: 150 });
      glove.setDepth(7);
      face.setDepth(6);
      this.tweens.add({
        targets: glove,
        x: W / 2 + 110,
        y: 720,
        scale: 1.5,
        angle: -28,
        duration: 600 * k,
        ease: 'Expo.In',
        onComplete: () => {
          dark.destroy();
          slow.destroy();
          this.impact(face, glove, god, k);
        },
      });
    });
  }

  // 3) インパクト
  impact(face, glove, god, k) {
    this.cameras.main.zoomTo(1, 120, 'Linear');
    sfx.impact(god);
    flash(this, 200, god ? 0xfff2a8 : 0xffffff, 1);
    shake(this, 500, god ? 0.04 : 0.025);
    const boom = this.add.image(W / 2, 520, 'boom').setScale(0.3).setDepth(8);
    this.tweens.add({ targets: boom, scale: god ? 2.4 : 1.8, angle: 25, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: boom, alpha: 0, delay: 500 * k, duration: 250 });
    for (let i = 0; i < (god ? 4 : 3); i++) {
      this.time.delayedCall(i * 70, () => shockwave(this, W / 2, 520, { color: god ? [0xffd23f, 0xffffff, 0xff4fa3, 0x4cc9f0][i] : 0xffffff, scale: 9, duration: 600, depth: 9 }));
    }
    burst(this, W / 2, 520, { count: 80, tint: god ? [0xffd23f, 0xffffff, 0xff4fa3, 0x4cc9f0] : [0xffd23f, 0xff7a1a, 0xffffff], speed: [400, 1400], scale: [1.2, 0], life: 900, depth: 10 });
    burst(this, W / 2, 520, { texture: 'shard', count: 30, tint: [0xffffff, 0xffd23f], speed: [500, 1300], gravity: 1200, scale: [1.4, 0.4], life: 1000, depth: 10, blend: 'NORMAL' });
    burst(this, W / 2, 520, { texture: 'star', count: 16, tint: [0xffd23f], speed: [300, 900], scale: [0.8, 0.2], life: 900, depth: 10, blend: 'NORMAL' });

    const label = txt(this, W / 2, 900, god ? 'GOD PUNCH!!' : 'ドゴォォッ!!', god ? 120 : 110, {
      title: true,
      color: god ? '#ffd23f' : '#ffffff',
      stroke: god ? '#b34700' : '#c1121f',
      strokeThickness: 18,
      shadow: true,
    })
      .setDepth(14)
      .setAngle(-10);
    const fitScale = Math.min(1, (W - 60) / label.width);
    label.setScale(fitScale * 3);
    this.tweens.add({ targets: label, scale: fitScale, duration: 200, ease: 'Back.Out' });

    // ヒットストップ → 顔が潰れて吹っ飛ぶ
    this.tweens.killTweensOf(face);
    const s0 = this.base.s;
    face.setScale(s0 * 1.45, s0 * 0.7).setTint(0xff8888).setDepth(12);
    glove.setDepth(13);
    this.time.delayedCall(150, () => {
      face.clearTint();
      this.tweens.add({ targets: glove, x: W / 2 + 230, y: 380, angle: -40, scale: 1.3, duration: 160, ease: 'Quad.Out' });
      this.tweens.add({ targets: face, x: W / 2 + 120, y: -300, scale: s0 * 0.35, angle: 720, duration: 520 * k, ease: 'Quad.In' });
      sfx.whoosh(0.5);
    });
    this.time.delayedCall(god ? 750 * k : 650 * k, () => go(this, 'Flight', { state: this.state }, 100));
  }
}
