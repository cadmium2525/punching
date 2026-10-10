import Phaser from 'phaser';
import { W, H, C, txt, button, background, go, fadeIn, burst, shake } from '../ui.js';
import { PRESETS, faceKey, lastCharacterId, setLastCharacterId } from '../characters.js';
import { getRecords } from '../storage/records.js';
import { formatKm } from '../core/format.js';
import { sfx, bgmPlay } from '../audio/sfx.js';

export default class HomeScene extends Phaser.Scene {
  constructor() {
    super('Home');
  }
  create() {
    fadeIn(this);
    bgmPlay('calm');
    background(this, { top: 0x23307a });

    // タイトル周りの爆発と、殴られ続けるアイツ
    const boom = this.add.image(W / 2, 400, 'boom').setScale(1.25).setAlpha(0.9);
    this.tweens.add({ targets: boom, angle: 360, duration: 30000, repeat: -1 });
    const victim = PRESETS[Math.floor(Math.random() * PRESETS.length)];
    const face = this.add.image(W / 2 + 40, 420, faceKey(victim.id)).setScale(0.78);
    const glove = this.add.image(W / 2 - 250, 520, 'glove').setScale(0.95).setAngle(60);

    const t1 = txt(this, W / 2, 170, 'ぶっ飛ばせ！', 92, { title: true, color: '#ffd23f', stroke: '#c1121f', strokeThickness: 16, shadow: true }).setAngle(-6);
    const t2 = txt(this, W / 2 + 10, 660, 'ムカつくアイツ！', 84, { title: true, color: '#ffffff', stroke: '#c1121f', strokeThickness: 16, shadow: true }).setAngle(-6);
    this.tweens.add({ targets: [t1, t2], scale: 1.04, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.InOut' });

    const punchLoop = () => {
      this.tweens.add({
        targets: glove,
        x: W / 2 - 110,
        y: 470,
        duration: 110,
        ease: 'Quad.In',
        onComplete: () => {
          burst(this, W / 2 - 60, 440, { count: 14, tint: [0xffd23f, 0xffffff], speed: [150, 450] });
          this.tweens.add({ targets: face, scaleX: 0.9, scaleY: 0.66, angle: 12, x: W / 2 + 70, duration: 70, yoyo: true });
          this.tweens.add({ targets: glove, x: W / 2 - 250, y: 520, duration: 380, ease: 'Quad.Out' });
        },
      });
    };
    this.time.addEvent({ delay: 1400, loop: true, callback: punchLoop });
    this.time.delayedCall(500, punchLoop);

    txt(this, W / 2, 770, '5回のミニゲームでパンチ力を溜めて\n銀河の向こうまでぶっ飛ばせ！', 28, { color: '#c8d0f0', lineSpacing: 8 });

    const best = getRecords().best;
    if (best) txt(this, W / 2, 860, `自己ベスト  ${formatKm(best.km)}`, 28, { color: '#ffd23f' });

    button(this, W / 2, 970, 560, 120, 'ゲームスタート', {
      color: C.yellow,
      textColor: '#1b1300',
      size: 46,
      title: true,
      onClick: () => {
        const id = lastCharacterId() || PRESETS[Math.floor(Math.random() * PRESETS.length)].id;
        setLastCharacterId(id);
        go(this, 'MiniGame', { characterId: id });
      },
    }).setName('start');
    button(this, W / 2, 1090, 560, 80, 'キャラクター選択', { size: 30, onClick: () => go(this, 'Select') }).setName('select');
    button(this, W / 2 - 142, 1190, 276, 76, 'ランキング', { size: 28, onClick: () => go(this, 'Ranking', { from: 'Home' }) });
    button(this, W / 2 + 142, 1190, 276, 76, '設定', { size: 28, onClick: () => go(this, 'Settings', { from: 'Home' }) });
  }
}
