import { expect, test } from '@playwright/test';

test('ページを読み込むとキャンバスが表示され、コンソールエラーが出ない', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.locator('canvas#scene')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });

  // SwiftShader のパフォーマンス警告は無視する
  const real = errors.filter((e) => !/swiftshader|GPU stall|WebGL warning/i.test(e));
  expect(real).toEqual([]);
});
