// PV（宣伝動画）用の演出シーン。?pv のときだけ起動し、ゲームの上に字幕を重ねて場面を進める。
import Phaser from 'phaser';
import { W, H, C, txt, burst, flash } from '../ui.js';
import { sfx } from '../audio/sfx.js';

const RAINBOW = [0xff3b3b, 0xffe53b, 0x3da5ff, 0xc04bff];
export const PV_URL = 'cadmium2525.github.io/punching';

export default class PVScene extends Phaser.Scene {
  constructor() {
    super('PV');
  }

  create() {
    this.t0 = this.time.now;
    this.fired = new Set();
    this.seen = {};
    this.band = this.add.rectangle(W / 2, 1185, W, 190, 0x000000, 0.62).setAlpha(0);
    this.caption = null;
    window.__pvStarted = performance.now();
  }

  /** 画面下の字幕（2行） */
  say(l1, l2, hold = 1600) {
    this.caption?.destroy();
    const c = this.add.container(W / 2, 1185);
    const a = txt(this, 0, -42, l1, 52, { title: true, color: '#ffffff', stroke: '#000000', strokeThickness: 10, fit: W - 40 });
    const b = txt(this, 0, 36, l2, 70, { title: true, color: '#ffd23f', stroke: '#c1121f', strokeThickness: 12, fit: W - 40 });
    c.add([a, b]);
    c.setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: this.band, alpha: 1, duration: 150 });
    this.time.delayedCall(hold, () => {
      if (this.caption !== c) return;
      this.tweens.add({ targets: [c, this.band], alpha: 0, duration: 200 });
    });
    this.caption = c;
  }

  once(key, fn) {
    if (this.fired.has(key)) return;
    this.fired.add(key);
    fn();
  }

  start(key, data) {
    const sm = this.game.scene;
    for (const s of sm.getScenes(true)) if (s.scene.key !== 'PV') sm.stop(s.scene.key);
    sm.start(key, data);
    sm.bringToTop('PV');
  }

  update() {
    const T = (this.time.now - this.t0) / 1000;
    const sm = this.game.scene;
    const active = (k) => sm.isActive(k);
    for (const k of ['MiniGame', 'Punch', 'Flight', 'Result']) if (active(k) && this.seen[k] == null) this.seen[k] = T;
    const since = (k) => (this.seen[k] == null ? -1 : T - this.seen[k]);

    // ホーム
    if (T > 0.35) this.once('c1', () => this.say('ムカつくアイツを', 'ぶっ飛ばせ!!', 1800));
    // キャラ選択（4人を順に見せる）
    if (T > 2.3) this.once('sel', () => this.start('Select'));
    [['preset-02', 2.7], ['preset-03', 3.0], ['preset-04', 3.3], ['preset-01', 3.6]].forEach(([id, t]) => {
      if (T > t) this.once('pick' + id, () => sm.getScene('Select')?.select?.(id));
    });
    if (T > 2.45) this.once('c2', () => this.say('ムカつく4人 ＋ 写真からも作れる', '誰をぶん殴る？', 1500));
    // ミニゲーム
    if (T > 4.1) this.once('mini', () => this.start('MiniGame', { characterId: 'preset-01' }));
    if (since('MiniGame') > 1.0) this.once('c3', () => this.say('10種のミニゲームから5つ', 'パンチ力をためろ!!', 2000));
    if (since('MiniGame') > 6.5) this.once('c4', () => this.say('ど真ん中なら', 'JUST!! 精度ボーナス', 1800));
    // 飛行
    if (since('Flight') > 0.4) this.once('c5', () => this.say('銀河の向こうまで', 'ぶっ飛べ!!!', 2200));
    // エンドカード
    if (since('Result') > 1.6) this.once('end', () => this.endCard());
  }

  endCard() {
    this.caption?.destroy();
    this.band.setAlpha(0);
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x0b1230, 1).setDepth(10).setAlpha(0);
    this.tweens.add({ targets: bg, alpha: 0.93, duration: 250 });
    const boom = this.add.image(W / 2, 420, 'boom').setScale(0.2).setDepth(11).setAlpha(0.95);
    this.tweens.add({ targets: boom, scale: 1.35, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: boom, angle: 30, duration: 4000 });
    const t1 = txt(this, W / 2, 330, 'ぶっ飛ばせ！', 100, { title: true, color: '#ffd23f', stroke: '#c1121f', strokeThickness: 16, shadow: true }).setAngle(-6).setDepth(12);
    const t2 = txt(this, W / 2, 480, 'ムカつくアイツ！', 88, { title: true, color: '#ffffff', stroke: '#c1121f', strokeThickness: 16, shadow: true }).setAngle(-6).setDepth(12);
    [t1, t2].forEach((t, i) => {
      t.setScale(2.5).setAlpha(0);
      this.tweens.add({ targets: t, scale: 1, alpha: 1, delay: 120 + i * 140, duration: 220, ease: 'Back.Out' });
    });
    this.time.delayedCall(150, () => {
      sfx.impact(true);
      flash(this, 150, 0xffffff, 0.5);
      burst(this, W / 2, 420, { count: 60, tint: [0xffd23f, 0xff4fa3, 0x4cc9f0, 0xffffff], speed: [300, 1000], life: 900, depth: 13 });
    });
    const lines = [
      ['無料・登録不要', '#ffffff', 44],
      ['ブラウザですぐ遊べる', '#ffffff', 44],
      ['ランキングで全国のアイツと勝負！', '#7ee8ff', 34],
    ];
    lines.forEach(([s, col, size], i) => {
      const l = txt(this, W / 2, 700 + i * 70, s, size, { title: true, color: col, stroke: '#000000', strokeThickness: 8 }).setDepth(12).setAlpha(0);
      this.tweens.add({ targets: l, alpha: 1, y: l.y - 10, delay: 600 + i * 150, duration: 250 });
    });
    const pill = this.add.rectangle(W / 2, 1010, 640, 96, C.yellow).setDepth(12).setAlpha(0);
    const url = txt(this, W / 2, 1010, PV_URL, 40, { title: true, color: '#1b1300', fit: 600 }).setDepth(13).setAlpha(0);
    const tag = txt(this, W / 2, 1110, '#ぶっ飛ばせムカつくアイツ', 32, { color: '#ffffff' }).setDepth(13).setAlpha(0);
    this.tweens.add({ targets: [pill, url, tag], alpha: 1, delay: 1150, duration: 250 });
    this.tweens.add({ targets: pill, scaleX: 1.04, scaleY: 1.08, yoyo: true, repeat: -1, delay: 1500, duration: 400, ease: 'Sine.InOut' });
    this.time.delayedCall(1150, () => sfx.fanfare(true));
    this.time.delayedCall(4200, () => (window.__pvDone = true));
  }
}
