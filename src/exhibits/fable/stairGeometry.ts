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
  /** 天井の高さ(段から) */
  headroom: 2.5,
  /** 瞬間移動の帯: 東側の階段(A')の z 範囲 */
  seamZ: [-1.0, -0.2] as [number, number],
};

export type StairRegion =
  | { kind: 'landing'; index: 0 | 1 | 2 | 3; height: number }
  | { kind: 'flight'; flight: 'A' | 'B' | 'C' | 'D'; step: number; height: number };

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
  if (east && z > -inZ && z < inZ) {
    const step = Math.min(S.steps - 1, Math.floor(((inZ - z) / runZ) * S.steps));
    return { kind: 'flight', flight: 'A', step, height: (step + 1) * S.rise };
  }
  if (north && x > -inX && x < inX) {
    const step = Math.min(S.steps - 1, Math.floor(((inX - x) / runX) * S.steps));
    return { kind: 'flight', flight: 'B', step, height: flightH + (step + 1) * S.rise };
  }
  if (west && z > -inZ && z < inZ) {
    const step = Math.min(S.steps - 1, Math.floor(((z + inZ) / runZ) * S.steps));
    return { kind: 'flight', flight: 'C', step, height: flightH * 2 + (step + 1) * S.rise };
  }
  if (south && x > -inX && x < inX) {
    const step = Math.min(S.steps - 1, Math.floor(((x + inX) / runX) * S.steps));
    return { kind: 'flight', flight: 'D', step, height: flightH * 3 + (step + 1) * S.rise };
  }
  return null;
}

/** 現在の高さに最も近い周を選んで足元の高さを返す */
export function stairHeight(x: number, z: number, currentY: number): number | null {
  const r = stairRegion(x, z);
  if (!r) return null;
  const k = Math.max(0, Math.min(STAIR.loops - 1, Math.round((currentY - r.height) / STAIR.loop)));
  return r.height + k * STAIR.loop;
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
