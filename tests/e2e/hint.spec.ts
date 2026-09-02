import { expect, test, type Page } from '@playwright/test';

// 描画の遅い CI 環境でも演出が終わるよう、時間を早送りしてテストする
test.setTimeout(150_000);

async function start(page: Page, isMobile: boolean): Promise<void> {
  await page.goto('/?timescale=3');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  const btn = page.getByTestId('help-start');
  if (isMobile) await btn.tap();
  else await btn.click();
}

async function progress(page: Page): Promise<number> {
  return page.evaluate(() => window.__museum!.hints.hintPlayer.progress);
}

test('ワープ → ボタン表示 → 押下でパネルと演出 → 再押下で復帰', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.evaluate(() => window.__museum!.warpTo('ames-room'));

  const hintButton = page.getByTestId('hint-button');
  await expect(hintButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hud-label')).toContainText('エイムズの部屋');
  await expect(page.getByTestId('hint-panel')).toBeHidden();

  if (isMobile) await hintButton.tap();
  else await hintButton.click();
  await expect(page.getByTestId('hint-panel')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('hint-panel')).toContainText('台形');
  await expect.poll(() => progress(page), { timeout: 45_000 }).toBe(1);
  await expect(hintButton).toHaveText('元に戻す');

  if (isMobile) await hintButton.tap();
  else await hintButton.click();
  await expect.poll(() => progress(page), { timeout: 45_000 }).toBe(0);
  await expect(page.getByTestId('hint-panel')).toBeHidden();
  await expect(hintButton).toHaveText('ヒントを見る');
});

test('展示から離れると演出が戻りパネルが閉じる', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.evaluate(() => window.__museum!.warpTo('muller-lyer'));
  const hintButton = page.getByTestId('hint-button');
  await expect(hintButton).toBeVisible({ timeout: 15_000 });
  if (isMobile) await hintButton.tap();
  else await hintButton.click();
  await expect.poll(() => progress(page), { timeout: 15_000 }).toBeGreaterThan(0);

  // 部屋の反対側へ移動
  await page.evaluate(() => window.__museum!.player.position.set(0, 0, 0));
  await expect.poll(() => progress(page), { timeout: 45_000 }).toBe(0);
  await expect(page.getByTestId('hint-panel')).toBeHidden();
  await expect(hintButton).toBeHidden();
});

test('E キーでもヒントを開閉できる', async ({ page, isMobile }) => {
  test.skip(isMobile, 'キーボードは PC のみ');
  await start(page, isMobile);
  await page.evaluate(() => window.__museum!.warpTo('checker-shadow'));
  await expect(page.getByTestId('hint-button')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('KeyE');
  await expect(page.getByTestId('hint-panel')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => progress(page), { timeout: 45_000 }).toBe(1);
  await page.keyboard.press('KeyE');
  await expect.poll(() => progress(page), { timeout: 45_000 }).toBe(0);
});

test('視点固定の演出(CameraOrbit)は推奨視点へ移動してからカメラを回し、戻すと元の位置に戻る', async ({
  page,
  isMobile,
}) => {
  await start(page, isMobile);
  await page.evaluate(() => window.__museum!.warpTo('penrose-triangle'));
  const hintButton = page.getByTestId('hint-button');
  await expect(hintButton).toBeVisible({ timeout: 15_000 });
  const before = await page.evaluate(() => window.__museum!.camera.position.toArray());
  if (isMobile) await hintButton.tap();
  else await hintButton.click();
  await expect.poll(() => progress(page), { timeout: 45_000 }).toBe(1);
  const during = await page.evaluate(() => window.__museum!.camera.position.toArray());
  expect(Math.hypot(during[0]! - before[0]!, during[2]! - before[2]!)).toBeGreaterThan(0.5);
  expect(await page.evaluate(() => window.__museum!.player.frozen)).toBe(true);

  if (isMobile) await hintButton.tap();
  else await hintButton.click();
  await expect.poll(() => progress(page), { timeout: 45_000 }).toBe(0);
  await expect
    .poll(
      async () => {
        const after = await page.evaluate(() => window.__museum!.camera.position.toArray());
        return Math.hypot(after[0]! - before[0]!, after[2]! - before[2]!);
      },
      { timeout: 10_000 },
    )
    .toBeLessThan(0.005);
  expect(await page.evaluate(() => window.__museum!.player.frozen)).toBe(false);
});
