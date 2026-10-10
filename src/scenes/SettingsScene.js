import Phaser from 'phaser';
import { W, H, C, txt, button, background, go, fadeIn, panel } from '../ui.js';
import { settings, saveSettings } from '../settings.js';
import { sfx } from '../audio/sfx.js';
import { ranking } from '../ranking/index.js';
import { askNickname } from '../ranking/nickname.js';
import { deleteAllCustomCharacters, customCharacters } from '../characters.js';
import { showPrivacy } from '../photo/privacy.js';

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }
  create(data) {
    this.from = data?.from || 'Home';
    fadeIn(this);
    background(this, { lines: false });
    txt(this, W / 2, 80, '設定', 60, { title: true, color: '#ffd23f' });

    this.toggle(220, '光の点滅を減らす', '画面フラッシュを弱くします', 'reduceFlash');
    this.toggle(350, '画面揺れを減らす', 'カメラの揺れを止めます', 'reduceShake');
    this.volume(480, '効果音', 'sfxVolume');
    this.volume(600, 'BGM', 'bgmVolume');

    let y = 740;
    if (ranking.online) {
      button(this, W / 2, y, 600, 84, 'ランキングの名前を変更', {
        size: 28,
        onClick: async () => {
          this.input.enabled = false;
          await askNickname();
          this.input.enabled = true;
        },
      });
      y += 110;
    }
    const delBtn = button(this, W / 2, y, 600, 84, '写真キャラをすべて削除', {
      size: 28,
      color: 0x6b1a24,
      onClick: () => this.confirmDeleteAll(delBtn),
    });
    y += 110;
    button(this, W / 2, y, 600, 84, 'プライバシーについて', { size: 28, onClick: () => showPrivacy(this) });
    button(this, W / 2, 1190, 400, 90, '戻る', { size: 32, onClick: () => go(this, this.from) });
  }

  toggle(y, label, desc, key) {
    panel(this, W / 2, y, 640, 110);
    txt(this, 70, y - 16, label, 30, { origin: [0, 0.5] });
    txt(this, 70, y + 24, desc, 20, { origin: [0, 0.5], color: '#a9b3d9' });
    const b = button(this, W - 130, y, 150, 64, '', {
      size: 28,
      onClick: () => {
        saveSettings({ [key]: !settings[key] });
        draw();
      },
    });
    const draw = () => {
      b.redraw(settings[key] ? C.green : C.panel2);
      b.label.setText(settings[key] ? 'ON' : 'OFF').setColor(settings[key] ? '#04220f' : '#ffffff');
    };
    draw();
  }

  volume(y, label, key) {
    panel(this, W / 2, y, 640, 100);
    txt(this, 70, y, label, 30, { origin: [0, 0.5] });
    const val = txt(this, W - 220, y, '', 32, { title: true, color: '#ffd23f' });
    const set = (d) => {
      saveSettings({ [key]: Phaser.Math.Clamp(settings[key] + d, 0, 10) });
      val.setText(String(settings[key]));
      sfx.tap();
    };
    button(this, W - 320, y, 70, 64, '－', { size: 32, onClick: () => set(-1), sound: false });
    button(this, W - 110, y, 70, 64, '＋', { size: 32, onClick: () => set(1), sound: false });
    val.setText(String(settings[key]));
  }

  confirmDeleteAll(btn) {
    if (!customCharacters().length) {
      btn.label.setText('写真キャラはありません');
      return;
    }
    if (!this._confirm) {
      this._confirm = true;
      btn.label.setText('もう一度押すと削除');
      return;
    }
    this._confirm = false;
    deleteAllCustomCharacters(this).then(() => btn.label.setText('削除しました'));
  }
}
