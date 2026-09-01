import { describe, expect, it } from 'vitest';
import { TouchInputCore } from '../../src/input/TouchInput';

function core(width = 800) {
  return new TouchInputCore({
    width: () => width,
    stickRadius: 50,
    deadZone: 0.1,
    lookSensitivity: 0.01,
  });
}

describe('TouchInputCore', () => {
  it('左半分のタッチは仮想スティックになり、上へ動かすと前進する', () => {
    const c = core();
    c.handle({ id: 1, type: 'down', x: 100, y: 500 });
    expect(c.stick.active).toBe(true);
    c.handle({ id: 1, type: 'move', x: 100, y: 450 });
    expect(c.move.x).toBeCloseTo(0);
    expect(c.move.y).toBeCloseTo(1);
    c.handle({ id: 1, type: 'up', x: 100, y: 450 });
    expect(c.stick.active).toBe(false);
    expect(c.move).toEqual({ x: 0, y: 0 });
  });

  it('半径を超えた入力は長さ 1 に制限され、ノブは縁に留まる', () => {
    const c = core();
    c.handle({ id: 1, type: 'down', x: 100, y: 500 });
    c.handle({ id: 1, type: 'move', x: 300, y: 500 });
    expect(c.move.x).toBeCloseTo(1);
    expect(c.move.y).toBeCloseTo(0);
    expect(c.stick.knobX).toBeCloseTo(150);
  });

  it('デッドゾーン内では移動しない', () => {
    const c = core();
    c.handle({ id: 1, type: 'down', x: 100, y: 500 });
    c.handle({ id: 1, type: 'move', x: 103, y: 500 });
    expect(c.move).toEqual({ x: 0, y: 0 });
  });

  it('右半分のドラッグは視点回転になり、consumeLook でリセットされる', () => {
    const c = core();
    c.handle({ id: 2, type: 'down', x: 600, y: 300 });
    c.handle({ id: 2, type: 'move', x: 620, y: 290 });
    const look = c.consumeLook();
    expect(look.yaw).toBeCloseTo(-0.2); // 右ドラッグで右を向く(yaw 減少)
    expect(look.pitch).toBeCloseTo(0.1); // 上ドラッグで上を向く
    expect(c.consumeLook()).toEqual({ yaw: 0, pitch: 0 });
  });

  it('スティックと視点を同時に操作できる', () => {
    const c = core();
    c.handle({ id: 1, type: 'down', x: 100, y: 500 });
    c.handle({ id: 2, type: 'down', x: 600, y: 300 });
    c.handle({ id: 1, type: 'move', x: 100, y: 450 });
    c.handle({ id: 2, type: 'move', x: 610, y: 300 });
    expect(c.move.y).toBeCloseTo(1);
    expect(c.consumeLook().yaw).toBeCloseTo(-0.1);
    c.handle({ id: 2, type: 'up', x: 610, y: 300 });
    expect(c.move.y).toBeCloseTo(1); // 視点側を離してもスティックは維持
  });

  it('スティック使用中に左半分へ 2 本目の指を置くと視点操作になる', () => {
    const c = core();
    c.handle({ id: 1, type: 'down', x: 100, y: 500 });
    c.handle({ id: 3, type: 'down', x: 200, y: 200 });
    c.handle({ id: 3, type: 'move', x: 210, y: 200 });
    expect(c.consumeLook().yaw).toBeCloseTo(-0.1);
  });

  it('reset で全状態が初期化される', () => {
    const c = core();
    c.handle({ id: 1, type: 'down', x: 100, y: 500 });
    c.handle({ id: 1, type: 'move', x: 100, y: 400 });
    c.reset();
    expect(c.move).toEqual({ x: 0, y: 0 });
    expect(c.stick.active).toBe(false);
  });
});
