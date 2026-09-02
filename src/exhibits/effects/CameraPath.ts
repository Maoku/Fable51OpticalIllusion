import * as THREE from 'three';
import type { PlayerController } from '../../player/PlayerController';
import type { HintEffect } from '../HintEffect';

export interface CameraPathOptions {
  /** 注視点(ワールド座標) */
  target: THREE.Vector3;
  /** 開始位置(現在のカメラ)の後に通る経由点。最後の点が t = 1 の位置 */
  waypoints: THREE.Vector3[];
  durationMs?: number;
}

/**
 * 開始位置から経由点を通ってカメラを飛ばし、常に注視点を見る。
 * t が戻るときは同じ経路を逆にたどる。
 */
export class CameraPath implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint = true;
  private readonly target: THREE.Vector3;
  private readonly waypoints: THREE.Vector3[];
  private readonly from = new THREE.Vector3();
  private readonly pos = new THREE.Vector3();
  private curve: THREE.CatmullRomCurve3 | null = null;

  constructor(
    private readonly player: PlayerController,
    opts: CameraPathOptions,
  ) {
    this.target = opts.target.clone();
    this.waypoints = opts.waypoints.map((p) => p.clone());
    this.durationMs = opts.durationMs ?? 3000;
  }

  onStart(direction: 1 | -1): void {
    if (direction === 1 && !this.curve) {
      this.from.copy(this.player.camera.position);
      this.curve = new THREE.CatmullRomCurve3(
        [this.from.clone(), ...this.waypoints],
        false,
        'centripetal',
      );
    }
  }

  apply(t: number): void {
    if (t <= 0 || !this.curve) {
      this.player.cameraOverride = null;
      this.curve = null;
      return;
    }
    this.curve.getPointAt(Math.min(1, t), this.pos);
    this.player.cameraOverride = { position: this.pos, lookAt: this.target };
  }
}
