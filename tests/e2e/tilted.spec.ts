import { expect, test, type Page } from '@playwright/test';
import { TILT } from '../../src/exhibits/fable/TiltedRoom';

/**
 * F2 傾きの間。
 * 中に入るとカメラも部屋に合わせて傾くので、床と壁が画面の水平・垂直に見え、
 * 代わりに球が坂を登り、鉛直な人形と下げ振りが傾いて見える。
 * 種明かしでは視界が世界の水平へ戻り、部屋の方が傾いていたことが分かる。
 */
async function start(page: Page, isMobile: boolean): Promise<void> {
  await page.goto('/?timescale=3');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  const btn = page.getByTestId('help-start');
  if (isMobile) await btn.tap();
  else await btn.click();
}

/** いまプレイヤーが立っている位置での視界の傾き(ラジアン)。枠の外なら 0 */
function frameAngle(page: Page): Promise<number> {
  return page.evaluate(() => {
    const m = window.__museum!;
    const p = m.player.position;
    return m.museum.frameAt(p.x, p.z)?.angle ?? 0;
  });
}

/**
 * カメラの左右の傾き(ロール)。
 * 見上げ / 見下ろしでは変わらないので、視界の傾きだけを取り出せる。
 * 推奨視点は傾きの軸に沿って部屋の奥を見ているので、ここでは部屋の傾きがそのままロールになる。
 */
function cameraRoll(page: Page): Promise<number> {
  return page.evaluate(() => {
    const q = window.__museum!.camera.quaternion;
    // 右方向 = q * (1,0,0) の y 成分
    const y = 2 * (q.x * q.y + q.w * q.z);
    return Math.asin(Math.min(1, Math.max(-1, Math.abs(y))));
  });
}

const progress = (page: Page): Promise<number> =>
  page.evaluate(() => window.__museum!.hints.hintPlayer.progress);

test('傾きの間: 中では視界が部屋に合わせて傾き、種明かしで水平に戻る', async ({
  page,
  isMobile,
}) => {
  await start(page, isMobile);

  // 部屋の外では傾かない
  expect(await frameAngle(page)).toBe(0);
  expect(await cameraRoll(page)).toBeLessThan(0.01);

  // 推奨視点は部屋の中。部屋と同じ 12° だけ視界が傾く
  await page.evaluate(() => window.__museum!.warpTo('tilted-room'));
  await expect.poll(() => frameAngle(page), { timeout: 20_000 }).toBeCloseTo(TILT.angle, 4);
  expect(await cameraRoll(page)).toBeCloseTo(TILT.angle, 3);

  // 種明かしで世界の水平へ戻る
  await page.evaluate(() => window.__museum!.hints.open('tilted-room'));
  await expect.poll(() => progress(page), { timeout: 45_000 }).toBe(1);
  expect(await frameAngle(page)).toBeCloseTo(0, 6);
  expect(await cameraRoll(page)).toBeLessThan(0.01);

  // 閉じるとまた部屋に合わせて傾く
  await page.evaluate(() => window.__museum!.hints.close());
  await expect.poll(() => progress(page), { timeout: 45_000 }).toBe(0);
  expect(await frameAngle(page)).toBeCloseTo(TILT.angle, 4);
  expect(await cameraRoll(page)).toBeCloseTo(TILT.angle, 3);

  // 部屋を出れば傾きは消える
  await page.evaluate(() => {
    window.__museum!.player.position.set(0, 0, -30);
  });
  await expect.poll(() => frameAngle(page), { timeout: 20_000 }).toBe(0);
  await expect.poll(() => cameraRoll(page), { timeout: 20_000 }).toBeLessThan(0.01);
});
