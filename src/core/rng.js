export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** pool から重複なしで n 個を抽選 */
export function pickDistinct(pool, n, rand = Math.random) {
  if (n > pool.length) throw new Error('pool too small');
  return shuffle(pool, rand).slice(0, n);
}

export function randomId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
