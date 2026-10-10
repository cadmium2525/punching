// キャラクター（プリセット10体＋端末内の写真キャラ）
import { charStore } from './storage/idb.js';

const NAMES = ['ドヤ顔部長', 'マウント先輩', 'こぼし課長', 'チャラ男', '嫌味な同僚', '屁理屈メガネ', '大声ボス', 'ナメた後輩', 'あざと女子', 'グラサン社長'];
const LINES = [
  'え、まだそれやってんの？',
  'オレの若い頃はさぁ〜',
  'それ、オレが先に言ったよね？',
  'ちょ、マジ無理なんだけどｗ',
  'あ、それ聞いてないです〜',
  'つまりキミの理解力の問題だね',
  'なんで分からんのだァ！',
  'え、先輩それダサくないっすか？',
  'えー、わたしわかんなーい♡',
  'キミの代わりはいくらでもいるよ',
];
export const COMMON_TAUNTS = ['何見てんだよ！', 'やれるもんならやってみな？', 'ププッ、弱そう〜', 'かかってこいよ！', 'え、本気？ｗ'];

export const PRESETS = NAMES.map((name, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { id: `preset-${n}`, no: n, name, file: `assets/characters/character_${n}.png`, line: LINES[i], custom: false };
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
export function faceKey(id) {
  return `face-${id}`;
}
export function tauntFor(id) {
  const c = getCharacter(id);
  const pool = c.line ? [c.line, ...COMMON_TAUNTS] : COMMON_TAUNTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 画像から丸い顔テクスチャを作る */
export function buildFaceTexture(scene, key, img) {
  const S = 360;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.save();
  x.beginPath();
  x.arc(S / 2, S / 2, S / 2 - 10, 0, Math.PI * 2);
  x.clip();
  const g = x.createRadialGradient(S / 2, S * 0.4, 10, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#c9d2ea');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  const r = Math.max(S / img.width, S / img.height) * 1.02;
  x.drawImage(img, (S - img.width * r) / 2, (S - img.height * r) / 2, img.width * r, img.height * r);
  x.restore();
  x.lineWidth = 10;
  x.strokeStyle = '#ffffff';
  x.beginPath();
  x.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
  x.stroke();
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
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
  for (const c of customs) if (scene.textures.exists(faceKey(c.id))) scene.textures.remove(faceKey(c.id));
  customs = [];
  for (const r of recs) {
    try {
      const url = URL.createObjectURL(r.blob);
      const img = await loadImage(url);
      URL.revokeObjectURL(url);
      buildFaceTexture(scene, faceKey(r.id), img);
      customs.push({ id: r.id, name: r.name || 'ムカつくアイツ', custom: true, line: null });
    } catch (e) {
      console.warn('custom char load failed', e);
    }
  }
  return customs;
}

export async function saveCustomCharacter(scene, { name, blob }) {
  const id = `custom-${Date.now().toString(36)}`;
  await charStore.put({ id, name, blob, createdAt: Date.now() });
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
