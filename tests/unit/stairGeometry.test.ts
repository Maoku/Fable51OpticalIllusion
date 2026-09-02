import { describe, expect, it } from 'vitest';
import {
  STAIR,
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
