import * as THREE from 'three';

/**
 * ペンローズの三角形の 3D 配置。
 * 立方体の 3 辺方向 e1, e2, e3 に沿って A→B→C→D と角柱を繋ぐと、
 * D - A = L (e1 + e2 + e3) となり、(1,1,1) 方向から見たときだけ A と D が重なって
 * 閉じた三角形に見える。ここでは (1,1,1) が +z(鑑賞者側)を向くよう全体を回転する。
 */
export interface PenroseLayout {
  /** A, B, C, D(ローカル座標。A が原点、視軸は +z) */
  points: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  /** 各角柱の方向 e1, e2, e3(回転後) */
  dirs: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  /** 視点(A から +z 方向に eyeDistance) */
  eye: THREE.Vector3;
  /** D 側の断面を細くする比率(見かけの太さを A と揃える) */
  taper: number;
  /** 三角形の見かけの重心 */
  centroid: THREE.Vector3;
}

export function computePenroseLayout(L: number, eyeDistance: number): PenroseLayout {
  const axis = new THREE.Vector3(1, 1, 1).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(0, 0, 1));
  const base: THREE.Vector3[] = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ].map((v) => v.applyQuaternion(q));
  // e1 の投影が水平(+x)になるよう z 軸回りに回す
  const e1 = base[0]!;
  const angle = Math.atan2(e1.y, e1.x);
  const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle);
  const dirs = base.map((v) =>
    v.clone().applyQuaternion(spin).normalize(),
  ) as PenroseLayout['dirs'];

  const A = new THREE.Vector3(0, 0, 0);
  const B = A.clone().addScaledVector(dirs[0], L);
  const C = B.clone().addScaledVector(dirs[1], L);
  const D = C.clone().addScaledVector(dirs[2], L);
  const eye = new THREE.Vector3(0, 0, eyeDistance);
  const dA = eye.distanceTo(A);
  const dD = eye.distanceTo(D);
  const centroid = A.clone()
    .add(B)
    .add(C)
    .multiplyScalar(1 / 3);
  return { points: [A, B, C, D], dirs, eye, taper: dD / dA, centroid };
}

/** 直角に交わる 2 本の角柱の留め継ぎ面の法線(入る方向 + 出る方向) */
export function miterNormal(dIn: THREE.Vector3, dOut: THREE.Vector3): THREE.Vector3 {
  return dIn.clone().add(dOut).normalize();
}
