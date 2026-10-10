import Phaser from 'phaser';
import { W, H, C, txt } from '../ui.js';
import { makeTextures } from '../textures.js';
import { PRESETS, buildFaceTexture, faceKey, loadCustomCharacters } from '../characters.js';
import { ranking } from '../ranking/index.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  preload() {
    const bar = this.add.rectangle(W / 2 - 200, H / 2 + 60, 0, 16, C.yellow).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2 + 60, 404, 20).setStrokeStyle(2, C.line);
    txt(this, W / 2, H / 2, 'ぶっ飛ばす準備中…', 32);
    this.load.on('progress', (p) => (bar.width = 400 * p));
    PRESETS.forEach((c) => this.load.image(`raw-${c.id}`, c.file));
  }
  async create() {
    makeTextures(this);
    PRESETS.forEach((c) => buildFaceTexture(this, faceKey(c.id), this.textures.get(`raw-${c.id}`).getSourceImage()));
    await loadCustomCharacters(this);
    ranking.init().catch((e) => console.warn('ranking init failed', e));
    this.scene.start('Home');
  }
}
