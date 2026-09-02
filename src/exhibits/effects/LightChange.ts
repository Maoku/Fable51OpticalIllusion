import * as THREE from 'three';
import type { HintEffect } from '../HintEffect';

export interface LightChangeTarget {
  color?: THREE.ColorRepresentation;
  intensity?: number;
  position?: THREE.Vector3;
}

interface LightSnapshot {
  light: THREE.Light;
  color: THREE.Color;
  intensity: number;
  position: THREE.Vector3;
  target: LightChangeTarget;
  targetColor: THREE.Color | null;
}

/** 光源の色温度・強さ・位置を変えて色の恒常性を破る */
export class LightChange implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint: boolean;
  private readonly snapshots: LightSnapshot[] = [];

  constructor(
    entries: { light: THREE.Light; target: LightChangeTarget }[],
    opts: { durationMs?: number; lockViewpoint?: boolean } = {},
  ) {
    this.durationMs = opts.durationMs ?? 1200;
    this.lockViewpoint = opts.lockViewpoint ?? false;
    for (const e of entries) {
      this.snapshots.push({
        light: e.light,
        color: e.light.color.clone(),
        intensity: e.light.intensity,
        position: e.light.position.clone(),
        target: e.target,
        targetColor: e.target.color !== undefined ? new THREE.Color(e.target.color) : null,
      });
    }
  }

  apply(t: number): void {
    for (const s of this.snapshots) {
      if (s.targetColor) s.light.color.copy(s.color).lerp(s.targetColor, t);
      if (s.target.intensity !== undefined) {
        s.light.intensity = THREE.MathUtils.lerp(s.intensity, s.target.intensity, t);
      }
      if (s.target.position) s.light.position.copy(s.position).lerp(s.target.position, t);
    }
  }
}
