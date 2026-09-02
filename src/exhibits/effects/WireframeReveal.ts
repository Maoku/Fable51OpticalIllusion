import * as THREE from 'three';
import type { HintEffect } from '../HintEffect';

export interface WireframeRevealOptions {
  color?: THREE.ColorRepresentation;
  /** EdgesGeometry のしきい値角度(度) */
  thresholdAngle?: number;
  /** 壁越しにも線を見せる */
  throughWalls?: boolean;
  durationMs?: number;
  lockViewpoint?: boolean;
}

/**
 * 実形状のワイヤーフレームをフェードインで重ねる。
 * 追加のガイド線(等長の目盛りなど)は addLine() で登録するとまとめて制御される。
 */
export class WireframeReveal implements HintEffect {
  readonly durationMs: number;
  readonly lockViewpoint: boolean;
  private readonly lines: THREE.LineSegments[] = [];
  private readonly extra: (THREE.Line | THREE.Sprite | THREE.Mesh)[] = [];

  constructor(meshes: THREE.Mesh[], opts: WireframeRevealOptions = {}) {
    this.durationMs = opts.durationMs ?? 900;
    this.lockViewpoint = opts.lockViewpoint ?? false;
    const color = opts.color ?? 0x2a9df4;
    for (const mesh of meshes) {
      const edges = new THREE.EdgesGeometry(mesh.geometry, opts.thresholdAngle ?? 12);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthTest: !(opts.throughWalls ?? true),
        depthWrite: false,
      });
      const line = new THREE.LineSegments(edges, mat);
      line.renderOrder = 10;
      line.visible = false;
      line.name = 'wireframe';
      mesh.add(line);
      this.lines.push(line);
    }
  }

  /** 演出と一緒にフェードインさせる追加オブジェクト(材質は transparent であること) */
  addLine(obj: THREE.Line | THREE.Sprite | THREE.Mesh): this {
    obj.visible = false;
    this.extra.push(obj);
    return this;
  }

  apply(t: number): void {
    for (const line of this.lines) {
      line.visible = t > 0;
      (line.material as THREE.LineBasicMaterial).opacity = t;
    }
    for (const obj of this.extra) {
      obj.visible = t > 0;
      const m = obj.material as THREE.Material;
      m.opacity = t;
    }
  }
}
