// ゲームの点数計算（純粋関数のみ）。Firestore Rules の検証ロジックと同じ計算をする。
import config from '../../data/game_config.json';

export const GRADES = ['PERFECT', 'GREAT', 'GOOD', 'MISS'];
export const BASE_POWER = config.base_power;
export const MAX_POWER = config.max_power;
export const GRADE_POINTS = config.grades;
export const COMBO_BONUS = config.combo_milestones;

/** 精度スコア(0-100)を整数に丸めて範囲内に収める */
export function clampScore(score) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** 精度スコア → 判定 */
export function gradeOf(score) {
  const s = clampScore(score);
  const t = config.grade_thresholds;
  if (s >= t.PERFECT) return 'PERFECT';
  if (s >= t.GREAT) return 'GREAT';
  if (s >= t.GOOD) return 'GOOD';
  return 'MISS';
}

/**
 * 誤差 → 精度スコアの区分線形変換。
 * err <= p: 100→95 / <= g: 94→80 / <= o: 79→50 / <= m: 49→0 / それ以上: 0
 */
export function scoreFromError(err, { p, g, o, m }) {
  if (!Number.isFinite(err) || err < 0) err = Math.abs(err);
  if (!Number.isFinite(err)) return 0;
  const lerp = (a, b, t) => a + (b - a) * t;
  if (err <= p) return lerp(100, 95, p === 0 ? 0 : err / p);
  if (err <= g) return lerp(94, 80, (err - p) / (g - p));
  if (err <= o) return lerp(79, 50, (err - g) / (o - g));
  if (err <= m) return lerp(49, 0, (err - o) / (m - o));
  return 0;
}

/** 1ラウンド分を加算した新しいパワー状態を返す */
export function applyRound({ power, perfectStreak, maxPerfectStreak }, grade) {
  let add = GRADE_POINTS[grade] ?? GRADE_POINTS.MISS;
  let comboBonus = 0;
  let streak = grade === 'PERFECT' ? perfectStreak + 1 : 0;
  if (streak > 0 && COMBO_BONUS[streak] != null) comboBonus = COMBO_BONUS[streak];
  const next = Math.min(MAX_POWER, power + add + comboBonus);
  return {
    power: next,
    gained: next - power,
    comboBonus,
    perfectStreak: streak,
    maxPerfectStreak: Math.max(maxPerfectStreak, streak),
  };
}

/** 判定の配列から最終パワーを計算 */
export function powerFromGrades(grades) {
  let st = { power: BASE_POWER, perfectStreak: 0, maxPerfectStreak: 0 };
  for (const g of grades) st = applyRound(st, g);
  return st.power;
}

/** パワー → 飛距離(km) */
export function distanceFromPower(power) {
  const p = Math.max(0, Math.min(MAX_POWER, power));
  return Math.round(10 ** (3 + (15.3 * (p - 350)) / 2350));
}

export function isGodPunch(grades) {
  return grades.length === config.rounds && grades.every((g) => g === 'PERFECT');
}
