import * as THREE from 'three';
import type { HintEffect } from '../HintEffect';

export interface MaterialSwapTarget {
  opacity?: number;
  color?: THREE.ColorRepresentation;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  wireframe?: boolean;
  /** t が 0 を超えたら表示、0 で非表示にする(内部構造を見せる用) */
  revealObjects?: THREE.Object3D[];
  /** t が 1 未満で表示、1 で非表示にする */
  hideObjects?: THREE.Object3D[];
}

interface Snapshot {
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  color: THREE.Color;
  emissive: THREE.Color | null;
  emissiveIntensity: number;
}

/**
 * 半透明化・単色化などで内部構造を見せる。
 * 元のマテリアル値を保持し、t で線形補間する。
 */
export class MaterialSwap implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint: boolean;
  private readonly snapshots: Snapshot[] = [];
  private readonly targetColor: THREE.Color | null;
  private readonly targetEmissive: THREE.Color | null;
  private readonly tmpColor = new THREE.Color();

  constructor(
    meshes: THREE.Mesh[],
    private readonly target: MaterialSwapTarget,
    opts: { durationMs?: number; lockViewpoint?: boolean } = {},
  ) {
    this.durationMs = opts.durationMs ?? 900;
    this.lockViewpoint = opts.lockViewpoint ?? false;
    this.targetColor = target.color !== undefined ? new THREE.Color(target.color) : null;
    this.targetEmissive = target.emissive !== undefined ? new THREE.Color(target.emissive) : null;
    for (const mesh of meshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!(
          m instanceof THREE.MeshStandardMaterial ||
          m instanceof THREE.MeshPhysicalMaterial ||
          m instanceof THREE.MeshBasicMaterial
        )) {
          continue;
        }
        const emissive = 'emissive' in m ? (m.emissive as THREE.Color) : null;
        this.snapshots.push({
          material: m,
          opacity: m.opacity,
          transparent: m.transparent,
          depthWrite: m.depthWrite,
          color: m.color.clone(),
          emissive: emissive ? emissive.clone() : null,
          emissiveIntensity: 'emissiveIntensity' in m ? (m.emissiveIntensity as number) : 1,
        });
      }
    }
    for (const o of target.revealObjects ?? []) o.visible = false;
  }

  apply(t: number): void {
    for (const s of this.snapshots) {
      const m = s.material;
      if (this.target.opacity !== undefined) {
        const op = THREE.MathUtils.lerp(s.opacity, this.target.opacity, t);
        m.opacity = op;
        m.transparent = t > 0 ? true : s.transparent;
        m.depthWrite = t > 0 ? op > 0.95 : s.depthWrite;
      }
      if (this.targetColor) {
        m.color.copy(s.color).lerp(this.targetColor, t);
      }
      if (this.targetEmissive && s.emissive && 'emissive' in m) {
        (m.emissive as THREE.Color).copy(s.emissive).lerp(this.targetEmissive, t);
      }
      if (this.target.emissiveIntensity !== undefined && 'emissiveIntensity' in m) {
        (m as THREE.MeshStandardMaterial).emissiveIntensity = THREE.MathUtils.lerp(
          s.emissiveIntensity,
          this.target.emissiveIntensity,
          t,
        );
      }
      if (this.target.wireframe !== undefined && 'wireframe' in m) {
        (m as THREE.MeshStandardMaterial).wireframe = t >= 0.5 ? this.target.wireframe : false;
      }
      m.needsUpdate = true;
    }
    for (const o of this.target.revealObjects ?? []) o.visible = t > 0;
    for (const o of this.target.hideObjects ?? []) o.visible = t < 1;
  }
}
