import type { Updatable } from '../app/Loop';
import { bus } from '../app/events';
import { HintPlayer } from '../exhibits/HintEffect';
import type { ExhibitRegistry } from '../exhibits/registry';
import type { PlayerController } from '../player/PlayerController';

/**
 * ヒントの開閉を統括する。
 * near → toggle → 演出 0→1、再度 toggle または leave で 1→0 に戻す。
 */
export class HintController implements Updatable {
  readonly hintPlayer = new HintPlayer();
  openId: string | null = null;
  nearId: string | null = null;
  private opening = false;

  constructor(
    private readonly registry: ExhibitRegistry,
    private readonly player: PlayerController,
  ) {
    bus.on('exhibit:near', ({ id }) => {
      this.nearId = id;
    });
    bus.on('exhibit:leave', ({ id }) => {
      if (this.nearId === id) this.nearId = null;
      if (this.openId === id) this.close();
    });
    bus.on('hint:toggle', ({ id }) => {
      void this.toggle(id);
    });
    bus.on('input:interact', () => {
      if (this.nearId) void this.toggle(this.nearId);
    });
    bus.on('ui:modal', ({ open }) => {
      if (open && this.openId) this.close();
    });

    this.hintPlayer.onProgress = (t) => {
      if (this.openId) bus.emit('hint:progress', { id: this.openId, t });
    };
    this.hintPlayer.onSettle = (target) => {
      if (target === 0 && this.openId) {
        const id = this.openId;
        this.openId = null;
        this.player.frozen = false;
        bus.emit('hint:close', { id });
      }
    };
  }

  get isOpen(): boolean {
    return this.openId !== null && this.hintPlayer.target === 1;
  }

  async toggle(id: string): Promise<void> {
    if (this.openId === id) {
      if (this.hintPlayer.target === 1) this.close();
      else await this.open(id);
      return;
    }
    await this.open(id);
  }

  async open(id: string): Promise<void> {
    if (this.opening) return;
    const exhibit = this.registry.get(id);
    if (!exhibit) return;
    if (this.openId && this.openId !== id) {
      // 別の展示が開いていれば即座に戻す
      const prev = this.openId;
      this.hintPlayer.reset();
      this.openId = null;
      this.player.frozen = false;
      bus.emit('hint:close', { id: prev });
    }
    this.opening = true;
    try {
      if (this.openId !== id) this.hintPlayer.set(exhibit.hint);
      this.openId = id;
      bus.emit('hint:open', { id });
      if (exhibit.hint.lockViewpoint && exhibit.meta.viewpoint) {
        this.player.frozen = true;
        await this.player.moveTo(exhibit.meta.viewpoint, 0.5);
      }
      this.hintPlayer.open();
    } finally {
      this.opening = false;
    }
  }

  close(): void {
    if (!this.openId) return;
    this.hintPlayer.close();
  }

  update(delta: number): void {
    this.hintPlayer.update(delta);
  }
}
