import * as THREE from 'three';
import type { Updatable } from '../app/Loop';

/**
 * 距離による光源の間引き。
 * three.js はシーン内の可視な点光源・スポットをすべて各フラグメントで評価するため、
 * 遠い展示の光源は visible = false にして計算から外す。
 * 光源の `userData.cullRange`(m)で範囲を上書きできる。
 */
export class LightCuller implements Updatable {
  private readonly lights: { light: THREE.Light; range2: number; pos: THREE.Vector3 }[] = [];
  private timer = 0;
  /** 判定の間隔(秒) */
  interval = 0.4;
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly getEye: () => THREE.Vector3) {}

  /** ルート以下の点光源・スポットを登録する */
  collect(root: THREE.Object3D, defaultRange = 18): void {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o instanceof THREE.PointLight) && !(o instanceof THREE.SpotLight)) return;
      // 既定は到達距離 + 5 m(到達距離のない光源は defaultRange)
      const range =
        (o.userData.cullRange as number | undefined) ??
        (o.distance > 0 ? o.distance + 5 : defaultRange);
      const pos = new THREE.Vector3();
      o.getWorldPosition(pos);
      this.lights.push({ light: o, range2: range * range, pos });
    });
    this.apply();
  }

  get count(): number {
    return this.lights.length;
  }

  get activeCount(): number {
    return this.lights.filter((l) => l.light.visible).length;
  }

  update(delta: number): void {
    this.timer += delta;
    if (this.timer < this.interval) return;
    this.timer = 0;
    this.apply();
  }

  private apply(): void {
    const eye = this.getEye();
    for (const entry of this.lights) {
      // 展示の演出で動かす光源もあるので、位置は毎回取り直す
      entry.light.getWorldPosition(entry.pos);
      const d2 = this.tmp.copy(entry.pos).sub(eye).lengthSq();
      entry.light.visible = d2 < entry.range2;
    }
  }
}
