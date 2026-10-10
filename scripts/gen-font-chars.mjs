// src 内で使われている日本語の文字を集め、Webフォントの先読み用リストを生成する
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const set = new Set();
function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.js$/.test(f) && !f.includes('fontChars')) for (const ch of readFileSync(p, 'utf8')) if (ch.charCodeAt(0) > 0x2000) set.add(ch);
  }
}
walk(join(root, 'src'));
const kana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉっゃゅょーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォッャュョヴ';
for (const ch of kana) set.add(ch);
const chars = [...set].sort().join('');
writeFileSync(join(root, 'src/fontChars.js'), `// 自動生成: scripts/gen-font-chars.mjs\nexport default ${JSON.stringify(chars)};\n`);
console.log(`[gen-font-chars] ${set.size} chars`);
