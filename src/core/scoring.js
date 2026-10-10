// ゲームの点数計算（純粋関数のみ）。Firestore Rules の検証ロジックと同じ計算をする。
//
// 精度(acc)は 0〜1000 の整数（スコア 0〜100 を 0.1 刻みにしたもの）。
//   判定：PERFECT ≥970 / GREAT ≥800 / GOOD ≥500 / MISS
//   POWER = 100 + 判定ポイント + PERFECT連続ボーナス + 精度ボーナス(各ラウンド max(0, acc-900))
//   → 全PERFECTでも 3050〜3200 に分かれるので、ランキングが同点で埋まりにくい
import config from '../../data/game_config.json';

export const GRADES = ['PERFECT', 'GREAT', 'GOOD', 'MISS'];
export const BASE_POWER = config.base_power;
export const MAX_POWER = config.max_power;
export const GRADE_POINTS = config.grades;
export const COMBO_BONUS = config.combo_milestones;
const TH = config.grade_thresholds;

/** スコア(0〜100の実数) → 精度(0〜1000の整数) */
export function accOf(score) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1000, Math.round(score * 10)));
}

/** 精度 → 判定 */
export function gradeOfAcc(acc) {
  if (acc >= TH.PERFECT) return 'PERFECT';
  if (acc >= TH.GREAT) return 'GREAT';
  if (acc >= TH.GOOD) return 'GOOD';
  return 'MISS';
}

/** スコア(0〜100) → 判定 */
export function gradeOf(score) {
  return gradeOfAcc(accOf(score));
}

/** 精度ボーナス */
export function precisionBonus(acc) {
  return Math.max(0, acc - 900);
}

/**
 * 誤差 → スコア(0〜100)の区分線形変換。
 * err <= p: 100→97 (PERFECT) / <= g: 97→80 (GREAT) / <= o: 80→50 (GOOD) / <= m: 50→0 / それ以上: 0
 * PERFECT の中でも、ど真ん中ほど高い（精度ボーナスに効く）
 */
export function scoreFromError(err, { p, g, o, m }) {
  err = Math.abs(err);
  if (!Number.isFinite(err)) return 0;
  const lerp = (a, b, t) => a + (b - a) * t;
  if (err <= p) return lerp(100, 97, p === 0 ? 0 : err / p);
  if (err <= g) return lerp(96.9, 80, (err - p) / (g - p));
  if (err <= o) return lerp(79.9, 50, (err - g) / (o - g));
  if (err <= m) return lerp(49.9, 0, (err - o) / (m - o));
  return 0;
}

/** 1ラウンド分を加算した新しいパワー状態を返す */
export function applyRound({ power, perfectStreak, maxPerfectStreak }, acc) {
  const grade = gradeOfAcc(acc);
  const points = GRADE_POINTS[grade];
  const streak = grade === 'PERFECT' ? perfectStreak + 1 : 0;
  const comboBonus = COMBO_BONUS[streak] ?? 0;
  const precision = precisionBonus(acc);
  const next = Math.min(MAX_POWER, power + points + comboBonus + precision);
  return {
    grade,
    power: next,
    gained: next - power,
    points,
    comboBonus,
    precision,
    perfectStreak: streak,
    maxPerfectStreak: Math.max(maxPerfectStreak, streak),
  };
}

/** 精度の配列から最終パワーを計算 */
export function powerFromAccs(accs) {
  let st = { power: BASE_POWER, perfectStreak: 0, maxPerfectStreak: 0 };
  for (const a of accs) st = applyRound(st, a);
  return st.power;
}

/** パワー → 飛距離(km) */
export function distanceFromPower(power) {
  const p = Math.max(0, Math.min(MAX_POWER, power));
  return Math.round(10 ** (3 + (15.3 * (p - 350)) / 2350));
}
