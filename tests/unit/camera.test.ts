import { describe, expect, it } from 'vitest';
import { BASE_FOV, MAX_FOV, MIN_HFOV, fovForAspect } from '../../src/app/camera';

/** 垂直画角とアスペクト比から水平画角(度)を求める */
function horizontalFov(fov: number, aspect: number): number {
  return (2 * Math.atan(Math.tan((fov / 2) * (Math.PI / 180)) * aspect) * 180) / Math.PI;
}

describe('fovForAspect', () => {
  it('横長の画面では基準の画角のまま', () => {
    expect(fovForAspect(16 / 9)).toBe(BASE_FOV);
    expect(fovForAspect(4 / 3)).toBe(BASE_FOV);
    expect(fovForAspect(1)).toBe(BASE_FOV);
  });

  it('タブレットの縦持ち程度では広げない', () => {
    expect(fovForAspect(0.75)).toBe(BASE_FOV);
  });

  it('スマホの縦持ちでは水平画角を確保するために垂直画角を広げる', () => {
    const aspect = 375 / 812;
    const fov = fovForAspect(aspect);
    expect(fov).toBeGreaterThan(BASE_FOV);
    expect(fov).toBeLessThanOrEqual(MAX_FOV);
    expect(horizontalFov(fov, aspect)).toBeCloseTo(MIN_HFOV, 5);
    // 基準の画角のままだと水平画角が痩せることの確認
    expect(horizontalFov(BASE_FOV, aspect)).toBeLessThan(MIN_HFOV);
  });

  it('極端に細長い画面でも上限で頭打ちにする', () => {
    expect(fovForAspect(0.3)).toBe(MAX_FOV);
  });

  it('アスペクト比が不正なら基準の画角を返す', () => {
    expect(fovForAspect(0)).toBe(BASE_FOV);
    expect(fovForAspect(Number.NaN)).toBe(BASE_FOV);
  });
});
