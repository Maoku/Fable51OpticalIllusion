import * as THREE from 'three';
import { aabbFromCenter, type AABB } from '../player/Collision';
import type { MuseumMaterials } from './materials';
import type { Opening, RoomSpec, Side } from './layout/types';

interface WallRect {
  /** 壁に沿った座標の範囲 */
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

/** 開口を除いた壁の矩形を列挙する */
export function wallRects(
  start: number,
  end: number,
  height: number,
  openings: readonly Opening[],
): WallRect[] {
  const rects: WallRect[] = [];
  const sorted = [...openings].sort((a, b) => a.center - b.center);
  let cursor = start;
  for (const o of sorted) {
    const left = o.center - o.width / 2;
    const right = o.center + o.width / 2;
    const bottom = o.bottom ?? 0;
    const top = Math.min(height, bottom + o.height);
    if (left > cursor) rects.push({ u0: cursor, u1: left, y0: 0, y1: height });
    if (bottom > 0) rects.push({ u0: left, u1: right, y0: 0, y1: bottom });
    if (top < height) rects.push({ u0: left, u1: right, y0: top, y1: height });
    cursor = Math.max(cursor, right);
  }
  if (cursor < end) rects.push({ u0: cursor, u1: end, y0: 0, y1: height });
  return rects;
}

/** 床・壁・天井・開口・照明を生成する部屋。 */
export class Room {
  readonly group = new THREE.Group();
  readonly colliders: AABB[] = [];
  readonly lights: THREE.PointLight[] = [];
  readonly thickness: number;

  constructor(
    readonly spec: RoomSpec,
    private readonly mats: MuseumMaterials,
  ) {
    this.thickness = spec.wallThickness ?? 0.3;
    this.group.name = `room:${spec.id}`;
    this.buildFloor();
    this.buildCeiling();
    for (const side of ['north', 'south', 'east', 'west'] as const) {
      if (spec.openSides?.includes(side)) continue;
      this.buildWall(side);
    }
    this.buildLights();
  }

  get bounds() {
    return this.spec.bounds;
  }

  contains(x: number, z: number): boolean {
    const b = this.spec.bounds;
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  }

  private floorBounds() {
    const b = this.spec.bounds;
    const h = this.thickness / 2;
    return {
      minX: this.spec.floor?.minX ?? b.minX - h,
      maxX: this.spec.floor?.maxX ?? b.maxX + h,
      minZ: this.spec.floor?.minZ ?? b.minZ - h,
      maxZ: this.spec.floor?.maxZ ?? b.maxZ + h,
    };
  }

  private buildFloor(): void {
    const f = this.floorBounds();
    const w = f.maxX - f.minX;
    const d = f.maxZ - f.minZ;
    const geo = new THREE.PlaneGeometry(w, d);
    // 床板テクスチャは 2 m で 1 タイル
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * (w / 2), uv.getY(i) * (d / 2));
    }
    const mesh = new THREE.Mesh(geo, this.mats.oakFloor);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((f.minX + f.maxX) / 2, 0, (f.minZ + f.maxZ) / 2);
    mesh.receiveShadow = true;
    mesh.name = 'floor';
    this.group.add(mesh);
  }

  private buildCeiling(): void {
    const f = this.floorBounds();
    const h = this.spec.height;
    const sky = this.spec.skylight;
    const slab = (minX: number, maxX: number, minZ: number, maxZ: number) => {
      if (maxX - minX <= 0 || maxZ - minZ <= 0) return;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(maxX - minX, 0.2, maxZ - minZ),
        this.mats.ceiling,
      );
      mesh.position.set((minX + maxX) / 2, h + 0.1, (minZ + maxZ) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'ceiling';
      this.group.add(mesh);
    };
    if (!sky) {
      slab(f.minX, f.maxX, f.minZ, f.maxZ);
      return;
    }
    // 天窓の周りを 4 枚に分けて張る
    slab(f.minX, f.maxX, f.minZ, sky.minZ);
    slab(f.minX, f.maxX, sky.maxZ, f.maxZ);
    slab(f.minX, sky.minX, sky.minZ, sky.maxZ);
    slab(sky.maxX, f.maxX, sky.minZ, sky.maxZ);
    // 光井戸
    const t = 0.2;
    const wells: [number, number, number, number][] = [
      [sky.minX - t, sky.minX, sky.minZ - t, sky.maxZ + t],
      [sky.maxX, sky.maxX + t, sky.minZ - t, sky.maxZ + t],
      [sky.minX, sky.maxX, sky.minZ - t, sky.minZ],
      [sky.minX, sky.maxX, sky.maxZ, sky.maxZ + t],
    ];
    for (const [x0, x1, z0, z1] of wells) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0, sky.depth, z1 - z0),
        this.mats.ceiling,
      );
      mesh.position.set((x0 + x1) / 2, h + sky.depth / 2, (z0 + z1) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'skylightWell';
      this.group.add(mesh);
    }
    // 空(発光面)。Bloom がわずかに滲む
    const skyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sky.maxX - sky.minX + 2 * t, sky.maxZ - sky.minZ + 2 * t),
      this.mats.sky,
    );
    skyMesh.rotation.x = Math.PI / 2;
    skyMesh.position.set(
      (sky.minX + sky.maxX) / 2,
      h + sky.depth + 0.05,
      (sky.minZ + sky.maxZ) / 2,
    );
    skyMesh.name = 'sky';
    this.group.add(skyMesh);
  }

  private buildWall(side: Side): void {
    const b = this.spec.bounds;
    const t = this.thickness;
    const h = this.spec.height;
    const alongX = side === 'north' || side === 'south';
    const start = (alongX ? b.minX : b.minZ) - t / 2;
    const end = (alongX ? b.maxX : b.maxZ) + t / 2;
    const openings = this.spec.openings.filter((o) => o.side === side);
    const fixed =
      side === 'north' ? b.minZ : side === 'south' ? b.maxZ : side === 'east' ? b.maxX : b.minX;

    for (const r of wallRects(start, end, h, openings)) {
      const len = r.u1 - r.u0;
      const hgt = r.y1 - r.y0;
      const mid = (r.u0 + r.u1) / 2;
      const cy = (r.y0 + r.y1) / 2;
      const geo = alongX ? new THREE.BoxGeometry(len, hgt, t) : new THREE.BoxGeometry(t, hgt, len);
      const wallMat = this.spec.wall === 'concrete' ? this.mats.concrete : this.mats.plaster;
      const mesh = new THREE.Mesh(geo, wallMat);
      const cx = alongX ? mid : fixed;
      const cz = alongX ? fixed : mid;
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `wall:${side}`;
      this.group.add(mesh);
      this.colliders.push(
        alongX ? aabbFromCenter(cx, cy, cz, len, hgt, t) : aabbFromCenter(cx, cy, cz, t, hgt, len),
      );
    }

    // ガラス窓は通り抜け不可
    for (const o of openings) {
      if (!o.glazed) continue;
      const bottom = o.bottom ?? 0;
      const cy = bottom + o.height / 2;
      const cx = alongX ? o.center : fixed;
      const cz = alongX ? fixed : o.center;
      this.colliders.push(
        alongX
          ? aabbFromCenter(cx, cy, cz, o.width, o.height, t)
          : aabbFromCenter(cx, cy, cz, t, o.height, o.width),
      );
    }
  }

  private buildLights(): void {
    for (const l of this.spec.lights) {
      const light = new THREE.PointLight(l.color ?? 0xfff4e6, l.intensity ?? 18, 18, 2);
      light.userData.cullRange = 26;
      light.position.set(l.x, this.spec.height - (l.drop ?? 0.3), l.z);
      light.name = 'roomLight';
      this.group.add(light);
      this.lights.push(light);
    }
  }
}
