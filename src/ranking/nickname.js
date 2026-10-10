// ニックネーム入力（DOM オーバーレイ）
import { ranking } from './index.js';
import { cleanNickname, isValidNickname } from './validate.js';

export function askNickname() {
  return new Promise((resolve) => {
    const ov = document.getElementById('overlay');
    ov.innerHTML = `
      <div class="ov-card">
        <h2>ランキング用の名前</h2>
        <p>1〜12文字。公開ランキングに表示されます。<strong>写真や本名は使わないでね。</strong></p>
        <input type="text" id="nick" maxlength="12" autocomplete="off" placeholder="例：パンチ職人" />
        <div class="ov-status" id="nick-st"></div>
        <div class="ov-row">
          <button class="ov-btn" id="nick-cancel">やめる</button>
          <button class="ov-btn primary" id="nick-ok">決定</button>
        </div>
      </div>`;
    ov.hidden = false;
    const input = ov.querySelector('#nick');
    const st = ov.querySelector('#nick-st');
    input.value = ranking.nickname || '';
    setTimeout(() => input.focus(), 50);
    const close = (v) => {
      ov.hidden = true;
      ov.innerHTML = '';
      resolve(v);
    };
    ov.querySelector('#nick-cancel').onclick = () => close(null);
    ov.querySelector('#nick-ok').onclick = async () => {
      const name = cleanNickname(input.value);
      if (!isValidNickname(name)) {
        st.textContent = '1〜12文字で入力してね（< > は使えません）';
        st.className = 'ov-status ov-error';
        return;
      }
      st.textContent = '保存中…';
      st.className = 'ov-status';
      try {
        await ranking.setNickname(name);
        close(name);
      } catch (e) {
        st.textContent = e.userMessage || '保存できませんでした';
        st.className = 'ov-status ov-error';
      }
    };
  });
}
