import Phaser from 'phaser';
import { W, H, C, txt, button, background, go, fadeIn, panel } from '../ui.js';
import { faceKey } from '../characters.js';
import { ranking } from '../ranking/index.js';
import { formatKm } from '../core/format.js';

export default class RankingScene extends Phaser.Scene {
  constructor() {
    super('Ranking');
  }
  create(data) {
    this.from = data?.from || 'Home';
    this.fromData = data;
    fadeIn(this);
    background(this, { lines: false });
    txt(this, W / 2, 70, 'ランキング', 56, { title: true, color: '#ffd23f', stroke: '#7a1010', strokeThickness: 10 });

    this.kind = 'daily';
    this.list = this.add.container(0, 0);
    if (ranking.online) {
      this.tabs = {
        daily: button(this, W / 2 - 150, 160, 280, 70, '今日', { size: 30, onClick: () => this.show('daily') }),
        alltime: button(this, W / 2 + 150, 160, 280, 70, '歴代', { size: 30, onClick: () => this.show('alltime') }),
      };
      txt(this, W / 2, 1110, '日次ランキングは日本時間0時にリセット', 22, { color: '#a9b3d9' });
    } else {
      txt(this, W / 2, 150, '端末内の記録（自己ベスト TOP10）', 28, { color: '#c8d0f0' });
      txt(this, W / 2, 1100, 'オンラインランキングは未設定です\n（設定方法は README を参照）', 22, { color: '#a9b3d9', lineSpacing: 6 });
    }
    this.mine = txt(this, W / 2, 1050, '', 28, { color: '#ffd23f' });
    button(this, W / 2, 1200, 400, 90, '戻る', { size: 32, onClick: () => go(this, this.from, this.fromData) });
    this.show('daily');
  }

  async show(kind) {
    this.kind = kind;
    if (this.tabs) {
      this.tabs.daily.redraw(kind === 'daily' ? C.blue : C.panel2);
      this.tabs.alltime.redraw(kind === 'alltime' ? C.blue : C.panel2);
    }
    this.list.removeAll(true);
    this.mine.setText('');
    const loading = txt(this, W / 2, 500, '読み込み中…', 30, { color: '#a9b3d9' });
    this.list.add(loading);
    let rows = [];
    let me = null;
    try {
      [rows, me] = await Promise.all([ranking.top(kind, 18), ranking.myRank(kind)]);
    } catch (e) {
      console.warn(e);
      if (this.kind === kind && this.scene.isActive()) loading.setText('読み込めませんでした');
      return;
    }
    if (this.kind !== kind || !this.scene.isActive()) return;
    this.list.removeAll(true);
    if (!rows.length) this.list.add(txt(this, W / 2, 500, 'まだ記録がありません\n一番乗りでぶっ飛ばそう！', 30, { color: '#a9b3d9' }));
    rows.forEach((r, i) => {
      const y = 240 + i * 44;
      const bg = this.add.rectangle(W / 2, y, 640, 40, r.isMe ? 0x4a3a10 : i % 2 ? 0x18214a : 0x1d2756).setStrokeStyle(r.isMe ? 2 : 0, C.yellow);
      const rankCol = i === 0 ? '#ffd23f' : i === 1 ? '#dfe6f5' : i === 2 ? '#e0a46a' : '#ffffff';
      const items = [
        bg,
        txt(this, 70, y, `${i + 1}`, 26, { title: true, color: rankCol }),
        r.characterId?.startsWith('preset-') ? this.add.image(125, y, faceKey(r.characterId)).setScale(0.1) : txt(this, 125, y, '写', 18, { backgroundColor: '#3a4785', padding: { x: 6, y: 4 } }),
        txt(this, 160, y, r.nickname || '???', 24, { origin: [0, 0.5] }),
        txt(this, W - 50, y, formatKm(r.km), 24, { origin: [1, 0.5], color: '#ffd23f', title: true }),
      ];
      this.list.add(items);
    });
    if (me) this.mine.setText(`あなた：${me.rank}位（${formatKm(me.km)}）`);
  }
}
