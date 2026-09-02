import * as THREE from 'three';

/**
 * エイムズの部屋の幾何。
 * 「見かけの部屋」(直方体)の各頂点を、覗き窓 V を中心とする射影変換
 *   X' = V + (X - V) / (1 + skew · (X.x - V.x))
 * で写す。射影変換は平面を平面に写すので、床・壁・天井はすべて平面のまま歪む。
 * V から見た方向は変わらないため、V からは直方体に見える。
 */
export interface AmesParams {
  /** 見かけの幅(x) */
  width: number;
  /** 見かけの奥行き(z)。奥の壁は z = -depth */
  depth: number;
  floorY: number;
  ceilY: number;
  /** 覗き窓(視点)の位置。ローカル座標で +z が鑑賞者側 */
  eye: { x: number; y: number; z: number };
  /** 歪みの強さ。左(x < 0)が遠く、右が近くなる */
  skew: number;
  peephole: { width: number; height: number; y: number };
  tilesX: number;
  tilesZ: number;
  /** 人形を置く位置の、隅からの内側オフセット(見かけ) */
  figureInset: number;
  figureHeight: number;
}

export const DEFAULT_AMES: AmesParams = {
  width: 3.6,
  depth: 3.0,
  floorY: 0.6,
  ceilY: 2.6,
  eye: { x: 0, y: 1.6, z: 0.6 },
  skew: 1 / 6,
  peephole: { width: 0.9, height: 0.55, y: 1.6 },
  tilesX: 6,
  tilesZ: 5,
  figureInset: 0.55,
  figureHeight: 1.3,
};

export type Vec3Like = { x: number; y: number; z: number };

/** 見かけの点を実際の点へ写す */
export function amesTransform(
  p: Vec3Like,
  eye: Vec3Like,
  skew: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const dx = p.x - eye.x;
  const dy = p.y - eye.y;
  const dz = p.z - eye.z;
  const k = 1 / (1 + skew * dx);
  return out.set(eye.x + k * dx, eye.y + k * dy, eye.z + k * dz);
}

/** 見かけの点に対する拡大率 k(1 より大きければ遠くなる) */
export function amesScale(p: Vec3Like, eye: Vec3Like, skew: number): number {
  return 1 / (1 + skew * (p.x - eye.x));
}

export type QuadKind = 'floor' | 'ceiling' | 'wall' | 'window' | 'baseboard' | 'near';

export interface Quad {
  points: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  color: number;
  kind: QuadKind;
}

const COLORS = {
  tileLight: 0xd9d3c7,
  tileDark: 0x8c8378,
  wall: 0xe9e4dc,
  ceiling: 0xf2efe9,
  window: 0x2b3540,
  baseboard: 0x3a352f,
};

function q(
  a: Vec3Like,
  b: Vec3Like,
  c: Vec3Like,
  d: Vec3Like,
  color: number,
  kind: QuadKind,
): Quad {
  const v = (p: Vec3Like) => new THREE.Vector3(p.x, p.y, p.z);
  return { points: [v(a), v(b), v(c), v(d)], color, kind };
}

/** 見かけの部屋を構成する四角形(まだ歪めていない) */
export function apparentQuads(p: AmesParams): Quad[] {
  const quads: Quad[] = [];
  const hw = p.width / 2;
  const { floorY, ceilY, depth } = p;
  const eps = 0.01;

  // 床タイル(手前 z=0 から奥 z=-depth)
  for (let i = 0; i < p.tilesX; i++) {
    for (let j = 0; j < p.tilesZ; j++) {
      const x0 = -hw + (i / p.tilesX) * p.width;
      const x1 = -hw + ((i + 1) / p.tilesX) * p.width;
      const z0 = -(j / p.tilesZ) * depth;
      const z1 = -((j + 1) / p.tilesZ) * depth;
      const color = (i + j) % 2 === 0 ? COLORS.tileLight : COLORS.tileDark;
      quads.push(
        q(
          { x: x0, y: floorY, z: z0 },
          { x: x1, y: floorY, z: z0 },
          { x: x1, y: floorY, z: z1 },
          { x: x0, y: floorY, z: z1 },
          color,
          'floor',
        ),
      );
    }
  }
  // 天井
  quads.push(
    q(
      { x: -hw, y: ceilY, z: 0 },
      { x: -hw, y: ceilY, z: -depth },
      { x: hw, y: ceilY, z: -depth },
      { x: hw, y: ceilY, z: 0 },
      COLORS.ceiling,
      'ceiling',
    ),
  );
  // 奥の壁
  quads.push(
    q(
      { x: -hw, y: floorY, z: -depth },
      { x: hw, y: floorY, z: -depth },
      { x: hw, y: ceilY, z: -depth },
      { x: -hw, y: ceilY, z: -depth },
      COLORS.wall,
      'wall',
    ),
  );
  // 奥の壁の 2 つの窓(見かけは同じ大きさ)
  for (const cx of [-hw * 0.55, hw * 0.55]) {
    quads.push(
      q(
        { x: cx - 0.35, y: 1.25, z: -depth + eps },
        { x: cx + 0.35, y: 1.25, z: -depth + eps },
        { x: cx + 0.35, y: 2.15, z: -depth + eps },
        { x: cx - 0.35, y: 2.15, z: -depth + eps },
        COLORS.window,
        'window',
      ),
    );
  }
  // 左右の壁
  quads.push(
    q(
      { x: -hw, y: floorY, z: 0 },
      { x: -hw, y: floorY, z: -depth },
      { x: -hw, y: ceilY, z: -depth },
      { x: -hw, y: ceilY, z: 0 },
      COLORS.wall,
      'wall',
    ),
    q(
      { x: hw, y: floorY, z: -depth },
      { x: hw, y: floorY, z: 0 },
      { x: hw, y: ceilY, z: 0 },
      { x: hw, y: ceilY, z: -depth },
      COLORS.wall,
      'wall',
    ),
  );
  // 幅木(奥・左・右)
  const bb = 0.12;
  quads.push(
    q(
      { x: -hw, y: floorY, z: -depth + eps },
      { x: hw, y: floorY, z: -depth + eps },
      { x: hw, y: floorY + bb, z: -depth + eps },
      { x: -hw, y: floorY + bb, z: -depth + eps },
      COLORS.baseboard,
      'baseboard',
    ),
    q(
      { x: -hw + eps, y: floorY, z: 0 },
      { x: -hw + eps, y: floorY, z: -depth },
      { x: -hw + eps, y: floorY + bb, z: -depth },
      { x: -hw + eps, y: floorY + bb, z: 0 },
      COLORS.baseboard,
      'baseboard',
    ),
    q(
      { x: hw - eps, y: floorY, z: -depth },
      { x: hw - eps, y: floorY, z: 0 },
      { x: hw - eps, y: floorY + bb, z: 0 },
      { x: hw - eps, y: floorY + bb, z: -depth },
      COLORS.baseboard,
      'baseboard',
    ),
  );
  // 手前の壁(覗き窓の周り 4 枚)
  const ph = p.peephole;
  const px0 = -ph.width / 2;
  const px1 = ph.width / 2;
  const py0 = ph.y - ph.height / 2;
  const py1 = ph.y + ph.height / 2;
  const near = (x0: number, x1: number, y0: number, y1: number) =>
    q(
      { x: x0, y: y0, z: 0 },
      { x: x0, y: y1, z: 0 },
      { x: x1, y: y1, z: 0 },
      { x: x1, y: y0, z: 0 },
      COLORS.wall,
      'near',
    );
  quads.push(near(-hw, px0, floorY, ceilY));
  quads.push(near(px1, hw, floorY, ceilY));
  quads.push(near(px0, px1, py1, ceilY));
  quads.push(near(px0, px1, floorY, py0));
  return quads;
}

/** 歪めた後の四角形 */
export function realQuads(p: AmesParams): Quad[] {
  return apparentQuads(p).map((quad) => ({
    ...quad,
    points: quad.points.map((pt) => amesTransform(pt, p.eye, p.skew)) as Quad['points'],
  }));
}

/** 見かけの直方体の 12 辺(歪める前) */
export function apparentEdges(p: AmesParams): [THREE.Vector3, THREE.Vector3][] {
  const hw = p.width / 2;
  const c = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const ys = [p.floorY, p.ceilY];
  const edges: [THREE.Vector3, THREE.Vector3][] = [];
  for (const y of ys) {
    edges.push([c(-hw, y, 0), c(hw, y, 0)]);
    edges.push([c(-hw, y, -p.depth), c(hw, y, -p.depth)]);
    edges.push([c(-hw, y, 0), c(-hw, y, -p.depth)]);
    edges.push([c(hw, y, 0), c(hw, y, -p.depth)]);
  }
  for (const x of [-hw, hw]) {
    for (const z of [0, -p.depth]) {
      edges.push([c(x, p.floorY, z), c(x, p.ceilY, z)]);
    }
  }
  return edges;
}

/** 人形の見かけの足元位置(左・右) */
export function figureApparentPositions(p: AmesParams): [THREE.Vector3, THREE.Vector3] {
  const hw = p.width / 2;
  const z = -p.depth + p.figureInset;
  return [
    new THREE.Vector3(-hw + p.figureInset, p.floorY, z),
    new THREE.Vector3(hw - p.figureInset, p.floorY, z),
  ];
}

export interface AmesEqualView {
  /** カメラの位置(ローカル座標) */
  position: THREE.Vector3;
  /** 注視点。二体の胴の高さの中点 */
  target: THREE.Vector3;
  /** カメラから二体までの距離(左右で等しい) */
  figureDistance: number;
}

/**
 * 二体の人形から等距離に立つ視点を返す。
 *
 * 覗き窓からは、左奥の人形の方が遠いので小さく見える。斜めから見ても距離が
 * 違ったままなので、見かけの大きさは揃わない。二体からの距離が等しくなる点
 * (= 二体を結ぶ線分の垂直二等分面の上)に立つと、同じ身長が同じ大きさに
 * 見えるので、それ自体が種明かしになる。
 *
 * @param spread 二体の中点から離れる距離
 * @param lift 手前へ向かう方向に混ぜる上向き成分
 */
export function equalDistanceViewpoint(p: AmesParams, spread = 4.6, lift = 0.25): AmesEqualView {
  const [leftApparent, rightApparent] = figureApparentPositions(p);
  const half = p.figureHeight / 2;
  const left = amesTransform(leftApparent, p.eye, p.skew);
  const right = amesTransform(rightApparent, p.eye, p.skew);
  left.y += half;
  right.y += half;
  const target = left.clone().add(right).multiplyScalar(0.5);
  const along = right.clone().sub(left);
  // along に直交し、鑑賞者側(+z)へ向かう方向。along.x は左右に開いているので 0 にならない
  const vx = -(along.y * lift + along.z) / along.x;
  const direction = new THREE.Vector3(vx, lift, 1).normalize();
  const position = target.clone().addScaledVector(direction, spread);
  return { position, target, figureDistance: position.distanceTo(left) };
}

/** 実際の部屋の範囲(AABB、ローカル座標) */
export function realBounds(p: AmesParams): THREE.Box3 {
  const box = new THREE.Box3();
  for (const quad of realQuads(p)) for (const pt of quad.points) box.expandByPoint(pt);
  return box;
}
