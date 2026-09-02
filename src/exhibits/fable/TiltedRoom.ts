import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import { createFigure } from '../../procedural/figure';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect } from '../HintEffect';
import { MaterialSwap } from '../effects/MaterialSwap';
import { WireframeReveal } from '../effects/WireframeReveal';

export const TILT = {
  /** 部屋の傾き(ラジアン)。z 軸回りに回すので床は x 方向へ傾く */
  angle: THREE.MathUtils.degToRad(12),
  width: 4,
  depth: 4,
  height: 2.8,
  doorWidth: 1.4,
  doorHeight: 2.3,
  /** 入口前の傾斜をならす帯の長さ */
  ramp: 0.9,
  /** 球の軌道が部屋の床に対して持つ傾き(部屋の中では登り坂に見える) */
  trackAngle: THREE.MathUtils.degToRad(6),
};

/**
 * 傾いた床の高さ(部屋のローカル座標、+z が入口側)。
 * 部屋の内側なら x·tanθ、入口前の帯では 0 へなだらかに繋ぐ。範囲外は null。
 */
export function tiltedFloorHeight(x: number, z: number, t = TILT): number | null {
  const hw = t.width / 2;
  if (x < -hw || x > hw) return null;
  const slope = x * Math.tan(t.angle);
  if (z <= 0 && z >= -t.depth) return slope;
  if (z > 0 && z <= t.ramp) return slope * (1 - z / t.ramp);
  return null;
}

/**
 * F2 傾きの間。
 * 床も壁も 12° 傾いた小部屋。カメラは常に水平を保つので、中に入ると
 * 球が坂を「登り」、鉛直に立つ人形や下げ振りが傾いて見える。
 */
export class TiltedRoom extends BaseExhibit {
  private ball: THREE.Mesh | null = null;
  private ballT = 0;
  private trackStart = new THREE.Vector3();
  private trackEnd = new THREE.Vector3();

  protected build(_ctx: LoadContext): void {
    const T = TILT;
    const mats = getMaterials();
    const room = new THREE.Group();
    room.rotation.z = T.angle;
    room.name = 'tiltedRoom';
    this.object.add(room);

    const hw = T.width / 2;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf1ede6,
      map: mats.plaster.map,
      roughness: 0.95,
    });
    const floorMat = new THREE.MeshStandardMaterial({ map: mats.oakFloor.map, roughness: 0.6 });
    const walls: THREE.Mesh[] = [];
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      room.add(mesh);
      return mesh;
    };
    const t = 0.12;
    // 床・天井(部屋は z ∈ [-depth, 0])
    walls.push(box(T.width + 2 * t, t, T.depth + 2 * t, 0, -t / 2, -T.depth / 2, floorMat));
    walls.push(
      box(T.width + 2 * t, t, T.depth + 2 * t, 0, T.height + t / 2, -T.depth / 2, wallMat),
    );
    // 奥・左右の壁
    walls.push(box(T.width + 2 * t, T.height, t, 0, T.height / 2, -T.depth - t / 2, wallMat));
    walls.push(box(t, T.height, T.depth, -hw - t / 2, T.height / 2, -T.depth / 2, wallMat));
    walls.push(box(t, T.height, T.depth, hw + t / 2, T.height / 2, -T.depth / 2, wallMat));
    // 入口の壁(ドアの左右と上)
    const side = (T.width - T.doorWidth) / 2;
    walls.push(box(side, T.height, t, -hw + side / 2, T.height / 2, t / 2, wallMat));
    walls.push(box(side, T.height, t, hw - side / 2, T.height / 2, t / 2, wallMat));
    walls.push(
      box(
        T.doorWidth,
        T.height - T.doorHeight,
        t,
        0,
        T.doorHeight + (T.height - T.doorHeight) / 2,
        t / 2,
        wallMat,
      ),
    );
    // 壁に掛けた額(部屋に合わせて傾く)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.04), mats.matteBlack);
    frame.position.set(0, 1.6, -T.depth + 0.03);
    room.add(frame);
    const picture = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x8fa9c9, roughness: 0.9 }),
    );
    picture.position.set(0, 1.6, -T.depth + 0.055);
    room.add(picture);

    // 球の軌道: 部屋の床に対して +x 方向へ 6° 下がる(世界では 12° − 6° = 6° の下り坂を -x へ転がる)
    const trackLen = 2.6;
    const track = new THREE.Group();
    track.position.set(0, 0.85, -2.4);
    track.rotation.z = -T.trackAngle;
    room.add(track);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x2a2724,
      roughness: 0.5,
      metalness: 0.4,
    });
    for (const dz of [-0.06, 0.06]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, trackLen, 10), railMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 0, dz);
      track.add(rail);
    }
    for (const dx of [-trackLen / 2 + 0.1, trackLen / 2 - 0.1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.16), railMat);
      leg.position.set(dx, -0.43, 0);
      track.add(leg);
    }
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 32, 16),
      new THREE.MeshStandardMaterial({ color: 0xc23b22, roughness: 0.35, metalness: 0.1 }),
    );
    ball.castShadow = true;
    track.add(ball);
    this.ball = ball;
    this.trackStart.set(trackLen / 2 - 0.15, 0.085, 0);
    this.trackEnd.set(-trackLen / 2 + 0.15, 0.085, 0);

    // 鉛直に立つ人形と下げ振り(部屋の傾きを打ち消して世界の鉛直に合わせる)
    const figure = createFigure(1.5, 0x5b7fa6);
    const figX = -1.3;
    figure.position.set(figX, 0, -3.2);
    figure.rotation.z = -T.angle;
    room.add(figure);
    const plumb = new THREE.Group();
    plumb.position.set(1.3, T.height - 0.05, -3.2);
    plumb.rotation.z = -T.angle;
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 1.9, 6),
      mats.matteBlack,
    );
    string.position.y = -0.95;
    const bob = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 16), railMat);
    bob.position.y = -1.95;
    bob.rotation.x = Math.PI;
    plumb.add(string, bob);
    room.add(plumb);

    // 通行止め: 左右の壁は傾きを考慮して内側に寄せる
    const lean = T.height * Math.sin(T.angle);
    this.addLocalCollider(hw - lean / 2, 1.5, -T.depth / 2, lean + 0.3, 3, T.depth);
    this.addLocalCollider(-hw - 0.15, 1.5, -T.depth / 2, 0.3, 3, T.depth);
    this.addLocalCollider(0, 1.5, -T.depth - 0.1, T.width + 0.6, 3, 0.3);
    this.addLocalCollider(-hw + side / 2, 1.5, 0, side, 3, 0.3);
    this.addLocalCollider(hw - side / 2, 1.5, 0, side, 3, 0.3);
    this.addLocalCollider(0, 0.45, -2.4, trackLen, 0.9, 0.35);
    this.addLocalCollider(figX * Math.cos(T.angle), 0.75, -3.2, 0.5, 1.5, 0.5);

    // 足元の高さ
    this.groundPatch = (wx, wz) => {
      const th = this.meta.facing + Math.PI;
      const dx = wx - this.meta.position.x;
      const dz = wz - this.meta.position.z;
      // ワールド → ローカル(toWorld の逆回転)
      const lx = dx * Math.cos(th) - dz * Math.sin(th);
      const lz = dx * Math.sin(th) + dz * Math.cos(th);
      return tiltedFloorHeight(lx, lz);
    };

    // 部屋の中の照明
    const lamp = new THREE.PointLight(0xfff1dc, 6, 7, 2);
    lamp.position.set(0, T.height - 0.3, -T.depth / 2);
    room.add(lamp);

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(hw + 0.5, 0, 0.6);
    this.object.add(caption);

    // 種明かし: 真の水平線と重力の向きを表示し、壁を半透明にして外の水平な部屋を見せる
    const lineMat = () =>
      new THREE.LineBasicMaterial({
        color: 0x2ecc71,
        transparent: true,
        opacity: 0,
        depthTest: false,
      });
    const horizon = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-2.6, 1.4, -3.4),
        new THREE.Vector3(2.6, 1.4, -3.4),
      ]),
      lineMat(),
    );
    const gravity = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.6, 2.6, -3.4),
        new THREE.Vector3(0.6, 0.15, -3.4),
        new THREE.Vector3(0.48, 0.45, -3.4),
        new THREE.Vector3(0.6, 0.15, -3.4),
        new THREE.Vector3(0.72, 0.45, -3.4),
      ]),
      new THREE.LineBasicMaterial({
        color: 0xff7a1a,
        transparent: true,
        opacity: 0,
        depthTest: false,
      }),
    );
    horizon.renderOrder = gravity.renderOrder = 11;
    // 世界の水平・鉛直で描く(傾いた部屋の子にしない)
    this.object.add(horizon, gravity);
    const wire = new WireframeReveal([], { durationMs: 1200 });
    wire.addLine(horizon).addLine(gravity);
    this.setHint(
      new CompositeHintEffect(
        [wire, new MaterialSwap(walls, { opacity: 0.3 }, { durationMs: 1200 })],
        {
          durationMs: 1200,
        },
      ),
    );
  }

  override update(delta: number): void {
    if (!this.ball) return;
    // 5 秒で転がり、1 秒止まって戻る
    const cycle = 6.5;
    this.ballT = (this.ballT + delta) % cycle;
    const roll = Math.min(1, this.ballT / 5);
    const eased = roll * roll; // 加速しながら転がる
    this.ball.position.lerpVectors(this.trackStart, this.trackEnd, eased);
    this.ball.rotation.z = eased * 12;
    const mat = this.ball.material as THREE.MeshStandardMaterial;
    const fade =
      this.ballT > 5.2
        ? 1 - Math.min(1, (this.ballT - 5.2) / 0.5)
        : this.ballT < 0.4
          ? this.ballT / 0.4
          : 1;
    mat.transparent = fade < 1;
    mat.opacity = fade;
  }
}
