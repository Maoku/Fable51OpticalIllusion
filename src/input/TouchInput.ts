import type { InputSource, LookDelta, MoveVector } from './InputSource';

export interface TouchPointer {
  id: number;
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
}

export interface StickState {
  active: boolean;
  /** 触れ始めた位置(スティックの中心) */
  originX: number;
  originY: number;
  /** 現在のノブ位置 */
  knobX: number;
  knobY: number;
}

export interface TouchInputOptions {
  /** 画面幅を返す。左半分をスティック、右半分をドラッグルックに割り当てる */
  width: () => number;
  /** スティックの最大半径(px) */
  stickRadius?: number;
  /** 半径に対するデッドゾーン比 */
  deadZone?: number;
  /** ラジアン / ピクセル */
  lookSensitivity?: number;
}

/**
 * DOM に依存しないタッチ入力のコア。
 * Pointer Events の列を渡すとスティック値と回転量を計算する(単体テスト対象)。
 */
export class TouchInputCore {
  readonly move: MoveVector = { x: 0, y: 0 };
  readonly stick: StickState = { active: false, originX: 0, originY: 0, knobX: 0, knobY: 0 };
  readonly stickRadius: number;
  readonly deadZone: number;
  lookSensitivity: number;

  private readonly width: () => number;
  private stickId: number | null = null;
  private lookId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private yaw = 0;
  private pitch = 0;

  constructor(opts: TouchInputOptions) {
    this.width = opts.width;
    this.stickRadius = opts.stickRadius ?? 56;
    this.deadZone = opts.deadZone ?? 0.12;
    this.lookSensitivity = opts.lookSensitivity ?? 0.005;
  }

  handle(p: TouchPointer): void {
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

  consumeLook(): LookDelta {
    const d = { yaw: this.yaw, pitch: this.pitch };
    this.yaw = 0;
    this.pitch = 0;
    return d;
  }

  reset(): void {
    this.stickId = null;
    this.lookId = null;
    this.stick.active = false;
    this.move.x = 0;
    this.move.y = 0;
    this.yaw = 0;
    this.pitch = 0;
  }

  private onDown(p: TouchPointer): void {
    const isLeft = p.x < this.width() / 2;
    if (isLeft && this.stickId === null) {
      this.stickId = p.id;
      this.stick.active = true;
      this.stick.originX = p.x;
      this.stick.originY = p.y;
      this.stick.knobX = p.x;
      this.stick.knobY = p.y;
      this.move.x = 0;
      this.move.y = 0;
      return;
    }
    if (this.lookId === null) {
      this.lookId = p.id;
      this.lastLookX = p.x;
      this.lastLookY = p.y;
    }
  }

  private onMove(p: TouchPointer): void {
    if (p.id === this.stickId) {
      let dx = p.x - this.stick.originX;
      let dy = p.y - this.stick.originY;
      const len = Math.hypot(dx, dy);
      if (len > this.stickRadius) {
        dx *= this.stickRadius / len;
        dy *= this.stickRadius / len;
      }
      this.stick.knobX = this.stick.originX + dx;
      this.stick.knobY = this.stick.originY + dy;
      const nx = dx / this.stickRadius;
      const ny = -dy / this.stickRadius; // 画面上方向 = 前進
      const mag = Math.hypot(nx, ny);
      if (mag < this.deadZone) {
        this.move.x = 0;
        this.move.y = 0;
      } else {
        // デッドゾーンの外側を 0..1 に再スケール
        const scaled = (mag - this.deadZone) / (1 - this.deadZone);
        this.move.x = (nx / mag) * scaled;
        this.move.y = (ny / mag) * scaled;
      }
      return;
    }
    if (p.id === this.lookId) {
      const dx = p.x - this.lastLookX;
      const dy = p.y - this.lastLookY;
      this.lastLookX = p.x;
      this.lastLookY = p.y;
      this.yaw -= dx * this.lookSensitivity;
      this.pitch -= dy * this.lookSensitivity;
    }
  }

  private onUp(p: TouchPointer): void {
    if (p.id === this.stickId) {
      this.stickId = null;
      this.stick.active = false;
      this.move.x = 0;
      this.move.y = 0;
    } else if (p.id === this.lookId) {
      this.lookId = null;
    }
  }
}

/**
 * 画面左半分で始まったタッチを仮想スティック、右半分をドラッグルックとして扱う。
 */
export class TouchInput implements InputSource {
  readonly core: TouchInputCore;
  interactPressed = false;
  readonly sprint = false;
  /** 一度でもタッチ操作が行われたか(UI の切替に使う) */
  touched = false;
  onFirstTouch?: () => void;

  private el: HTMLElement | null = null;

  constructor(opts?: Partial<TouchInputOptions>) {
    this.core = new TouchInputCore({
      width: () => this.el?.clientWidth || window.innerWidth,
      ...opts,
    });
  }

  get move(): MoveVector {
    return this.core.move;
  }

  get stick(): StickState {
    return this.core.stick;
  }

  consumeLook(): LookDelta {
    return this.core.consumeLook();
  }

  endFrame(): void {
    this.interactPressed = false;
  }

  attach(el: HTMLElement): void {
    this.detach();
    this.el = el;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('touchstart', preventDefault, { passive: false });
    el.addEventListener('touchmove', preventDefault, { passive: false });
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.el) return;
    const el = this.el;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('touchstart', preventDefault);
    el.removeEventListener('touchmove', preventDefault);
    window.removeEventListener('blur', this.onBlur);
    this.el = null;
    this.core.reset();
  }

  private isTouch(e: PointerEvent): boolean {
    return e.pointerType === 'touch' || e.pointerType === 'pen';
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.isTouch(e)) return;
    if (!this.touched) {
      this.touched = true;
      this.onFirstTouch?.();
    }
    this.el?.setPointerCapture?.(e.pointerId);
    this.core.handle({ id: e.pointerId, type: 'down', x: e.clientX, y: e.clientY });
    e.preventDefault();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.isTouch(e)) return;
    this.core.handle({ id: e.pointerId, type: 'move', x: e.clientX, y: e.clientY });
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.isTouch(e)) return;
    this.core.handle({ id: e.pointerId, type: 'up', x: e.clientX, y: e.clientY });
  };

  private readonly onBlur = (): void => {
    this.core.reset();
  };
}

function preventDefault(e: Event): void {
  e.preventDefault();
}
