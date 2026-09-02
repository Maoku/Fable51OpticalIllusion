import { expect, test, type Page } from '@playwright/test';

/**
 * F3 色の部屋。
 * 内装は無灯の一色なので材質からは稜線が出ないが、GTAO(スクリーンスペースの遮蔽)は
 * 深度と法線だけを見るため入隅を暗くしてしまい、床・壁・天井の稜線が浮かび上がる。
 * 部屋の中にいる間は AO を切ることで、奥行きの手がかりを消す。
 */
async function start(page: Page, isMobile: boolean): Promise<void> {
  // GTAO は high ティアだけなので固定する。SwiftShader では fps が出ず
  // 自動でティアが下がるので、動的調整も止める
  await page.goto('/?timescale=3&quality=high');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  await page.evaluate(() => {
    window.__museum!.quality.paused = true;
  });
  const btn = page.getByTestId('help-start');
  if (isMobile) await btn.tap();
  else await btn.click();
}

const aoEnabled = (page: Page): Promise<boolean> =>
  page.evaluate(() => window.__museum!.post.aoEnabled);

test('色の部屋: 中にいる間だけ AO が切れる', async ({ page, isMobile }) => {
  await start(page, isMobile);
  // 前提: high ティアでは AO が有効
  expect(await page.evaluate(() => window.__museum!.quality.settings.ssao)).toBe(true);
  expect(await aoEnabled(page)).toBe(true);

  // 推奨視点は部屋の中(入口から 1.2 m)
  await page.evaluate(() => window.__museum!.warpTo('ganzfeld-chamber'));
  await expect.poll(() => aoEnabled(page), { timeout: 20_000 }).toBe(false);

  // 部屋を出れば戻る
  await page.evaluate(() => {
    window.__museum!.player.position.set(0, 0, -24);
  });
  await expect.poll(() => aoEnabled(page), { timeout: 20_000 }).toBe(true);
});
