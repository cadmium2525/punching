// Firebase の Web 設定（公開して問題ない値）。ビルド時に環境変数から読み込む。
// 未設定ならオンラインランキングは無効になり、端末内の記録だけで遊べる。
const env = import.meta.env;
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const recaptchaSiteKey = env.VITE_RECAPTCHA_SITE_KEY || '';
export const emulatorHost = env.VITE_FIREBASE_EMULATOR || ''; // 例: "127.0.0.1"（テスト用）
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
