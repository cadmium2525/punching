// Firebase エミュレーター上で、ゲーム → ニックネーム登録 → ランキング反映までを通しで確認
import { test, expect } from '@playwright/test';

test('全PERFECTをランキングに登録すると今日1位になる', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?test&bot=perfect&fast');
  await page.waitForFunction(() => window.__pf?.game?.scene?.isActive('Home'));
  await page.evaluate(() => window.__pf.game.scene.getScene('Home').scene.start('MiniGame', { characterId: 'preset-02' }));
  await page.waitForFunction(() => window.__pf.game.scene.isActive('Result'), null, { timeout: 60000 });
  // 未登録なので「登録する」ボタンが出る → 押してニックネーム入力
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const sc = window.__pf.game.scene.getScene('Result');
    const b = sc.children.list.find((c) => c.label?.text === '登録する');
    b.emit('pointerdown');
    b.emit('pointerup');
  });
  await page.locator('#nick').fill('パンチ職人');
  await page.locator('#nick-ok').click();
  await expect(page.locator('#overlay')).toBeHidden({ timeout: 15000 });
  await page.waitForFunction(() => window.__pf.game.scene.getScene('Result').rankText.text.includes('位'), null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__pf.game.scene.getScene('Result').rankText.text)).toBe('今日 1位');

  // ランキング画面に表示される
  await page.evaluate(() => window.__pf.game.scene.getScene('Result').scene.start('Ranking', { from: 'Home' }));
  await page.waitForFunction(() => window.__pf.game.scene.getScene('Ranking').mine?.text?.includes('1位'), null, { timeout: 15000 });
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/08_ranking.png` });
  const names = await page.evaluate(() => window.__pf.game.scene.getScene('Ranking').list.list.filter((o) => o.text).map((o) => o.text));
  expect(names).toContain('パンチ職人');
  expect(errors).toEqual([]);
});
