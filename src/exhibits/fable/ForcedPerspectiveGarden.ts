import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import { createFigure } from '../../procedural/figure';
import { MeshBatch } from '../../procedural/merge';
import { makeCanvasTexture, mulberry32 } from '../../procedural/textures';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect } from '../HintEffect';
import { FogChange } from '../effects/FogChange';
import { LightChange } from '../effects/LightChange';
import { Reveal } from '../effects/Reveal';

const HAZE = new THREE.Color(0xd6dde3);

/** 遠くほど霞の色に寄せる(頂点色での疑似的な空気遠近。フォグと重ねて効かせる) */
function hazed(color: THREE.ColorRepresentation, distance01: number): THREE.Color {
  return new THREE.Color(color).lerp(HAZE, THREE.MathUtils.clamp(distance01, 0, 1) * 0.5);
}

/** 中庭の広さ(展示のローカル座標)。+z が回廊側、-z が窓の向こう */
const YARD = { halfWidth: 5.7, depth: 8, skyHeight: 7 };

/**
 * 水盤の配置。
 *
 * 水面は窓の腰(0.85 m)より少し低い 0.80 m に置く。こうすると腰壁が水際の
 * 手前を隠すので、台の立ち上がりが窓から見えない。水は窓のすぐ向こうから
 * 始まっているように見え、鑑賞者は水辺のテラスに立っていることになる。
 *
 * 推奨視点(窓から 1.3 m、目の高さ 1.6 m)からの俯角:
 *   手前の水際 atan(0.8 / 1.9) ≒ 22.8°、奥の水際 atan(0.8 / 8.85) ≒ 5.2°
 * 水面は垂直画角のうち約 18° を占める。
 */
const POND = {
  waterY: 0.8,
  /** 岸の天端。水面より 2 cm 高いだけなので、際は目立たない */
  bankTop: 0.82,
  /** 手前の水際。ここまでが石のテラス */
  nearZ: -0.6,
  /**
   * テラスの手前の端。回廊の壁の中(壁の内面は z = +0.15)に少し入れて、
   * 立ち上がりの面が回廊側から見えないようにする
   */
  terraceFrontZ: -0.05,
  /** 奥の水際 */
  farZ: -7.55,
  /** 水面の半幅。左右に 0.2 m だけ岸を残す */
  halfWidth: 5.5,
  /** 水底 */
  bottomY: 0.62,
  /**
   * 岸の底面の高さ。0 にすると回廊の床(窓の下は x が重なる)と同一平面になり、
   * 深度が競って床に縞が出るので、少し浮かせる
   */
  baseY: 0.03,
};

export interface WaterBand {
  /** 手前の水際が見える俯角(度) */
  nearDeg: number;
  /** 奥の水際の俯角(度) */
  farDeg: number;
  /** 水面が占める垂直方向の角度(度) */
  spanDeg: number;
}

/**
 * 推奨視点から水面が見える範囲を角度で返す。
 *
 * 窓の腰壁とテラスの天端が視線を遮るので、水面の手前側は少し隠れる。
 * 隠れきってしまうと「水庭が見えない」ことになるため、設計値を数値で守る。
 *
 * @param eye 目の位置(y = 高さ、z = 窓からの距離)
 * @param sillY 窓の腰の高さ
 */
export function waterViewBand(eye = { y: 1.6, z: 1.3 }, sillY = 0.85): WaterBand {
  const P = POND;
  const drop = eye.y - P.waterY;
  /** 高さ h の遮蔽物が距離 d にあるとき、その上を通る視線が水面に届く距離 */
  const clear = (d: number, h: number): number => {
    const slope = (eye.y - h) / d;
    return slope <= 0 ? 0 : drop / slope;
  };
  const nearest = Math.max(
    // 手前の水際そのもの
    eye.z - P.nearZ,
    // 窓の腰壁
    clear(eye.z, sillY),
    // テラスの天端(水際の位置にある)
    clear(eye.z - P.nearZ, P.bankTop),
  );
  const farthest = eye.z - P.farZ;
  const deg = (d: number) => (Math.atan(drop / d) * 180) / Math.PI;
  const nearDeg = deg(nearest);
  const farDeg = deg(farthest);
  return { nearDeg, farDeg, spanDeg: nearDeg - farDeg };
}

/**
 * F4 窓の外の庭。
 * 回廊の窓から広大な水庭が見えるが、実際は窓のすぐ向こうにある
 * 奥行き 8 m ほどの 1/20 スケールのジオラマ。
 * ローカル座標: +z が回廊側(鑑賞者)、-z が窓の向こう。
 */
export class ForcedPerspectiveGarden extends BaseExhibit {
  private post: LoadContext['post'] | null = null;
  private dofOn = false;
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  /** URL で被写界深度を強制する(A/B 比較用)。null なら自動 */
  private readonly dofOverride = readDofOverride();

  protected build(ctx: LoadContext): void {
    const mats = getMaterials();
    const rand = mulberry32(42);
    this.post = ctx.post;

    // 窓ガラスと桟。桟は 2 本にして、視界の中心を水面に空ける
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.9), mats.glass);
    glass.position.set(0, 1.8, 0.0);
    this.object.add(glass);
    for (const x of [-1.6, 1.6]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 0.06), mats.matteBlack);
      bar.position.set(x, 1.8, 0);
      this.object.add(bar);
    }

    // 外側の囲い: 回廊と両展示室に挟まれた中庭に収める
    const enclosure = new THREE.Group();
    enclosure.name = 'diorama';
    this.object.add(enclosure);
    // フォグはこの配下だけに効かせる
    this.fogScope = enclosure;
    const HALF_W = YARD.halfWidth;
    const DEPTH = YARD.depth;
    const SKY_H = YARD.skyHeight;
    // 書き割り(空と遠山)。奥と左右の 3 面に同じ絵を張り、天井は空の色で閉じる
    const backdropTex = makeCanvasTexture(
      (c, s) => {
        const g = c.createLinearGradient(0, 0, 0, s);
        g.addColorStop(0, '#b9cbdc');
        g.addColorStop(0.45, '#dfe6ec');
        g.addColorStop(0.62, '#e9e2d8');
        g.addColorStop(1, '#d6dde3');
        c.fillStyle = g;
        c.fillRect(0, 0, s, s);
        const r = mulberry32(3);
        const layers = [
          { y: 0.6, h: 0.16, color: 'rgba(150,168,186,0.55)' },
          { y: 0.66, h: 0.12, color: 'rgba(120,140,160,0.6)' },
          { y: 0.72, h: 0.09, color: 'rgba(96,116,136,0.7)' },
        ];
        for (const L of layers) {
          c.fillStyle = L.color;
          c.beginPath();
          c.moveTo(0, s);
          let x = 0;
          while (x <= s) {
            const y = s * (L.y - L.h * (0.4 + 0.6 * Math.abs(Math.sin((x / s) * 9 + r() * 2))));
            c.lineTo(x, y);
            x += s / 40;
          }
          c.lineTo(s, s);
          c.closePath();
          c.fill();
        }
        // 水面に溶ける霧
        const mist = c.createLinearGradient(0, s * 0.7, 0, s);
        mist.addColorStop(0, 'rgba(214,221,227,0)');
        mist.addColorStop(1, 'rgba(214,221,227,1)');
        c.fillStyle = mist;
        c.fillRect(0, s * 0.7, s, s * 0.3);
      },
      { size: 1024 },
    );
    // 書き割りは霞そのものを描いた絵なので、フォグは二重に掛けない
    const backdropMat = new THREE.MeshBasicMaterial({ map: backdropTex, toneMapped: false });
    backdropMat.userData.noFog = true;
    // 角で隙間が縦の筋になって見えるので、3 面を少しずつ重ねる
    const OVERLAP = 0.4;
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2 + OVERLAP * 2, SKY_H),
      backdropMat,
    );
    back.position.set(0, SKY_H / 2, -DEPTH);
    enclosure.add(back);
    for (const sideX of [-HALF_W, HALF_W]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH + OVERLAP, SKY_H), backdropMat);
      wall.rotation.y = sideX < 0 ? Math.PI / 2 : -Math.PI / 2;
      wall.position.set(sideX, SKY_H / 2, -DEPTH / 2 - OVERLAP / 2);
      enclosure.add(wall);
    }
    const skyMat = new THREE.MeshBasicMaterial({ color: 0xb9cbdc, toneMapped: false });
    skyMat.userData.noFog = true;
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, DEPTH), skyMat);
    sky.rotation.x = Math.PI / 2;
    sky.position.set(0, SKY_H, -DEPTH / 2);
    enclosure.add(sky);

    // 岸(石のテラス)と水底。中庭の床いっぱいに敷き、水盤をくり抜いた形にする。
    // 立ち上がりの面をどこからも見せないので、水が窓のすぐ向こうから始まって見える
    const P = POND;
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x7d7a74,
      map: mats.concrete.map,
      roughness: 0.95,
    });
    const bankH = P.bankTop - P.baseY;
    const bank = (w: number, d: number, x: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, bankH, d), stoneMat);
      mesh.position.set(x, P.baseY + bankH / 2, z);
      enclosure.add(mesh);
      return mesh;
    };
    // 手前(壁の中から水際まで)、奥、左右
    bank(HALF_W * 2, P.terraceFrontZ - P.nearZ, 0, (P.terraceFrontZ + P.nearZ) / 2);
    bank(HALF_W * 2, -DEPTH - P.farZ, 0, (P.farZ - DEPTH) / 2);
    const sideW = HALF_W - P.halfWidth;
    for (const side of [-1, 1]) {
      bank(sideW, P.nearZ - P.farZ, side * (P.halfWidth + sideW / 2), (P.nearZ + P.farZ) / 2);
    }
    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(P.halfWidth * 2, P.bottomY - P.baseY, P.nearZ - P.farZ),
      new THREE.MeshStandardMaterial({ color: 0x3f4a4e, roughness: 0.95 }),
    );
    bottom.position.set(0, P.baseY + (P.bottomY - P.baseY) / 2, (P.nearZ + P.farZ) / 2);
    enclosure.add(bottom);

    // 水面
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(P.halfWidth * 2, P.nearZ - P.farZ),
      new THREE.MeshPhysicalMaterial({
        color: 0x6f8a99,
        metalness: 0.7,
        roughness: 0.32,
        envMapIntensity: 1.2,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, P.waterY, (P.nearZ + P.farZ) / 2);
    enclosure.add(water);

    // 小物(木・石・東屋・灯籠)は頂点色で 1 メッシュにまとめる。
    // 中央は水面に譲り、手前の景物は左右へ寄せる
    const batch = new MeshBatch();
    const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const placeTree = (x: number, z: number, h: number, d: number) => {
      const rot = new THREE.Euler(0, rand() * Math.PI, 0);
      batch.add(
        new THREE.CylinderGeometry(h * 0.04, h * 0.06, h * 0.45, 8),
        hazed(0x5a4634, d),
        at(x, P.waterY + h * 0.225, z),
        rot,
      );
      batch.add(
        new THREE.ConeGeometry(h * 0.3, h * 0.7, 9),
        hazed(0x3f7a4a, d),
        at(x, P.waterY + h * 0.8, z),
        rot,
      );
    };
    // 手前は左右の小島だけにして、中央は水面に譲る。
    // 大きさの勾配(手前 0.4〜0.55 → 中景 0.2 → 奥 0.15)が遠近感を作る
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (3.1 + rand() * 1.6);
      const z = -1.4 - rand() * 1.3;
      batch.add(
        new THREE.CylinderGeometry(0.34, 0.28, 0.05, 16),
        hazed(0x6d6a63, 0.05),
        at(x, P.waterY + 0.02, z),
      );
      placeTree(x, z, 0.4 + rand() * 0.15, 0.05);
    }
    // 中景の小島
    const islandZ = -4.5;
    batch.add(
      new THREE.CylinderGeometry(0.5, 0.42, 0.06, 16),
      hazed(0x6d6a63, 0.4),
      at(-1.2, P.waterY + 0.03, islandZ),
    );
    placeTree(-1.2, islandZ, 0.25, 0.4);
    batch.add(
      new THREE.CylinderGeometry(0.3, 0.26, 0.05, 14),
      hazed(0x6d6a63, 0.45),
      at(1.9, P.waterY + 0.025, islandZ - 0.7),
    );
    placeTree(1.9, islandZ - 0.7, 0.18, 0.45);
    // 奥の岸の木立
    for (let i = 0; i < 14; i++) {
      const x = -4.6 + rand() * 9.2;
      const z = P.farZ - 0.1 - rand() * 0.4;
      placeTree(x, z, 0.12 + rand() * 0.06, 0.8);
    }
    // 石
    for (let i = 0; i < 16; i++) {
      const near = i % 2 === 0;
      const x = near ? (i % 4 === 0 ? -1 : 1) * (2.9 + rand() * 1.8) : -4.6 + rand() * 9.2;
      const z = near ? -1.3 - rand() * 1.5 : P.farZ - 0.05 - rand() * 0.3;
      const d = near ? 0.05 : 0.8;
      const r = (near ? 0.06 : 0.02) + rand() * (near ? 0.09 : 0.03);
      batch.add(
        new THREE.DodecahedronGeometry(r, 0),
        hazed(0x7e7a74, d),
        at(x, P.waterY + r * 0.4, z),
        new THREE.Euler(rand() * 3, rand() * 3, 0),
        new THREE.Vector3(1, 0.6, 1),
      );
    }
    // 東屋(奥、右)
    batch.add(
      new THREE.BoxGeometry(0.16, 0.1, 0.16),
      hazed(0x7e7a74, 0.75),
      at(2.6, P.bankTop + 0.05, P.farZ - 0.25),
    );
    batch.add(
      new THREE.ConeGeometry(0.15, 0.09, 4),
      hazed(0x5a4634, 0.75),
      at(2.6, P.bankTop + 0.145, P.farZ - 0.25),
      new THREE.Euler(0, Math.PI / 4, 0),
    );
    // 石灯籠(手前、左の小島)
    const stone = hazed(0x7e7a74, 0.05);
    batch.add(
      new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8),
      stone,
      at(-2.6, P.waterY + 0.11, -1.2),
    );
    batch.add(new THREE.BoxGeometry(0.1, 0.07, 0.1), stone, at(-2.6, P.waterY + 0.26, -1.2));
    batch.add(
      new THREE.ConeGeometry(0.09, 0.06, 4),
      stone,
      at(-2.6, P.waterY + 0.33, -1.2),
      new THREE.Euler(0, Math.PI / 4, 0),
    );
    const scenery = batch.build(new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    if (scenery) enclosure.add(scenery);

    // 霞。ジオラマの配下だけに効かせる(App が読み込み後に範囲を絞る)。
    // 推奨視点からジオラマは 1.9〜9.3 m にあるので、この範囲に勾配が乗る
    const fog = new THREE.Fog(HAZE.getHex(), 3.5, 13.5);
    ctx.scene.fog = fog;

    // 庭の光: 夕方の低い光と柔らかな補助光。方向光は館内全体に及ぶので使わない。
    // 狙いは庭の奥。手前の岸へ向けると光だまりが白飛びして、水面の手前が潰れる
    const sunTarget = new THREE.Object3D();
    sunTarget.position.set(0.5, P.waterY, -6.5);
    enclosure.add(sunTarget);
    const sun = new THREE.SpotLight(0xffe2c0, 46, 22, Math.PI / 5, 0.6, 1.2);
    sun.position.set(-4.2, 5.6, -9.5);
    sun.target = sunTarget;
    enclosure.add(sun);
    const hemi = new THREE.PointLight(0xdfe8f0, 5, 12, 1.6);
    hemi.position.set(0, 5, -5.5);
    enclosure.add(hemi);

    // 種明かし: 等身大の人型と 1 m の物差しを水の中に現し、霞を晴らして光を平坦な白にする
    const person = createFigure(1.7, 0xa65b5b);
    person.position.set(-1.5, P.waterY, -2.2);
    person.rotation.y = Math.PI * 0.15;
    enclosure.add(person);
    const ruler = new THREE.Group();
    const rod = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.0, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.5 }),
    );
    rod.position.y = 0.5;
    ruler.add(rod);
    // 目盛りは館内共通の黒ではなく専用のマテリアルにする(フォグの範囲を混ぜないため)
    const tickMat = new THREE.MeshStandardMaterial({ color: 0x1d1b18, roughness: 0.6 });
    for (let i = 0; i <= 10; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.045), tickMat);
      tick.position.set(0, i * 0.1, 0);
      ruler.add(tick);
    }
    ruler.position.set(1.6, P.waterY, -2.0);
    enclosure.add(ruler);
    this.setHint(
      new CompositeHintEffect(
        [
          new Reveal([person, ruler], { durationMs: 1200 }),
          new FogChange(fog, { near: 12, far: 40 }, { durationMs: 1200 }),
          new LightChange(
            [
              { light: sun, target: { color: 0xffffff, intensity: 22 } },
              { light: hemi, target: { color: 0xffffff, intensity: 11 } },
            ],
            { durationMs: 1200 },
          ),
        ],
        { durationMs: 1200 },
      ),
    );

    const caption = createCaptionFor(this.meta.id, { stand: false, tilt: 0, height: 0 });
    caption.position.set(3.7, 1.15, 0.02);
    this.object.add(caption);
  }

  /**
   * 窓の方を見ているあいだ被写界深度をかける。既定は無効。
   *
   * 実 GPU で A/B を取ったところ、霞(フォグ)が既に遠景を柔らかくしているため、
   * ぼかしても見た目がほとんど変わらなかった。強くすると今度はミニチュアの
   * 手がかりになり、「広大な庭」に見せたい狙いと逆に働く。
   * 毎フレームの追加パスに見合わないので、既定では入れず `?dof=1` のときだけ試せる形にした。
   */
  override update(_delta: number, camera: THREE.Camera): void {
    const post = this.post;
    if (!post) return;
    let want = false;
    if (this.dofOverride === true) {
      const p = camera.getWorldPosition(this.tmpPos);
      const l = this.toLocal(p.x, p.y, p.z);
      const nearWindow = l.z > 0 && l.z < 4 && Math.abs(l.x) < 4;
      if (nearWindow) {
        // 窓(ローカル -z)の方を向いているか
        camera.getWorldDirection(this.tmpDir);
        const inward = this.frontDir.multiplyScalar(-1);
        want = this.tmpDir.dot(inward) > 0.5;
      }
    }
    if (want === this.dofOn) return;
    this.dofOn = want;
    post.setDepthOfField(want ? { focus: 2.9, aperture: 0.00022, maxblur: 0.004 } : null);
  }

  override dispose(): void {
    if (this.dofOn) this.post?.setDepthOfField(null);
    this.dofOn = false;
    super.dispose();
  }
}

/** `?dof=1` で被写界深度を試す(A/B 比較用)。既定と `?dof=0` は無効 */
function readDofOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('dof');
  if (v === '0') return false;
  if (v === '1') return true;
  return null;
}
