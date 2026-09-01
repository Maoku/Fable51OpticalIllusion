import { describe, expect, it } from 'vitest';
import { aabbFromCenter, pushOutOfBox, resolveCircle } from '../../src/player/Collision';

const wall = aabbFromCenter(0, 2, 0, 10, 4, 0.3); // x∈[-5,5], z∈[-0.15,0.15]

describe('pushOutOfBox', () => {
  it('触れていなければ動かさない', () => {
    const p = { x: 0, z: 1 };
    expect(pushOutOfBox(p, 0.35, wall)).toBe(false);
    expect(p).toEqual({ x: 0, z: 1 });
  });

  it('面に食い込んだ円を法線方向に押し出す', () => {
    const p = { x: 0, z: 0.3 }; // 面 z=0.15 から 0.15 しか離れていない
    expect(pushOutOfBox(p, 0.35, wall)).toBe(true);
    expect(p.x).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(0.5);
  });

  it('角に食い込んだ円は角からの方向に押し出す', () => {
    const p = { x: 5.1, z: 0.25 };
    pushOutOfBox(p, 0.35, wall);
    const d = Math.hypot(p.x - 5, p.z - 0.15);
    expect(d).toBeCloseTo(0.35);
    expect(p.x).toBeGreaterThan(5);
    expect(p.z).toBeGreaterThan(0.15);
  });

  it('中心が箱の内側なら浅い側の面へ押し出す', () => {
    const p = { x: 0, z: 0.05 }; // z=0.15 の面が近い
    pushOutOfBox(p, 0.35, wall);
    expect(p.z).toBeCloseTo(0.15 + 0.35);
    const q = { x: 0, z: -0.05 };
    pushOutOfBox(q, 0.35, wall);
    expect(q.z).toBeCloseTo(-0.15 - 0.35);
  });

  it('ちょうど半径分離れている境界値では押し出さない', () => {
    const p = { x: 0, z: 0.15 + 0.35 };
    expect(pushOutOfBox(p, 0.35, wall)).toBe(false);
  });
});

describe('resolveCircle', () => {
  it('高さ範囲と重ならない箱(ドア上部のまぐさ)は無視する', () => {
    const lintel = aabbFromCenter(0, 3.5, 0, 3, 1, 0.3); // y∈[3,4]
    const p = { x: 0, z: 0 };
    resolveCircle(p, 0.35, [lintel], 0.2, 1.8);
    expect(p).toEqual({ x: 0, z: 0 });
  });

  it('入口の両脇の壁を通り抜けられない', () => {
    const left = aabbFromCenter(-4, 2, 0, 6.5, 4, 0.3); // x∈[-7.25,-0.75]
    const right = aabbFromCenter(4, 2, 0, 6.5, 4, 0.3); // x∈[0.75,7.25]
    const p = { x: -1.5, z: 0.1 };
    resolveCircle(p, 0.35, [left, right], 0.2, 1.8);
    expect(p.z).toBeCloseTo(0.5);
    // ドアの中央は通れる
    const q = { x: 0, z: 0 };
    resolveCircle(q, 0.35, [left, right], 0.2, 1.8);
    expect(q).toEqual({ x: 0, z: 0 });
  });

  it('部屋の角で 2 枚の壁に同時に当たっても外へ出ない', () => {
    const north = aabbFromCenter(0, 2, -5, 10.3, 4, 0.3);
    const west = aabbFromCenter(-5, 2, 0, 0.3, 4, 10.3);
    const p = { x: -4.9, z: -4.9 };
    resolveCircle(p, 0.35, [north, west], 0.2, 1.8);
    expect(p.x).toBeGreaterThanOrEqual(-5 + 0.15 + 0.35 - 1e-6);
    expect(p.z).toBeGreaterThanOrEqual(-5 + 0.15 + 0.35 - 1e-6);
  });
});
