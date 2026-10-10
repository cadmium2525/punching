import { test, expect } from '@playwright/test';

const shots = process.env.SHOTS_DIR;

async function snap(page, name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
}

async function waitScene(page, key, timeout = 30000) {
  await page.waitForFunction((k) => window.__pf?.game?.scene?.isActive(k), key, { timeout });
}

// Phaser のボタンは名前で探してクリックする
async function clickNamed(page, sceneKey, name) {
  const pos = await page.evaluate(
    ([k, n]) => {
      const sc = window.__pf.game.scene.getScene(k);
      const o = sc.children.getByName(n) || sc.children.list.find((c) => c.list?.find?.((x) => x.name === n))?.list.find((x) => x.name === n);
      const m = o.getWorldTransformMatrix();
      const canvas = window.__pf.game.canvas.getBoundingClientRect();
      const s = canvas.width / 720;
      return { x: canvas.left + m.tx * s, y: canvas.top + m.ty * s };
    },
    [sceneKey, name],
  );
  await page.mouse.click(pos.x, pos.y);
}

test('全PERFECTで3050以上・GOD PUNCH・銀河の向こう', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?test&bot=perfect');
  await waitScene(page, 'Home');
  await page.waitForTimeout(800);
  await snap(page, '01_home');
  await clickNamed(page, 'Home', 'start');
  await waitScene(page, 'MiniGame');
  await page.waitForTimeout(1600);
  await snap(page, '03_minigame');
  await waitScene(page, 'Punch', 40000);
  await page.waitForTimeout(1350);
  await snap(page, '04_punch');
  await waitScene(page, 'Flight');
  await page.waitForTimeout(5200);
  await snap(page, '05_flight');
  await waitScene(page, 'Result', 15000);
  await page.waitForTimeout(900);
  await snap(page, '06_result');
  const r = await page.evaluate(() => window.__pfResult);
  expect(r.power).toBeGreaterThanOrEqual(3050);
  expect(r.power).toBeLessThanOrEqual(3200);
  expect(r.god).toBe(true);
  expect(r.km).toBeGreaterThan(9.5e17);
  expect(errors).toEqual([]);
});

test('未入力（全MISS）でも5ラウンド途切れず最後まで進む・飛行スキップで距離不変', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?test&bot=miss');
  await waitScene(page, 'Home');
  await clickNamed(page, 'Home', 'start');
  await waitScene(page, 'Flight', 40000);
  await page.waitForTimeout(1200);
  await page.mouse.click(200, 400); // スキップ
  await waitScene(page, 'Result', 5000);
  const r = await page.evaluate(() => window.__pfResult);
  expect(r.power).toBe(350);
  expect(r.km).toBe(1000);
  expect(errors).toEqual([]);
});

test('キャラ選択 → リトライが1秒以内', async ({ page }) => {
  await page.goto('./?test&bot=perfect&fast');
  await waitScene(page, 'Home');
  await clickNamed(page, 'Home', 'select');
  await waitScene(page, 'Select');
  await clickNamed(page, 'Select', 'preset-07');
  await page.waitForTimeout(500);
  await snap(page, '02_select');
  await clickNamed(page, 'Select', 'play');
  await waitScene(page, 'Result', 40000);
  await page.waitForTimeout(400);
  const t0 = Date.now();
  await clickNamed(page, 'Result', 'retry');
  await waitScene(page, 'MiniGame', 1000);
  expect(Date.now() - t0).toBeLessThan(1000);
  const ch = await page.evaluate(() => window.__pf.game.scene.getScene('MiniGame').state.characterId);
  expect(ch).toBe('preset-07');
});
