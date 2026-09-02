import * as THREE from 'three';
import type { AABB } from '../player/Collision';
import { classicHallSpec, classicSpawn } from './layout/classicHall';
import { corridorSpec } from './layout/corridor';
import { fableGallerySpec } from './layout/fableGallery';
import type { RoomId, RoomSpec } from './layout/types';
import { getMaterials } from './materials';
import { Room } from './Room';
import { SkyLight } from './SkyLight';

/** 足元の高さを返す。範囲外なら null。y は現在の高さ(段が重なる構造で近い方を選ぶため) */
export type GroundPatch = (x: number, z: number, y: number) => number | null;

/** 部屋群と回廊を組み立てる。 */
export class Museum {
  readonly group = new THREE.Group();
  readonly rooms = new Map<RoomId, Room>();
  readonly colliders: AABB[] = [];
  readonly groundPatches: GroundPatch[] = [];
  readonly skyLights: SkyLight[] = [];
  readonly spawn = {
    position: new THREE.Vector3(classicSpawn.x, 0, classicSpawn.z),
    yaw: classicSpawn.yaw,
    pitch: 0,
  };

  constructor(specs: RoomSpec[] = [classicHallSpec, corridorSpec, fableGallerySpec]) {
    this.group.name = 'museum';
    const mats = getMaterials();
    for (const spec of specs) {
      const room = new Room(spec, mats);
      this.rooms.set(spec.id, room);
      this.group.add(room.group);
      this.colliders.push(...room.colliders);
      if (spec.skylight) {
        const sky = spec.skylight;
        const center = new THREE.Vector3((sky.minX + sky.maxX) / 2, 0, (sky.minZ + sky.maxZ) / 2);
        // 方向光は館内全体に届くので、影カメラも全館を覆う(範囲外は影が落ちず明るくなるため)
        const all = specs.reduce(
          (b, r) => ({
            minX: Math.min(b.minX, r.bounds.minX),
            maxX: Math.max(b.maxX, r.bounds.maxX),
            minZ: Math.min(b.minZ, r.bounds.minZ),
            maxZ: Math.max(b.maxZ, r.bounds.maxZ),
          }),
          { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
        );
        const extent = Math.max(all.maxX - all.minX, all.maxZ - all.minZ) / 2 + 2;
        const light = new SkyLight({
          center,
          extent,
          shadowCenter: new THREE.Vector3((all.minX + all.maxX) / 2, 0, (all.minZ + all.maxZ) / 2),
        });
        this.group.add(light.light, light.target);
        this.skyLights.push(light);
      }
    }

    const hemi = new THREE.HemisphereLight(0xffffff, 0xcbbba6, 0.7);
    hemi.name = 'hemisphere';
    this.group.add(hemi);
  }

  /** 足元の高さ(段差や傾いた床)。どのパッチにも入っていなければ 0 */
  groundAt(x: number, z: number, currentY = 0): number {
    for (const patch of this.groundPatches) {
      const y = patch(x, z, currentY);
      if (y !== null) return y;
    }
    return 0;
  }

  /** 座標がどの部屋にあるか */
  roomAt(x: number, z: number): Room | null {
    for (const room of this.rooms.values()) {
      if (room.contains(x, z)) return room;
    }
    return null;
  }

  addColliders(boxes: readonly AABB[]): void {
    this.colliders.push(...boxes);
  }
}
