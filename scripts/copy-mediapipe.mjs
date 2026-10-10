// MediaPipe の wasm を public/ にコピー（端末内で背景除去するため。CDN 不要）
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dst = join(root, 'public/mediapipe/wasm');
if (!existsSync(src)) {
  console.warn('[copy-mediapipe] @mediapipe/tasks-vision が見つかりません');
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log('[copy-mediapipe] copied wasm to public/mediapipe/wasm');
