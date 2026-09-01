export interface Updatable {
  /** @param delta 前フレームからの経過秒(上限あり) @param elapsed 起動からの経過秒 */
  update(delta: number, elapsed: number): void;
}

/** requestAnimationFrame ベースのメインループ。 */
export class Loop {
  private readonly updatables = new Set<Updatable>();
  private rafId = 0;
  private running = false;
  private last = 0;
  private elapsed = 0;
  /** 1 フレームの delta 上限(秒)。タブ復帰時の暴走を防ぐ */
  maxDelta = 0.1;

  constructor(private readonly render: () => void) {}

  add(u: Updatable): () => void {
    this.updatables.add(u);
    return () => this.remove(u);
  }

  remove(u: Updatable): void {
    this.updatables.delete(u);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const delta = Math.min((now - this.last) / 1000, this.maxDelta);
      this.last = now;
      this.elapsed += delta;
      for (const u of this.updatables) u.update(delta, this.elapsed);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  get isRunning(): boolean {
    return this.running;
  }
}
