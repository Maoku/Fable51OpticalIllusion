import { describe, expect, it } from 'vitest';
import { MouseLookCore } from '../../src/input/MouseLook';

/** PointerEvent.buttons のビット(左 = 1、右 = 2) */
const LEFT = 1;
const RIGHT = 2;

function core(): MouseLookCore {
  return new MouseLookCore(0.01);
}

describe('MouseLookCore', () => {
  it('右ボタンのドラッグで視点が回り、consumeLook でリセットされる', () => {
    const c = core();
    c.handle({ type: 'down', button: 2, x: 400, y: 300 });
    expect(c.dragging).toBe(true);
    c.handle({ type: 'move', buttons: RIGHT, x: 420, y: 290 });
    const look = c.consumeLook();
    expect(look.yaw).toBeCloseTo(-0.2); // 右へドラッグすると右を向く(yaw 減少)
    expect(look.pitch).toBeCloseTo(0.1); // 上へドラッグすると上を向く
    expect(c.consumeLook()).toEqual({ yaw: 0, pitch: 0 });
  });

  it('左ボタンのドラッグでも同じように回る(トラックパッド向け)', () => {
    const c = core();
    c.handle({ type: 'down', button: 0, x: 400, y: 300 });
    c.handle({ type: 'move', buttons: LEFT, x: 380, y: 300 });
    expect(c.consumeLook().yaw).toBeCloseTo(0.2);
  });

  it('ボタンを押していない移動では回らない', () => {
    const c = core();
    c.handle({ type: 'move', buttons: 0, x: 500, y: 200 });
    expect(c.dragging).toBe(false);
    expect(c.consumeLook()).toEqual({ yaw: 0, pitch: 0 });
  });

  it('中ボタンではドラッグを始めない', () => {
    const c = core();
    c.handle({ type: 'down', button: 1, x: 400, y: 300 });
    expect(c.dragging).toBe(false);
    c.handle({ type: 'move', buttons: 4, x: 450, y: 300 });
    expect(c.consumeLook().yaw).toBeCloseTo(0);
  });

  it('ボタンを離すとドラッグが終わり、その後の移動では回らない', () => {
    const c = core();
    c.handle({ type: 'down', button: 2, x: 400, y: 300 });
    c.handle({ type: 'move', buttons: RIGHT, x: 410, y: 300 });
    c.handle({ type: 'up', button: 2, x: 410, y: 300 });
    expect(c.dragging).toBe(false);
    c.consumeLook();
    c.handle({ type: 'move', buttons: 0, x: 600, y: 300 });
    expect(c.consumeLook()).toEqual({ yaw: 0, pitch: 0 });
  });

  it('ウィンドウの外で離された場合、次の移動でドラッグを終える', () => {
    const c = core();
    c.handle({ type: 'down', button: 2, x: 400, y: 300 });
    c.handle({ type: 'move', buttons: 0, x: 500, y: 300 });
    expect(c.dragging).toBe(false);
    expect(c.consumeLook()).toEqual({ yaw: 0, pitch: 0 });
  });

  it('ドラッグ中に別のボタンを押しても、最初のボタンの操作が続く', () => {
    const c = core();
    c.handle({ type: 'down', button: 2, x: 400, y: 300 });
    c.handle({ type: 'down', button: 0, x: 400, y: 300 });
    c.handle({ type: 'up', button: 0, x: 400, y: 300 });
    expect(c.dragging).toBe(true);
    c.handle({ type: 'move', buttons: RIGHT, x: 410, y: 300 });
    expect(c.consumeLook().yaw).toBeCloseTo(-0.1);
  });

  it('PointerLock 中は addDelta で回る', () => {
    const c = core();
    c.addDelta(10, -5);
    const look = c.consumeLook();
    expect(look.yaw).toBeCloseTo(-0.1);
    expect(look.pitch).toBeCloseTo(0.05);
  });

  it('視点を回すと looked が立つ(操作案内を消すため)', () => {
    const c = core();
    expect(c.looked).toBe(false);
    c.handle({ type: 'down', button: 2, x: 400, y: 300 });
    expect(c.looked).toBe(false); // 押しただけでは立たない
    c.handle({ type: 'move', buttons: RIGHT, x: 405, y: 300 });
    expect(c.looked).toBe(true);
  });

  it('reset で回転量とドラッグ状態が初期化される', () => {
    const c = core();
    c.handle({ type: 'down', button: 2, x: 400, y: 300 });
    c.handle({ type: 'move', buttons: RIGHT, x: 500, y: 300 });
    c.reset();
    expect(c.dragging).toBe(false);
    expect(c.consumeLook()).toEqual({ yaw: 0, pitch: 0 });
  });
});
