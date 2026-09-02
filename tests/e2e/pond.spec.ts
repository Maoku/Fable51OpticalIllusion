import { expect, test, type Page } from '@playwright/test';

/**
 * F7 逆さの水面。
 * 水面は平面反射で、反射の描画中だけ彫刻を差し替える。
 * 立方体の塔が立っているのに、水面には球の塔が映る。
 */
// SwiftShader は CPU 描画なので、反射を描くテストは時間がかかる
test.setTimeout(150_000);

async function start(page: Page, isMobile: boolean): Promise<void> {
  // 平面反射は low 以外で動く。GTAO のぶん重い high ではなく mid で確かめる
  await page.goto('/?timescale=3&quality=mid');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  await page.evaluate(() => {
    window.__museum!.quality.paused = true;
  });
  const btn = page.getByTestId('help-start');
  if (isMobile) await btn.tap();
  else await btn.click();
}

interface PondState {
  renders: number;
  strength: number;
}

function pond(page: Page): Promise<PondState> {
  return page.evaluate(() => {
    const ex = window.__museum!.registry.get('inverted-pond') as unknown as {
      water: { reflectionRenders: number; reflectionStrength: number } | null;
    };
    return {
      renders: ex.water?.reflectionRenders ?? -1,
      strength: ex.water?.reflectionStrength ?? -1,
    };
  });
}

test('逆さの水面: 水盤を見ている間だけ反射を描き直す', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.evaluate(() => window.__museum!.warpTo('inverted-pond'));
  // 推奨視点では毎フレーム更新される
  const first = await pond(page);
  expect(first.renders).toBeGreaterThanOrEqual(0);
  await expect
    .poll(async () => (await pond(page)).renders, { timeout: 20_000 })
    .toBeGreaterThan(first.renders);

  // 背を向ければ増えない(視錐台の外)。
  // SwiftShader は数 fps しか出ないので、止まるまで待ってから確かめる
  await page.evaluate(() => {
    window.__museum!.player.teleport({ yaw: Math.PI, pitch: 0 });
  });
  await expect
    .poll(
      async () => {
        const a = (await pond(page)).renders;
        await page.waitForTimeout(1500);
        return (await pond(page)).renders - a;
      },
      { timeout: 40_000 },
    )
    .toBe(0);
});

test('逆さの水面: 種明かしで映り込みが弱まり、戻すと元に戻る', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.evaluate(() => window.__museum!.warpTo('inverted-pond'));
  expect((await pond(page)).strength).toBeCloseTo(1, 3);

  await page.evaluate(() => window.__museum!.hints.open('inverted-pond'));
  await expect
    .poll(() => page.evaluate(() => window.__museum!.hints.hintPlayer.progress), {
      timeout: 45_000,
    })
    .toBe(1);
  expect((await pond(page)).strength).toBeCloseTo(0.35, 2);

  await page.evaluate(() => window.__museum!.hints.close());
  await expect
    .poll(() => page.evaluate(() => window.__museum!.hints.hintPlayer.progress), {
      timeout: 45_000,
    })
    .toBe(0);
  expect((await pond(page)).strength).toBeCloseTo(1, 3);
});
