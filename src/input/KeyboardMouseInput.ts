import type { InputSource, LookDelta, MoveVector } from './InputSource';
import { MouseLookCore } from './MouseLook';

const INTERACT_CODES = new Set(['KeyE', 'Enter', 'Space']);

/**
 * PC 向け入力。WASD / 矢印で移動、マウスのボタンを押しながらのドラッグで視点操作。
 *
 * 既定では PointerLock を使わない。ロック中はカーソルが消えて HUD のボタンが押せず、
 * UI 操作のたびに Esc で解除する必要があったため。ロックしたい場合は L キーで切り替える。
 */
export class KeyboardMouseInput implements InputSource {
  readonly move: MoveVector = { x: 0, y: 0 };
  readonly look = new MouseLookCore();
  interactPressed = false;
  sprint = false;
  /** PointerLock を取得した状態か */
  locked = false;
  /** PointerLock への切り替えを許可するか(UI 表示中は false にする) */
  lockAllowed = true;
  onLockChange?: (locked: boolean) => void;
  /** ドラッグの開始・終了(カーソルの見た目と操作案内に使う) */
  onDragChange?: (dragging: boolean) => void;

  private readonly keys = new Set<string>();
  private el: HTMLElement | null = null;

  /** ラジアン / ピクセル */
  get sensitivity(): number {
    return this.look.sensitivity;
  }

  set sensitivity(v: number) {
    this.look.sensitivity = v;
  }

  get dragging(): boolean {
    return this.look.dragging;
  }

  attach(el: HTMLElement): void {
    this.detach();
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('contextmenu', preventDefault);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    document.addEventListener('pointerlockchange', this.onLockChangeEvent);
    document.addEventListener('pointerlockerror', this.onLockError);
  }

  detach(): void {
    if (!this.el) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener('contextmenu', preventDefault);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    document.removeEventListener('pointerlockchange', this.onLockChangeEvent);
    document.removeEventListener('pointerlockerror', this.onLockError);
    this.el = null;
    this.keys.clear();
    this.look.reset();
    this.updateMove();
  }

  consumeLook(): LookDelta {
    return this.look.consumeLook();
  }

  endFrame(): void {
    this.interactPressed = false;
  }

  /** PointerLock を要求する(L キー用。既定の操作では使わない) */
  requestLock(): void {
    const el = this.el;
    if (!el || this.locked || !this.lockAllowed) return;
    if (typeof el.requestPointerLock !== 'function') return;
    try {
      const result = el.requestPointerLock() as unknown;
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {
          /* 取れない環境ではドラッグのまま使う */
        });
      }
    } catch {
      /* 同上 */
    }
  }

  releaseLock(): void {
    if (this.locked && typeof document.exitPointerLock === 'function') {
      document.exitPointerLock();
    }
  }

  toggleLock(): void {
    if (this.locked) this.releaseLock();
    else this.requestLock();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isEditableTarget(e.target)) return;
    if (e.repeat) return;
    this.keys.add(e.code);
    if (INTERACT_CODES.has(e.code)) {
      this.interactPressed = true;
      e.preventDefault();
    }
    if (e.code === 'KeyL') this.toggleLock();
    this.updateMove();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.updateMove();
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.setDragging(false);
    this.updateMove();
  };

  private updateMove(): void {
    const k = this.keys;
    const right = k.has('KeyD') || k.has('ArrowRight') ? 1 : 0;
    const left = k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0;
    const fwd = k.has('KeyW') || k.has('ArrowUp') ? 1 : 0;
    const back = k.has('KeyS') || k.has('ArrowDown') ? 1 : 0;
    this.move.x = right - left;
    this.move.y = fwd - back;
    this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
  }

  private setDragging(dragging: boolean): void {
    if (this.look.dragging === dragging) return;
    this.look.dragging = dragging;
    this.onDragChange?.(dragging);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || this.locked) return;
    const before = this.look.dragging;
    this.look.handle({ type: 'down', button: e.button, x: e.clientX, y: e.clientY });
    if (this.look.dragging === before) return;
    // ドラッグ中は UI の上を通っても回転を続ける。
    // 対応するポインタが既にない場合は例外になるので、握り潰して回転だけ続ける
    capturePointer(this.el, e.pointerId, true);
    this.onDragChange?.(true);
    e.preventDefault();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    if (this.locked) {
      this.look.addDelta(e.movementX, e.movementY);
      return;
    }
    const before = this.look.dragging;
    this.look.handle({ type: 'move', buttons: e.buttons, x: e.clientX, y: e.clientY });
    if (before && !this.look.dragging) this.onDragChange?.(false);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    const before = this.look.dragging;
    this.look.handle({ type: 'up', button: e.button, x: e.clientX, y: e.clientY });
    if (before && !this.look.dragging) {
      capturePointer(this.el, e.pointerId, false);
      this.onDragChange?.(false);
    }
  };

  private readonly onLockChangeEvent = (): void => {
    const locked = document.pointerLockElement === this.el && this.el !== null;
    if (locked !== this.locked) {
      this.locked = locked;
      this.setDragging(false);
      this.onLockChange?.(locked);
    }
  };

  private readonly onLockError = (): void => {
    this.locked = false;
    this.onLockChange?.(false);
  };
}

function preventDefault(e: Event): void {
  e.preventDefault();
}

/** ポインタキャプチャの取得 / 解放。対象のポインタが既にない環境では何もしない */
function capturePointer(el: HTMLElement | null, pointerId: number, capture: boolean): void {
  try {
    if (capture) el?.setPointerCapture?.(pointerId);
    else el?.releasePointerCapture?.(pointerId);
  } catch {
    /* noop */
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
