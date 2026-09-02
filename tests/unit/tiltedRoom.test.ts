import { describe, expect, it } from 'vitest';
import { TILT, tiltedFloorHeight } from '../../src/exhibits/fable/TiltedRoom';

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
