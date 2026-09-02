import { describe, expect, it } from 'vitest';
import { ProximityDetector } from '../../src/interaction/ProximityDetector';

const targets = [
  { id: 'a', x: 0, z: 0, radius: 2 },
  { id: 'b', x: 5, z: 0, radius: 2 },
];

describe('ProximityDetector', () => {
  it('半径内に入ると entered、外に出ると left を返す', () => {
    const d = new ProximityDetector(targets);
    expect(d.update(10, 10)).toEqual({ entered: null, left: null });
    expect(d.update(1, 0)).toEqual({ entered: 'a', left: null });
    expect(d.current).toBe('a');
    expect(d.update(1.5, 0)).toEqual({ entered: null, left: null });
    expect(d.update(10, 0)).toEqual({ entered: null, left: 'a' });
    expect(d.current).toBeNull();
  });

  it('ヒステリシス: 半径の境界を少し越えても離脱しない', () => {
    const d = new ProximityDetector(targets, { hysteresis: 1.15 });
    d.update(1, 0);
    expect(d.update(2.2, 0)).toEqual({ entered: null, left: null }); // 2.2 < 2 × 1.15
    expect(d.update(2.4, 0)).toEqual({ entered: null, left: 'a' });
  });

  it('境界の外から入るときは元の半径で判定する', () => {
    const d = new ProximityDetector(targets, { hysteresis: 1.15 });
    expect(d.update(2.2, 0)).toEqual({ entered: null, left: null });
    expect(d.update(1.9, 0)).toEqual({ entered: 'a', left: null });
  });

  it('複数の半径が重なるときは最寄りを選ぶ', () => {
    const d = new ProximityDetector([
      { id: 'a', x: 0, z: 0, radius: 4 },
      { id: 'b', x: 3, z: 0, radius: 4 },
    ]);
    expect(d.update(2.5, 0).entered).toBe('b');
  });

  it('明確に近い展示へ移動したときだけ切り替わる', () => {
    const d = new ProximityDetector(
      [
        { id: 'a', x: 0, z: 0, radius: 4 },
        { id: 'b', x: 3, z: 0, radius: 4 },
      ],
      { switchRatio: 0.8 },
    );
    d.update(0.5, 0); // a
    expect(d.update(1.6, 0)).toEqual({ entered: null, left: null }); // b まで 1.4、a まで 1.6: 比 0.875 で維持
    expect(d.update(2.5, 0)).toEqual({ entered: 'b', left: 'a' }); // b まで 0.5、a まで 2.5
  });

  it('setTargets で現在の展示が消えたらリセットされる', () => {
    const d = new ProximityDetector(targets);
    d.update(0, 0);
    d.setTargets([{ id: 'b', x: 5, z: 0, radius: 2 }]);
    expect(d.current).toBeNull();
  });
});
