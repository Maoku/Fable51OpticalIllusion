import { expect, test } from '@playwright/test';

test('終わらない階段: 上の周の継ぎ目をまたぐと 1 周分だけ下へ戻り、水平位置は変わらない', async ({
  page,
  isMobile,
}) => {
  await page.goto('/?timescale=3');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  const start = page.getByTestId('help-start');
  if (isMobile) await start.tap();
  else await start.click();

  // 上の周の東側の階段(A')の途中、継ぎ目の手前に立つ(ローカル z = +0.2)
  await page.evaluate(() => {
    window.__museum!.player.position.set(-2.925, 6.3, -12.8);
  });
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => window.__museum!.player.position.y);
  expect(before).toBeGreaterThan(5.6);

  // 継ぎ目の帯(ローカル z ∈ [-1.0, -0.2])へ進む
  await page.evaluate(() => {
    window.__museum!.player.position.z = -13.6;
  });
  await expect
    .poll(() => page.evaluate(() => window.__museum!.player.position.y), { timeout: 40_000 })
    .toBeLessThan(2);
  const pos = await page.evaluate(() => window.__museum!.player.position.toArray());
  expect(pos[0]).toBeCloseTo(-2.925, 2);
  expect(pos[2]).toBeCloseTo(-13.6, 2);
  const teleports = await page.evaluate(
    () =>
      (window.__museum!.registry.get('endless-stair') as unknown as { teleports: number })
        .teleports,
  );
  expect(teleports).toBe(1);
});
