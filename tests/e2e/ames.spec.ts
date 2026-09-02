import { expect, test, type Page } from '@playwright/test';

/**
 * C1 エイムズの部屋。
 * 種明かしでは二体の人形から等距離になる視点へ回り込む。
 * そこでは同じ身長が同じ大きさに見えるので、「遠い方が小さく見えていただけ」が
 * そのまま画面に出る。
 */
async function start(page: Page, isMobile: boolean): Promise<void> {
  await page.goto('/?timescale=3');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  const btn = page.getByTestId('help-start');
  if (isMobile) await btn.tap();
  else await btn.click();
}

/** 二体の人形の見かけの身長(画面上の高さ)の比 */
function apparentHeightRatio(page: Page): Promise<number> {
  return page.evaluate(() => {
    const m = window.__museum!;
    const camera = m.camera;
    camera.updateMatrixWorld();
    const v = camera.matrixWorldInverse.elements;
    const p = camera.projectionMatrix.elements;
    /** ワールド座標の点が画面のどの高さに来るか(NDC の y) */
    const screenY = (x: number, y: number, z: number): number => {
      const vx = v[0]! * x + v[4]! * y + v[8]! * z + v[12]!;
      const vy = v[1]! * x + v[5]! * y + v[9]! * z + v[13]!;
      const vz = v[2]! * x + v[6]! * y + v[10]! * z + v[14]!;
      const cy = p[1]! * vx + p[5]! * vy + p[9]! * vz + p[13]!;
      const cw = p[3]! * vx + p[7]! * vy + p[11]! * vz + p[15]!;
      return cy / cw;
    };
    const heights: number[] = [];
    m.registry.get('ames-room')!.object.traverse((o) => {
      if (o.name !== 'figure') return;
      o.updateMatrixWorld();
      const e = o.matrixWorld.elements;
      const x = e[12]!;
      const y = e[13]!;
      const z = e[14]!;
      heights.push(Math.abs(screenY(x, y + 1.3, z) - screenY(x, y, z)));
    });
    return heights.length === 2 ? heights[0]! / heights[1]! : -1;
  });
}

test('エイムズの部屋: 種明かしの視点では二体が同じ大きさに見える', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.evaluate(() => window.__museum!.warpTo('ames-room'));
  await expect(page.getByTestId('hint-button')).toBeVisible({ timeout: 15_000 });

  // 覗き窓からは見かけの大きさが大きく違う
  const before = await apparentHeightRatio(page);
  expect(before).toBeGreaterThan(0);
  expect(before, '覗き窓からの見かけの身長の比').toBeLessThan(0.75);

  await page.evaluate(() => window.__museum!.hints.open('ames-room'));
  await expect
    .poll(() => page.evaluate(() => window.__museum!.hints.hintPlayer.progress), {
      timeout: 45_000,
    })
    .toBe(1);

  const after = await apparentHeightRatio(page);
  expect(after, '等距離の視点からの見かけの身長の比').toBeGreaterThan(0.95);
  expect(after).toBeLessThan(1.05);
});
