import { describe, expect, it } from 'vitest';
import { adjustPixelRatio, detectTier, lowerTier } from '../../src/app/Quality';

describe('detectTier', () => {
  it('デスクトップの dGPU は high', () => {
    expect(detectTier('ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)', false)).toBe('high');
    expect(detectTier('Apple M2', false)).toBe('high');
    expect(detectTier('AMD Radeon Pro 5500M OpenGL Engine', false)).toBe('high');
  });

  it('Intel の iGPU は mid、Intel Arc は high', () => {
    expect(detectTier('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)', false)).toBe('mid');
    expect(detectTier('ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics)', false)).toBe('high');
  });

  it('モバイルは既定で mid、廉価 GPU は low', () => {
    expect(detectTier('Apple GPU', true)).toBe('mid');
    expect(detectTier('ANGLE (Qualcomm, Adreno (TM) 740)', true)).toBe('mid');
    expect(detectTier('ANGLE (Qualcomm, Adreno (TM) 506)', true)).toBe('low');
    expect(detectTier('Mali-G52 MC2', true)).toBe('low');
    expect(detectTier('Mali-T830', true)).toBe('low');
  });

  it('ソフトウェアレンダラは low', () => {
    expect(detectTier('Google SwiftShader', false)).toBe('low');
    expect(detectTier('llvmpipe (LLVM 15.0.7, 256 bits)', false)).toBe('low');
  });

  it('GPU 情報が取れないときはモバイル判定に従う', () => {
    expect(detectTier(null, false)).toBe('high');
    expect(detectTier(null, true)).toBe('mid');
  });
});

describe('adjustPixelRatio', () => {
  const base = { targetFps: 60, min: 0.75, max: 2.0, step: 0.25 };

  it('fps が目標の 85% 未満なら 1 段下げる', () => {
    expect(adjustPixelRatio({ ...base, current: 2.0, avgFps: 40 })).toBe(1.75);
  });

  it('fps が目標を満たしていれば 1 段上げる', () => {
    expect(adjustPixelRatio({ ...base, current: 1.5, avgFps: 60 })).toBe(1.75);
  });

  it('中間の fps では維持する', () => {
    expect(adjustPixelRatio({ ...base, current: 1.5, avgFps: 55 })).toBe(1.5);
  });

  it('上下限を超えない', () => {
    expect(adjustPixelRatio({ ...base, current: 0.75, avgFps: 10 })).toBe(0.75);
    expect(adjustPixelRatio({ ...base, current: 2.0, avgFps: 120 })).toBe(2.0);
  });
});

describe('lowerTier', () => {
  it('1 段ずつ下がり low で止まる', () => {
    expect(lowerTier('high')).toBe('mid');
    expect(lowerTier('mid')).toBe('low');
    expect(lowerTier('low')).toBe('low');
  });
});
