// 絵コンテ用スチルを撮る(Docs/SHOOTING_PLAN.md 参照)。
// SwiftShader(CPU 描画)で quality=high を強制し、HUD を隠して 1280x720 で撮る。
//
//   npm run dev
//   BASE=http://localhost:5173 node Docs/shooting/storyboard.mjs Docs/shooting/storyboard-shots.json
//
// 出力は Docs/screenshots/storyboard/<name>.png(git 管理外)。
// shots.json の各要素: { name, pose: [x, z, yaw, pitch] } または { name, warp: id, hint?: id, hintT?: 0〜1 }
// hintT を指定すると、演出がその進行度に達した時点で時間を止めて撮る。
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'Docs/screenshots/storyboard';
const shots = JSON.parse(readFileSync(process.argv[2] ?? 'Docs/shooting/storyboard-shots.json', 'utf8'));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`${BASE}/?quality=high&timescale=3`);
await page.waitForSelector('body[data-ready="1"]', { timeout: 120_000 });
await page.getByTestId('help-start').click();
await page.evaluate(() => {
  document.getElementById('ui').style.display = 'none';
});

for (const s of shots) {
  const t0 = Date.now();
  await page.evaluate(() => {
    const m = window.__museum;
    m.loop.timeScale = 3;
    m.hints.hintPlayer.reset();
    m.player.cameraOverride = null;
  });
  if (s.warp) await page.evaluate((id) => window.__museum.warpTo(id), s.warp);
  if (s.pose) {
    await page.evaluate(([x, z, yaw, pitch]) => {
      const m = window.__museum;
      m.player.teleport({ position: m.player.position.clone().set(x, 0, z), yaw, pitch });
    }, s.pose);
  }
  await page.waitForTimeout(800);
  if (s.hint) {
    const target = s.hintT ?? 1;
    await page.evaluate((id) => window.__museum.hints.open(id), s.hint);
    await page.waitForFunction((t) => window.__museum.hints.hintPlayer.progress >= t, target, {
      timeout: 120_000,
    });
    if (target < 1) {
      await page.evaluate(() => {
        window.__museum.loop.timeScale = 0;
      });
    }
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  const pose = await page.evaluate(() => {
    const p = window.__museum.player;
    return [p.position.x, p.position.z, p.yaw, p.pitch].map((v) => Math.round(v * 1000) / 1000);
  });
  console.log(`[${s.name}] pose=${JSON.stringify(pose)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close();
