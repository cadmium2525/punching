import Phaser from 'phaser';
import { W, H, C, txt, button, background, go, fadeIn, burst, shake, flash, popText, shockwave, eventTime, GRADE_STYLE } from '../ui.js';
import { GameState } from '../core/state.js';
import { createModel, MINIGAME_INFO } from '../minigames/models.js';
import { createView, CX, CY } from '../minigames/views.js';
import { addChar, tauntFor } from '../characters.js';
import { sfx, bgmPlay } from '../audio/sfx.js';
import { getFlag, setFlag } from '../settings.js';
import { formatPower } from '../core/format.js';
import { MAX_POWER } from '../core/scoring.js';
import { DEBUG } from '../debug.js';


export default class MiniGameScene extends Phaser.Scene {
  constructor() {
    super('MiniGame');
  }

  create({ characterId }) {
    fadeIn(this, 100);
    bgmPlay('fight');
    this.state = new GameState(characterId, DEBUG.games ? { miniGames: DEBUG.games } : {});
    this.active = false;
    this.model = null;
    this.view = null;
    this.botFired = 0;
    this._shownPower = 100;

    background(this, { top: 0x1f2a6e });

    // ヘッダー
    this.roundText = txt(this, 40, 56, 'ROUND 1/5', 34, { title: true, origin: [0, 0.5] });
    this.powerText = txt(this, W - 40, 56, 'POWER 100', 38, { title: true, color: '#ffd23f', origin: [1, 0.5] });
    this.pips = [];
    for (let i = 0; i < 5; i++) {
      const p = this.add.rectangle(40 + i * 132, 112, 120, 18, 0x2d3a78).setOrigin(0, 0.5);
      this.pips.push(p);
    }

    // 相手（ムカつくアイツ）と拳
    this.faceShadow = this.add.ellipse(320, 560, 220, 36, 0x000000, 0.35);
    this.face = addChar(this, characterId, { box: { x: 320, y: 360, w: 380, h: 390 } });
    this.F = this.face.base;
    this.faceShadow.setY(Math.min(575, this.face.footY()));
    // 挑発のゆらゆら
    this.idle = this.tweens.add({ targets: this.face, angle: { from: -2.5, to: 2.5 }, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.InOut' });
    this.bubble = txt(this, 560, 190, '', 24, { color: '#1b1300', backgroundColor: '#ffffff', wrap: 230, padding: { x: 14, y: 10 } }).setAlpha(0);
    this.aura = this.add.particles(0, 0, 'spark', {
      speed: { min: 20, max: 80 },
      scale: { start: 0.5, end: 0 },
      lifespan: 500,
      frequency: 140,
      tint: [0xffd23f, 0xff7a1a],
      blendMode: 'ADD',
    });
    this.glove = this.add.image(590, 480, 'glove').setScale(0.6).setAngle(-50);
    this.aura.startFollow(this.glove);
    this.gloveHome = { x: 590, y: 480 };
    this.tweens.add({ targets: this.glove, y: '+=10', yoyo: true, repeat: -1, duration: 450, ease: 'Sine.InOut' });

    this.callText = txt(this, W / 2, 580, '', 52, { title: true, color: '#ffffff', stroke: '#0a0f2a', strokeThickness: 10 });
    this.hintText = txt(this, W / 2, 636, '', 26, { color: '#7ee8ff' });

    // 制限時間バー
    this.timerBg = this.add.rectangle(W / 2, 682, 600, 12, 0x2d3a78);
    this.timerBar = this.add.rectangle(W / 2 - 300, 682, 600, 12, 0x4cc9f0).setOrigin(0, 0.5);

    // TAPボタン（画面のどこを押してもOK）
    this.tapBtn = this.add.container(W / 2, 1160);
    const tg = this.add.graphics();
    tg.fillStyle(0x000000, 0.35).fillRoundedRect(-300, -66, 600, 140, 30);
    tg.fillStyle(C.yellow, 1).fillRoundedRect(-300, -74, 600, 140, 30);
    tg.fillStyle(0xffffff, 0.25).fillRoundedRect(-292, -66, 584, 54, 24);
    this.tapBtn.add([tg, txt(this, 0, -4, 'TAP!', 80, { title: true, color: '#1b1300' })]);

    this.input.addPointer(3);
    this.input.on('pointerdown', (p) => this.onPointer(p));
    this.input.keyboard?.on('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') this.handleInput(performance.now(), 'key', null);
    });

    this.intro();
  }

  /** 対戦開始（約1秒）：アイツが挑発 */
  intro() {
    this.face.setScale(this.F.s * 2.2).setAlpha(0);
    this.tweens.add({ targets: this.face, scale: this.F.s, alpha: 1, duration: 260, ease: 'Back.Out' });
    sfx.vs();
    this.say(tauntFor(this.state.characterId), 900);
    const vs = popText(this, W / 2, 780, 'FIGHT!', 150, { color: '#ffd23f', stroke: '#c1121f', strokeThickness: 18, hold: 380, from: 3 });
    vs.setAngle(-8);
    this.time.delayedCall(DEBUG.fast ? 300 : 900, () => this.startRound());
  }

  say(text, ms = 800) {
    this.bubble.setText('「' + text + '」').setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.bubble, scale: 1, duration: 160, ease: 'Back.Out' });
    this.tweens.add({ targets: this.bubble, alpha: 0, delay: ms, duration: 200 });
  }

  startRound() {
    const st = this.state;
    const id = st.currentGameId;
    const info = MINIGAME_INFO[id];
    this.roundIndex = st.currentRound;
    this.roundText.setText(`ROUND ${st.currentRound + 1}/5`);
    this.pips[st.currentRound].setFillStyle(0x6c7bd1);
    this.tweens.add({ targets: this.pips[st.currentRound], scaleY: { from: 2, to: 1 }, duration: 200 });

    this.model = createModel(id, Math.random, st.currentRound);
    this.view = createView(id, this, this.model);
    this.botFired = 0;
    this.botPlan = this.makeBotPlan();

    this.callText.setText(info.call).setX(W + 300);
    this.tweens.add({ targets: this.callText, x: W / 2, duration: 180, ease: 'Back.Out' });

    const hintKey = 'hint.' + id;
    const firstTime = !getFlag(hintKey);
    this.hintText.setText(firstTime ? info.hint : '').setAlpha(firstTime ? 1 : 0);
    if (firstTime) setFlag(hintKey);
    const delay = DEBUG.fast ? 50 : firstTime ? 900 : 300;
    this.timerBar.width = 600;
    this.time.delayedCall(delay, () => {
      this.model.start(performance.now());
      this.active = true;
      this.lastWarn = 0;
    });
  }

  makeBotPlan() {
    if (!DEBUG.bot || DEBUG.bot === 'miss') return [];
    const ins = this.model.botInputs();
    if (DEBUG.bot === 'perfect') return ins;
    if (DEBUG.bot === 'random') {
      const r = Math.random();
      if (r < 0.15) return [];
      return ins.map((b) => ({ ...b, t: b.t + (r < 0.6 ? 0 : 90) }));
    }
    return ins;
  }

  onPointer(p) {
    if (!this.active) return;
    this.handleInput(eventTime(p), p.id, p);
  }

  handleInput(t, pointerId, pointer) {
    if (!this.active || !this.model) return;
    // 位置を使うゲーム（動くアイツを狙え）のため、ゲーム領域の中心を原点にした座標も渡す
    const lx = pointer ? pointer.x - CX : 0;
    const ly = pointer ? pointer.y - CY : 0;
    const res = this.model.input(t, pointerId, lx, ly);
    this.view.onInput(t, res, pointer);
    this.tweens.add({ targets: this.tapBtn, scale: { from: 0.93, to: 1 }, duration: 110 });
    if (this.model.done) this.endRound();
  }

  update() {
    if (!this.active || !this.model) return;
    const now = performance.now();
    // 自動プレイ（テスト用）
    while (this.botPlan && this.botFired < this.botPlan.length && now - this.model.t0 >= this.botPlan[this.botFired].t) {
      const b = this.botPlan[this.botFired];
      this.botFired++;
      this.handleInput(this.model.t0 + b.t, this.botFired, { x: CX + (b.x ?? 0), y: CY + (b.y ?? 0) });
      if (!this.active) return;
    }
    this.model.update(now);
    this.view.render(now);
    const rem = this.model.remaining(now);
    this.timerBar.width = (600 * rem) / this.model.limitMs;
    this.timerBar.setFillStyle(rem < 600 ? 0xe63946 : 0x4cc9f0);
    if (rem < 600 && now - this.lastWarn > 200) {
      this.lastWarn = now;
      sfx.timerWarn();
    }
    if (this.model.done) this.endRound();
  }

  endRound() {
    if (!this.active) return;
    this.active = false;
    this.view.render(performance.now());
    const r = this.state.commitRound(this.roundIndex, this.model.score, this.model.raw);
    if (!r) return;
    window.__pfLastRound = r;
    this.feedback(r);
  }

  /** 判定演出 */
  feedback(r) {
    const st = GRADE_STYLE[r.grade];
    const perfect = r.grade === 'PERFECT';
    this.pips[r.round].setFillStyle(st.tint);
    sfx.grade(r.grade);
    const hitStop = perfect ? 150 : 0;
    this.punchFace(r.grade);

    this.time.delayedCall(hitStop, () => {
      const g = popText(this, W / 2, 790, r.grade === 'MISS' ? 'MISS…' : r.grade + '!', perfect ? 132 : 110, {
        color: st.color,
        stroke: st.stroke,
        strokeThickness: 16,
        hold: 420,
        depth: 600,
      });
      g.setAngle(-6);
      if (r.acc >= 995) {
        const j = popText(this, W / 2, 680, 'JUST!!', 90, { color: '#ffffff', stroke: '#ff4fa3', strokeThickness: 14, hold: 420, depth: 610, from: 3 });
        j.setTint(0xff3b3b, 0xffe53b, 0x3da5ff, 0xc04bff);
      }
      popText(this, W / 2, 920, `POWER +${r.gained}`, 52, { color: '#ffd23f', stroke: '#3b2300', strokeThickness: 10, hold: 380, depth: 600, from: 0.4 });
      txt(this, W / 2, 965, `精度 ${(r.acc / 10).toFixed(1)}%${r.precision ? `  ボーナス +${r.precision}` : ''}`, 26, { color: '#7ee8ff', stroke: '#000000', strokeThickness: 5 })
        .setDepth(600)
        .setName('accText');
      this.time.delayedCall(600, () => this.children.getByName('accText')?.destroy());
      if (r.comboBonus) {
        popText(this, W / 2, 1020, `${r.streak}連続PERFECT! +${r.comboBonus}`, 44, { color: '#ff4fa3', stroke: '#2a0018', strokeThickness: 10, hold: 380, depth: 600 });
        sfx.combo(r.streak);
      }
      if (perfect) {
        burst(this, W / 2, 790, { count: 40, tint: [0xffd23f, 0xffb800, 0xffffff], speed: [250, 750], scale: [0.8, 0], life: 700 });
        burst(this, W / 2, 790, { texture: 'star', count: 12, tint: [0xffd23f], speed: [200, 500], scale: [0.6, 0.1], life: 700, blend: 'NORMAL' });
        shockwave(this, W / 2, 790, { color: 0xffd23f, scale: 5 });
        flash(this, 120, 0xfff3b0, 0.35);
        shake(this, 160, 0.012);
      } else if (r.grade === 'GREAT') {
        burst(this, W / 2, 790, { count: 24, tint: [0xff9a3c, 0xffffff], speed: [200, 550] });
        shake(this, 120, 0.006);
      }
      this.tweenPower();
      this.chargeUp();
    });

    const next = (perfect ? 820 : 700) * (DEBUG.fast ? 0.4 : 1);
    this.time.delayedCall(next, () => {
      this.view?.destroy();
      this.view = null;
      if (this.state.finished) go(this, 'Punch', { state: this.state }, 120);
      else this.startRound();
    });
  }

  tweenPower() {
    const from = this._shownPower ?? 100;
    const to = this.state.power;
    this._shownPower = to;
    this.tweens.addCounter({
      from,
      to,
      duration: 350,
      onUpdate: (tw) => this.powerText.setText('POWER ' + formatPower(tw.getValue())),
    });
    this.tweens.add({ targets: this.powerText, scale: { from: 1.3, to: 1 }, duration: 250 });
  }

  /** ラウンドが進むほど拳のチャージが強まる */
  chargeUp() {
    const lv = this.state.currentRound;
    const p = this.state.power / MAX_POWER;
    this.glove.setScale(0.6 + lv * 0.06 + p * 0.2);
    this.aura.frequency = Math.max(20, 140 - lv * 25 - p * 60);
  }

  /** 拳でアイツを殴る（判定に応じた強さ） */
  punchFace(grade) {
    const FACE = this.F;
    const power = { PERFECT: 1, GREAT: 0.7, GOOD: 0.45, MISS: 0 }[grade];
    if (power === 0) {
      // 空振り：アイツが煽る
      this.tweens.add({ targets: this.glove, x: FACE.x + 200, y: FACE.y - 30, duration: 120, yoyo: true, ease: 'Quad.Out' });
      this.tweens.add({ targets: this.face, x: FACE.x - 50, duration: 120, yoyo: true });
      this.say(['ププッ、当たってないよ？', 'ヘイヘ〜イ！', 'どこ狙ってんの？ｗ'][Math.floor(Math.random() * 3)], 700);
      return;
    }
    this.tweens.add({
      targets: this.glove,
      x: FACE.x + 70,
      y: FACE.y + 20,
      duration: 70,
      ease: 'Quad.In',
      onComplete: () => {
        sfx.jab(power);
        burst(this, FACE.x + 40, FACE.y, { count: Math.round(20 * power), tint: [0xffffff, 0xffd23f], speed: [200, 500] });
        burst(this, FACE.x + 40, FACE.y, { texture: 'shard', count: Math.round(8 * power), tint: [0xffffff], speed: [200, 600], gravity: 900, blend: 'NORMAL', scale: [1, 0.4] });
        this.face.setTint(0xff9999);
        this.tweens.add({
          targets: this.face,
          scaleX: FACE.s * (1 + 0.25 * power),
          scaleY: FACE.s * (1 - 0.18 * power),
          angle: -18 * power,
          x: FACE.x - 50 * power,
          duration: 70,
          yoyo: true,
          ease: 'Quad.Out',
          onComplete: () => this.face.clearTint().setAngle(0).setPosition(FACE.x, FACE.y).setScale(FACE.s),
        });
        this.tweens.add({ targets: this.glove, x: this.gloveHome.x, y: this.gloveHome.y, duration: 260, delay: 60, ease: 'Quad.Out' });
        if (power >= 0.7) shake(this, 100, 0.008 * power);
      },
    });
  }

  smallHit(count) {
    const FACE = this.F;
    const f = this.face;
    f.setPosition(FACE.x + Phaser.Math.Between(-12, 12), FACE.y + Phaser.Math.Between(-8, 8));
    f.setAngle(Phaser.Math.Between(-8, 8));
    f.setTint(count % 2 ? 0xffbbbb : 0xffffff);
    this.time.delayedCall(60, () => f.clearTint().setPosition(FACE.x, FACE.y).setAngle(0));
  }

  flashText(msg, color) {
    popText(this, W / 2, 680, msg, 40, { color, stroke: '#000000', strokeThickness: 8, hold: 400 });
  }
}
