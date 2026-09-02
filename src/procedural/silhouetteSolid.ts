/**
 * 三方向のシルエットから立体を生成する(F1「三面の彫刻」)。
 * 各シルエットを 2D の符号付き距離関数(内側が正)で与え、
 * 3 つの押し出しの共通部分 min(front, side, top) を 3D の場として返す。
 * 場の正の領域が立体で、マーチングキューブで表面化する。
 */
export type Sdf2 = (u: number, v: number) => number;

export interface SilhouetteSpec {
  /** 正面(z 方向から見る)。引数は (x, y) */
  front: Sdf2;
  /** 側面(x 方向から見る)。引数は (z, y) */
  side: Sdf2;
  /** 上面(y 方向から見る)。引数は (x, z) */
  top: Sdf2;
}

export interface SilhouetteField {
  resolution: number;
  /** [z][y][x] の順に並ぶ */
  field: Float32Array;
  /** グリッド座標 → [-1, 1] の空間座標 */
  coord(i: number): number;
}

export const sdf = {
  circle:
    (r: number): Sdf2 =>
    (u, v) =>
      r - Math.hypot(u, v),
  square:
    (half: number): Sdf2 =>
    (u, v) =>
      Math.min(half - Math.abs(u), half - Math.abs(v)),
  /** 底辺が v = +half(幅 2·half)、頂点が v = -half の二等辺三角形 */
  triangle: (half: number): Sdf2 => {
    const cos = Math.cos(Math.atan(0.5));
    return (u, v) => Math.min(half - v, ((v + half) / 2 - Math.abs(u)) * cos);
  },
};

export function buildSilhouetteField(spec: SilhouetteSpec, resolution: number): SilhouetteField {
  const n = resolution;
  const field = new Float32Array(n * n * n);
  const coord = (i: number) => (i - n / 2) / (n / 2);
  for (let iz = 0; iz < n; iz++) {
    const z = coord(iz);
    for (let iy = 0; iy < n; iy++) {
      const y = coord(iy);
      for (let ix = 0; ix < n; ix++) {
        const x = coord(ix);
        field[iz * n * n + iy * n + ix] = Math.min(
          spec.front(x, y),
          spec.side(z, y),
          spec.top(x, z),
        );
      }
    }
  }
  return { resolution: n, field, coord };
}

export type Axis = 'x' | 'y' | 'z';

/**
 * 場の正の領域を軸方向に投影した占有マップ(true = 影になる)。
 * 返り値は [a][b] で、x 軸投影なら [z][y]、y 軸なら [z][x]、z 軸なら [y][x]。
 */
export function projectOccupancy(f: SilhouetteField, axis: Axis): boolean[][] {
  const n = f.resolution;
  const out: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  for (let iz = 0; iz < n; iz++) {
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        if (f.field[iz * n * n + iy * n + ix]! <= 0) continue;
        if (axis === 'x') out[iz]![iy] = true;
        else if (axis === 'y') out[iz]![ix] = true;
        else out[iy]![ix] = true;
      }
    }
  }
  return out;
}

/** シルエット SDF をグリッドでサンプルした占有マップ(投影との比較用) */
export function sampleSilhouette(s: Sdf2, resolution: number): boolean[][] {
  const n = resolution;
  const coord = (i: number) => (i - n / 2) / (n / 2);
  const out: boolean[][] = [];
  for (let a = 0; a < n; a++) {
    const row: boolean[] = [];
    for (let b = 0; b < n; b++) row.push(s(coord(b), coord(a)) > 0);
    out.push(row);
  }
  return out;
}

/** 2 つの占有マップの不一致セルの割合 */
export function mismatchRatio(a: boolean[][], b: boolean[][]): number {
  let diff = 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i]!.length; j++) {
      total++;
      if (a[i]![j] !== b[i]![j]) diff++;
    }
  }
  return total === 0 ? 0 : diff / total;
}

/** 三面の彫刻の既定シルエット: 正面が円、側面が正方形、上面が三角形 */
export const TRILEMMA_SPEC: SilhouetteSpec = {
  front: sdf.circle(0.78),
  side: sdf.square(0.78),
  top: sdf.triangle(0.78),
};
