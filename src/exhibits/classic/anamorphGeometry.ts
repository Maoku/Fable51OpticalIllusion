import * as THREE from 'three';

/**
 * アナモルフォーシスの幾何。
 * 視点 E の前に「見かけの画像」の平面 P を置き、P 上の各点を E からのレイで
 * 床(y = 0)や壁(z = wallZ)へ投影して歪んだ像を作る。
 * 逆に、床・壁の点 S から (u, v) を求めてテクスチャを生成する。
 */
export interface AnamorphPlane {
  center: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  normal: THREE.Vector3;
  half: number;
}

/** 視点 E を向く正方形の平面を center に作る */
export function makeImagePlane(
  eye: THREE.Vector3,
  center: THREE.Vector3,
  half: number,
): AnamorphPlane {
  const normal = eye.clone().sub(center).normalize();
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  right.crossVectors(up, normal).normalize();
  return { center: center.clone(), right, up, normal, half };
}

/** 平面上の (u, v) ∈ [-1, 1]² のワールド座標 */
export function planePoint(p: AnamorphPlane, u: number, v: number): THREE.Vector3 {
  return p.center
    .clone()
    .addScaledVector(p.right, u * p.half)
    .addScaledVector(p.up, v * p.half);
}

/** E から Q を通るレイと床(y = 0)または壁(z = wallZ)の交点。手前で当たった方 */
export function projectToSurfaces(
  eye: THREE.Vector3,
  q: THREE.Vector3,
  wallZ: number,
): { point: THREE.Vector3; surface: 'floor' | 'wall' } | null {
  const d = q.clone().sub(eye);
  let tFloor = Infinity;
  let tWall = Infinity;
  if (d.y < -1e-9) tFloor = -eye.y / d.y;
  if (Math.abs(d.z) > 1e-9) tWall = (wallZ - eye.z) / d.z;
  if (tFloor < 0) tFloor = Infinity;
  if (tWall < 0) tWall = Infinity;
  if (!Number.isFinite(tFloor) && !Number.isFinite(tWall)) return null;
  if (tFloor <= tWall) return { point: eye.clone().addScaledVector(d, tFloor), surface: 'floor' };
  return { point: eye.clone().addScaledVector(d, tWall), surface: 'wall' };
}

/** 面上の点 S から、E→S のレイが平面 P を通る (u, v)。P が E と S の間になければ null */
export function surfaceToImage(
  eye: THREE.Vector3,
  s: THREE.Vector3,
  p: AnamorphPlane,
): [number, number] | null {
  const d = s.clone().sub(eye);
  const denom = d.dot(p.normal);
  if (Math.abs(denom) < 1e-9) return null;
  const t = p.center.clone().sub(eye).dot(p.normal) / denom;
  if (t <= 0 || t >= 1) return null;
  const q = eye.clone().addScaledVector(d, t).sub(p.center);
  return [q.dot(p.right) / p.half, q.dot(p.up) / p.half];
}
