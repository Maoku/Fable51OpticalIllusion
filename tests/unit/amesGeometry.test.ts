import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AMES,
  amesScale,
  amesTransform,
  figureApparentPositions,
  realBounds,
  realQuads,
} from '../../src/exhibits/classic/amesGeometry';

const p = DEFAULT_AMES;

function planeDistance(points: THREE.Vector3[]): number {
  const [a, b, c, d] = points as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  return Math.abs(d.clone().sub(a).dot(n));
}

describe('amesTransform', () => {
  it('覗き窓から見た方向を変えない', () => {
    const pts = [
      { x: -1.8, y: 0.6, z: -3 },
      { x: 1.8, y: 2.6, z: -3 },
      { x: 0.4, y: 1.0, z: -1.2 },
    ];
    for (const pt of pts) {
      const real = amesTransform(pt, p.eye, p.skew);
      const d0 = new THREE.Vector3(pt.x - p.eye.x, pt.y - p.eye.y, pt.z - p.eye.z).normalize();
      const d1 = real
        .clone()
        .sub(new THREE.Vector3(p.eye.x, p.eye.y, p.eye.z))
        .normalize();
      expect(d0.distanceTo(d1)).toBeLessThan(1e-9);
    }
  });

  it('左奥は遠く、右奥は近くなり、比率は (1 + αw/2) / (1 - αw/2)', () => {
    const hw = p.width / 2;
    const left = amesScale({ x: -hw, y: 0.6, z: -3 }, p.eye, p.skew);
    const right = amesScale({ x: hw, y: 0.6, z: -3 }, p.eye, p.skew);
    expect(left).toBeGreaterThan(1);
    expect(right).toBeLessThan(1);
    expect(left / right).toBeCloseTo((1 + p.skew * hw) / (1 - p.skew * hw), 9);
    expect(left / right).toBeGreaterThan(1.8);
  });

  it('射影変換なので歪めた後も各四角形は平面のまま', () => {
    for (const quad of realQuads(p)) {
      expect(planeDistance(quad.points)).toBeLessThan(1e-9);
    }
  });

  it('床は美術館の床(y = 0)より下に沈まず、天井は 4 m を超えない', () => {
    const b = realBounds(p);
    expect(b.min.y).toBeGreaterThanOrEqual(0);
    expect(b.max.y).toBeLessThanOrEqual(3.9);
  });

  it('同じ身長の人形が、視点からは左が小さく右が大きく見える', () => {
    const [left, right] = figureApparentPositions(p);
    const kl = amesScale(left, p.eye, p.skew);
    const kr = amesScale(right, p.eye, p.skew);
    const apparentLeft = p.figureHeight / kl;
    const apparentRight = p.figureHeight / kr;
    expect(apparentRight / apparentLeft).toBeGreaterThan(1.5);
  });

  it('覗き窓の中心(視軸上の点)は動かない', () => {
    const c = { x: p.eye.x, y: p.peephole.y, z: 0 };
    const real = amesTransform(c, p.eye, p.skew);
    expect(real.x).toBeCloseTo(c.x);
    expect(real.y).toBeCloseTo(c.y);
    expect(real.z).toBeCloseTo(c.z);
  });
});
