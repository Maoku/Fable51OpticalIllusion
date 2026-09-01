import type { InputSource, LookDelta, MoveVector } from './InputSource';

/**
 * 複数の InputSource を合成する。
 * タッチ対応ノート PC のようにキーボードとタッチが同居する端末に対応するため、
 * すべての入力を同時に有効にしておく。
 */
export class CompositeInput implements InputSource {
  readonly move: MoveVector = { x: 0, y: 0 };

  constructor(readonly sources: InputSource[]) {}

  get interactPressed(): boolean {
    return this.sources.some((s) => s.interactPressed);
  }

  get sprint(): boolean {
    return this.sources.some((s) => s.sprint);
  }

  /** 各ソースの移動ベクトルを合成し、長さを 1 に制限する */
  poll(): MoveVector {
    let x = 0;
    let y = 0;
    for (const s of this.sources) {
      x += s.move.x;
      y += s.move.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move.x = x;
    this.move.y = y;
    return this.move;
  }

  consumeLook(): LookDelta {
    let yaw = 0;
    let pitch = 0;
    for (const s of this.sources) {
      const d = s.consumeLook();
      yaw += d.yaw;
      pitch += d.pitch;
    }
    return { yaw, pitch };
  }

  attach(el: HTMLElement): void {
    for (const s of this.sources) s.attach(el);
  }

  detach(): void {
    for (const s of this.sources) s.detach();
  }

  endFrame(): void {
    for (const s of this.sources) s.endFrame();
  }
}
