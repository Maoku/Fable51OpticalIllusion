// テロップ(Docs/SHOOTING_PLAN.md §5)を 1 枚ずつ透過 PNG に焼く。
// アプリと同じ Noto Sans JP を使うため、ブラウザで組んで撮る。
//
//   node Docs/shooting/telops.mjs
//
// 出力は OUT(既定 Docs/screenshots/pv/telops)に 00.png … と telops.json(時間表)。
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = process.env.OUT ?? 'Docs/screenshots/pv/telops';
const WIDTH = Number(process.env.WIDTH ?? 1920);
const HEIGHT = Number(process.env.HEIGHT ?? 1080);

/** §5 テロップ表。in/out は秒、kind が組み方(位置と大きさ) */
export const TELOPS = [
  { in: 0.3, out: 3.9, kind: 'title', text: 'ブラウザで歩ける、錯視の美術館' },
  { in: 5.1, out: 6.4, kind: 'lead', text: '坂を登る球' },
  { in: 6.8, out: 8.0, kind: 'lead', text: '傾いていたのは、部屋のほう' },
  { in: 8.2, out: 9.1, kind: 'lead', text: '底なしの井戸' },
  { in: 9.5, out: 10.7, kind: 'lead', text: '深い穴はなかった' },
  { in: 10.9, out: 12.9, kind: 'title', text: '総費用 $95.77 (建設・改修・宣伝)' },
  { in: 13.0, out: 15.0, kind: 'url', text: 'maoku.github.io/Fable51OpticalIllusion' },
];

const CSS = `
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; position: relative; overflow: hidden;
    font-family: 'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif;
    color: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .row { position: absolute; display: flex; }
  /* 展示名と種明かしは画面の下 1/5、左寄せ(§5) */
  .name { left: 96px; bottom: 148px; }
  .lead { left: 96px; bottom: 68px; }
  .title { left: 0; right: 0; bottom: 96px; justify-content: center; }
  .url { left: 0; right: 0; bottom: 76px; justify-content: center; }
  .chip { left: 0; right: 0; bottom: 60px; justify-content: center; }
  /* 白文字に薄い黒の座布団(不透明度 55%) */
  .plate {
    background: rgba(29, 27, 24, 0.55);
    border-radius: 10px;
    padding: 0.22em 0.6em;
    line-height: 1.32;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  }
  .name .plate { font-size: 36px; font-weight: 500; letter-spacing: 0.04em; }
  .lead .plate { font-size: 44px; font-weight: 700; letter-spacing: 0.02em; }
  .title .plate { font-size: 64px; font-weight: 700; letter-spacing: 0.02em; }
  .url .plate { font-size: 40px; font-weight: 500; letter-spacing: 0.03em; }
  /* HUD の「ヒントを見る」ボタンを模した黒地の角丸 */
  .chip .plate {
    background: #1d1b18;
    color: #f4f1ec;
    border-radius: 999px;
    padding: 0.6em 1.4em;
    font-size: 32px;
    font-weight: 500;
    text-shadow: none;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  }
`;

const html = (kind, text) => `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap">
<style>${CSS}</style></head><body>
<div class="row ${kind}"><span class="plate">${text}</span></div>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const list = [];
for (const [i, t] of TELOPS.entries()) {
  const file = `${String(i).padStart(2, '0')}.png`;
  await page.setContent(html(t.kind, t.text), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${file}`, omitBackground: true });
  list.push({ ...t, file });
  console.log(`[${file}] ${t.kind} ${t.in}–${t.out}s ${t.text}`);
}
writeFileSync(`${OUT}/telops.json`, JSON.stringify(list, null, 2) + '\n');
await browser.close();
