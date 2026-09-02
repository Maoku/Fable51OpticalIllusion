import { describe, expect, it, vi } from 'vitest';
import {
  CompositeHintEffect,
  HintPlayer,
  easeInOutCubic,
  type HintEffect,
} from '../../src/exhibits/HintEffect';

function makeEffect(durationMs = 1000): HintEffect & { applied: number[] } {
  const applied: number[] = [];
  return {
    applied,
    durationMs,
    lockViewpoint: false,
    apply: (t) => applied.push(t),
    onStart: vi.fn(),
    onEnd: vi.fn(),
  };
}

describe('HintPlayer', () => {
  it('open で durationMs かけて 0→1 に進み、終端で onEnd(1) が呼ばれる', () => {
    const p = new HintPlayer();
    const e = makeEffect(1000);
    p.set(e);
    p.open();
    expect(e.onStart).toHaveBeenCalledWith(1);
    p.update(0.5);
    expect(p.progress).toBeCloseTo(0.5);
    expect(e.applied.at(-1)).toBeCloseTo(easeInOutCubic(0.5));
    p.update(0.6);
    expect(p.progress).toBe(1);
    expect(e.applied.at(-1)).toBe(1);
    expect(e.onEnd).toHaveBeenCalledWith(1);
    expect(p.isSettled).toBe(true);
  });

  it('途中で close すると連続的に戻る', () => {
    const p = new HintPlayer();
    const e = makeEffect(1000);
    p.set(e);
    p.open();
    p.update(0.4);
    p.close();
    p.update(0.2);
    expect(p.progress).toBeCloseTo(0.2);
    p.update(1);
    expect(p.progress).toBe(0);
    expect(e.applied.at(-1)).toBe(0);
    expect(e.onEnd).toHaveBeenLastCalledWith(-1);
  });

  it('toggle は目標を反転する', () => {
    const p = new HintPlayer();
    p.set(makeEffect());
    p.toggle();
    expect(p.target).toBe(1);
    p.toggle();
    expect(p.target).toBe(0);
  });

  it('reset は即座に 0 へ戻して apply(0) を呼ぶ', () => {
    const p = new HintPlayer();
    const e = makeEffect();
    p.set(e);
    p.open();
    p.update(0.3);
    p.reset();
    expect(p.progress).toBe(0);
    expect(e.applied.at(-1)).toBe(0);
    expect(p.target).toBe(0);
  });

  it('set で別の演出に切り替えると前の演出は 0 に戻される', () => {
    const p = new HintPlayer();
    const a = makeEffect();
    const b = makeEffect();
    p.set(a);
    p.open();
    p.update(0.5);
    p.set(b);
    expect(a.applied.at(-1)).toBe(0);
    expect(p.effect).toBe(b);
    expect(p.progress).toBe(0);
  });

  it('onSettle は端に到達したときだけ呼ばれる', () => {
    const p = new HintPlayer();
    p.set(makeEffect(500));
    const settle = vi.fn();
    p.onSettle = settle;
    p.open();
    p.update(0.2);
    expect(settle).not.toHaveBeenCalled();
    p.update(0.4);
    expect(settle).toHaveBeenCalledWith(1, expect.anything());
  });
});

describe('CompositeHintEffect', () => {
  it('全演出に apply を配り、durationMs は最大、lockViewpoint はいずれか', () => {
    const a = makeEffect(500);
    const b = { ...makeEffect(1500), lockViewpoint: true };
    const c = new CompositeHintEffect([a, b]);
    expect(c.durationMs).toBe(1500);
    expect(c.lockViewpoint).toBe(true);
    c.apply(0.3);
    expect(a.applied).toEqual([0.3]);
    expect(b.applied).toEqual([0.3]);
  });
});
