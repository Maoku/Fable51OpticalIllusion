import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computePenroseLayout, miterNormal } from '../../src/exhibits/classic/penroseGeometry';

describe('computePenroseLayout', () => {
  const L = 0.9;
  const layout = computePenroseLayout(L, 5.5);
  const [A, B, C, D] = layout.points;
  const [e1, e2, e3] = layout.dirs;

  it('3 本の方向は互いに直交する単位ベクトル', () => {
    for (const e of [e1, e2, e3]) expect(e.length()).toBeCloseTo(1);
    expect(e1.dot(e2)).toBeCloseTo(0);
    expect(e2.dot(e3)).toBeCloseTo(0);
    expect(e3.dot(e1)).toBeCloseTo(0);
  });

  it('A と D は視軸(+z)上に並び、視点から重なって見える', () => {
    const ad = D.clone().sub(A);
    expect(ad.x).toBeCloseTo(0);
    expect(ad.y).toBeCloseTo(0);
    expect(ad.z).toBeCloseTo(L * Math.sqrt(3));
    const dirA = A.clone().sub(layout.eye).normalize();
    const dirD = D.clone().sub(layout.eye).normalize();
    expect(dirA.distanceTo(dirD)).toBeLessThan(1e-9);
  });

  it('視軸に投影すると 120° ずつ離れた正三角形になる', () => {
    const proj = (v: THREE.Vector3) => new THREE.Vector2(v.x, v.y);
    const pe = [proj(e1), proj(e2), proj(e3)];
    for (const v of pe) expect(v.length()).toBeCloseTo(Math.sqrt(2 / 3));
    for (let i = 0; i < 3; i++) {
      const a = pe[i]!;
      const b = pe[(i + 1) % 3]!;
      const cos = a.dot(b) / (a.length() * b.length());
      expect(Math.acos(cos)).toBeCloseTo((2 * Math.PI) / 3);
    }
    // 底辺 AB は水平
    expect(B.y - A.y).toBeCloseTo(0);
    expect(B.x - A.x).toBeGreaterThan(0);
    // 頂点 C は底辺より上
    expect(C.y).toBeGreaterThan(A.y);
  });

  it('D 側の断面は視点までの距離の比だけ細くなる', () => {
    const dA = layout.eye.distanceTo(A);
    const dD = layout.eye.distanceTo(D);
    expect(layout.taper).toBeCloseTo(dD / dA);
    expect(layout.taper).toBeLessThan(1);
    expect(layout.taper).toBeGreaterThan(0.6);
  });

  it('留め継ぎの法線は 2 方向の和', () => {
    const n = miterNormal(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
    expect(n.x).toBeCloseTo(Math.SQRT1_2);
    expect(n.y).toBeCloseTo(Math.SQRT1_2);
  });
});
