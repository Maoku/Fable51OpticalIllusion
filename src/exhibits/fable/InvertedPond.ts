import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect, type HintEffect } from '../HintEffect';
import { LightChange } from '../effects/LightChange';
import { MaterialSwap } from '../effects/MaterialSwap';
import { WaterSurface } from './WaterSurface';

/**
 * 水盤の寸法。
 *
 * 彫刻(水面から 0.9 m)の反射が水面に収まる必要がある。目の高さ 1.6 m、
 * 水面 1.0 m、正面 2.1 m から見ると、頂部の反射は水盤の中心から 1.24 m の
 * ところに落ちる。内法の半分(1.45 m)がそれより大きいので、塔が丸ごと映る。
 */
export const POND = { outer: 3.3, inner: 2.9, rimHeight: 1.05, waterY: 1.0, basinFloor: 0.06 };

/** 反射を描く距離の上限。これより遠ければ更新しない */
const REFLECT_RANGE = 12;

/** 鏡の中に映るときの色(石の彫刻に見せる) */
const GHOST_IN_MIRROR = new THREE.Color(0xdfe4ea);
/** 種明かしで主画面に現すときの色(本物と見分けるため青く) */
const GHOST_REVEALED = new THREE.Color(0x7fc0e0);

/**
 * F7 逆さの水面。
 * 静かな水盤に映る彫刻の「反射」が本物と違う形をしている。
 *
 * mid 以上では本物の平面反射を描き、反射の描画中だけ彫刻を差し替える。
 * 水の上には立方体を積んだ彫刻が立っているのに、水面には球を積んだ彫刻が映る。
 * low ティアでは反射を描かず、半透明の板の下に逆さの彫刻を吊るす旧来の方式にする。
 */
export class InvertedPond extends BaseExhibit {
  private water: WaterSurface | null = null;
  private hintT = 0;
  private ghost: THREE.Group | null = null;
  private ghostMaterial: THREE.MeshStandardMaterial | null = null;
  private readonly bounds = new THREE.Sphere();
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  private readonly cameraPos = new THREE.Vector3();

  protected build(ctx: LoadContext): void {
    const mats = getMaterials();
    const P = POND;
    const reflective = ctx.quality.tier !== 'low';
    const stone = new THREE.MeshStandardMaterial({
      color: 0x8d8a85,
      map: mats.concrete.map,
      roughness: 0.9,
    });

    // 水盤(縁と内側)
    const rimShape = new THREE.Shape();
    const ho = P.outer / 2;
    const hi = P.inner / 2;
    rimShape.moveTo(-ho, -ho);
    rimShape.lineTo(ho, -ho);
    rimShape.lineTo(ho, ho);
    rimShape.lineTo(-ho, ho);
    rimShape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-hi, -hi);
    hole.lineTo(-hi, hi);
    hole.lineTo(hi, hi);
    hole.lineTo(hi, -hi);
    hole.closePath();
    rimShape.holes.push(hole);
    const rim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(rimShape, { depth: P.rimHeight, bevelEnabled: false }),
      stone,
    );
    rim.rotation.x = -Math.PI / 2;
    rim.castShadow = true;
    rim.receiveShadow = true;
    this.object.add(rim);
    const basinMat = new THREE.MeshStandardMaterial({
      color: 0x2b3238,
      roughness: 0.7,
      side: THREE.BackSide,
    });
    const basin = new THREE.Mesh(
      new THREE.BoxGeometry(P.inner, P.rimHeight - P.basinFloor, P.inner),
      basinMat,
    );
    basin.position.y = (P.rimHeight + P.basinFloor) / 2;
    this.object.add(basin);
    this.addLocalCollider(0, P.rimHeight / 2, 0, P.outer, P.rimHeight, P.outer);

    // 中央の島: 水面に浮かぶ薄い円盤と、それを支える細い柱
    const island = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.08, 32), stone);
    island.position.y = P.waterY + 0.04;
    this.object.add(island);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, P.waterY, 12), stone);
    post.position.y = P.waterY / 2;
    this.object.add(post);

    // 本物の彫刻(水面の上): 積み重ねた立方体
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.5 });
    const upright = new THREE.Group();
    for (const [i, size] of [0.34, 0.26, 0.18].entries()) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), white);
      cube.position.y = [0.17, 0.34 + 0.13, 0.6 + 0.09][i]!;
      cube.rotation.y = i * 0.5;
      cube.castShadow = true;
      upright.add(cube);
    }
    upright.position.y = P.waterY + 0.08;
    this.object.add(upright);

    // 鏡の中にだけある彫刻: 積み重ねた球。本物と同じ場所に立てる。
    // 反射は鏡像なので、水面には上下が逆になった球の塔が映る
    const ghostMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfe4ea,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 1,
    });
    const ghost = new THREE.Group();
    for (const [i, r] of [0.19, 0.14, 0.1].entries()) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), ghostMaterial);
      sphere.position.y = [0.19, 0.38 + 0.14, 0.66 + 0.1][i]!;
      ghost.add(sphere);
    }
    this.ghost = ghost;
    this.ghostMaterial = ghostMaterial;

    if (reflective) {
      ghost.position.y = P.waterY + 0.08;
      ghost.visible = false;
      this.object.add(ghost);

      const water = new WaterSurface(new THREE.PlaneGeometry(P.inner, P.inner), {
        resolution: ctx.quality.tier === 'high' ? 512 : 256,
        color: 0x35464f,
        distortion: 0.012,
        waveScale: 2.0,
        fresnelBase: 0.8,
        onBeforeReflect: () => {
          upright.visible = false;
          ghost.visible = true;
          ghostMaterial.opacity = 1;
          ghostMaterial.depthWrite = true;
          // 鏡の中では普通の石の彫刻に見えるよう白のまま
          ghostMaterial.color.copy(GHOST_IN_MIRROR);
          // 反射カメラは水面の下(水盤の中)に置かれるので、水面より上へ 5 cm だけ
          // 出ている内壁がすぐ目の前に来て視界を覆ってしまう。鏡の中では消す
          basin.visible = false;
        },
        onAfterReflect: () => {
          upright.visible = true;
          basin.visible = true;
          this.applyGhostVisibility();
        },
      });
      water.rotation.x = -Math.PI / 2;
      water.position.y = P.waterY;
      this.object.add(water);
      this.water = water;
      this.bounds.set(this.toWorld(0, P.waterY, 0), P.outer);
    } else {
      // low ティア: 反射を描かず、半透明の板の下に逆さの彫刻を吊るす
      ghost.position.y = P.waterY;
      ghost.scale.y = -1;
      ghostMaterial.transparent = false;
      this.object.add(ghost);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(P.inner, P.inner),
        new THREE.MeshPhysicalMaterial({
          color: 0x9fb6c4,
          transparent: true,
          opacity: 0.42,
          metalness: 0.55,
          roughness: 0.05,
          envMapIntensity: 1.4,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      plate.rotation.x = -Math.PI / 2;
      plate.position.y = P.waterY;
      plate.renderOrder = 2;
      this.object.add(plate);
      this.setHint(
        new CompositeHintEffect(
          [
            new MaterialSwap([plate], { opacity: 0.04 }, { durationMs: 1200 }),
            new LightChange(
              [{ light: this.addLights(P, upright).under, target: { intensity: 10 } }],
              { durationMs: 1200 },
            ),
          ],
          { durationMs: 1200 },
        ),
      );
    }

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(P.outer / 2 + 0.4, 0, 0.8);
    this.object.add(caption);

    if (!reflective) return;

    const lights = this.addLights(P, upright);
    // 種明かし: 鏡の中の彫刻を主画面にも薄く現し、水面の反射を弱めて水の色に近づける
    const reveal: HintEffect = {
      durationMs: 1400,
      lockViewpoint: false,
      apply: (t) => {
        this.hintT = t;
        if (this.water) this.water.reflectionStrength = 1 - 0.65 * t;
        this.applyGhostVisibility();
      },
    };
    this.setHint(
      new CompositeHintEffect(
        [
          reveal,
          new LightChange([{ light: lights.under, target: { intensity: 9, color: 0xffffff } }], {
            durationMs: 1400,
          }),
        ],
        { durationMs: 1400 },
      ),
    );
  }

  /** 水盤の中と上の照明 */
  private addLights(
    P: typeof POND,
    target: THREE.Object3D,
  ): { under: THREE.PointLight; top: THREE.SpotLight } {
    const under = new THREE.PointLight(0xbfd3e0, 4, 4, 1.8);
    under.position.set(0.5, P.waterY - 0.25, 0.5);
    this.object.add(under);
    const top = new THREE.SpotLight(0xfff3e4, 18, 6, Math.PI / 7, 0.5, 1.8);
    top.position.set(0.6, P.rimHeight + 2.6, 0.9);
    top.target = target;
    this.object.add(top);
    return { under, top };
  }

  /** 主画面での鏡像彫刻の見え方(種明かしの進行度で薄く現す) */
  private applyGhostVisibility(): void {
    const ghost = this.ghost;
    const material = this.ghostMaterial;
    if (!ghost || !material) return;
    ghost.visible = this.hintT > 0;
    material.opacity = 0.6 * this.hintT;
    material.depthWrite = false;
    // 主画面では、本物の白い立方体と見分けがつくよう青く染める
    material.color.copy(GHOST_REVEALED);
  }

  override update(delta: number, camera: THREE.Camera): void {
    const water = this.water;
    if (!water) return;
    water.advance(delta);
    // 画面に入っていて、近いときだけ反射を描き直す
    camera.getWorldPosition(this.cameraPos);
    if (this.cameraPos.distanceTo(this.bounds.center) > REFLECT_RANGE) return;
    const cam = camera as THREE.PerspectiveCamera;
    this.viewProjection.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProjection);
    if (!this.frustum.intersectsSphere(this.bounds)) return;
    water.requestReflection();
  }

  override dispose(): void {
    this.water?.dispose();
    this.water = null;
    super.dispose();
  }
}
