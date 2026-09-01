import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/app/EventBus';

interface Events extends Record<string, unknown> {
  ping: { n: number };
  empty: undefined;
}

describe('EventBus', () => {
  it('購読したリスナーに emit のペイロードが届く', () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    bus.on('ping', fn);
    bus.emit('ping', { n: 1 });
    expect(fn).toHaveBeenCalledWith({ n: 1 });
  });

  it('on の戻り値で購読を解除できる', () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    const off = bus.on('ping', fn);
    off();
    bus.emit('ping', { n: 2 });
    expect(fn).not.toHaveBeenCalled();
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('once は一度だけ呼ばれる', () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    bus.once('ping', fn);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('emit 中に解除しても残りのリスナーは呼ばれる', () => {
    const bus = new EventBus<Events>();
    const second = vi.fn();
    const first = vi.fn(() => bus.off('ping', second));
    bus.on('ping', first);
    bus.on('ping', second);
    bus.emit('ping', { n: 1 });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('リスナーのないイベントを emit しても例外にならない', () => {
    const bus = new EventBus<Events>();
    expect(() => bus.emit('empty', undefined)).not.toThrow();
  });

  it('clear で全リスナーが消える', () => {
    const bus = new EventBus<Events>();
    bus.on('ping', vi.fn());
    bus.clear();
    expect(bus.listenerCount('ping')).toBe(0);
  });
});
