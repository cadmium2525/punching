// Firebase の Web 設定（公開して問題ない値）。ビルド時に環境変数から読み込む。
// 未設定ならオンラインランキングは無効になり、端末内の記録だけで遊べる。
// 環境変数（VITE_FIREBASE_*）があればそちらを優先（エミュレーターでのテスト用）。
import fileConfig from './firebase-config.js';

const env = import.meta.env;
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || fileConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId,
  appId: env.VITE_FIREBASE_APP_ID || fileConfig.appId,
};
export const recaptchaSiteKey = env.VITE_RECAPTCHA_SITE_KEY || '';
export const emulatorHost = env.VITE_FIREBASE_EMULATOR || ''; // 例: "127.0.0.1"（テスト用）
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
