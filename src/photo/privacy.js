export const PRIVACY_HTML = `
<h2>プライバシーについて</h2>
<p><strong>写真はサーバーに送信されません。</strong>背景の切り抜きはすべてお使いの端末（ブラウザ）の中で行い、作ったキャラクターは端末内（IndexedDB）にだけ保存されます。</p>
<p>使えるのは、自分の写真か、写っている本人の許可を得た写真だけです。実在の人物を傷つける目的で使わないでください。</p>
<p>公開ランキングに送られるのは、ニックネーム・パンチパワー・判定結果・プリセットキャラ番号だけです。写真キャラで遊んだ場合も、写真は送られず「写真キャラ」とだけ表示されます。</p>
<p>ランキングは匿名認証（Firebase）を使い、個人を特定する情報は集めません。保存した写真キャラは「設定 → 写真キャラをすべて削除」でいつでも消せます。</p>`;

export function showPrivacy(scene) {
  const ov = document.getElementById('overlay');
  scene.input.enabled = false;
  ov.innerHTML = `<div class="ov-card">${PRIVACY_HTML}<div class="ov-row"><button class="ov-btn primary" id="pv-ok">閉じる</button></div></div>`;
  ov.hidden = false;
  ov.querySelector('#pv-ok').onclick = () => {
    ov.hidden = true;
    ov.innerHTML = '';
    scene.input.enabled = true;
  };
}
