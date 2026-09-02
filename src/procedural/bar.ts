import * as THREE from 'three';

export interface BarEnd {
  point: THREE.Vector3;
  /** この端での断面の幅 */
  width: number;
  /** 端を切る平面の法線(省略時は軸に垂直) */
  cutNormal?: THREE.Vector3;
}

/**
 * 断面が正方形の角柱を作る。
 * u, v は軸に垂直な断面の基底(角柱の面がどの方向を向くかを決める)。
 * 端を任意の平面で切れるので、留め継ぎ(45° の合わせ目)を再現できる。
 */
export function createBarGeometry(
  start: BarEnd,
  end: BarEnd,
  u: THREE.Vector3,
  v: THREE.Vector3,
): THREE.BufferGeometry {
  const dir = end.point.clone().sub(start.point).normalize();
  const corner = (e: BarEnd, su: number, sv: number): THREE.Vector3 => {
    const off = u
      .clone()
      .multiplyScalar((su * e.width) / 2)
      .addScaledVector(v, (sv * e.width) / 2);
    const p = e.point.clone().add(off);
    if (e.cutNormal) {
      const denom = dir.dot(e.cutNormal);
      if (Math.abs(denom) > 1e-6) {
        const t = -off.dot(e.cutNormal) / denom;
        p.addScaledVector(dir, t);
      }
    }
    return p;
  };
  // 断面の 4 隅(反時計回り)
  const signs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const s = signs.map(([a, b]) => corner(start, a, b));
  const e = signs.map(([a, b]) => corner(end, a, b));
  const positions: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    positions.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(s[i]!, e[i]!, e[j]!, s[j]!);
  }
  quad(s[3]!, s[2]!, s[1]!, s[0]!);
  quad(e[0]!, e[1]!, e[2]!, e[3]!);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  // 面の向きを外向きに揃える(u × v が軸方向と逆なら反転)
  if (u.clone().cross(v).dot(dir) < 0) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i + 1);
      const y = pos.getY(i + 1);
      const z = pos.getZ(i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, x, y, z);
    }
    geo.computeVertexNormals();
  }
  return geo;
}
