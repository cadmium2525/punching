// 写真からキャラクター作成（DOM オーバーレイ）
// 流れ：同意 → 画像選択 → 端末内で背景除去 → プレビュー/手動トリミング → IndexedDB 保存
import { personMask } from './segment.js';
import { saveCustomCharacter } from '../characters.js';

const MAX_SRC = 768;
const OUT = 512;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function openPhotoEditor(scene, done) {
  const ov = document.getElementById('overlay');
  const close = (id = null) => {
    ov.hidden = true;
    ov.innerHTML = '';
    done(id);
  };
  ov.hidden = false;
  ov.innerHTML = `
    <div class="ov-card" id="pe">
      <h2>写真からムカつくアイツを作る</h2>
      <p><strong>写真はサーバーに送信されません。</strong>背景の切り抜きはこの端末の中だけで行い、端末内に保存します。ランキングや共有には使われません。</p>
      <label><input type="checkbox" id="pe-consent" /> 自分の写真、または写っている本人の許可を得た写真です</label>
      <div class="ov-row">
        <label class="ov-btn blue file" id="pe-pick" aria-disabled="true">写真を選ぶ<input type="file" id="pe-file" accept="image/png,image/jpeg,image/webp" disabled /></label>
      </div>
      <div class="ov-status" id="pe-st"></div>
      <div id="pe-edit" hidden>
        <div class="ov-preview" id="pe-prev"><canvas id="pe-canvas" width="${OUT}" height="${OUT}"></canvas></div>
        <p style="text-align:center;margin-top:0">ドラッグで位置調整</p>
        <div class="ov-slider">大きさ<input type="range" id="pe-zoom" min="0.3" max="4" step="0.01" value="1" /></div>
        <div class="ov-slider">切り抜きの強さ<input type="range" id="pe-th" min="0.1" max="0.9" step="0.01" value="0.5" /></div>
        <label><input type="checkbox" id="pe-keep" /> 背景を残す（うまく切り抜けないとき）</label>
        <input type="text" id="pe-name" maxlength="10" placeholder="名前（10文字まで）" value="ムカつくアイツ" />
      </div>
      <div class="ov-row">
        <button class="ov-btn" id="pe-cancel">やめる</button>
        <button class="ov-btn primary" id="pe-save" disabled>保存する</button>
      </div>
    </div>`;
  const $ = (id) => ov.querySelector('#' + id);
  const st = $('pe-st');
  const status = (msg, err = false) => {
    st.textContent = msg;
    st.className = 'ov-status' + (err ? ' ov-error' : '');
  };

  $('pe-consent').onchange = (e) => {
    $('pe-file').disabled = !e.target.checked;
    $('pe-pick').setAttribute('aria-disabled', String(!e.target.checked));
    $('pe-pick').style.opacity = e.target.checked ? 1 : 0.45;
  };
  $('pe-pick').style.opacity = 0.45;
  $('pe-pick').onclick = (e) => {
    if (!$('pe-consent').checked) {
      e.preventDefault();
      status('先に許可のチェックを入れてね', true);
    }
  };
  $('pe-cancel').onclick = () => close(null);

  const ed = { src: null, cut: null, mask: null, x: 0, y: 0, zoom: 1, th: 0.5, keep: false };

  $('pe-file').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      status('PNG / JPEG / WebP の画像を選んでね', true);
      return;
    }
    try {
      status('読み込み中…');
      ed.src = await fileToCanvas(file);
    } catch {
      status('画像を読み込めませんでした', true);
      return;
    }
    $('pe-edit').hidden = false;
    $('pe-save').disabled = false;
    fitTo(ed, null);
    draw();
    status('背景を切り抜き中…（初回は少し時間がかかります）');
    try {
      ed.mask = await personMask(ed.src);
      rebuildCut();
      fitTo(ed, maskBox(ed.mask, ed.src.width, ed.src.height));
      draw();
      status('できた！位置と大きさを調整してね');
    } catch (err) {
      console.warn(err);
      ed.keep = true;
      $('pe-keep').checked = true;
      draw();
      status('自動の切り抜きに失敗しました。背景ありで手動トリミングできます', true);
    }
  };

  function rebuildCut() {
    if (!ed.mask) return;
    ed.cut = applyMask(ed.src, ed.mask, ed.th);
  }

  const canvas = $('pe-canvas');
  const ctx = canvas.getContext('2d');
  function draw() {
    renderTo(ctx, ed);
  }

  $('pe-zoom').oninput = (e) => {
    const z = +e.target.value;
    const c = OUT / 2;
    ed.x = c - ((c - ed.x) * z) / ed.zoom;
    ed.y = c - ((c - ed.y) * z) / ed.zoom;
    ed.zoom = z;
    draw();
  };
  $('pe-th').oninput = (e) => {
    ed.th = +e.target.value;
    rebuildCut();
    draw();
  };
  $('pe-keep').onchange = (e) => {
    ed.keep = e.target.checked;
    draw();
  };

  // ドラッグで移動
  const prev = $('pe-prev');
  let drag = null;
  prev.onpointerdown = (e) => {
    drag = { x: e.clientX, y: e.clientY, ox: ed.x, oy: ed.y };
    prev.setPointerCapture(e.pointerId);
  };
  prev.onpointermove = (e) => {
    if (!drag) return;
    const k = OUT / prev.clientWidth;
    ed.x = drag.ox + (e.clientX - drag.x) * k;
    ed.y = drag.oy + (e.clientY - drag.y) * k;
    draw();
  };
  prev.onpointerup = prev.onpointercancel = () => (drag = null);

  $('pe-save').onclick = async () => {
    if (!ed.src) return;
    $('pe-save').disabled = true;
    status('保存中…');
    try {
      const out = document.createElement('canvas');
      out.width = out.height = OUT;
      renderTo(out.getContext('2d'), ed, true);
      const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
      const name = ($('pe-name').value || 'ムカつくアイツ').replace(/[<>]/g, '').slice(0, 10);
      const id = await saveCustomCharacter(scene, { name, blob });
      close(id);
    } catch (err) {
      console.warn(err);
      status('保存できませんでした（ブラウザの保存領域を確認してね）', true);
      $('pe-save').disabled = false;
    }
  };
  // ズームスライダーの値を ed に合わせる
  ed.onFit = () => ($('pe-zoom').value = String(ed.zoom));
}

function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      const r = Math.min(1, MAX_SRC / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * r);
      c.height = Math.round(im.height * r);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      resolve(c);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    im.src = url;
  });
}

function applyMask(src, mask, th) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  const img = x.getImageData(0, 0, c.width, c.height);
  const lo = th - 0.12;
  const hi = th + 0.12;
  const sx = mask.width / c.width;
  const sy = mask.height / c.height;
  for (let py = 0; py < c.height; py++) {
    const my = Math.min(mask.height - 1, Math.floor(py * sy));
    for (let px = 0; px < c.width; px++) {
      const v = mask.data[my * mask.width + Math.min(mask.width - 1, Math.floor(px * sx))];
      const a = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
      img.data[(py * c.width + px) * 4 + 3] *= a;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

function maskBox(mask, w, h) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < mask.height; y++)
    for (let x = 0; x < mask.width; x++)
      if (mask.data[y * mask.width + x] > 0.5) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const kx = w / mask.width;
  const ky = h / mask.height;
  return { x: x0 * kx, y: y0 * ky, w: (x1 - x0) * kx, h: (y1 - y0) * ky };
}

/** 人物の上半分（顔のあたり）が円に収まるように合わせる */
function fitTo(ed, box) {
  const { width: w, height: h } = ed.src;
  if (box) {
    const focusH = Math.min(box.h, box.w * 1.3);
    ed.zoom = (OUT * 0.85) / Math.max(focusH, box.w);
    const cx = box.x + box.w / 2;
    const cy = box.y + focusH / 2;
    ed.x = OUT / 2 - cx * ed.zoom;
    ed.y = OUT / 2 - cy * ed.zoom;
  } else {
    ed.zoom = OUT / Math.min(w, h);
    ed.x = (OUT - w * ed.zoom) / 2;
    ed.y = (OUT - h * ed.zoom) / 2;
  }
  ed.zoom = Math.max(0.3, Math.min(4, ed.zoom));
  ed.onFit?.();
}

function renderTo(ctx, ed, final = false) {
  ctx.clearRect(0, 0, OUT, OUT);
  if (!ed.src) return;
  const img = ed.keep || !ed.cut ? ed.src : ed.cut;
  ctx.save();
  if (final) {
    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.drawImage(img, ed.x, ed.y, ed.src.width * ed.zoom, ed.src.height * ed.zoom);
  ctx.restore();
}
