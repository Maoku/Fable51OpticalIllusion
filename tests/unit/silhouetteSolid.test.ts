import { describe, expect, it } from 'vitest';
import {
  TRILEMMA_SPEC,
  buildSilhouetteField,
  mismatchRatio,
  projectOccupancy,
  sampleSilhouette,
  sdf,
} from '../../src/procedural/silhouetteSolid';

describe('silhouetteSolid', () => {
  const res = 64;
  const field = buildSilhouetteField(TRILEMMA_SPEC, res);

  it('立体は空でなく、領域の内側に収まる', () => {
    let inside = 0;
    for (const v of field.field) if (v > 0) inside++;
    expect(inside).toBeGreaterThan(1000);
    // 境界のセルは外側
    const n = res;
    expect(field.field[0]).toBeLessThanOrEqual(0);
    expect(field.field[n * n * n - 1]).toBeLessThanOrEqual(0);
  });

  it('z 方向の投影は正面のシルエット(円)と一致する', () => {
    const proj = projectOccupancy(field, 'z'); // [y][x]
    const expected = sampleSilhouette(TRILEMMA_SPEC.front, res); // [y][x]
    expect(mismatchRatio(proj, expected)).toBeLessThan(0.01);
  });

  it('x 方向の投影は側面のシルエット(正方形)と一致する', () => {
    const proj = projectOccupancy(field, 'x'); // [z][y]
    const expected = sampleSilhouette((u, v) => TRILEMMA_SPEC.side(v, u), res); // [z][y]
    expect(mismatchRatio(proj, expected)).toBeLessThan(0.01);
  });

  it('y 方向の投影は上面のシルエット(三角形)と一致する', () => {
    const proj = projectOccupancy(field, 'y'); // [z][x]
    const expected = sampleSilhouette((u, v) => TRILEMMA_SPEC.top(u, v), res); // [z][x]
    expect(mismatchRatio(proj, expected)).toBeLessThan(0.01);
  });

  it('SDF の符号: 円・正方形・三角形の内外', () => {
    expect(sdf.circle(0.5)(0, 0)).toBeGreaterThan(0);
    expect(sdf.circle(0.5)(0.6, 0)).toBeLessThan(0);
    expect(sdf.square(0.5)(0.4, -0.4)).toBeGreaterThan(0);
    expect(sdf.square(0.5)(0.6, 0)).toBeLessThan(0);
    const tri = sdf.triangle(0.8);
    expect(tri(0, 0.5)).toBeGreaterThan(0); // 底辺寄りの中央
    expect(tri(0.7, -0.7)).toBeLessThan(0); // 頂点付近の外側
    expect(tri(0, 0.9)).toBeLessThan(0); // 底辺の外
  });
});
