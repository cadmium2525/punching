// 端末内の人物セグメンテーション（MediaPipe Image Segmenter / wasm）
// 写真はどこにも送信しない。wasm とモデルは同じサイト（GitHub Pages）から読み込む。
let segmenterP = null;

function assetUrl(p) {
  return new URL(p, document.baseURI).href;
}

export function loadSegmenter() {
  if (!segmenterP) {
    segmenterP = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(assetUrl('mediapipe/wasm'));
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: assetUrl('models/selfie_segmenter.tflite'), delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    })().catch((e) => {
      segmenterP = null;
      throw e;
    });
  }
  return segmenterP;
}

/** canvas の人物らしさ（0〜1）を Float32Array で返す */
export async function personMask(canvas) {
  const seg = await loadSegmenter();
  const res = seg.segment(canvas);
  try {
    const m = res.confidenceMasks[0];
    const data = m.getAsFloat32Array().slice();
    return { data, width: m.width, height: m.height };
  } finally {
    res.close();
  }
}
