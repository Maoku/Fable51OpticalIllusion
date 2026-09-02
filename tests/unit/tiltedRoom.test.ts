import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TILT, tiltFrameBlend, tiltedFloorHeight } from '../../src/exhibits/fable/TiltedRoom';

describe('tiltedFloorHeight', () => {
  const tan = Math.tan(TILT.angle);

  it('部屋の中は x·tanθ の坂になる', () => {
    expect(tiltedFloorHeight(0, -2)).toBeCloseTo(0);
    expect(tiltedFloorHeight(1, -2)).toBeCloseTo(tan);
    expect(tiltedFloorHeight(-1.5, -3.9)).toBeCloseTo(-1.5 * tan);
  });

  it('入口の帯では 0 へなだらかに繋がる', () => {
    expect(tiltedFloorHeight(1, 0)).toBeCloseTo(tan);
    expect(tiltedFloorHeight(1, TILT.ramp / 2)).toBeCloseTo(tan / 2);
    expect(tiltedFloorHeight(1, TILT.ramp)).toBeCloseTo(0);
  });

  it('部屋の外は null', () => {
    expect(tiltedFloorHeight(3, -2)).toBeNull();
    expect(tiltedFloorHeight(0, -5)).toBeNull();
    expect(tiltedFloorHeight(0, 2)).toBeNull();
  });

  it('12° の傾きで幅 4 m の高低差は約 0.85 m', () => {
    const diff = tiltedFloorHeight(2, -2)! - tiltedFloorHeight(-2, -2)!;
    expect(diff).toBeCloseTo(4 * tan, 6);
    expect(diff).toBeGreaterThan(0.8);
    expect(diff).toBeLessThan(0.9);
  });
});

describe('tiltFrameBlend', () => {
  it('部屋の中では 1(視界が部屋に完全に合う)', () => {
    expect(tiltFrameBlend(0, -2)).toBe(1);
    expect(tiltFrameBlend(1.9, -0.1)).toBe(1);
    expect(tiltFrameBlend(-1.9, -TILT.depth)).toBe(1);
  });

  it('入口の帯でなめらかに 0 へ戻る', () => {
    expect(tiltFrameBlend(0, 0)).toBe(1);
    expect(tiltFrameBlend(0, TILT.ramp / 2)).toBeCloseTo(0.5);
    expect(tiltFrameBlend(0, TILT.ramp)).toBe(0);
    // 単調に減る
    let prev = 1;
    for (let i = 1; i <= 10; i++) {
      const v = tiltFrameBlend(0, (i / 10) * TILT.ramp);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });

  it('部屋の外では 0', () => {
    expect(tiltFrameBlend(3, -2)).toBe(0);
    expect(tiltFrameBlend(0, -5)).toBe(0);
    expect(tiltFrameBlend(0, 2)).toBe(0);
  });

  it('床の高さが決まる範囲と、視界が傾く範囲が一致する', () => {
    for (const x of [-1.9, 0, 1.9]) {
      for (const z of [-3.9, -2, -0.1, 0, 0.4, 0.85]) {
        const hasFloor = tiltedFloorHeight(x, z) !== null;
        expect(tiltFrameBlend(x, z) > 0, `(${x}, ${z})`).toBe(hasFloor && z < TILT.ramp);
      }
    }
  });
});

describe('傾きの間の球の軌道', () => {
  it('部屋の中では登り、世界では下りになる', () => {
    // 部屋に対する軌道の傾き(登り)より、部屋の傾きの方が大きい
    expect(TILT.trackAngle).toBeGreaterThan(0);
    expect(TILT.angle).toBeGreaterThan(TILT.trackAngle);
    // 世界での傾き = 部屋の傾き - 軌道の傾き。正なら球は世界で下る
    const world = TILT.angle - TILT.trackAngle;
    expect(world).toBeGreaterThan(0);
    // 画面の中では軌道の傾きぶん登って見える。読み取れる大きさであること
    expect(TILT.trackAngle).toBeGreaterThanOrEqual(THREE.MathUtils.degToRad(8));
  });
});
