import type { InputSource, LookDelta, MoveVector } from './InputSource';

const INTERACT_CODES = new Set(['KeyE', 'Enter', 'Space']);

/**
 * PC 向け入力。WASD / 矢印で移動、マウスで視点操作。
 * PointerLock が取れれば使用し、拒否された場合はドラッグルックにフォールバックする。
 */
export class KeyboardMouseInput implements InputSource {
  readonly move: MoveVector = { x: 0, y: 0 };
  interactPressed = false;
  sprint = false;
  /** ラジアン / ピクセル */
  sensitivity = 0.0022;
  /** PointerLock を取得した状態か */
  locked = false;
  /** PointerLock が使えず、ドラッグルックで動作しているか */
  dragFallback = false;
  /** クリックで PointerLock を要求するか(UI 表示中は false にする) */
  autoLock = true;
  onLockChange?: (locked: boolean) => void;

  private readonly keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private el: HTMLElement | null = null;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  attach(el: HTMLElement): void {
    this.detach();
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('pointerdown', this.onPointerDown);
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
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    document.removeEventListener('pointerlockchange', this.onLockChangeEvent);
    document.removeEventListener('pointerlockerror', this.onLockError);
    this.el = null;
    this.keys.clear();
    this.updateMove();
  }

  consumeLook(): LookDelta {
    const d = { yaw: this.yaw, pitch: this.pitch };
    this.yaw = 0;
    this.pitch = 0;
    return d;
  }

  endFrame(): void {
    this.interactPressed = false;
  }

  /** PointerLock を要求する。取れない環境ではドラッグルックに切り替える */
  requestLock(): void {
    const el = this.el;
    if (!el || this.locked || this.dragFallback) return;
    if (typeof el.requestPointerLock !== 'function') {
      this.dragFallback = true;
      return;
    }
    try {
      const result = el.requestPointerLock() as unknown;
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {
          this.dragFallback = true;
        });
      }
    } catch {
      this.dragFallback = true;
    }
  }

  releaseLock(): void {
    if (this.locked && typeof document.exitPointerLock === 'function') {
      document.exitPointerLock();
    }
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isEditableTarget(e.target)) return;
    if (e.repeat) return;
    this.keys.add(e.code);
    if (INTERACT_CODES.has(e.code)) {
      this.interactPressed = true;
      e.preventDefault();
    }
    this.updateMove();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.updateMove();
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
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

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (this.locked) return;
    if (this.autoLock && !this.dragFallback) {
      this.requestLock();
    }
    // PointerLock が取れるまでの間、あるいはフォールバック時はドラッグで回す
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    if (this.locked) {
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      return;
    }
    if (this.dragging) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.yaw -= dx * this.sensitivity;
      this.pitch -= dy * this.sensitivity;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    this.dragging = false;
  };

  private readonly onLockChangeEvent = (): void => {
    const locked = document.pointerLockElement === this.el && this.el !== null;
    if (locked !== this.locked) {
      this.locked = locked;
      this.dragging = false;
      this.onLockChange?.(locked);
    }
  };

  private readonly onLockError = (): void => {
    this.dragFallback = true;
    this.locked = false;
    this.onLockChange?.(false);
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
