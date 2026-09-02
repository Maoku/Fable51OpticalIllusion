// 15 秒 PV の素材をフレーム単位で撮る(Docs/SHOOTING_PLAN.md §3 のカット表どおり)。
//
// 画面収録の代わりに、時間を仮想化してカット表の時刻ちょうどで 1 枚ずつ撮る。
// requestAnimationFrame と performance.now を差し替え、1 フレーム 1/FPS 秒ずつ
// 手で進めるので、描画が何ミリ秒かかってもカット尺はずれない(fps 非依存)。
//
//   npm run dev
//   BASE=http://localhost:5173 node Docs/shooting/capture.mjs
//
// 出力は OUT(既定 <scratch>/frames)に frame_000000.png … 連番。
// 実機 GPU を使うため headed で起動する(HEADLESS=1 で SwiftShader に切り替わるが非常に遅い)。
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'Docs/screenshots/pv/frames';
const FPS = Number(process.env.FPS ?? 60);
const WIDTH = Number(process.env.WIDTH ?? 1920);
const HEIGHT = Number(process.env.HEIGHT ?? 1080);
const DURATION = Number(process.env.DURATION ?? 15);
const QUALITY = process.env.QUALITY ?? 'high';
const HEADLESS = process.env.HEADLESS === '1';
const DT = 1 / FPS;
const FRAMES = Math.round(DURATION * FPS);

/** カット表(秒)。時刻は SHOOTING_PLAN.md §3 の IN と一致する */
const TIMELINE = [
  [0.0, 'c1-dolly'], // カット 1: 入館のドリーイン(1.8 s)
  [1.8, 'c2'], // カット 2: C2 ペンローズの三角形(0.5 + 2.6 s)
  [4.9, 'c3-cut'], // カット 3: F2 傾きの間へワープ、球が坂を登る
  [6.4, 'c3-reveal'], // 種明かし(1.6 s)
  [8.0, 'c4-approach'], // カット 4: F5 井戸へ寄る(0.6 s)
  [8.6, 'c4-reveal'], // 種明かし(0.5 + 1.6 s)
  [10.7, 'c5'], // カット 5: F6 終わらない階段(0.5 + 3.6 s)
];

/** 時間を仮想化する。ページのどのスクリプトより先に入れる */
function virtualClock() {
  let vt = 0;
  let nextId = 1;
  const pending = new Map();
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => pending.delete(id);
  performance.now = () => vt;
  window.__vclock = {
    get time() {
      return vt / 1000;
    },
    step(dtMs) {
      vt += dtMs;
      const due = [...pending.values()];
      pending.clear();
      for (const cb of due) cb(vt);
    },
  };
}

const browser = await chromium.launch({
  headless: HEADLESS,
  args: HEADLESS ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.addInitScript(virtualClock);

const step = (frames = 1) =>
  page.evaluate(
    ([dtMs, n]) => {
      for (let i = 0; i < n; i++) window.__vclock.step(dtMs);
    },
    [DT * 1000, frames],
  );
/** 時間を進めずに 1 回描き直す(カットの切り替えをそのフレームに反映させる) */
const redraw = () => page.evaluate(() => window.__vclock.step(0));

await page.goto(`${BASE}/?quality=${QUALITY}`);
// 起動が終わるまで仮想時間を進める(rAF を握っているので自分で回す必要がある)
for (let i = 0; i < 4000; i++) {
  if (await page.evaluate(() => document.body.dataset.ready === '1')) break;
  await step();
}
if (!(await page.evaluate(() => document.body.dataset.ready === '1'))) {
  throw new Error('起動しなかった');
}

// 収録の下ごしらえ: 操作説明を閉じ、HUD を隠し、品質の動的調整を止める
await page.evaluate(() => {
  document.querySelector('[data-testid="help-start"]').click();
  document.getElementById('ui').style.display = 'none';
  const m = window.__museum;
  m.quality.paused = true; // 仮想時間では fps が 30〜60 に見えてティアが下がるため
  // 起動中に下がった pixelRatio を戻す(1 フレームずつ描くので描画時間は尺に影響しない)
  m.quality.pixelRatio = 1;
  m.renderer.setPixelRatio(1);
  m.lastWidth = 0;
  m.resize();
  m.hints.hintPlayer.reset();
  m.player.cameraOverride = null;
});
const info = await page.evaluate(() => {
  const gl = window.__museum.renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    tier: window.__museum.quality.tier,
    pixelRatio: window.__museum.quality.pixelRatio,
  };
});
console.log(`GPU ${info.gpu} / tier ${info.tier} / pixelRatio ${info.pixelRatio}`);
if (info.tier !== QUALITY) console.warn(`警告: ティアが ${info.tier}(要求 ${QUALITY})`);

// 開始姿勢(入口)と F2 の球の位相合わせ。
// 球は 6.5 秒周期。カット 3 の開始(4.9 s)で転がり始め(ballT ≈ 1.6)になるよう
// 撮影開始時の位相を 3.2 に置く(3.2 + 4.9 = 8.1 → 6.5 で割った余り 1.6)。
await page.evaluate(() => {
  const m = window.__museum;
  m.player.teleport({ position: m.player.position.clone().set(0, 0, 5.5), yaw: 0, pitch: 0 });
  m.registry.get('tilted-room').ballT = 3.2;
});
await step(); // 位相を反映した 1 フレーム
await page.evaluate(() => {
  const m = window.__museum;
  m.player.teleport({ position: m.player.position.clone().set(0, 0, 5.5), yaw: 0, pitch: 0 });
  m.registry.get('tilted-room').ballT = 3.2;
});

/** カット表のアクション。ページ側で実行する */
async function fire(action) {
  await page.evaluate((name) => {
    const m = window.__museum;
    const P = m.player;
    const pose = (x, z, yaw, pitch) => ({ position: P.position.clone().set(x, 0, z), yaw, pitch });
    // ハードカット: 演出を即座に戻し、カメラの上書きも解く
    const cut = (id) => {
      m.hints.hintPlayer.reset();
      P.cameraOverride = null;
      if (id) void m.warpTo(id);
    };
    switch (name) {
      case 'c1-dolly':
        void P.moveTo(pose(0, 2.5, 0, 0), 1.8);
        break;
      case 'c2':
        cut('penrose-triangle');
        void m.hints.open('penrose-triangle');
        break;
      case 'c3-cut':
        cut('tilted-room');
        break;
      case 'c3-reveal':
        void m.hints.open('tilted-room');
        break;
      case 'c4-approach':
        cut();
        P.teleport(pose(-3.9, -22, Math.PI / 2, -0.42));
        void P.moveTo(pose(-4.5, -22, Math.PI / 2, -0.55), 0.6);
        break;
      case 'c4-reveal':
        void m.hints.open('infinity-well');
        break;
      case 'c5':
        cut('endless-stair');
        void m.hints.open('endless-stair');
        break;
      default:
        throw new Error(`unknown action ${name}`);
    }
  }, action);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const log = [];
let next = 0;
const started = Date.now();
for (let i = 0; i < FRAMES; i++) {
  const t = i * DT;
  // その時刻に予定されたアクションを撮る前に発火する
  let fired = false;
  while (next < TIMELINE.length && TIMELINE[next][0] <= t + 1e-9) {
    await fire(TIMELINE[next][1]);
    fired = true;
    const state = await page.evaluate(() => ({
      ball: window.__museum.registry.get('tilted-room').ballT,
    }));
    log.push(`${t.toFixed(3)}s  frame ${i}  ${TIMELINE[next][1]}  ballT=${state.ball.toFixed(2)}`);
    next++;
  }
  if (fired) await redraw();
  await page.screenshot({ path: `${OUT}/frame_${String(i).padStart(6, '0')}.png` });
  await step();
  if (i % 60 === 0) {
    const sec = (Date.now() - started) / 1000;
    console.log(`frame ${i}/${FRAMES}  ${(i / Math.max(sec, 0.001)).toFixed(1)} fps 実時間`);
  }
}

writeFileSync(`${OUT}/../timeline.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
console.log(`${FRAMES} フレーム / ${((Date.now() - started) / 1000).toFixed(0)} 秒`);
await browser.close();
