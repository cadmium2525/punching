// 設定（光刺激軽減・画面揺れ軽減・音量）。端末内の localStorage に保存。
const KEY = 'pf.settings';
const DEFAULTS = { reduceFlash: false, reduceShake: false, sfxVolume: 8, bgmVolume: 5 };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = load();

if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
  try {
    if (!localStorage.getItem(KEY)) {
      settings.reduceFlash = true;
      settings.reduceShake = true;
    }
  } catch {}
}

const listeners = new Set();
export function saveSettings(patch) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
  listeners.forEach((f) => f(settings));
}
export function onSettings(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** 小さな永続フラグ用 */
export function getFlag(name) {
  try {
    return localStorage.getItem('pf.flag.' + name) === '1';
  } catch {
    return false;
  }
}
export function setFlag(name) {
  try {
    localStorage.setItem('pf.flag.' + name, '1');
  } catch {}
}
