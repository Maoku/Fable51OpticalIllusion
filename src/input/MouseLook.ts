import type { LookDelta } from './InputSource';

export interface MousePointer {
  type: 'down' | 'move' | 'up';
  /** 押した / 離したボタン(0 = 左、1 = 中、2 = 右)。move では未使用 */
  button?: number;
  /** move の時点で押されているボタンのビットマスク(左 = 1、右 = 2) */
  buttons?: number;
  x: number;
  y: number;
}

/** 視点回転を始められるボタン。右が主、左はトラックパッド向けの補助 */
export const DRAG_BUTTONS: readonly number[] = [0, 2];

/** PointerEvent.buttons のビット */
const BUTTON_BIT: Record<number, number> = { 0: 1, 2: 2 };

/**
 * DOM に依存しないマウスルックのコア。
 * ボタンを押しながらのドラッグを視点回転に変換する(単体テスト対象)。
 *
 * PointerLock を使わないのは、ロック中はカーソルが消えて「ヒントを見る」などの
 * DOM ボタンを押せなくなるため。ドラッグなら UI 操作と共存できる。
 */
export class MouseLookCore {
  /** ラジアン / ピクセル。ドラッグは移動量が画面幅に制限されるので、ロック時より高くする */
  sensitivity: number;
  /** ドラッグ中か */
  dragging = false;
  /** 一度でも視点を回したか(操作案内の表示に使う) */
  looked = false;

  private button = -1;
  private lastX = 0;
  private lastY = 0;
  private yaw = 0;
  private pitch = 0;

  constructor(sensitivity = 0.0035) {
    this.sensitivity = sensitivity;
  }

  handle(p: MousePointer): void {
    switch (p.type) {
      case 'down':
        this.onDown(p);
        break;
      case 'move':
        this.onMove(p);
        break;
      case 'up':
        this.onUp(p);
        break;
    }
  }

  /** PointerLock 中の movementX / movementY をそのまま回転に足す */
  addDelta(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    this.looked = true;
  }

  consumeLook(): LookDelta {
    const d = { yaw: this.yaw, pitch: this.pitch };
    this.yaw = 0;
    this.pitch = 0;
    return d;
  }

  reset(): void {
    this.dragging = false;
    this.button = -1;
    this.yaw = 0;
    this.pitch = 0;
  }

  private onDown(p: MousePointer): void {
    const button = p.button ?? 0;
    if (this.dragging || !DRAG_BUTTONS.includes(button)) return;
    this.dragging = true;
    this.button = button;
    this.lastX = p.x;
    this.lastY = p.y;
  }

  private onMove(p: MousePointer): void {
    if (!this.dragging) return;
    // ウィンドウの外で離された場合など、ボタンが上がっていたら終わりにする
    const bit = BUTTON_BIT[this.button];
    if (p.buttons !== undefined && bit !== undefined && (p.buttons & bit) === 0) {
      this.dragging = false;
      return;
    }
    this.addDelta(p.x - this.lastX, p.y - this.lastY);
    this.lastX = p.x;
    this.lastY = p.y;
  }

  private onUp(p: MousePointer): void {
    if (!this.dragging) return;
    if (p.button !== undefined && p.button !== this.button) return;
    this.dragging = false;
    this.button = -1;
  }
}
