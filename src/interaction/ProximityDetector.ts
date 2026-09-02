export interface ProximityTarget {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface ProximityChange {
  entered: string | null;
  left: string | null;
}

export interface ProximityOptions {
  /** 離脱半径の倍率(ヒステリシス)。1.15 なら半径の 115% で離脱 */
  hysteresis?: number;
  /** 現在の展示より明確に近い(距離比がこの値未満)ときだけ切り替える */
  switchRatio?: number;
}

/**
 * 最寄り展示を判定する。DOM や three.js に依存しない。
 * 進入は半径以内、離脱は半径 × hysteresis の外側で判定し、境界でのちらつきを防ぐ。
 */
export class ProximityDetector {
  current: string | null = null;
  private readonly hysteresis: number;
  private readonly switchRatio: number;

  constructor(
    private targets: ProximityTarget[],
    opts: ProximityOptions = {},
  ) {
    this.hysteresis = opts.hysteresis ?? 1.15;
    this.switchRatio = opts.switchRatio ?? 0.8;
  }

  setTargets(targets: ProximityTarget[]): void {
    this.targets = targets;
    if (this.current && !targets.some((t) => t.id === this.current)) this.current = null;
  }

  update(x: number, z: number): ProximityChange {
    let best: ProximityTarget | null = null;
    let bestDist = Infinity;
    for (const t of this.targets) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d <= t.radius && d < bestDist) {
        best = t;
        bestDist = d;
      }
    }

    const cur = this.targets.find((t) => t.id === this.current) ?? null;
    if (cur) {
      const d = Math.hypot(cur.x - x, cur.z - z);
      if (d <= cur.radius * this.hysteresis) {
        if (best && best.id !== cur.id && bestDist < d * this.switchRatio) {
          this.current = best.id;
          return { entered: best.id, left: cur.id };
        }
        return { entered: null, left: null };
      }
      this.current = best?.id ?? null;
      return { entered: best?.id ?? null, left: cur.id };
    }

    if (best) {
      this.current = best.id;
      return { entered: best.id, left: null };
    }
    return { entered: null, left: null };
  }
}
