import * as THREE from 'three';
import type { AABB } from '../player/Collision';
import { classicHallSpec, classicSpawn } from './layout/classicHall';
import { corridorSpec } from './layout/corridor';
import { fableGallerySpec } from './layout/fableGallery';
import type { RoomId, RoomSpec } from './layout/types';
import { getMaterials } from './materials';
import { Room } from './Room';

/** 部屋群と回廊を組み立てる。 */
export class Museum {
  readonly group = new THREE.Group();
  readonly rooms = new Map<RoomId, Room>();
  readonly colliders: AABB[] = [];
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
    }

    const hemi = new THREE.HemisphereLight(0xffffff, 0xcbbba6, 0.7);
    hemi.name = 'hemisphere';
    this.group.add(hemi);
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
