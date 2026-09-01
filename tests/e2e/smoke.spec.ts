import { expect, test, type Page } from '@playwright/test';

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** SwiftShader などテスト環境固有の警告を除く */
function realErrors(errors: string[]): string[] {
  return errors.filter((e) => !/swiftshader|GPU stall|WebGL warning|Automatic fallback/i.test(e));
}

test('ページを読み込むとキャンバスが表示され、コンソールエラーが出ない', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/');
  await expect(page.locator('canvas#scene')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  await expect(page.getByTestId('help-start')).toBeVisible();
  expect(realErrors(errors)).toEqual([]);
});

test('操作説明を閉じるとキーボードで移動でき、壁を突き抜けない', async ({ page, isMobile }) => {
  test.skip(isMobile, 'キーボード操作は PC のみ');
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  await page.getByTestId('help-start').click();

  // 描画が遅い環境でも成立するよう、時間ではなく座標の変化を待つ
  const before = await page.evaluate(() => window.__museum!.player.position.z);
  await page.keyboard.down('KeyW');
  await expect
    .poll(() => page.evaluate(() => window.__museum!.player.position.z), { timeout: 20_000 })
    .toBeLessThan(before - 0.3);
  await page.keyboard.up('KeyW');

  // 西の壁(x = -9)のすぐ手前に立ち、壁へ向かって歩き続けても外へ出ない
  await page.evaluate(() => window.__museum!.player.position.set(-8, 0, 5));
  await page.keyboard.down('KeyA');
  await expect
    .poll(() => page.evaluate(() => window.__museum!.player.position.x), { timeout: 20_000 })
    .toBeLessThan(-8.4);
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyA');
  const x = await page.evaluate(() => window.__museum!.player.position.x);
  expect(x).toBeGreaterThanOrEqual(-8.5 - 1e-3);
});

test('モバイルでは仮想スティックのヒントが表示される', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'モバイルエミュレーションのみ');
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  await page.getByTestId('help-start').tap();
  await expect(page.locator('.touch-controls')).toBeVisible();
});
