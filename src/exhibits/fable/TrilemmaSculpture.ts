import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import { TRILEMMA_SPEC, buildSilhouetteField, type Sdf2 } from '../../procedural/silhouetteSolid';
import { makeCanvasTexture } from '../../procedural/textures';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CameraPath } from '../effects/CameraPath';

/** 場からマーチングキューブで表面メッシュを作る */
export function createSilhouetteGeometry(resolution: number): THREE.BufferGeometry {
  const f = buildSilhouetteField(TRILEMMA_SPEC, resolution);
  const mc = new MarchingCubes(resolution, new THREE.MeshBasicMaterial(), false, false, 200000);
  mc.isolation = 0;
  // 場の値は [-1, 1] 程度なので、勾配が安定するよう拡大する
  for (let i = 0; i < f.field.length; i++) mc.field[i] = f.field[i]! * 40;
  mc.update();
  const count = mc.count;
  const positions = new Float32Array(mc.positionArray.subarray(0, count * 3));
  const normals = new Float32Array(mc.normalArray.subarray(0, count * 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  mc.geometry.dispose();
  return geo;
}

function silhouetteTexture(s: Sdf2, flipV = false): THREE.CanvasTexture {
  return makeCanvasTexture(
    (ctx, size) => {
      ctx.clearRect(0, 0, size, size);
      const img = ctx.createImageData(size, size);
      for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
          const u = ((px + 0.5) / size) * 2 - 1;
          let v = 1 - ((py + 0.5) / size) * 2;
          if (flipV) v = -v;
          const d = s(u, v);
          // 影の縁を少し柔らかく
          const a = THREE.MathUtils.clamp(d / 0.03 + 0.5, 0, 1) * 0.82;
          const i = (py * size + px) * 4;
          img.data[i] = 40;
          img.data[i + 1] = 38;
          img.data[i + 2] = 36;
          img.data[i + 3] = Math.round(a * 255);
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    { size: 512 },
  );
}

/**
 * F1 三面の彫刻。
 * 正面からは円、側面からは正方形、真上からは三角に見える白い立体。
 * 3 面の壁と床に落ちる影(焼き込み)がそれぞれの形を示す。
 */
export class TrilemmaSculpture extends BaseExhibit {
  protected build(ctx: LoadContext): void {
    const mats = getMaterials();
    const size = 0.95; // 立体の一辺(m)
    const center = new THREE.Vector3(0, 1.45, 0);

    // 白い台(床)と 2 枚のパネル
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 2.6), mats.matteWhite);
    base.position.set(0, 0.03, 0);
    base.receiveShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.9, 0.06), mats.matteWhite);
    back.position.set(0, 1.45, -1.3);
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 2.6), mats.matteWhite);
    side.position.set(-1.3, 1.45, 0);
    this.object.add(base, back, side);
    this.addLocalCollider(0, 1.45, 0, 2.6, 2.9, 2.6);

    // 影(焼き込み): 奥に円、横に正方形、床に三角
    const decal = (tex: THREE.Texture) =>
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
    const s = size * 1.02;
    const circle = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      decal(silhouetteTexture(TRILEMMA_SPEC.front)),
    );
    circle.position.set(center.x, center.y, -1.3 + 0.035);
    const square = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      decal(silhouetteTexture(TRILEMMA_SPEC.side)),
    );
    square.rotation.y = Math.PI / 2;
    square.position.set(-1.3 + 0.035, center.y, center.z);
    const tri = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      decal(silhouetteTexture(TRILEMMA_SPEC.top, true)),
    );
    tri.rotation.x = -Math.PI / 2;
    tri.position.set(center.x, 0.065, center.z);
    this.object.add(circle, square, tri);

    // 立体(マーチングキューブ)。ティアで解像度を変える
    const res = ctx.quality.tier === 'low' ? 40 : ctx.quality.tier === 'mid' ? 56 : 72;
    const geo = createSilhouetteGeometry(res);
    const solid = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.55, metalness: 0 }),
    );
    solid.scale.setScalar(size / 2);
    solid.position.copy(center);
    solid.castShadow = true;
    this.object.add(solid);

    // 吊り線
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 6 - center.y - size / 2, 6),
      mats.matteBlack,
    );
    wire.position.set(center.x, center.y + size / 2 + (6 - center.y - size / 2) / 2, center.z);
    this.object.add(wire);

    // 3 灯の硬いスポット(正面・横・上)。影は焼き込みなので落とさない
    const spot = (x: number, y: number, z: number, intensity: number) => {
      const l = new THREE.SpotLight(0xfff3e4, intensity, 9, Math.PI / 9, 0.4, 1.6);
      l.position.set(x, y, z);
      l.target = solid;
      this.object.add(l);
    };
    spot(0.4, 2.2, 3.2, 40);
    spot(3.0, 2.0, 0.6, 30);
    spot(0.3, 5.5, 0.3, 30);

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(1.7, 0, 0.9);
    this.object.add(caption);

    const target = this.toWorld(center.x, center.y, center.z);
    this.setHint(
      new CameraPath(ctx.player, {
        target,
        waypoints: [
          this.toWorld(2.6, 1.7, 1.2),
          this.toWorld(3.4, 1.55, 0.0), // 横から: 正方形
          this.toWorld(1.8, 3.6, 1.4),
          this.toWorld(0.05, 4.7, 0.25), // 真上から: 三角形
        ],
        durationMs: 4200,
      }),
    );
  }
}
