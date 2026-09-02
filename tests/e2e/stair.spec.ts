import { expect, test, type Page } from '@playwright/test';
import { STAIR } from '../../src/exhibits/fable/stairGeometry';

async function start(page: Page, isMobile: boolean): Promise<void> {
  await page.goto('/?timescale=3');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  const btn = page.getByTestId('help-start');
  if (isMobile) await btn.tap();
  else await btn.click();
}

test('終わらない階段: 上の周の継ぎ目をまたぐと 1 周分だけ下へ戻り、水平位置は変わらない', async ({
  page,
  isMobile,
}) => {
  await start(page, isMobile);

  // 上の周の東側の階段(A')の途中、継ぎ目の手前に立つ(ローカル z = +0.2)
  await page.evaluate(() => {
    window.__museum!.player.position.set(-2.925, 6.3, -12.8);
  });
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => window.__museum!.player.position.y);
  expect(before).toBeGreaterThan(5.6);

  // 継ぎ目の帯(ローカル z ∈ [-1.0, -0.2])へ進む
  await page.evaluate(() => {
    window.__museum!.player.position.z = -13.6;
  });
  await expect
    .poll(() => page.evaluate(() => window.__museum!.player.position.y), { timeout: 40_000 })
    .toBeLessThan(2);
  const pos = await page.evaluate(() => window.__museum!.player.position.toArray());
  expect(pos[0]).toBeCloseTo(-2.925, 2);
  expect(pos[2]).toBeCloseTo(-13.6, 2);
  const teleports = await page.evaluate(
    () =>
      (window.__museum!.registry.get('endless-stair') as unknown as { teleports: number })
        .teleports,
  );
  expect(teleports).toBe(1);
});

/** 目の高さ(PlayerController.eyeHeight)。この上に余裕がないとカメラが天井にめり込む */
const EYE_HEIGHT = 1.6;
const FLIGHTS = ['A', 'B', 'C', 'D'] as const;

test('終わらない階段: どのフライトでも頭上が確保され、カメラが天井にめり込まない', async ({
  page,
  isMobile,
}) => {
  await start(page, isMobile);

  // 実際に組み上がったジオメトリを測る。三角形を集めて「真上へのレイ」を自前で解くので、
  // three.js を import できない(ビルド後の preview でも動く)状況でも計測できる。
  const headroom = await page.evaluate((S) => {
    const stair = window.__museum!.registry.get('endless-stair')!;
    const museum = window.__museum!.museum;
    const root = stair.object;
    root.updateMatrixWorld(true);

    // ワールド座標の三角形を集める(表示中のメッシュのみ)
    const tris: number[][][] = [];
    root.traverse((o) => {
      const mesh = o as unknown as {
        isMesh?: boolean;
        visible: boolean;
        geometry: { attributes: { position?: BufferAttributeLike }; index: IndexLike | null };
        matrixWorld: { elements: number[] };
      };
      if (!mesh.isMesh || !mesh.visible) return;
      const pos = mesh.geometry.attributes.position;
      if (!pos) return;
      const e = mesh.matrixWorld.elements;
      const at = (i: number): number[] => {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        return [
          e[0]! * x + e[4]! * y + e[8]! * z + e[12]!,
          e[1]! * x + e[5]! * y + e[9]! * z + e[13]!,
          e[2]! * x + e[6]! * y + e[10]! * z + e[14]!,
        ];
      };
      const idx = mesh.geometry.index;
      const count = idx ? idx.count : pos.count;
      for (let i = 0; i < count; i += 3) {
        tris.push([
          at(idx ? idx.getX(i) : i),
          at(idx ? idx.getX(i + 1) : i + 1),
          at(idx ? idx.getX(i + 2) : i + 2),
        ]);
      }
    });

    /** (x, z) の真上、y0 より上にある最も低い面の高さ */
    const ceilingAbove = (x: number, z: number, y0: number): number | null => {
      let best = Infinity;
      for (const [a, b, c] of tris) {
        const det = (b![2]! - c![2]!) * (a![0]! - c![0]!) + (c![0]! - b![0]!) * (a![2]! - c![2]!);
        if (Math.abs(det) < 1e-12) continue;
        const u = ((b![2]! - c![2]!) * (x - c![0]!) + (c![0]! - b![0]!) * (z - c![2]!)) / det;
        const v = ((c![2]! - a![2]!) * (x - c![0]!) + (a![0]! - c![0]!) * (z - c![2]!)) / det;
        const w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const y = u * a![1]! + v * b![1]! + w * c![1]!;
        if (y > y0 && y < best) best = y;
      }
      return Number.isFinite(best) ? best : null;
    };

    const p = stair.meta.position;
    const inX = S.ax - S.w;
    const inZ = S.az - S.w;
    /** 段の上に立ったときの頭上の高さ(足元から天井まで) */
    const probe = (lx: number, lz: number): number | null => {
      const wx = p.x + lx;
      const wz = p.z + lz;
      const floor = museum.groundAt(wx, wz, 1.0);
      const ceil = ceilingAbove(wx, wz, floor + 0.05);
      return ceil === null ? null : ceil - floor;
    };

    // 各フライトを標本化する。段の境界ちょうどは足元の判定が丸めで揺れるので、
    // 各段の中央で測る
    const sample = (f: (t: number) => number | null): number[] => {
      const out: number[] = [];
      for (let i = 0; i < S.steps; i++) {
        const v = f((i + 0.5) / S.steps);
        if (v !== null) out.push(v);
      }
      return out;
    };
    const byFlight: Record<string, number[]> = {
      A: sample((t) => probe(S.ax - S.w / 2, inZ - t * inZ * 2)),
      B: sample((t) => probe(inX - t * inX * 2, -(S.az - S.w / 2))),
      C: sample((t) => probe(-(S.ax - S.w / 2), -inZ + t * inZ * 2)),
      D: sample((t) => probe(-inX + t * inX * 2, S.az - S.w / 2)),
    };
    const result: Record<string, { min: number; max: number }> = {};
    for (const [k, v] of Object.entries(byFlight)) {
      result[k] = { min: Math.min(...v), max: Math.max(...v) };
    }
    return result;
  }, STAIR);

  // 目の高さ + 余裕。フライト B・D の天井が登り方向と逆に傾いていると、
  // 頂部の頭上が 1.3 m 前後まで下がり、カメラが天井にめり込む
  for (const flight of FLIGHTS) {
    expect
      .soft(headroom[flight]!.min, `フライト ${flight} の頭上の最小値`)
      .toBeGreaterThan(EYE_HEIGHT + 0.4);
  }

  // 4 本のフライトは同じ形なので、頭上の高さも揃っているはず
  const mins = FLIGHTS.map((f) => headroom[f]!.min);
  const maxes = FLIGHTS.map((f) => headroom[f]!.max);
  expect
    .soft(Math.max(...maxes) - Math.min(...mins), 'フライト間の頭上の高さの差')
    .toBeLessThan(0.2);
});

interface BufferAttributeLike {
  count: number;
  getX(i: number): number;
  getY(i: number): number;
  getZ(i: number): number;
}

interface IndexLike {
  count: number;
  getX(i: number): number;
}
