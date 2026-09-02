import { describe, expect, it } from 'vitest';
import { waterViewBand } from '../../src/exhibits/fable/ForcedPerspectiveGarden';

/**
 * 修正前は水面が生垣に隠れて 1 点も見えなかった。
 * 「窓から水庭が広く見える」ことを角度で守る。
 */
describe('waterViewBand', () => {
  it('推奨視点から水面が十分な幅で見える', () => {
    const band = waterViewBand();
    expect(band.spanDeg).toBeGreaterThan(8);
    // 奥の水際は水平に近く、手前は見下ろす角度になる
    expect(band.farDeg).toBeGreaterThan(0);
    expect(band.farDeg).toBeLessThan(8);
    expect(band.nearDeg).toBeGreaterThan(15);
    expect(band.nearDeg).toBeLessThan(30);
  });

  it('窓から離れても近づいても水面は見え続ける', () => {
    for (const z of [0.6, 1.0, 1.3, 2.0, 3.0]) {
      const band = waterViewBand({ y: 1.6, z });
      expect(band.spanDeg, `窓から ${z} m`).toBeGreaterThan(5);
    }
  });

  it('腰壁が高いほど手前の水面が隠れる(遮蔽を正しく数えている)', () => {
    const low = waterViewBand({ y: 1.6, z: 1.3 }, 0.85);
    const high = waterViewBand({ y: 1.6, z: 1.3 }, 1.3);
    expect(high.nearDeg).toBeLessThan(low.nearDeg);
    expect(high.spanDeg).toBeLessThan(low.spanDeg);
  });
});
