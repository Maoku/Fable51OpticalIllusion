import * as THREE from 'three';
import type { HintEffect } from '../HintEffect';

export interface TransformTarget {
  object: THREE.Object3D;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3;
}

interface Snapshot {
  target: TransformTarget;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  targetQuaternion: THREE.Quaternion | null;
  scale: THREE.Vector3;
}

/** オブジェクトの位置・回転・拡大率を目標値へ補間する */
export class TransformLerp implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint: boolean;
  private readonly snapshots: Snapshot[];

  constructor(
    targets: TransformTarget[],
    opts: { durationMs?: number; lockViewpoint?: boolean } = {},
  ) {
    this.durationMs = opts.durationMs ?? 1200;
    this.lockViewpoint = opts.lockViewpoint ?? false;
    this.snapshots = targets.map((t) => ({
      target: t,
      position: t.object.position.clone(),
      quaternion: t.object.quaternion.clone(),
      targetQuaternion: t.rotation ? new THREE.Quaternion().setFromEuler(t.rotation) : null,
      scale: t.object.scale.clone(),
    }));
  }

  apply(t: number): void {
    for (const s of this.snapshots) {
      const o = s.target.object;
      if (s.target.position) o.position.copy(s.position).lerp(s.target.position, t);
      if (s.targetQuaternion) o.quaternion.copy(s.quaternion).slerp(s.targetQuaternion, t);
      if (s.target.scale) o.scale.copy(s.scale).lerp(s.target.scale, t);
    }
  }
}
