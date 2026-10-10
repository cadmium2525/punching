import Phaser from 'phaser';
import { W, H, C, txt, button, background, go, fadeIn, burst, popText, shake, panel, flash } from '../ui.js';
import { addChar } from '../characters.js';
import { sfx, bgmPlay } from '../audio/sfx.js';
import { formatKm, formatLightYears, formatPower } from '../core/format.js';
import { titleFor } from '../core/stages.js';
import { addRecord } from '../storage/records.js';
import { ranking } from '../ranking/index.js';
import { askNickname } from '../ranking/nickname.js';

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create({ state }) {
    this.state = state;
    fadeIn(this, 120);
    bgmPlay('calm');
    const { isNew } = addRecord(state);
    window.__pfResult = { power: state.power, km: state.finalDistanceKm, god: state.godPunch, grades: state.grades, accs: state.accs, isNew };
    background(this, { top: state.godPunch ? 0x4a2a00 : isNew ? 0x3a2a70 : 0x1b2660 });

    if (isNew) {
      const nr = popText(this, W / 2, 110, 'NEW RECORD!', 74, { color: '#ffd23f', stroke: '#b34700', strokeThickness: 14, hold: 99999 });
      nr.setAngle(-4);
      this.tweens.add({ targets: nr, scale: 1.06, yoyo: true, repeat: -1, duration: 500, delay: 300 });
      this.time.delayedCall(250, () => {
        sfx.fanfare(true);
        this.confetti();
      });
    } else {
      txt(this, W / 2, 110, 'RESULT', 72, { title: true, color: '#ffffff', stroke: '#0a0f2a', strokeThickness: 12 });
      this.time.delayedCall(250, () => sfx.fanfare(false));
    }

    txt(this, W / 2, 210, '飛距離', 30, { color: '#a9b3d9' });
    const dist = txt(this, W / 2, 290, formatKm(state.finalDistanceKm), 84, { title: true, color: '#ffd23f', stroke: '#1b1300', strokeThickness: 12 });
    if (dist.width > W - 40) dist.setScale((W - 40) / dist.width);
    dist.setScale(dist.scale * 1.6);
    this.tweens.add({ targets: dist, scale: dist.scale / 1.6, duration: 300, ease: 'Back.Out' });
    const ly = formatLightYears(state.finalDistanceKm);
    if (ly) txt(this, W / 2, 360, ly, 28, { color: '#ffffff' });

    const title = titleFor(state.finalDistanceKm, state.godPunch);
    txt(this, W / 2, 425, `称号：${title}`, 32, { color: '#1b1300', backgroundColor: state.godPunch ? '#ffd23f' : '#7ee8ff', padding: { x: 20, y: 8 } });

    const face = addChar(this, state.characterId, { box: { x: W / 2, y: 552, w: 220, h: 160 } }).setAngle(-15);
    this.tweens.add({ targets: face, angle: 15, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.InOut' });
    const st = this.add.image(W / 2 + 70, 480, 'star').setScale(0.5).setTint(0xffd23f);
    this.tweens.add({ targets: st, angle: 360, repeat: -1, duration: 1200 });

    panel(this, W / 2, 768, 620, 274);
    const avg = state.accs.reduce((a, b) => a + b, 0) / state.accs.length / 10;
    const rows = [
      ['パンチパワー', formatPower(state.power)],
      ['PERFECT数', `${state.perfectCount} / 5`],
      ['最大コンボ', `${state.maxPerfectStreak}連続`],
      ['平均精度', `${avg.toFixed(1)}%`],
      ['GOD PUNCH', state.godPunch ? 'はい！' : 'いいえ'],
    ];
    rows.forEach(([k, v], i) => {
      const y = 654 + i * 42;
      txt(this, 80, y, k, 28, { origin: [0, 0.5], color: '#c8d0f0' });
      txt(this, W - 80, y, v, 30, { origin: [1, 0.5], color: '#ffffff', title: true });
    });
    txt(this, 80, 874, 'ランキング', 28, { origin: [0, 0.5], color: '#c8d0f0' });
    this.rankText = txt(this, W - 80, 874, '…', 28, { origin: [1, 0.5], color: '#ffd23f', title: true });

    button(this, W / 2, 985, 600, 110, 'もう一度遊ぶ', {
      color: C.yellow,
      textColor: '#1b1300',
      size: 44,
      title: true,
      onClick: () => go(this, 'MiniGame', { characterId: state.characterId }, 100),
    }).setName('retry');
    button(this, W / 2 - 152, 1105, 296, 84, 'キャラ変更', { size: 28, onClick: () => go(this, 'Select') });
    button(this, W / 2 + 152, 1105, 296, 84, 'ランキング', { size: 28, onClick: () => go(this, 'Ranking', { from: 'Result', state }) });
    button(this, W / 2 - 152, 1205, 296, 84, 'ホーム', { size: 28, onClick: () => go(this, 'Home') });
    button(this, W / 2 + 152, 1205, 296, 84, '結果をシェア', { size: 28, color: 0x1d9bf0, onClick: () => this.share(title) });

    this.submit();
  }

  async submit() {
    if (!ranking.online) {
      this.rankText.setText('端末内の記録のみ');
      return;
    }
    if (!ranking.nickname) {
      this.rankText.setText('');
      const b = button(this, W - 170, 874, 220, 50, '登録する', {
        size: 24,
        color: C.blue,
        textColor: '#04122a',
        onClick: async () => {
          this.input.enabled = false;
          const name = await askNickname();
          this.input.enabled = true;
          if (!name) return;
          b.destroy();
          this.doSubmit();
        },
      });
      return;
    }
    this.doSubmit();
  }

  async doSubmit() {
    this.rankText.setText('送信中…');
    try {
      const r = await ranking.submit(this.state);
      if (!this.scene.isActive()) return;
      this.rankText.setText(r?.dailyRank ? `今日 ${r.dailyRank}位` : '記録済み');
      if (r?.dailyRank && r.dailyRank <= 3) {
        sfx.fanfare(true);
        this.confetti();
      }
    } catch (e) {
      console.warn(e);
      if (this.scene.isActive()) this.rankText.setText(e?.userMessage || '送信できませんでした');
    }
  }

  confetti() {
    const e = this.add.particles(0, -20, 'shard', {
      x: { min: 0, max: W },
      speedY: { min: 200, max: 500 },
      speedX: { min: -80, max: 80 },
      rotate: { min: 0, max: 360 },
      scale: { min: 0.6, max: 1.2 },
      lifespan: 3000,
      quantity: 3,
      frequency: 30,
      tint: [0xffd23f, 0xe63946, 0x4cc9f0, 0x3ddc84, 0xff4fa3],
      gravityY: 150,
    });
    e.setDepth(200);
    this.time.delayedCall(1500, () => e.stop());
  }

  async share(title) {
    const s = this.state;
    const text = `ムカつくアイツを ${formatKm(s.finalDistanceKm)} ぶっ飛ばした！【${title}】\n#ぶっ飛ばせムカつくアイツ`;
    const url = location.href.split('?')[0].split('#')[0];
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
    } catch {
      return;
    }
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  }
}
