// 飛行演出の通過ポイント。距離は実距離(km)に対応させる（仕様書 5章）。
export const LANDMARKS = [
  { km: 100, id: 'karman', name: '大気圏', pass: '大気圏突破！', kind: 'line' },
  { km: 400, id: 'iss', name: '宇宙ステーション', pass: '宇宙ステーションをかすめた！', kind: 'iss' },
  { km: 35786, id: 'geo', name: '静止衛星軌道', pass: '静止衛星を追い越した！', kind: 'satellite' },
  { km: 384400, id: 'moon', name: '月', pass: '月を通過！', kind: 'moon' },
  { km: 7.8e7, id: 'mars', name: '火星', pass: '火星を通過！', kind: 'mars' },
  { km: 1.496e8, id: 'sun', name: '太陽', pass: '太陽をかすめた！アチッ！', kind: 'sun' },
  { km: 6.3e8, id: 'jupiter', name: '木星', pass: '木星を通過！', kind: 'jupiter' },
  { km: 1.28e9, id: 'saturn', name: '土星', pass: '土星の輪をくぐった！', kind: 'saturn' },
  { km: 4.3e9, id: 'neptune', name: '海王星', pass: '海王星を通過！', kind: 'neptune' },
  { km: 1.8e10, id: 'helio', name: '太陽系の果て', pass: '太陽系を脱出！', kind: 'line' },
  { km: 7.5e12, id: 'oort', name: 'オールトの雲', pass: 'オールトの雲を突き抜けた！', kind: 'cloud' },
  { km: 4.0e13, id: 'proxima', name: 'プロキシマ・ケンタウリ', pass: '隣の恒星まで到達！', kind: 'star' },
  { km: 8.1e13, id: 'sirius', name: 'シリウス', pass: 'シリウスを通過！', kind: 'star' },
  { km: 1.27e16, id: 'orion', name: 'オリオン大星雲', pass: 'オリオン大星雲を突破！', kind: 'nebula' },
  { km: 2.46e17, id: 'center', name: '銀河系の中心', pass: '銀河系の中心を通過！', kind: 'core' },
  { km: 9.5e17, id: 'galaxy', name: '天の川銀河', pass: '天の川銀河を突破!!', kind: 'galaxy' },
  { km: 1.5e18, id: 'lmc', name: '大マゼラン雲', pass: '大マゼラン雲の向こうへ!!', kind: 'galaxy2' },
  { km: 2.4e19, id: 'andromeda', name: 'アンドロメダ銀河', pass: 'アンドロメダ銀河を突破!!', kind: 'galaxy' },
  { km: 5.4e20, id: 'virgo', name: 'おとめ座銀河団', pass: 'おとめ座銀河団を突き抜けた!!', kind: 'cluster' },
  { km: 2.4e21, id: 'laniakea', name: 'ラニアケア超銀河団', pass: '超銀河団の果てへ!!!', kind: 'cluster' },
];

/** 到達した通過ポイント（短距離では未到達エリアを含めない） */
export function reachedLandmarks(km) {
  return LANDMARKS.filter((l) => l.km <= km);
}

/** 称号 */
export function titleFor(km, godPunch) {
  const r = reachedLandmarks(km);
  const last = r[r.length - 1];
  if (godPunch) {
    if (last?.id === 'laniakea') return '宇宙の果てまでぶっ飛ばした神';
    if (last?.id === 'virgo') return '銀河団の向こうまでぶっ飛ばした神';
    if (last?.id === 'andromeda') return 'アンドロメダまでぶっ飛ばした神';
    return '銀河の向こうまでぶっ飛ばした神';
  }
  if (!last) return '地球からは出られなかった…';
  const map = {
    karman: '宇宙デビュー級',
    iss: '宇宙飛行士級',
    geo: '衛星軌道級',
    moon: '月までぶっ飛ばした',
    mars: '火星送り',
    sun: '太陽で焼いた',
    jupiter: '木星送り',
    saturn: '土星送り',
    neptune: '太陽系の果て送り',
    helio: '太陽系追放',
    oort: '星間追放',
    proxima: '恒星間ぶっ飛ばし',
    sirius: '恒星間ぶっ飛ばし',
    orion: '星雲送り',
    center: '銀河中心送り',
    galaxy: '銀河の向こうまで',
    lmc: '銀河の向こうまで',
    andromeda: 'アンドロメダ送り',
    virgo: '銀河団送り',
    laniakea: '宇宙の果て送り',
  };
  return map[last.id];
}

/**
 * 飛行中の表示距離 log10(km)。t は 0〜8 秒。
 * 0-0.5 衝撃 / 0.5-2 地上 / 2-4 大気圏 / 4-6 宇宙 / 6-7 減速 / 7-8 着地
 * 表示値がステージ演出と一致するよう、log 空間で補間する。
 */
export function flightLogKm(t, finalKm) {
  const L = Math.log10(Math.max(1, finalKm));
  const ground = Math.min(1, L); // 10km
  const atmo = Math.min(Math.log10(120), L);
  if (t <= 0.5) return 0;
  if (t <= 2) return ground * easeInQuad((t - 0.5) / 1.5);
  if (t <= 4) return ground + (atmo - ground) * ((t - 2) / 2);
  if (t <= 7) return atmo + (L - atmo) * easeOutQuad((t - 4) / 3);
  return L;
}

export function flightKm(t, finalKm) {
  if (t <= 0.5) return 0;
  if (t >= 7) return finalKm;
  return Math.min(finalKm, Math.round(10 ** flightLogKm(t, finalKm)));
}

function easeInQuad(x) {
  return x * x;
}
function easeOutQuad(x) {
  return 1 - (1 - x) * (1 - x);
}
