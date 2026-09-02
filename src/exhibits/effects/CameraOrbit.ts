import * as THREE from 'three';
import type { PlayerController } from '../../player/PlayerController';
import type { HintEffect } from '../HintEffect';

export interface CameraOrbitOptions {
  /** 注視点(ワールド座標) */
  target: THREE.Vector3;
  /** 回転量(ラジアン)。正で左回り */
  sweep?: number;
  /** 上方向への移動量(m) */
  lift?: number;
  /** 注視点からの距離の倍率(1 で変化なし) */
  radiusScale?: number;
  durationMs?: number;
}

/**
 * 推奨視点から少し離れた軌道へカメラを移動し、分解される様子を見せる。
 * 開始時のカメラ位置を起点に注視点の周りを回るので、視点は必ず固定する。
 */
export class CameraOrbit implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint = true;
  private readonly target: THREE.Vector3;
  private readonly sweep: number;
  private readonly lift: number;
  private readonly radiusScale: number;
  private readonly from = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly pos = new THREE.Vector3();
  private started = false;

  constructor(
    private readonly player: PlayerController,
    opts: CameraOrbitOptions,
  ) {
    this.target = opts.target.clone();
    this.sweep = opts.sweep ?? Math.PI * 0.6;
    this.lift = opts.lift ?? 0.8;
    this.radiusScale = opts.radiusScale ?? 1.3;
    this.durationMs = opts.durationMs ?? 2200;
  }

  onStart(direction: 1 | -1): void {
    if (direction === 1 && !this.started) {
      this.from.copy(this.player.camera.position);
      this.started = true;
    }
  }

  apply(t: number): void {
    if (t <= 0) {
      this.player.cameraOverride = null;
      this.started = false;
      return;
    }
    this.tmp.copy(this.from).sub(this.target);
    const y = this.tmp.y;
    this.tmp.y = 0;
    const angle = this.sweep * t;
    const scale = 1 + (this.radiusScale - 1) * t;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.pos.set(
      (this.tmp.x * cos - this.tmp.z * sin) * scale,
      y + this.lift * t,
      (this.tmp.x * sin + this.tmp.z * cos) * scale,
    );
    this.pos.add(this.target);
    this.player.cameraOverride = { position: this.pos, lookAt: this.target };
  }
}
