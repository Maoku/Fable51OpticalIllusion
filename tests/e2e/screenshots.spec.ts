import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * 推奨視点のスクリーンショットを Docs/screenshots/ に保存する。
 * 通常のテストでは走らせず、`SHOTS=1 npx playwright test screenshots --project=desktop-chromium` で実行する。
 * 指定した展示だけ撮るには `SHOTS=demo-guide,demo-section` のように id をカンマ区切りで渡す。
 */
const SHOTS = process.env.SHOTS;
const OUT = 'Docs/screenshots';

/**
 * 任意の位置からの撮影: SHOT_POSES="name:x,z,yaw,pitch;name2:..." で指定する。
 */
const POSES = process.env.SHOT_POSES;

test.describe('screenshots', () => {
  test.skip(!SHOTS && !POSES, 'SHOTS / SHOT_POSES 環境変数が未設定');

  test('指定した位置と向きから撮影する', async ({ page }) => {
    test.skip(!POSES, 'SHOT_POSES が未設定');
    test.setTimeout(300_000);
    mkdirSync(OUT, { recursive: true });
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
    await page.getByTestId('help-start').click();
    for (const entry of POSES!.split(';')) {
      const [name, nums] = entry.split(':');
      const [x, z, yaw, pitch] = nums!.split(',').map(Number);
      await page.evaluate(
        ([x, z, yaw, pitch]) => {
          const m = window.__museum!;
          m.player.teleport({
            position: m.player.position.clone().set(x!, 0, z!),
            yaw: yaw!,
            pitch: pitch!,
          });
        },
        [x, z, yaw, pitch],
      );
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/${name}.png` });
    }
  });

  test('各展示の推奨視点と種明かし後を撮影する', async ({ page }) => {
    test.skip(!SHOTS, 'SHOTS が未設定');
    test.setTimeout(600_000);
    mkdirSync(OUT, { recursive: true });
    // 描画の遅い環境でも演出が終わるよう早送りする(撮るのは静止した状態)
    await page.goto('/?timescale=3' + (process.env.SHOT_QUERY ?? ''));
    await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
    await page.getByTestId('help-start').click();

    const ids: string[] = await page.evaluate(() =>
      window.__museum!.registry.exhibits.map((e) => e.meta.id),
    );
    const wanted = SHOTS === '1' ? ids : SHOTS!.split(',').filter((s) => ids.includes(s));

    for (const id of wanted) {
      await page.evaluate((id) => window.__museum!.warpTo(id), id);
      await expect(page.getByTestId('hint-button')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${id}.png` });

      await page.evaluate((id) => window.__museum!.hints.open(id), id);
      await expect
        .poll(() => page.evaluate(() => window.__museum!.hints.hintPlayer.progress), {
          timeout: 30_000,
        })
        .toBe(1);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/${id}-hint.png` });

      await page.evaluate(() => window.__museum!.hints.close());
      await expect
        .poll(() => page.evaluate(() => window.__museum!.hints.hintPlayer.progress), {
          timeout: 30_000,
        })
        .toBe(0);
    }
  });
});
