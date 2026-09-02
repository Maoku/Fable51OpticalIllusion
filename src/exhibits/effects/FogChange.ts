import * as THREE from 'three';
import type { HintEffect } from '../HintEffect';

export interface FogChangeTarget {
  near?: number;
  far?: number;
  color?: THREE.ColorRepresentation;
}

/** フォグの濃さを変える。種明かしで霞を晴らし、書き割りの正体を見せる */
export class FogChange implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint: boolean;
  private readonly near: number;
  private readonly far: number;
  private readonly color: THREE.Color;
  private readonly targetColor: THREE.Color | null;

  constructor(
    private readonly fog: THREE.Fog,
    private readonly target: FogChangeTarget,
    opts: { durationMs?: number; lockViewpoint?: boolean } = {},
  ) {
    this.durationMs = opts.durationMs ?? 1200;
    this.lockViewpoint = opts.lockViewpoint ?? false;
    this.near = fog.near;
    this.far = fog.far;
    this.color = fog.color.clone();
    this.targetColor = target.color !== undefined ? new THREE.Color(target.color) : null;
  }

  apply(t: number): void {
    if (this.target.near !== undefined) {
      this.fog.near = THREE.MathUtils.lerp(this.near, this.target.near, t);
    }
    if (this.target.far !== undefined) {
      this.fog.far = THREE.MathUtils.lerp(this.far, this.target.far, t);
    }
    if (this.targetColor) this.fog.color.copy(this.color).lerp(this.targetColor, t);
  }
}
