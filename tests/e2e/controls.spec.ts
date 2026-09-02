import { expect, test, type Page } from '@playwright/test';

async function start(page: Page): Promise<void> {
  await page.goto('/?timescale=3');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  await page.getByTestId('help-start').click();
}

/** キャンバスの上でボタンを押しながら水平にドラッグする */
async function drag(page: Page, button: 'left' | 'right', dx: number): Promise<void> {
  const from = { x: 300, y: 400 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  // 何回かに分けて動かす(1 回の move だとブラウザがまとめてしまうことがある)
  for (let i = 1; i <= 4; i++) {
    await page.mouse.move(from.x + (dx * i) / 4, from.y);
  }
  await page.mouse.up({ button });
}

const yawOf = (page: Page): Promise<number> => page.evaluate(() => window.__museum!.player.yaw);

test.describe('PC の視点操作', () => {
  test.skip(({ isMobile }) => !!isMobile, 'マウス操作は PC のみ');

  test('右ボタンのドラッグで視点が回り、PointerLock は取られない', async ({ page }) => {
    await start(page);
    const before = await yawOf(page);
    await drag(page, 'right', 200);
    await expect.poll(() => yawOf(page), { timeout: 10_000 }).not.toBeCloseTo(before, 2);
    // 右へドラッグすると右を向く(yaw が減る)
    expect(await yawOf(page)).toBeLessThan(before);
    expect(await page.evaluate(() => document.pointerLockElement !== null)).toBe(false);
  });

  test('左ボタンのドラッグでも視点が回る', async ({ page }) => {
    await start(page);
    const before = await yawOf(page);
    await drag(page, 'left', -200);
    await expect.poll(() => yawOf(page), { timeout: 10_000 }).not.toBeCloseTo(before, 2);
    expect(await yawOf(page)).toBeGreaterThan(before);
  });

  test('キャンバスを左クリックしても PointerLock に入らない', async ({ page }) => {
    await start(page);
    await page.mouse.click(300, 400);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.pointerLockElement !== null)).toBe(false);
  });

  test('視点を回した直後でもヒントのボタンを押せる(Esc の解除が要らない)', async ({ page }) => {
    await start(page);
    await page.evaluate(() => window.__museum!.warpTo('ames-room'));
    const hintButton = page.getByTestId('hint-button');
    await expect(hintButton).toBeVisible({ timeout: 15_000 });

    await drag(page, 'right', 60);
    await hintButton.click();
    await expect(page.getByTestId('hint-panel')).toBeVisible({ timeout: 30_000 });
  });

  test('キャンバスの上ではブラウザのコンテキストメニューを止めている', async ({ page }) => {
    await start(page);
    // 実際の右クリックからの contextmenu は CDP 経由では発生しないので、
    // キャンバスに向けてイベントを流し、既定動作が止められることを確かめる
    const prevented = await page.evaluate(() => {
      const canvas = document.querySelector('canvas#scene');
      if (!canvas) return null;
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      return !canvas.dispatchEvent(event);
    });
    expect(prevented).toBe(true);
  });

  test('操作案内は視点を回すまで出ていて、回すと消える', async ({ page }) => {
    await start(page);
    const prompt = page.locator('.hud__prompt');
    await expect(prompt).toBeVisible();
    await drag(page, 'right', 80);
    await expect(prompt).toBeHidden();
  });
});
