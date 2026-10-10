// 端末内の記録（自己ベストと履歴）
const KEY = 'pf.records';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { best: null, history: [] };
  } catch {
    return { best: null, history: [] };
  }
}

export function getRecords() {
  return load();
}

/** 記録を保存し、新記録かどうかを返す */
export function addRecord(state) {
  const r = load();
  const entry = {
    km: state.finalDistanceKm,
    power: state.power,
    perfect: state.perfectCount,
    god: state.godPunch,
    characterId: state.characterId,
    at: Date.now(),
  };
  const isNew = !r.best || entry.power > r.best.power;
  if (isNew) r.best = entry;
  r.history = [entry, ...r.history].slice(0, 50);
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {}
  return { isNew, prevBest: isNew ? null : r.best };
}

export function topLocal(n = 10) {
  return load()
    .history.slice()
    .sort((a, b) => b.power - a.power || a.at - b.at)
    .slice(0, n);
}
