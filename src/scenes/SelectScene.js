import Phaser from 'phaser';
import { W, H, C, txt, button, background, go, fadeIn, burst } from '../ui.js';
import { allCharacters, customCharacters, addChar, thumbKey, lastCharacterId, setLastCharacterId, tauntFor, MAX_CUSTOM, deleteCustomCharacter } from '../characters.js';
import { openPhotoEditor } from '../photo/editor.js';
import { bgmPlay } from '../audio/sfx.js';
import { sfx } from '../audio/sfx.js';

export default class SelectScene extends Phaser.Scene {
  constructor() {
    super('Select');
  }
  create() {
    fadeIn(this);
    bgmPlay('calm');
    background(this);
    txt(this, W / 2, 70, 'ぶん殴る相手を選べ！', 48, { title: true, color: '#ffd23f', stroke: '#7a1010', strokeThickness: 10 });
    txt(this, W / 2, 128, 'プリセット10人 ＋ 写真から作成', 24, { color: '#a9b3d9' });

    this.selected = lastCharacterId() || allCharacters()[0].id;

    // 選択中キャラの大きな表示
    this.bigFace = null;
    this.nameText = txt(this, W / 2 + 70, 245, '', 34, { title: true, origin: [0, 0.5] });
    this.bubble = txt(this, W / 2 + 70, 320, '', 22, { color: '#1b1300', backgroundColor: '#ffffff', origin: [0, 0.5], wrap: 230, align: 'left', padding: { x: 14, y: 10 } });

    this.grid = this.add.container(0, 0);
    this.buildGrid();

    this.add.existing(
      button(this, W / 2, 1060, 600, 80, '＋ 写真から作成', {
        color: C.blue,
        textColor: '#04122a',
        size: 30,
        onClick: () => {
          if (customCharacters().length >= MAX_CUSTOM) {
            this.toast(`写真キャラは${MAX_CUSTOM}人までです（長押しで削除）`);
            return;
          }
          this.input.enabled = false;
          openPhotoEditor(this, (id) => {
            this.input.enabled = true;
            if (id) this.select(id);
            this.buildGrid();
          });
        },
      }),
    );
    button(this, W / 2 + 70, 1180, 460, 100, 'このキャラで遊ぶ', {
      color: C.yellow,
      textColor: '#1b1300',
      size: 38,
      title: true,
      onClick: () => {
        setLastCharacterId(this.selected);
        go(this, 'MiniGame', { characterId: this.selected });
      },
    }).setName('play');
    button(this, 110, 1180, 160, 100, '戻る', { size: 28, onClick: () => go(this, 'Home') });
    this.select(this.selected, false);
  }

  buildGrid() {
    this.grid.removeAll(true);
    this.cards = new Map();
    const chars = allCharacters();
    const cols = 4;
    const size = 150;
    const gap = 16;
    const x0 = W / 2 - ((cols - 1) * (size + gap)) / 2;
    const y0 = 450;
    chars.forEach((ch, i) => {
      const x = x0 + (i % cols) * (size + gap);
      const y = y0 + Math.floor(i / cols) * (size + 10);
      const card = this.add.container(x, y);
      const g = this.add.graphics();
      const img = this.add.image(0, -8, thumbKey(ch.id)).setDisplaySize(124, 124);
      const label = txt(this, 0, 58, ch.custom ? '写真' : `NO.${ch.no}`, 18, { color: '#c8d0f0' });
      card.add([g, img, label]);
      card.setSize(size, size).setInteractive({ useHandCursor: true });
      card.draw = (on) => {
        g.clear();
        g.fillStyle(on ? 0x3a3110 : C.panel, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 18);
        g.lineStyle(on ? 6 : 2, on ? C.yellow : C.line, 1).strokeRoundedRect(-size / 2, -size / 2, size, size, 18);
      };
      card.draw(ch.id === this.selected);
      let pressTimer = null;
      card.on('pointerdown', () => {
        if (ch.custom) {
          pressTimer = this.time.delayedCall(650, () => {
            pressTimer = null;
            this.confirmDelete(ch);
          });
        }
      });
      card.on('pointerup', () => {
        if (ch.custom && !pressTimer) return; // 長押し済み
        pressTimer?.remove();
        pressTimer = null;
        this.select(ch.id);
      });
      card.on('pointerout', () => {
        pressTimer?.remove();
        pressTimer = null;
      });
      card.setName(ch.id);
      this.grid.add(card);
      this.cards.set(ch.id, card);
    });
  }

  select(id, fx = true) {
    this.cards.get(this.selected)?.draw(false);
    this.selected = id;
    const card = this.cards.get(id);
    card?.draw(true);
    const ch = allCharacters().find((c) => c.id === id);
    if (!ch) return;
    this.bigFace?.destroy();
    this.bigFace = addChar(this, id, { box: { x: W / 2 - 160, y: 285, w: 230, h: 270 } });
    this.nameText.setText(ch.name);
    this.bubble.setText('「' + tauntFor(id) + '」');
    if (fx) {
      sfx.jab(0.6);
      const s = this.bigFace.base.s;
      this.tweens.add({ targets: this.bigFace, scale: { from: s * 1.25, to: s }, duration: 260, ease: 'Back.Out' });
      if (card) {
        this.tweens.add({ targets: card, scale: { from: 1.12, to: 1 }, duration: 200, ease: 'Back.Out' });
        burst(this, card.x, card.y, { count: 10, tint: [0xffd23f], speed: [100, 300], life: 400 });
      }
    }
  }

  confirmDelete(ch) {
    const ov = document.getElementById('overlay');
    this.input.enabled = false;
    ov.innerHTML = `<div class="ov-card"><h2>写真キャラを削除</h2><p>「${escapeHtml(ch.name)}」を端末から削除しますか？</p><div class="ov-row"><button class="ov-btn" data-a="no">やめる</button><button class="ov-btn primary" data-a="yes">削除する</button></div></div>`;
    ov.hidden = false;
    ov.onclick = async (e) => {
      const a = e.target?.dataset?.a;
      if (!a) return;
      ov.hidden = true;
      ov.onclick = null;
      ov.innerHTML = '';
      this.input.enabled = true;
      if (a === 'yes') {
        await deleteCustomCharacter(this, ch.id);
        if (this.selected === ch.id) this.selected = allCharacters()[0].id;
        this.buildGrid();
        this.select(this.selected, false);
      }
    };
  }

  toast(msg) {
    const t = txt(this, W / 2, 990, msg, 24, { backgroundColor: '#000000aa', padding: { x: 16, y: 10 } }).setDepth(100);
    this.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 300, onComplete: () => t.destroy() });
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
