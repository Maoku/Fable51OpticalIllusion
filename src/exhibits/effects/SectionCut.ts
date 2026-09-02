import * as THREE from 'three';
import type { HintEffect } from '../HintEffect';

export interface SectionCutOptions {
  /** 切断面の法線(ワールド座標)。法線の負側が消える */
  normal: THREE.Vector3;
  /** 演出開始時の切断面上の点(何も切れない位置) */
  start: THREE.Vector3;
  /** 演出完了時の切断面上の点 */
  end: THREE.Vector3;
  durationMs?: number;
  lockViewpoint?: boolean;
  /** 断面を塗る色(指定すると裏面を単色で描く) */
  capColor?: THREE.ColorRepresentation;
}

/**
 * クリッピング平面で断面を見せる。renderer.localClippingEnabled が必要。
 */
export class SectionCut implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint: boolean;
  private readonly plane = new THREE.Plane();
  private readonly normal: THREE.Vector3;
  private readonly start: THREE.Vector3;
  private readonly end: THREE.Vector3;
  private readonly point = new THREE.Vector3();
  private readonly materials: THREE.Material[] = [];
  private readonly originalSide = new Map<THREE.Material, THREE.Side>();

  constructor(meshes: THREE.Mesh[], opts: SectionCutOptions) {
    this.durationMs = opts.durationMs ?? 1200;
    this.lockViewpoint = opts.lockViewpoint ?? false;
    this.normal = opts.normal.clone().normalize();
    this.start = opts.start.clone();
    this.end = opts.end.clone();
    for (const mesh of meshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        this.materials.push(m);
        this.originalSide.set(m, m.side);
      }
    }
    this.plane.setFromNormalAndCoplanarPoint(this.normal, this.start);
  }

  apply(t: number): void {
    if (t <= 0) {
      for (const m of this.materials) {
        m.clippingPlanes = null;
        m.side = this.originalSide.get(m) ?? THREE.FrontSide;
        m.needsUpdate = true;
      }
      return;
    }
    this.point.copy(this.start).lerp(this.end, t);
    this.plane.setFromNormalAndCoplanarPoint(this.normal, this.point);
    for (const m of this.materials) {
      if (!m.clippingPlanes) {
        m.clippingPlanes = [this.plane];
        m.side = THREE.DoubleSide;
        m.needsUpdate = true;
      }
    }
  }
}
