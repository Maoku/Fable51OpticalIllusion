import { describe, expect, it } from 'vitest';
import {
  STAIR,
  stairCeilingHeight,
  stairHeight,
  stairRegion,
  stairSeamShift,
} from '../../src/exhibits/fable/stairGeometry';

const S = STAIR;
const flightH = S.steps * S.rise;

describe('stairRegion', () => {
  it('4 隅は踊り場で、反時計回りに 1 フライトずつ高くなる', () => {
    expect(stairRegion(2.4, 2.3)).toMatchObject({ kind: 'landing', index: 0, height: 0 });
    expect(stairRegion(2.4, -2.3)).toMatchObject({ kind: 'landing', index: 1, height: flightH });
    expect(stairRegion(-2.4, -2.3)).toMatchObject({
      kind: 'landing',
      index: 2,
      height: flightH * 2,
    });
    expect(stairRegion(-2.4, 2.3)).toMatchObject({
      kind: 'landing',
      index: 3,
      height: flightH * 3,
    });
  });

  it('東の階段は北へ進むほど高く、最後の段は次の踊り場と同じ高さ', () => {
    const first = stairRegion(2.4, 1.5)!;
    const last = stairRegion(2.4, -1.5)!;
    expect(first).toMatchObject({ kind: 'flight', flight: 'A', step: 0, height: S.rise });
    expect(last).toMatchObject({ kind: 'flight', flight: 'A', step: S.steps - 1, height: flightH });
  });

  it('1 周で loop の高さぶん上がる', () => {
    const lastD = stairRegion(1.6, 2.3)!;
    expect(lastD.height).toBeCloseTo(S.loop);
    expect(flightH * 4).toBeCloseTo(S.loop);
  });

  it('吹き抜けの中心や外は null', () => {
    expect(stairRegion(0, 0)).toBeNull();
    expect(stairRegion(5, 0)).toBeNull();
  });
});

describe('stairHeight', () => {
  it('現在の高さに近い周を選ぶ', () => {
    expect(stairHeight(2.4, 2.3, 0.2)).toBeCloseTo(0);
    expect(stairHeight(2.4, 2.3, S.loop + 0.3)).toBeCloseTo(S.loop);
    expect(stairHeight(2.4, 0, 6.5)).toBeCloseTo(S.loop + stairRegion(2.4, 0)!.height);
  });

  it('周の数を超えない', () => {
    expect(stairHeight(2.4, 2.3, 100)).toBeCloseTo(S.loop * (S.loops - 1));
  });
});

describe('stairSeamShift', () => {
  it('上の周の東側の階段の帯に入ると 1 周分だけ下へ戻る', () => {
    const z = (S.seamZ[0] + S.seamZ[1]) / 2;
    expect(stairSeamShift(2.4, z, S.loop + 1.0)).toBeCloseTo(-S.loop);
    // 下の周では戻らない
    expect(stairSeamShift(2.4, z, 1.0)).toBe(0);
    // 帯の外では戻らない
    expect(stairSeamShift(2.4, 1.2, S.loop + 1.0)).toBe(0);
  });

  it('上の周の偽の戸口から出ると 1 周分だけ下へ戻る', () => {
    expect(stairSeamShift(S.ax + 0.5, 2.3, S.loop)).toBeCloseTo(-S.loop);
    expect(stairSeamShift(S.ax + 0.5, 2.3, 0)).toBe(0);
  });

  it('戻った先の足元の高さは、戻る前と 1 周ぶんちょうど違う(継ぎ目なし)', () => {
    const z = (S.seamZ[0] + S.seamZ[1]) / 2;
    const before = stairHeight(2.4, z, S.loop + 1.0)!;
    const after = stairHeight(2.4, z, S.loop + 1.0 - S.loop)!;
    expect(before - after).toBeCloseTo(S.loop);
  });
});

describe('stairCeilingHeight', () => {
  const S2 = STAIR;
  /** 各フライトの中心線上の点を、進み具合 t(0..1)から返す */
  const inX = S2.ax - S2.w;
  const inZ = S2.az - S2.w;
  const onFlight: Record<string, (t: number) => [number, number]> = {
    A: (t) => [S2.ax - S2.w / 2, inZ - t * inZ * 2],
    B: (t) => [inX - t * inX * 2, -(S2.az - S2.w / 2)],
    C: (t) => [-(S2.ax - S2.w / 2), -inZ + t * inZ * 2],
    D: (t) => [-inX + t * inX * 2, S2.az - S2.w / 2],
  };

  it('踊り場では床から headroom ぶん上にある', () => {
    expect(stairCeilingHeight(2.4, 2.3, 0)).toBeCloseTo(S2.headroom);
    expect(stairCeilingHeight(2.4, -2.3, 1)).toBeCloseTo(flightH + S2.headroom);
    expect(stairCeilingHeight(-2.4, 2.3, 3)).toBeCloseTo(flightH * 3 + S2.headroom);
  });

  it('どのフライトでも、足元から見た頭上の高さが目の高さを十分に上回る', () => {
    const EYE = 1.6;
    for (const [name, at] of Object.entries(onFlight)) {
      for (let i = 0; i < S2.steps; i++) {
        const [x, z] = at((i + 0.5) / S2.steps);
        const floor = stairHeight(x, z, 1)!;
        const ceil = stairCeilingHeight(x, z, 1)!;
        expect(ceil - floor, `フライト ${name} の ${i + 1} 段目`).toBeGreaterThan(EYE + 0.4);
      }
    }
  });

  it('4 本のフライトの頭上の高さは揃っている', () => {
    const heights: number[] = [];
    for (const at of Object.values(onFlight)) {
      for (let i = 0; i < S2.steps; i++) {
        const [x, z] = at((i + 0.5) / S2.steps);
        heights.push(stairCeilingHeight(x, z, 1)! - stairHeight(x, z, 1)!);
      }
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1e-9);
  });

  it('踊り場とフライトの境目で天井が連続している', () => {
    for (const at of Object.values(onFlight)) {
      for (const t of [0.001, 0.999]) {
        const [x, z] = at(t);
        const ceil = stairCeilingHeight(x, z, 1)!;
        // 勾配線 + headroom なので、隣の踊り場の天井とほぼ同じ高さになる
        const slope = stairRegion(x, z) as { slopeHeight: number };
        expect(ceil).toBeCloseTo(slope.slopeHeight + S2.headroom, 9);
      }
    }
  });

  it('現在の高さに近い周を選ぶ', () => {
    expect(stairCeilingHeight(2.4, 2.3, 0)).toBeCloseTo(S2.headroom);
    expect(stairCeilingHeight(2.4, 2.3, S2.loop)).toBeCloseTo(S2.loop + S2.headroom);
  });

  it('吹き抜けの中心や外は null', () => {
    expect(stairCeilingHeight(0, 0, 0)).toBeNull();
    expect(stairCeilingHeight(5, 0, 0)).toBeNull();
  });
});
