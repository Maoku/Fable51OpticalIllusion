import * as THREE from 'three';
import type { QualitySettings } from '../app/Quality';
import type { Museum } from '../museum/Museum';
import type { AABB } from '../player/Collision';
import type { PlayerController } from '../player/PlayerController';
import { NOOP_EFFECT, type HintEffect } from './HintEffect';

export type ExhibitRoom = 'classic' | 'fable';

export interface Viewpoint {
  /** 足元の位置 */
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
}

export interface ExhibitMeta {
  id: string;
  room: ExhibitRoom;
  /** 展示の中心(近接判定の基準) */
  position: THREE.Vector3;
  /** 展示の正面が向く yaw(0 = -z) */
  facing: number;
  triggerRadius: number;
  /** 近接判定の中心(省略時は position)。視点依存の展示は推奨視点の近くに置く */
  triggerCenter?: THREE.Vector3;
  /** 推奨視点。ワープ先および演出中の固定位置 */
  viewpoint?: Viewpoint;
}

export interface LoadContext {
  quality: QualitySettings;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  museum: Museum;
  player: PlayerController;
}

export interface Exhibit {
  readonly meta: ExhibitMeta;
  readonly object: THREE.Object3D;
  /** 演出は必須 */
  readonly hint: HintEffect;
  /** 展示が占有するワールド座標の AABB(プレイヤーの通行不可) */
  readonly colliders: readonly AABB[];
  load(ctx: LoadContext): Promise<void>;
  update(delta: number, camera: THREE.Camera): void;
  dispose(): void;
}

/** yaw の向きの前方ベクトル(0 = -z) */
export function forwardOf(yaw: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}

/** 展示の正面から `distance` 離れて展示を向く視点 */
export function viewpointInFront(
  position: THREE.Vector3,
  facing: number,
  distance: number,
  pitch = 0,
): Viewpoint {
  const p = forwardOf(facing).multiplyScalar(distance).add(position);
  p.y = 0;
  return { position: p, yaw: facing + Math.PI, pitch };
}

/**
 * 展示の基底クラス。ジオメトリ生成は `build()` に書く。
 * ローカル座標は「+z が正面(鑑賞者側)」。meta.facing の向きへ +z が向くように回転する。
 */
export abstract class BaseExhibit implements Exhibit {
  readonly object = new THREE.Group();
  readonly colliders: AABB[] = [];
  protected loaded = false;
  private _hint: HintEffect = NOOP_EFFECT;

  constructor(readonly meta: ExhibitMeta) {
    this.object.name = `exhibit:${meta.id}`;
    this.object.position.copy(meta.position);
    this.object.rotation.y = meta.facing + Math.PI;
  }

  /** ローカル座標の点をワールド座標へ(load 前でも使える) */
  protected toWorld(x: number, y: number, z: number): THREE.Vector3 {
    const th = this.meta.facing + Math.PI;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    return new THREE.Vector3(
      this.meta.position.x + x * cos + z * sin,
      this.meta.position.y + y,
      this.meta.position.z - x * sin + z * cos,
    );
  }

  /** 正面方向(ローカル +z)のワールド単位ベクトル */
  protected get frontDir(): THREE.Vector3 {
    return forwardOf(this.meta.facing);
  }

  get hint(): HintEffect {
    return this._hint;
  }

  protected setHint(effect: HintEffect): void {
    this._hint = effect;
  }

  async load(ctx: LoadContext): Promise<void> {
    if (this.loaded) return;
    this.build(ctx);
    this.object.updateMatrixWorld(true);
    this.loaded = true;
  }

  protected abstract build(ctx: LoadContext): void;

  update(_delta: number, _camera: THREE.Camera): void {}

  dispose(): void {
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.object.removeFromParent();
  }

  /**
   * 展示ローカル座標の箱をワールド座標の AABB として登録する。
   * facing による回転は 4 隅を回して包含する箱にする(保守的)。
   */
  protected addLocalCollider(
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
  ): void {
    const th = this.meta.facing + Math.PI;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    const corners = [
      [cx - sx / 2, cz - sz / 2],
      [cx + sx / 2, cz - sz / 2],
      [cx - sx / 2, cz + sz / 2],
      [cx + sx / 2, cz + sz / 2],
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [lx, lz] of corners) {
      const wx = this.meta.position.x + lx! * cos + lz! * sin;
      const wz = this.meta.position.z - lx! * sin + lz! * cos;
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz);
      maxZ = Math.max(maxZ, wz);
    }
    this.colliders.push({
      minX,
      maxX,
      minZ,
      maxZ,
      minY: this.meta.position.y + cy - sy / 2,
      maxY: this.meta.position.y + cy + sy / 2,
    });
  }
}
