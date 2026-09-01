export type Listener<T> = (payload: T) => void;

/**
 * 型付きの最小 EventBus。
 * イベント名とペイロード型の対応を `Events` で与える。
 */
export class EventBus<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn as Listener<never>);
    return () => this.off(type, fn);
  }

  once<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void {
    const wrapped: Listener<Events[K]> = (payload) => {
      this.off(type, wrapped);
      fn(payload);
    };
    return this.on(type, wrapped);
  }

  off<K extends keyof Events>(type: K, fn: Listener<Events[K]>): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(fn as Listener<never>);
    if (set.size === 0) this.listeners.delete(type);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    // emit 中に購読解除されても安全なようにコピーして回す
    for (const fn of Array.from(set)) {
      (fn as Listener<Events[K]>)(payload);
    }
  }

  listenerCount(type: keyof Events): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}
