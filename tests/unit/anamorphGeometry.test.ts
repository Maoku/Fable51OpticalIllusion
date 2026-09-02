import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  makeImagePlane,
  planePoint,
  projectToSurfaces,
  surfaceToImage,
} from '../../src/exhibits/classic/anamorphGeometry';

describe('anamorphosis', () => {
  const eye = new THREE.Vector3(0, 1.6, 4.6);
  const plane = makeImagePlane(eye, new THREE.Vector3(0, 1.0, 1.9), 0.8);
  const wallZ = 0;

  it('平面は視点を向き、right / up / normal が正規直交する', () => {
    expect(plane.normal.dot(eye.clone().sub(plane.center).normalize())).toBeCloseTo(1);
    expect(plane.right.dot(plane.up)).toBeCloseTo(0);
    expect(plane.up.dot(plane.normal)).toBeCloseTo(0);
    expect(plane.right.length()).toBeCloseTo(1);
    expect(plane.up.y).toBeGreaterThan(0.9);
  });

  it('画像の点を床・壁へ投影し、逆写像すると元の (u, v) に戻る', () => {
    for (const [u, v] of [
      [-0.9, -0.9],
      [0.5, -0.4],
      [0, 0],
      [0.8, 0.9],
      [-0.6, 0.7],
    ] as const) {
      const q = planePoint(plane, u, v);
      const hit = projectToSurfaces(eye, q, wallZ);
      expect(hit).not.toBeNull();
      const back = surfaceToImage(eye, hit!.point, plane);
      expect(back).not.toBeNull();
      expect(back![0]).toBeCloseTo(u, 6);
      expect(back![1]).toBeCloseTo(v, 6);
    }
  });

  it('画像の下側は床に、上側は壁に落ちる', () => {
    expect(projectToSurfaces(eye, planePoint(plane, 0, -0.9), wallZ)!.surface).toBe('floor');
    expect(projectToSurfaces(eye, planePoint(plane, 0, 0.9), wallZ)!.surface).toBe('wall');
  });

  it('視点より手前の面の点は画像に対応しない', () => {
    const behind = new THREE.Vector3(0, 0, 5.5); // 視点より手前の床
    expect(surfaceToImage(eye, behind, plane)).toBeNull();
  });
});
