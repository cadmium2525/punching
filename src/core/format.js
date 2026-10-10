const LY_KM = 9.4607e12;

const UNITS = [
  [1e20, '垓'],
  [1e16, '京'],
  [1e12, '兆'],
  [1e8, '億'],
];

/** 飛距離の表示用文字列（大きな数は日本語の単位で） */
export function formatKm(km) {
  const v = Math.max(0, Math.round(km));
  if (v < 1e8) return `${v.toLocaleString('ja-JP')} km`;
  for (const [u, name] of UNITS) {
    if (v >= u) {
      const n = v / u;
      const digits = n >= 1000 ? 0 : n >= 100 ? 1 : 2;
      return `${n.toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits })}${name} km`;
    }
  }
  return `${v} km`;
}

/** 光年換算（0.01光年未満は null） */
export function formatLightYears(km) {
  const ly = km / LY_KM;
  if (ly < 0.01) return null;
  if (ly < 10) return `約${ly.toFixed(2)}光年`;
  if (ly < 10000) return `約${Math.round(ly).toLocaleString('ja-JP')}光年`;
  if (ly < 1e8) return `約${(ly / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万光年`;
  return `約${(ly / 1e8).toLocaleString('ja-JP', { maximumFractionDigits: 2 })}億光年`;
}

export function formatPower(p) {
  return Math.round(p).toLocaleString('ja-JP');
}
