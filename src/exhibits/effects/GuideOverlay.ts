import * as THREE from 'three';
import type { HintEffect } from '../HintEffect';

export interface GuideOverlayOptions {
  /** 元のメッシュからのローカルオフセット(既定は +z に 2 mm) */
  offset?: THREE.Vector3;
  durationMs?: number;
  lockViewpoint?: boolean;
  /** 元のメッシュの見え方を薄くする割合(0 で変化なし) */
  dimBase?: number;
}

/**
 * 補助線・ガイドのテクスチャを元の面に重ねて表示する。
 * テクスチャの切替ではなく、同じ形状の半透明メッシュを重ねて opacity で制御する。
 */
export class GuideOverlay implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint: boolean;
  readonly overlay: THREE.Mesh;
  private readonly baseMaterial: THREE.Material | null;
  private readonly dimBase: number;

  constructor(base: THREE.Mesh, guide: THREE.Texture, opts: GuideOverlayOptions = {}) {
    this.durationMs = opts.durationMs ?? 700;
    this.lockViewpoint = opts.lockViewpoint ?? false;
    this.dimBase = opts.dimBase ?? 0;
    const mat = new THREE.MeshBasicMaterial({
      map: guide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });
    this.overlay = new THREE.Mesh(base.geometry, mat);
    this.overlay.position.copy(opts.offset ?? new THREE.Vector3(0, 0, 0.002));
    this.overlay.renderOrder = 5;
    this.overlay.visible = false;
    this.overlay.name = 'guide';
    base.add(this.overlay);
    this.baseMaterial = this.dimBase > 0 && !Array.isArray(base.material) ? base.material : null;
    if (this.baseMaterial) this.baseMaterial.transparent = true;
  }

  apply(t: number): void {
    this.overlay.visible = t > 0;
    (this.overlay.material as THREE.MeshBasicMaterial).opacity = t;
    if (this.baseMaterial) this.baseMaterial.opacity = 1 - this.dimBase * t;
  }
}
