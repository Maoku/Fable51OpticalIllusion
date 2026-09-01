import { describe, expect, it } from 'vitest';
import { wallRects } from '../../src/museum/Room';

describe('wallRects', () => {
  it('開口がなければ壁全体が 1 枚', () => {
    expect(wallRects(-5, 5, 4, [])).toEqual([{ u0: -5, u1: 5, y0: 0, y1: 4 }]);
  });

  it('ドアは左右の壁とまぐさに分割される', () => {
    const rects = wallRects(-5, 5, 4, [{ side: 'north', center: 0, width: 2, height: 3 }]);
    expect(rects).toEqual([
      { u0: -5, u1: -1, y0: 0, y1: 4 },
      { u0: -1, u1: 1, y0: 3, y1: 4 },
      { u0: 1, u1: 5, y0: 0, y1: 4 },
    ]);
  });

  it('窓は腰壁とまぐさの両方を持つ', () => {
    const rects = wallRects(0, 10, 3.5, [
      { side: 'east', center: 5, width: 4, height: 1.8, bottom: 0.9 },
    ]);
    expect(rects).toContainEqual({ u0: 3, u1: 7, y0: 0, y1: 0.9 });
    expect(rects).toContainEqual({ u0: 3, u1: 7, y0: 2.7, y1: 3.5 });
  });

  it('天井まで届く開口にはまぐさがない', () => {
    const rects = wallRects(-5, 5, 4, [{ side: 'north', center: 0, width: 2, height: 4 }]);
    expect(rects.every((r) => !(r.u0 === -1 && r.u1 === 1))).toBe(true);
  });

  it('複数の開口を順序に関係なく処理する', () => {
    const rects = wallRects(0, 10, 3, [
      { side: 'north', center: 7, width: 2, height: 3 },
      { side: 'north', center: 3, width: 2, height: 3 },
    ]);
    expect(rects.filter((r) => r.y0 === 0 && r.y1 === 3).map((r) => [r.u0, r.u1])).toEqual([
      [0, 2],
      [4, 6],
      [8, 10],
    ]);
  });
});
