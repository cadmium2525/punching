import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const photo = fileURLToPath(new URL('../../public/assets/characters/character_08.png', import.meta.url));
const shots = process.env.SHOTS_DIR;

async function clickNamed(page, sceneKey, name) {
  const pos = await page.evaluate(
    ([k, n]) => {
      const sc = window.__pf.game.scene.getScene(k);
      const o = sc.children.getByName(n) || sc.children.list.flatMap((c) => c.list || []).find((x) => x.name === n);
      const m = o.getWorldTransformMatrix();
      const r = window.__pf.game.canvas.getBoundingClientRect();
      const s = r.width / 720;
      return { x: r.left + m.tx * s, y: r.top + m.ty * s };
    },
    [sceneKey, name],
  );
  await page.mouse.click(pos.x, pos.y);
}

test('写真から端末内で背景除去してキャラ作成・画像は送信しない', async ({ page }) => {
  const sent = [];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.protocol === 'blob:' || u.protocol === 'data:') return; // 端末内のメモリ参照
    // 同一オリジンの静的ファイル取得とフォント以外の通信、または本文付きの送信はすべて記録
    if (req.method() !== 'GET' || (u.host !== '127.0.0.1:4173' && !u.host.endsWith('googleapis.com') && !u.host.endsWith('gstatic.com'))) sent.push(`${req.method()} ${req.url()}`);
  });
  await page.goto('./?test');
  await page.waitForFunction(() => window.__pf?.game?.scene?.isActive('Home'));
  await clickNamed(page, 'Home', 'select');
  await page.waitForFunction(() => window.__pf.game.scene.isActive('Select'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const sc = window.__pf.game.scene.getScene('Select');
    sc.children.list.find((c) => c.label?.text?.includes('写真から作成')).emit('pointerdown');
    sc.children.list.find((c) => c.label?.text?.includes('写真から作成')).emit('pointerup');
  });
  await expect(page.locator('#pe')).toBeVisible();
  // 同意前はファイル選択できない
  await expect(page.locator('#pe-file')).toBeDisabled();
  await page.locator('#pe-consent').check();
  await page.locator('#pe-file').setInputFiles(photo);
  await expect(page.locator('#pe-st')).toHaveText(/できた|失敗/, { timeout: 60000 });
  const st = await page.locator('#pe-st').textContent();
  expect(st).toContain('できた');
  if (shots) await page.screenshot({ path: `${shots}/07_photo.png` });
  await page.locator('#pe-name').fill('テスト上司');
  await page.locator('#pe-save').click();
  await expect(page.locator('#overlay')).toBeHidden();
  const ids = await page.evaluate(() => window.__pf.game.scene.getScene('Select').cards && [...window.__pf.game.scene.getScene('Select').cards.keys()]);
  expect(ids.some((id) => id.startsWith('custom-'))).toBe(true);
  // 再読み込みしても IndexedDB から復元される
  await page.reload();
  await page.waitForFunction(() => window.__pf?.game?.scene?.isActive('Home'));
  const n = await page.evaluate(async () => (await new Promise((r) => { const q = indexedDB.open('punch-flight'); q.onsuccess = () => { const t = q.result.transaction('characters').objectStore('characters').count(); t.onsuccess = () => r(t.result); }; })));
  expect(n).toBe(1);
  expect(sent).toEqual([]);
});
