import type * as THREE from 'three';
import type { Updatable } from '../app/Loop';
import type { QualityController } from '../app/Quality';
import { h, uiRoot } from './dom';

/** 実機確認用の統計表示(`?stats=1`)。fps、ティア、pixelRatio、描画回数 */
export class Stats implements Updatable {
  private readonly el: HTMLElement;
  private frames = 0;
  private time = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly quality: QualityController,
    private readonly extra: () => string = () => '',
  ) {
    this.el = h('pre', { className: 'stats', attrs: { 'data-testid': 'stats' } });
    uiRoot().appendChild(this.el);
  }

  update(delta: number): void {
    this.frames++;
    this.time += delta;
    if (this.time < 0.5) return;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    const info = this.renderer.info;
    this.el.textContent =
      `fps ${fps.toFixed(0)}  tier ${this.quality.tier}  dpr ${this.quality.pixelRatio.toFixed(2)}\n` +
      `calls ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k  ` +
      `geo ${info.memory.geometries}  tex ${info.memory.textures}\n${this.extra()}`;
  }
}
