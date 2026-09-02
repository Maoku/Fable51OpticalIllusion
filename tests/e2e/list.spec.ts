import { expect, test } from '@playwright/test';

test('展示一覧から任意の展示の推奨視点へワープできる', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  const start = page.getByTestId('help-start');
  if (isMobile) await start.tap();
  else await start.click();

  const listButton = page.getByTestId('list-button');
  if (isMobile) await listButton.tap();
  else await listButton.click();
  await expect(page.getByTestId('exhibit-list')).toBeVisible();

  const item = page.getByTestId('list-item-ebbinghaus');
  if (isMobile) await item.tap();
  else await item.click();
  await expect(page.getByTestId('exhibit-list')).toBeHidden();
  await expect(page.getByTestId('hint-button')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hud-label')).toContainText('エビングハウス');

  const pos = await page.evaluate(() => window.__museum!.player.position.toArray());
  expect(pos[0]).toBeCloseTo(-8.85 + 2.2, 1);
});

test('Tab キーで展示一覧を開閉できる', async ({ page, isMobile }) => {
  test.skip(isMobile, 'キーボードは PC のみ');
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  await page.getByTestId('help-start').click();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('exhibit-list')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('exhibit-list')).toBeHidden();
});
