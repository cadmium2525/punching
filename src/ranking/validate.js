// ニックネームの検証（Firestore Rules と同じ条件）
export function cleanNickname(s) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, 12);
}
export function isValidNickname(s) {
  const n = cleanNickname(s);
  return n.length >= 1 && n.length <= 12 && n === String(s).trim();
}
