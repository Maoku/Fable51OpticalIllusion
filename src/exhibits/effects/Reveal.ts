import type * as THREE from 'three';
import type { HintEffect } from '../HintEffect';

interface Entry {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

/** 隠していたオブジェクト群をフェードインで現す(等身大の人型など) */
export class Reveal implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint: boolean;
  private readonly entries: Entry[] = [];

  constructor(
    private readonly objects: THREE.Object3D[],
    opts: { durationMs?: number; lockViewpoint?: boolean } = {},
  ) {
    this.durationMs = opts.durationMs ?? 900;
    this.lockViewpoint = opts.lockViewpoint ?? false;
    const seen = new Set<THREE.Material>();
    for (const root of objects) {
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh && !(o as THREE.Line).isLine && !(o as THREE.Sprite).isSprite) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m || seen.has(m)) continue;
          seen.add(m);
          this.entries.push({
            material: m,
            opacity: m.opacity,
            transparent: m.transparent,
            depthWrite: m.depthWrite,
          });
        }
      });
      root.visible = false;
    }
  }

  apply(t: number): void {
    for (const o of this.objects) o.visible = t > 0;
    for (const e of this.entries) {
      const m = e.material;
      if (t >= 1) {
        m.opacity = e.opacity;
        m.transparent = e.transparent;
        m.depthWrite = e.depthWrite;
      } else {
        m.opacity = e.opacity * t;
        m.transparent = true;
        m.depthWrite = false;
      }
    }
  }
}
