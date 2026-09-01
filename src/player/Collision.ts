export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface Point2 {
  x: number;
  z: number;
}

export function aabbFromCenter(
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
): AABB {
  return {
    minX: cx - sx / 2,
    maxX: cx + sx / 2,
    minY: cy - sy / 2,
    maxY: cy + sy / 2,
    minZ: cz - sz / 2,
    maxZ: cz + sz / 2,
  };
}

export function overlapsY(box: AABB, yMin: number, yMax: number): boolean {
  return box.maxY > yMin && box.minY < yMax;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * XZ 平面上の円を 1 つの AABB から押し出す。
 * @returns 押し出しが発生したか
 */
export function pushOutOfBox(pos: Point2, radius: number, box: AABB): boolean {
  const cx = clamp(pos.x, box.minX, box.maxX);
  const cz = clamp(pos.z, box.minZ, box.maxZ);
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const distSq = dx * dx + dz * dz;
  if (distSq >= radius * radius) return false;

  if (distSq > 1e-12) {
    // 箱の外側: 最近点からの方向に押し出す
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    pos.x += (dx / dist) * push;
    pos.z += (dz / dist) * push;
    return true;
  }

  // 中心が箱の内側: 貫入の浅い軸方向へ押し出す
  const toMinX = pos.x - box.minX;
  const toMaxX = box.maxX - pos.x;
  const toMinZ = pos.z - box.minZ;
  const toMaxZ = box.maxZ - pos.z;
  const min = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
  if (min === toMinX) pos.x = box.minX - radius;
  else if (min === toMaxX) pos.x = box.maxX + radius;
  else if (min === toMinZ) pos.z = box.minZ - radius;
  else pos.z = box.maxZ + radius;
  return true;
}

/**
 * 円(プレイヤー)を複数の AABB から押し出す。
 * 高さ範囲 [yMin, yMax] と重ならない箱(ドア上部のまぐさ等)は無視する。
 * 角で複数の箱に同時に当たるケースのため数回反復する。
 */
export function resolveCircle(
  pos: Point2,
  radius: number,
  boxes: readonly AABB[],
  yMin: number,
  yMax: number,
  iterations = 3,
): Point2 {
  for (let i = 0; i < iterations; i++) {
    let moved = false;
    for (const box of boxes) {
      if (!overlapsY(box, yMin, yMax)) continue;
      if (pushOutOfBox(pos, radius, box)) moved = true;
    }
    if (!moved) break;
  }
  return pos;
}
