/**
 * F6 終わらない階段の幾何(ローカル座標、DOM / three.js 非依存)。
 * 正方形の吹き抜けの周りに 4 本の階段が反時計回りに巡り、1 周で LOOP 上がる。
 * 同じ形を 2 周分積み、上の周の途中で 1 周分だけ下へ瞬間移動させると、
 * 見た目は繋がったまま同じ踊り場へ戻る。
 */
export const STAIR = {
  /** 内法の半幅(x)と半奥行き(z) */
  ax: 3.1,
  az: 3.0,
  /** 通路(階段)の幅 */
  w: 1.45,
  /** 段の高さと 1 フライトの段数 */
  rise: 0.175,
  steps: 8,
  /** 1 周の高さ = 4 × steps × rise */
  loop: 5.6,
  /** 積む周の数 */
  loops: 2,
  /** 天井の高さ(踊り場の床、およびフライトの勾配線から) */
  headroom: 2.5,
  /** 瞬間移動の帯: 東側の階段(A')の z 範囲 */
  seamZ: [-1.0, -0.2] as [number, number],
};

export type StairRegion =
  | { kind: 'landing'; index: 0 | 1 | 2 | 3; height: number }
  | {
      kind: 'flight';
      flight: 'A' | 'B' | 'C' | 'D';
      step: number;
      /** 足元(段の上面)の高さ */
      height: number;
      /** フライトの中での進み具合 0..1 */
      t: number;
      /** 段ではなく勾配そのものの高さ。天井はこの線から headroom 上に張る */
      slopeHeight: number;
    };

const ix = () => STAIR.ax - STAIR.w; // 1.65
const iz = () => STAIR.az - STAIR.w; // 1.55

/** 1 周の中でのローカル (x, z) が属する領域。周回分は含まない */
export function stairRegion(x: number, z: number): StairRegion | null {
  const S = STAIR;
  const inX = ix();
  const inZ = iz();
  const flightH = S.steps * S.rise;
  const east = x >= inX && x <= S.ax;
  const west = x <= -inX && x >= -S.ax;
  const north = z <= -inZ && z >= -S.az;
  const south = z >= inZ && z <= S.az;
  if (east && south) return { kind: 'landing', index: 0, height: 0 };
  if (east && north) return { kind: 'landing', index: 1, height: flightH };
  if (west && north) return { kind: 'landing', index: 2, height: flightH * 2 };
  if (west && south) return { kind: 'landing', index: 3, height: flightH * 3 };
  const runZ = inZ * 2;
  const runX = inX * 2;
  const flight = (name: 'A' | 'B' | 'C' | 'D', t: number, startH: number): StairRegion => {
    const step = Math.min(S.steps - 1, Math.floor(t * S.steps));
    return {
      kind: 'flight',
      flight: name,
      step,
      height: startH + (step + 1) * S.rise,
      t,
      slopeHeight: startH + t * flightH,
    };
  };
  if (east && z > -inZ && z < inZ) return flight('A', (inZ - z) / runZ, 0);
  if (north && x > -inX && x < inX) return flight('B', (inX - x) / runX, flightH);
  if (west && z > -inZ && z < inZ) return flight('C', (z + inZ) / runZ, flightH * 2);
  if (south && x > -inX && x < inX) return flight('D', (x + inX) / runX, flightH * 3);
  return null;
}

/** 現在の高さに最も近い周を選ぶ */
function loopIndex(reference: number, currentY: number): number {
  return Math.max(0, Math.min(STAIR.loops - 1, Math.round((currentY - reference) / STAIR.loop)));
}

/** 現在の高さに最も近い周を選んで足元の高さを返す */
export function stairHeight(x: number, z: number, currentY: number): number | null {
  const r = stairRegion(x, z);
  if (!r) return null;
  return r.height + loopIndex(r.height, currentY) * STAIR.loop;
}

/**
 * 1 周の中での天井の下面の高さ。
 * 踊り場では床から、フライトでは段の勾配線から headroom 上に張る。
 * 踊り場とフライトの境目で高さが一致するので、継ぎ目に段差ができない。
 */
export function stairCeilingBase(r: StairRegion): number {
  return (r.kind === 'landing' ? r.height : r.slopeHeight) + STAIR.headroom;
}

/** 現在の高さに最も近い周を選んで天井の下面の高さを返す */
export function stairCeilingHeight(x: number, z: number, currentY: number): number | null {
  const r = stairRegion(x, z);
  if (!r) return null;
  return stairCeilingBase(r) + loopIndex(r.height, currentY) * STAIR.loop;
}

/** 瞬間移動の判定。戻す高さ(負の値)を返す。該当しなければ 0 */
export function stairSeamShift(x: number, z: number, y: number): number {
  const S = STAIR;
  // 継ぎ目 1: 上の周の東側の階段(A')の途中
  if (x >= ix() && x <= S.ax && z >= S.seamZ[0] && z <= S.seamZ[1] && y > S.loop + 0.3) {
    return -S.loop;
  }
  // 継ぎ目 2: 上の周の踊り場 L0' から出る偽の戸口
  if (x > S.ax + 0.05 && z >= iz() && z <= S.az && y > S.loop - 0.6) {
    return -S.loop;
  }
  return 0;
}
