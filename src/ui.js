// 共通UI：配色・文字・ボタン・演出ヘルパー
import Phaser from 'phaser';
import { settings } from './settings.js';
import { sfx } from './audio/sfx.js';

export const W = 720;
export const H = 1280;

export const C = {
  bg: 0x0b1230,
  bg2: 0x141c45,
  panel: 0x1a2350,
  panel2: 0x232d63,
  line: 0x34407a,
  yellow: 0xffd23f,
  gold: 0xffb800,
  red: 0xe63946,
  orange: 0xff7a1a,
  cyan: 0x4cc9f0,
  blue: 0x3da5ff,
  green: 0x3ddc84,
  white: 0xffffff,
  muted: 0xa9b3d9,
};

export const FONT_TITLE = '"Dela Gothic One", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "WenQuanYi Zen Hei", sans-serif';
export const FONT_UI = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Noto Sans JP", "WenQuanYi Zen Hei", sans-serif';

export const GRADE_STYLE = {
  PERFECT: { color: '#ffd23f', stroke: '#b34700', tint: C.gold },
  GREAT: { color: '#ff9a3c', stroke: '#6b1d00', tint: C.orange },
  GOOD: { color: '#7ee8ff', stroke: '#0b3a66', tint: C.cyan },
  MISS: { color: '#9aa3c7', stroke: '#272e52', tint: C.muted },
};

export const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/** 文字。size は px。title=true で極太見出しフォント */
export function txt(scene, x, y, str, size = 32, opts = {}) {
  const { title = false, color = '#ffffff', stroke = null, strokeThickness = 0, align = 'center', origin = 0.5, wrap = 0, shadow = false, fit = 0, ...rest } = opts;
  const t = scene.add.text(x, y, str, {
    fontFamily: title ? FONT_TITLE : FONT_UI,
    fontSize: `${size}px`,
    fontStyle: title ? 'normal' : '800',
    color,
    stroke: stroke ?? undefined,
    strokeThickness: stroke ? strokeThickness || Math.max(4, size / 8) : 0,
    align,
    wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined,
    padding: { x: 6, y: 6 },
    ...rest,
  });
  if (Array.isArray(origin)) t.setOrigin(origin[0], origin[1]);
  else t.setOrigin(origin);
  if (opts.fit && t.width > opts.fit) t.setScale(opts.fit / t.width);
  if (shadow) t.setShadow(0, 6, '#000000', 0, true, true);
  return t;
}

/** 角丸ボタン */
export function button(scene, x, y, w, h, label, opts = {}) {
  const { color = C.panel2, textColor = '#ffffff', size = 30, onClick = () => {}, title = false, radius = 18, sound = true, icon = null } = opts;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (col) => {
    g.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, radius);
    g.fillStyle(col, 1).fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.fillStyle(0xffffff, 0.12).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.42, { tl: radius - 4, tr: radius - 4, bl: 6, br: 6 });
  };
  draw(color);
  const t = txt(scene, 0, 0, (icon ? icon + ' ' : '') + label, size, { color: textColor, title });
  c.add([g, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.label = t;
  c.redraw = draw;
  let down = false;
  c.on('pointerdown', () => {
    down = true;
    scene.tweens.add({ targets: c, scale: 0.94, duration: 60 });
  });
  const reset = () => {
    down = false;
    scene.tweens.add({ targets: c, scale: 1, duration: 120, ease: 'Back.Out' });
  };
  c.on('pointerout', reset);
  c.on('pointerup', () => {
    if (!down) return;
    reset();
    if (sound) sfx.click();
    onClick();
  });
  return c;
}

export function panel(scene, x, y, w, h, color = C.panel, alpha = 1, radius = 20) {
  const g = scene.add.graphics();
  g.fillStyle(color, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(2, C.line, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  return g;
}

/** 背景（濃紺グラデ＋集中線）。毎フレームの再描画を避けるため一度だけテクスチャ化する */
export function background(scene, { lines = true, top = 0x1b2660, bottom = C.bg } = {}) {
  const key = `bg-${top}-${bottom}-${lines}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, W, H);
    if (lines) {
      g.fillStyle(0xffffff, 0.03);
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const a2 = a + 0.05;
        g.fillTriangle(W / 2, H * 0.4, W / 2 + Math.cos(a) * 1600, H * 0.4 + Math.sin(a) * 1600, W / 2 + Math.cos(a2) * 1600, H * 0.4 + Math.sin(a2) * 1600);
      }
    }
    g.generateTexture(key, W, H);
    g.destroy();
  }
  return scene.add.image(W / 2, H / 2, key);
}

// ===== 演出ヘルパー（設定の軽減オプションを尊重） =====

export function shake(scene, duration = 200, intensity = 0.01) {
  if (settings.reduceShake) return;
  scene.cameras.main.shake(duration, intensity);
}

/** 画面フラッシュ。光刺激軽減時は弱い単発のフェードに置き換える */
export function flash(scene, duration = 150, color = 0xffffff, strength = 1) {
  const alpha = settings.reduceFlash ? Math.min(0.18, strength * 0.18) : Math.min(1, strength);
  const r = scene.add.rectangle(W / 2, H / 2, W, H, color, alpha).setDepth(1000).setScrollFactor(0);
  scene.tweens.add({ targets: r, alpha: 0, duration: settings.reduceFlash ? duration * 2 : duration, onComplete: () => r.destroy() });
}

/** 文字をバンッと出す */
export function popText(scene, x, y, str, size, opts = {}) {
  const { hold = 500, depth = 500, rise = 0, from = 2.2, ...style } = opts;
  const t = txt(scene, x, y, str, size, { title: true, ...style }).setDepth(depth).setAlpha(0);
  const fitS = Math.min(1, (W - 40) / t.width);
  t.setScale(from * fitS);
  scene.tweens.add({ targets: t, scale: fitS, alpha: 1, duration: 180, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, alpha: 0, y: y - rise, delay: 180 + hold, duration: 250, onComplete: () => t.destroy() });
  return t;
}

/** 粒子を一度に放出 */
export function burst(scene, x, y, { texture = 'spark', count = 20, tint = [0xffffff], speed = [200, 600], scale = [0.6, 0], life = 600, depth = 400, gravity = 0, angle = [0, 360], blend = 'ADD' } = {}) {
  const n = settings.reduceFlash ? Math.ceil(count * 0.6) : count;
  const e = scene.add.particles(x, y, texture, {
    speed: { min: speed[0], max: speed[1] },
    angle: { min: angle[0], max: angle[1] },
    scale: { start: scale[0], end: scale[1] },
    lifespan: { min: life * 0.6, max: life },
    tint,
    gravityY: gravity,
    blendMode: blend,
    rotate: { min: 0, max: 360 },
    emitting: false,
  });
  e.setDepth(depth);
  e.explode(n);
  scene.time.delayedCall(life + 100, () => e.destroy());
  return e;
}

/** 衝撃波リング */
export function shockwave(scene, x, y, { color = 0xffffff, scale = 6, duration = 450, depth = 450, width = 1 } = {}) {
  const r = scene.add.image(x, y, 'ring').setTint(color).setDepth(depth).setScale(0.2 * width).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: r, scale, alpha: 0, duration, ease: 'Cubic.Out', onComplete: () => r.destroy() });
  return r;
}

/** シーン遷移（短いフェード） */
export function go(scene, key, data = {}, ms = 140) {
  if (scene._leaving) return;
  scene._leaving = true;
  scene.input.enabled = false;
  scene.cameras.main.fadeOut(ms, 11, 18, 48);
  scene.time.delayedCall(ms, () => scene.scene.start(key, data));
}

export function fadeIn(scene, ms = 140) {
  scene._leaving = false;
  scene.cameras.main.fadeIn(ms, 11, 18, 48);
}

/** 入力イベントの時刻（performance.now() 基準） */
export function eventTime(pointer) {
  const now = performance.now();
  const ts = pointer?.event?.timeStamp;
  if (typeof ts === 'number' && ts > 0 && ts <= now + 1 && now - ts < 500) return ts;
  return now;
}
