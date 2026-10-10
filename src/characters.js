// キャラクター（正式キャラ4人＋端末内の写真キャラ）
import { charStore } from './storage/idb.js';

// 正式キャラクター4人（全身の立ち姿・透過WebP）
const NAMES = ['煽りリーマン', 'パワハラ部長', 'ヒョウ柄のお局', '小悪魔ギャル'];
const LINES = [
  'ベロベロバ〜！悔しかったら殴ってみな！',
  'オレに逆らうとはいい度胸だなァ！',
  'ちょっとアンタ！なに見てんのよ！',
  'ざぁこ♡ ざぁこ♡ 殴れるもんなら殴ってみな？',
];
export const COMMON_TAUNTS = ['何見てんだよ！', 'やれるもんならやってみな？', 'ププッ、弱そう〜', 'かかってこいよ！', 'え、本気？ｗ'];

// 顔の位置（トリミング後の画像に対する比率）と、顔の大きさ（高さに対する比率）
const BUST = { fx: 0.5, fy: 0.45, face: 0.6 }; // 写真キャラが胸上の場合
const FACE_META = {
  'preset-01': { fx: 0.583, fy: 0.092, face: 0.17 },
  'preset-02': { fx: 0.626, fy: 0.088, face: 0.15 },
  'preset-03': { fx: 0.507, fy: 0.126, face: 0.19 },
  'preset-04': { fx: 0.49, fy: 0.18, face: 0.17 },
};

export const PRESETS = NAMES.map((name, i) => {
  const n = String(i + 1).padStart(2, '0');
  const id = `preset-${n}`;
  return { id, no: n, name, file: `assets/characters/character_${n}.webp`, line: LINES[i], custom: false, meta: FACE_META[id] };
});

let customs = [];
export const MAX_CUSTOM = 6;

export function allCharacters() {
  return [...PRESETS, ...customs];
}
export function getCharacter(id) {
  return allCharacters().find((c) => c.id === id) || PRESETS[0];
}
export function customCharacters() {
  return customs;
}
export function charKey(id) {
  return `char-${id}`;
}
export function thumbKey(id) {
  return `thumb-${id}`;
}
const metas = new Map();
export function charMeta(id) {
  return metas.get(id) || BUST;
}
export function tauntFor(id) {
  const c = getCharacter(id);
  const pool = c.line ? [c.line, ...COMMON_TAUNTS] : COMMON_TAUNTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 透明部分を切り詰めて、キャラ本体のテクスチャとアイコン用（顔まわり）のテクスチャを作る */
export function buildCharTextures(scene, id, img, meta = null) {
  const MAXH = 1200;
  const src = document.createElement('canvas');
  src.width = img.width;
  src.height = img.height;
  const sx = src.getContext('2d', { willReadFrequently: true });
  sx.drawImage(img, 0, 0);
  const data = sx.getImageData(0, 0, src.width, src.height).data;
  let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++)
      if (data[(y * src.width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) [x0, y0, x1, y1] = [0, 0, src.width - 1, src.height - 1];
  const tw = x1 - x0 + 1;
  const th = y1 - y0 + 1;
  if (!meta) meta = guessMeta(data, src.width, x0, y0, tw, th);
  const k = Math.min(1, MAXH / th);
  const c = document.createElement('canvas');
  c.width = Math.round(tw * k);
  c.height = Math.round(th * k);
  c.getContext('2d').drawImage(src, x0, y0, tw, th, 0, 0, c.width, c.height);
  addCanvas(scene, charKey(id), c);
  // アイコン：顔を中心にした正方形
  const side = Math.min(c.width, c.height, meta.face * c.height * 2.4);
  const cx = Math.min(c.width - side / 2, Math.max(side / 2, meta.fx * c.width));
  const cy = Math.min(c.height - side / 2, Math.max(side / 2, meta.fy * c.height));
  const t = document.createElement('canvas');
  t.width = t.height = 256;
  t.getContext('2d').drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, 256, 256);
  addCanvas(scene, thumbKey(id), t);
  metas.set(id, meta);
  return meta;
}

function addCanvas(scene, key, c) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

/** 写真キャラ用：縦長なら全身とみなし、上端付近の人物の中心を顔とする */
function guessMeta(data, W, x0, y0, tw, th) {
  if (th / tw < 1.3) return BUST;
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y0 + th * 0.12; y++)
    for (let x = x0; x < x0 + tw; x++)
      if (data[(y * W + x) * 4 + 3] > 128) {
        sum += x - x0;
        n++;
      }
  return { fx: n ? sum / n / tw : 0.5, fy: 0.09, face: 0.16 };
}

/**
 * キャラを置く。原点は顔の位置（殴る・潰す演出の中心）。
 *  box:  { x, y, w, h } の枠に全身を収める
 *  face: { x, y, size } 顔の中心と大きさを指定（上半身アップ）
 */
export function addChar(scene, id, { box, face }) {
  const m = charMeta(id);
  const img = scene.add.image(0, 0, charKey(id)).setOrigin(m.fx, m.fy);
  const w = img.width;
  const h = img.height;
  let s, x, y;
  if (face) {
    s = face.size / (m.face * h);
    x = face.x;
    y = face.y;
  } else {
    s = Math.min(box.w / w, box.h / h);
    x = box.x + (m.fx - 0.5) * w * s;
    y = box.y + (m.fy - 0.5) * h * s;
  }
  img.setScale(s).setPosition(x, y);
  img.base = { x, y, s };
  img.meta = m;
  /** 足元の y 座標 */
  img.footY = () => img.y + (1 - m.fy) * img.height * img.scaleY;
  return img;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = url;
  });
}

/** IndexedDB から写真キャラを読み込み、テクスチャ化 */
export async function loadCustomCharacters(scene) {
  let recs = [];
  try {
    recs = await charStore.all();
  } catch (e) {
    console.warn('IndexedDB unavailable', e);
  }
  for (const c of customs) for (const k of [charKey(c.id), thumbKey(c.id)]) if (scene.textures.exists(k)) scene.textures.remove(k);
  customs = [];
  for (const r of recs) {
    try {
      const url = URL.createObjectURL(r.blob);
      const img = await loadImage(url);
      URL.revokeObjectURL(url);
      const meta = buildCharTextures(scene, r.id, img, r.meta || null);
      customs.push({ id: r.id, name: r.name || 'ムカつくアイツ', custom: true, line: null, meta });
    } catch (e) {
      console.warn('custom char load failed', e);
    }
  }
  return customs;
}

export async function saveCustomCharacter(scene, { name, blob, meta = null }) {
  const id = `custom-${Date.now().toString(36)}`;
  await charStore.put({ id, name, blob, meta, createdAt: Date.now() });
  await loadCustomCharacters(scene);
  return id;
}

export async function deleteCustomCharacter(scene, id) {
  await charStore.delete(id);
  await loadCustomCharacters(scene);
}

export async function deleteAllCustomCharacters(scene) {
  await charStore.clear();
  await loadCustomCharacters(scene);
}

const LAST = 'pf.lastChar';
export function lastCharacterId() {
  try {
    const id = localStorage.getItem(LAST);
    if (id && allCharacters().some((c) => c.id === id)) return id;
  } catch {}
  return null;
}
export function setLastCharacterId(id) {
  try {
    localStorage.setItem(LAST, id);
  } catch {}
}
