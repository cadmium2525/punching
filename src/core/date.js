/** 日本時間の日付キー（例: 20261010）。日次ランキングは JST 0時で切り替わる */
export function jstDay(date = new Date()) {
  const t = new Date(date.getTime() + 9 * 3600 * 1000);
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
}
