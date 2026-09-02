import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { createPedestal } from '../../museum/Pedestal';
import { createBarGeometry } from '../../procedural/bar';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CameraOrbit } from '../effects/CameraOrbit';
import { computePenroseLayout, miterNormal } from './penroseGeometry';

export const PENROSE = { L: 0.9, w: 0.13, eyeDistance: 5.5, axisHeight: 1.15, pedestalHeight: 0.9 };

/**
 * C2 ペンローズの三角形。
 * 3 本の角柱を空間的にずらして配置し、推奨視点からだけ閉じた三角形に見せる。
 */
export class PenroseTriangle extends BaseExhibit {
  /** 三角形の見かけの重心(ワールド座標)。視点の向きと演出の中心に使う */
  centroidWorld = new THREE.Vector3();

  protected build(ctx: LoadContext): void {
    const { L, w, eyeDistance, axisHeight, pedestalHeight } = PENROSE;
    const ped = createPedestal({ width: 0.9, depth: 0.9, height: pedestalHeight });
    this.object.add(ped.mesh);
    this.addLocalCollider(ped.box.cx, ped.box.cy, ped.box.cz, ped.box.sx, ped.box.sy, ped.box.sz);

    const eyeLocal = new THREE.Vector3(0, 1.6, eyeDistance);
    const anchor = new THREE.Vector3(0, axisHeight, 0);
    const layout = computePenroseLayout(L, eyeLocal.distanceTo(anchor));
    const [A, B, C, D] = layout.points;
    const [e1, e2, e3] = layout.dirs;

    const n12 = miterNormal(e1, e2);
    const n23 = miterNormal(e2, e3);
    const n31 = miterNormal(e3, e1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf2efe9,
      roughness: 0.45,
      flatShading: true,
    });
    const bars = [
      createBarGeometry(
        { point: A, width: w, cutNormal: n31 },
        { point: B, width: w, cutNormal: n12 },
        e2,
        e3,
      ),
      createBarGeometry(
        { point: B, width: w, cutNormal: n12 },
        { point: C, width: w, cutNormal: n23 },
        e3,
        e1,
      ),
      createBarGeometry(
        { point: C, width: w, cutNormal: n23 },
        { point: D, width: w * layout.taper, cutNormal: n31 },
        e1,
        e2,
      ),
    ];
    const sculpture = new THREE.Group();
    for (const g of bars) {
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      sculpture.add(m);
    }
    // 視軸(+z)を A から視点へ向ける
    const toEye = eyeLocal.clone().sub(anchor).normalize();
    sculpture.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toEye);
    sculpture.position.copy(anchor);
    this.object.add(sculpture);

    // 支柱(台座から下の角柱まで)
    const mid = A.clone()
      .add(B)
      .multiplyScalar(0.5)
      .applyQuaternion(sculpture.quaternion)
      .add(anchor);
    const postH = mid.y - w / 2 - pedestalHeight;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, postH, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.6 }),
    );
    post.position.set(mid.x, pedestalHeight + postH / 2, mid.z);
    this.object.add(post);

    const cLocal = layout.centroid.clone().applyQuaternion(sculpture.quaternion).add(anchor);
    this.centroidWorld = this.toWorld(cLocal.x, cLocal.y, cLocal.z);

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(0.85, 0, 0.6);
    this.object.add(caption);

    this.setHint(
      new CameraOrbit(ctx.player, {
        target: this.centroidWorld.clone(),
        sweep: 1.0,
        lift: 0.4,
        radiusScale: 0.55,
        durationMs: 2600,
      }),
    );
  }

  /** 推奨視点: 視軸上に立ち、三角形の重心を見る */
  static viewpointFor(meta: { position: THREE.Vector3; facing: number }): {
    position: THREE.Vector3;
    yaw: number;
    pitch: number;
  } {
    const th = meta.facing + Math.PI;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    const lz = PENROSE.eyeDistance;
    const position = new THREE.Vector3(meta.position.x + lz * sin, 0, meta.position.z + lz * cos);
    // 重心はおおむね視軸の右上。build 後に正確な向きを設定し直す
    return { position, yaw: meta.facing + Math.PI, pitch: 0.06 };
  }

  override async load(ctx: LoadContext): Promise<void> {
    await super.load(ctx);
    const vp = this.meta.viewpoint;
    if (vp) {
      const eye = vp.position.clone().setY(1.6);
      const d = this.centroidWorld.clone().sub(eye);
      vp.yaw = Math.atan2(-d.x, -d.z);
      vp.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    }
  }
}
