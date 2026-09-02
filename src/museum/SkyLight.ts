import * as THREE from 'three';
import type { Updatable } from '../app/Loop';
import type { QualitySettings } from '../app/Quality';

export interface SkyLightOptions {
  /** 照らす範囲の中心 */
  center: THREE.Vector3;
  /** 影カメラの半径 */
  extent: number;
  /** 影カメラの中心(省略時は center) */
  shadowCenter?: THREE.Vector3;
  /** 1 周期の秒数。光の角度がこの時間でゆっくり往復する */
  periodSeconds?: number;
}

/**
 * 天窓から落ちる方向光。時間とともに光の角度がゆっくり動く。
 * ティアに応じて影の解像度を変え、low では影を落とさない。
 */
export class SkyLight implements Updatable {
  readonly light = new THREE.DirectionalLight(0xfff6e8, 2.4);
  readonly target = new THREE.Object3D();
  private readonly center: THREE.Vector3;
  private readonly shadowCenter: THREE.Vector3;
  private readonly period: number;
  private elapsed = 0;

  constructor(opts: SkyLightOptions) {
    this.center = opts.center.clone();
    this.period = opts.periodSeconds ?? 180;
    this.shadowCenter = (opts.shadowCenter ?? opts.center).clone();
    this.target.position.copy(this.shadowCenter);
    this.light.target = this.target;
    this.light.name = 'skylight';
    const cam = this.light.shadow.camera;
    cam.left = -opts.extent;
    cam.right = opts.extent;
    cam.top = opts.extent;
    cam.bottom = -opts.extent;
    cam.near = 1;
    cam.far = 80;
    this.light.shadow.bias = -0.0008;
    this.light.shadow.normalBias = 0.02;
    this.light.shadow.radius = 3;
    this.place(0);
  }

  applyQuality(q: QualitySettings): void {
    this.light.castShadow = q.dynamicShadows && q.shadowMapSize > 0;
    if (this.light.castShadow) {
      const size = q.shadowMapSize;
      this.light.shadow.mapSize.set(size, size);
      this.light.shadow.map?.dispose();
      this.light.shadow.map = null;
    }
    // 影がないと部屋全体が均一に明るくなるので、low では控えめにする
    this.light.intensity = this.light.castShadow ? 2.4 : 0.9;
  }

  update(delta: number): void {
    this.elapsed += delta;
    this.place(this.elapsed);
  }

  private place(t: number): void {
    const phase = (t / this.period) * Math.PI * 2;
    // 東西に ±22°、南北に ±8° ゆっくり揺れる
    const az = Math.sin(phase) * THREE.MathUtils.degToRad(22);
    const tilt = Math.cos(phase * 0.5) * THREE.MathUtils.degToRad(8);
    const dir = new THREE.Vector3(Math.sin(az), 1, Math.sin(tilt) + 0.35).normalize();
    // 光の向きは天窓の中心基準、影カメラは全館の中心に置く
    this.light.position.copy(this.shadowCenter).addScaledVector(dir, 40);
    this.target.position
      .copy(this.shadowCenter)
      .addScaledVector(dir, 40 - 18)
      .sub(dir.clone().multiplyScalar(40 - 18));
  }
}
