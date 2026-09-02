import type { Updatable } from '../app/Loop';

/**
 * ヒント演出の抽象。進行度 t を 0(通常の見え方)→ 1(種明かし完了)で補間する。
 * 途中状態を持てるよう、apply は任意の t で何度呼ばれても同じ結果になるように書く。
 */
export interface HintEffect {
  apply(t: number): void;
  readonly durationMs: number;
  /** 演出中にプレイヤーを推奨視点へ固定するか */
  readonly lockViewpoint: boolean;
  /** 演出の開始時(direction: 1 = 開く、-1 = 閉じる) */
  onStart?(direction: 1 | -1): void;
  /** 演出が端(t = 0 または 1)に到達したとき */
  onEnd?(direction: 1 | -1): void;
}

export const NOOP_EFFECT: HintEffect = {
  apply() {},
  durationMs: 600,
  lockViewpoint: false,
};

/** 複数の演出をまとめて 1 つの HintEffect にする */
export class CompositeHintEffect implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint: boolean;

  constructor(
    readonly effects: HintEffect[],
    opts: { durationMs?: number; lockViewpoint?: boolean } = {},
  ) {
    this.durationMs = opts.durationMs ?? Math.max(600, ...effects.map((e) => e.durationMs));
    this.lockViewpoint = opts.lockViewpoint ?? effects.some((e) => e.lockViewpoint);
  }

  apply(t: number): void {
    for (const e of this.effects) e.apply(t);
  }

  onStart(direction: 1 | -1): void {
    for (const e of this.effects) e.onStart?.(direction);
  }

  onEnd(direction: 1 | -1): void {
    for (const e of this.effects) e.onEnd?.(direction);
  }
}

export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 1 つの HintEffect の進行度を時間で駆動する。
 * open() で 0→1、close() で 1→0 に向かい、途中で反転しても連続的に戻る。
 */
export class HintPlayer implements Updatable {
  /** 補間前の生の進行度 0..1 */
  progress = 0;
  /** 目標(0 または 1) */
  target: 0 | 1 = 0;
  effect: HintEffect | null = null;
  onProgress?: (t: number, effect: HintEffect) => void;
  onSettle?: (target: 0 | 1, effect: HintEffect) => void;
  private moving = false;

  get t(): number {
    return easeInOutCubic(this.progress);
  }

  get isOpen(): boolean {
    return this.target === 1;
  }

  get isSettled(): boolean {
    return !this.moving;
  }

  /** 新しい演出を割り当て、進行度をリセットする */
  set(effect: HintEffect): void {
    if (this.effect && this.effect !== effect && this.progress > 0) {
      this.effect.apply(0);
      this.effect.onEnd?.(-1);
    }
    this.effect = effect;
    this.progress = 0;
    this.target = 0;
    this.moving = false;
  }

  open(): void {
    this.setTarget(1);
  }

  close(): void {
    this.setTarget(0);
  }

  toggle(): void {
    this.setTarget(this.target === 1 ? 0 : 1);
  }

  private setTarget(target: 0 | 1): void {
    if (!this.effect) return;
    if (this.target === target && (this.moving || this.progress === target)) return;
    this.target = target;
    if (!this.moving) {
      this.moving = true;
      this.effect.onStart?.(target === 1 ? 1 : -1);
    }
  }

  update(delta: number): void {
    const effect = this.effect;
    if (!effect || !this.moving) return;
    const speed = 1000 / Math.max(1, effect.durationMs);
    const dir = this.target === 1 ? 1 : -1;
    this.progress = clamp01(this.progress + dir * speed * delta);
    const t = this.t;
    effect.apply(t);
    this.onProgress?.(t, effect);
    if (this.progress === this.target) {
      this.moving = false;
      effect.onEnd?.(dir);
      this.onSettle?.(this.target, effect);
    }
  }

  /** 即座に 0 へ戻す(展示から離れたとき等) */
  reset(): void {
    if (!this.effect) return;
    if (this.progress > 0 || this.moving) {
      this.effect.apply(0);
      this.effect.onEnd?.(-1);
    }
    this.progress = 0;
    this.target = 0;
    this.moving = false;
  }
}
