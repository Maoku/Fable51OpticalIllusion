import { expect, test, type Page } from '@playwright/test';

/**
 * F4 窓の外の庭。
 * 霞(フォグ)はジオラマの中だけに効かせる。three.js のフォグはシーン全体に
 * 掛かるので、範囲を絞れていないと館内まで霞んでしまう。
 */
async function start(page: Page, isMobile: boolean, query = ''): Promise<void> {
  await page.goto(`/?timescale=3${query}`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  const btn = page.getByTestId('help-start');
  if (isMobile) await btn.tap();
  else await btn.click();
}

/** フォグが効いているマテリアルの数を、ジオラマの中と外で数える */
function fogCounts(page: Page): Promise<{ inside: number; outside: number }> {
  return page.evaluate(() => {
    const m = window.__museum!;
    const diorama = m.registry.get('garden-window')!.object.getObjectByName('diorama');
    const inScope = new Set<unknown>();
    diorama?.traverse((o) => {
      const mesh = o as unknown as { material?: unknown };
      if (!mesh.material) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        inScope.add(mat);
      }
    });
    let inside = 0;
    let outside = 0;
    const seen = new Set<unknown>();
    m.scene.traverse((o) => {
      const mesh = o as unknown as { material?: unknown };
      if (!mesh.material) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        const withFog = mat as { fog?: boolean };
        if (withFog.fog !== true) continue;
        if (inScope.has(mat)) inside++;
        else outside++;
      }
    });
    return { inside, outside };
  });
}

test('窓の外の庭: 霞はジオラマの中だけに効く', async ({ page, isMobile }) => {
  await start(page, isMobile);
  expect(await page.evaluate(() => window.__museum!.scene.fog !== null)).toBe(true);
  const counts = await fogCounts(page);
  expect(counts.inside, 'ジオラマの中で霞が効いているマテリアル').toBeGreaterThan(0);
  expect(counts.outside, 'ジオラマの外で霞が効いてしまっているマテリアル').toBe(0);
});

test('窓の外の庭: 種明かしで霞が晴れ、戻すと元に戻る', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.evaluate(() => window.__museum!.warpTo('garden-window'));
  const near = () => page.evaluate(() => (window.__museum!.scene.fog as { near: number }).near);
  const before = await near();
  await page.evaluate(() => window.__museum!.hints.open('garden-window'));
  await expect
    .poll(() => page.evaluate(() => window.__museum!.hints.hintPlayer.progress), {
      timeout: 45_000,
    })
    .toBe(1);
  expect(await near()).toBeGreaterThan(before);
  await page.evaluate(() => window.__museum!.hints.close());
  await expect
    .poll(() => page.evaluate(() => window.__museum!.hints.hintPlayer.progress), {
      timeout: 45_000,
    })
    .toBe(0);
  expect(await near()).toBeCloseTo(before, 3);
});

test('窓の外の庭: 被写界深度は既定では入らず、?dof=1 のときだけ入る', async ({
  page,
  isMobile,
}) => {
  const dof = () => page.evaluate(() => window.__museum!.post.dofEnabled);

  await start(page, isMobile, '&quality=high');
  await page.evaluate(() => {
    window.__museum!.quality.paused = true;
  });
  await page.evaluate(() => window.__museum!.warpTo('garden-window'));
  await page.waitForTimeout(600);
  expect(await dof(), '既定では入らない').toBe(false);

  await start(page, isMobile, '&quality=high&dof=1');
  await page.evaluate(() => {
    window.__museum!.quality.paused = true;
  });
  await page.evaluate(() => window.__museum!.warpTo('garden-window'));
  await expect.poll(dof, { timeout: 20_000 }).toBe(true);

  // 窓から離れれば外れる
  await page.evaluate(() => {
    window.__museum!.player.position.set(0, 0, 0);
  });
  await expect.poll(dof, { timeout: 20_000 }).toBe(false);
});
