import { expect, test } from '@playwright/test';

test('操作説明からクレジット画面を開閉できる', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  const link = page.getByTestId('credits-button');
  if (isMobile) await link.tap();
  else await link.click();
  await expect(page.getByTestId('credits')).toBeVisible();
  await expect(page.getByTestId('credits')).toContainText('three.js');
  await expect(page.getByTestId('credits')).toContainText('Noto Sans JP');
  const close = page.getByTestId('credits-close');
  if (isMobile) await close.tap();
  else await close.click();
  await expect(page.getByTestId('credits')).toBeHidden();
  // クレジットを閉じた後は操作できる
  expect(await page.evaluate(() => window.__museum!.player.enabled)).toBe(true);
});
