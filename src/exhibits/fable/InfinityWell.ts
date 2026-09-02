import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import { makeCanvasTexture } from '../../procedural/textures';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect, type HintEffect } from '../HintEffect';
import { CameraOrbit } from '../effects/CameraOrbit';
import { SectionCut } from '../effects/SectionCut';

export const WELL = {
  radius: 0.55,
  rimOuter: 0.8,
  rimHeight: 0.42,
  depth: 0.3,
  shaftDepth: 40,
  ringSpacing: 0.6,
};

/** 井戸の底に見せる縦穴(隠しシーン)をこの分だけ下に置く */
const PORTAL_OFFSET = new THREE.Vector3(0, -200, 0);

const PORTAL_VERT = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PORTAL_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec2 resolution;
uniform float reveal;
uniform vec3 revealColor;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec3 c = texture2D(map, uv).rgb;
  gl_FragColor = vec4(mix(c, revealColor, reveal), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * F5 無限の井戸。
 * 深さ 30 cm しかない井戸の底に、鑑賞者のカメラと同じ姿勢で描いた「隠し縦穴」の像を
 * 画面座標で貼る(ポータル)。視差も正しく、覗き込むとどこまでも続いて見える。
 * low ティアでは同心リングの静止画で代替する。
 */
export class InfinityWell extends BaseExhibit {
  private rt: THREE.WebGLRenderTarget | null = null;
  private portalScene: THREE.Scene | null = null;
  private readonly portalCamera = new THREE.PerspectiveCamera();
  private portalMat: THREE.ShaderMaterial | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly bufferSize = new THREE.Vector2();

  protected build(ctx: LoadContext): void {
    const mats = getMaterials();
    const W = WELL;
    this.renderer = ctx.renderer;

    // 縁石(リング)と 30 cm の内壁
    const stone = new THREE.MeshStandardMaterial({
      color: 0x9b968f,
      map: mats.concrete.map,
      roughness: 0.9,
    });
    const rimShape = new THREE.Shape();
    rimShape.absarc(0, 0, W.rimOuter, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, W.radius, 0, Math.PI * 2, true);
    rimShape.holes.push(hole);
    const rim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(rimShape, {
        depth: W.rimHeight,
        bevelEnabled: false,
        curveSegments: 48,
      }),
      stone,
    );
    rim.rotation.x = -Math.PI / 2;
    rim.castShadow = true;
    rim.receiveShadow = true;
    this.object.add(rim);
    // 内壁: 底は部屋の床より上(縁石の上端から 30 cm)に置く。床の板に隠れないようにするため
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(W.radius, W.radius, W.depth, 48, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x2e2f33,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0,
        side: THREE.BackSide,
      }),
    );
    inner.position.y = W.rimHeight - W.depth / 2;
    this.object.add(inner);
    this.addLocalCollider(0, W.rimHeight / 2, 0, W.rimOuter * 2, W.rimHeight, W.rimOuter * 2);

    // 底(ポータル)
    const usePortal = ctx.quality.tier !== 'low';
    let bottom: THREE.Mesh;
    if (usePortal) {
      this.portalMat = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: null },
          resolution: { value: new THREE.Vector2(1, 1) },
          reveal: { value: 0 },
          revealColor: { value: new THREE.Color(0x2c2f33) },
        },
        vertexShader: PORTAL_VERT,
        fragmentShader: PORTAL_FRAG,
      });
      bottom = new THREE.Mesh(new THREE.CircleGeometry(W.radius, 48), this.portalMat);
      this.buildShaft();
    } else {
      bottom = new THREE.Mesh(
        new THREE.CircleGeometry(W.radius, 48),
        new THREE.MeshBasicMaterial({ map: this.ringTexture(), toneMapped: false }),
      );
    }
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = W.rimHeight - W.depth + 0.002;
    this.object.add(bottom);

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(1.2, 0, 0.8);
    this.object.add(caption);

    // 種明かし: 断面で 30 cm の深さを見せ、底の像を平らな板に戻す
    const center = this.toWorld(0, W.rimHeight / 2, 0);
    const normal = this.frontDir.negate();
    const revealPortal: HintEffect = {
      durationMs: 1600,
      lockViewpoint: false,
      apply: (t) => {
        if (this.portalMat) this.portalMat.uniforms.reveal!.value = t;
        (bottom.material as THREE.Material).opacity = 1;
      },
    };
    this.setHint(
      new CompositeHintEffect(
        [
          new CameraOrbit(ctx.player, {
            target: center,
            sweep: 0.5,
            lift: 0.9,
            radiusScale: 1.05,
            durationMs: 1600,
          }),
          new SectionCut([rim, inner], {
            normal,
            start: center.clone().addScaledVector(normal, -W.rimOuter - 0.1),
            end: center.clone(),
            durationMs: 1600,
          }),
          revealPortal,
        ],
        { durationMs: 1600 },
      ),
    );
  }

  /** 隠しシーン: 深い縦穴と等間隔の光るリング */
  private buildShaft(): void {
    const W = WELL;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x02040a, 0.09);
    const origin = this.toWorld(0, W.rimHeight - W.depth, 0).add(PORTAL_OFFSET);
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(W.radius, W.radius, W.shaftDepth, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x1a1d22, side: THREE.BackSide }),
    );
    wall.position.copy(origin).add(new THREE.Vector3(0, -W.shaftDepth / 2, 0));
    scene.add(wall);
    const count = Math.floor(W.shaftDepth / W.ringSpacing);
    const rings = new THREE.InstancedMesh(
      new THREE.TorusGeometry(W.radius - 0.015, 0.012, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xbfe7ff }),
      count,
    );
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    for (let i = 0; i < count; i++) {
      m.makeTranslation(origin.x, origin.y - 0.15 - i * W.ringSpacing, origin.z).multiply(rot);
      rings.setMatrixAt(i, m);
    }
    scene.add(rings);
    this.portalScene = scene;
    this.portalCamera.matrixAutoUpdate = false;
  }

  private ringTexture(): THREE.CanvasTexture {
    return makeCanvasTexture(
      (c, s) => {
        c.fillStyle = '#02040a';
        c.fillRect(0, 0, s, s);
        const cx = s / 2;
        let r = s * 0.48;
        let k = 0;
        while (r > 2) {
          const a = Math.max(0.05, 1 - k * 0.07);
          c.strokeStyle = `rgba(191,231,255,${a})`;
          c.lineWidth = Math.max(1, r * 0.03);
          c.beginPath();
          c.arc(cx, cx, r, 0, Math.PI * 2);
          c.stroke();
          r *= 0.86;
          k++;
        }
      },
      { size: 512 },
    );
  }

  override update(_delta: number, camera: THREE.Camera): void {
    const renderer = this.renderer;
    if (!renderer || !this.portalScene || !this.portalMat) return;
    // 井戸の近くにいるときだけ描く
    const d = camera.position.distanceTo(this.meta.position);
    if (d > 12) return;
    renderer.getDrawingBufferSize(this.bufferSize);
    const w = Math.max(1, Math.floor(this.bufferSize.x / 2));
    const h = Math.max(1, Math.floor(this.bufferSize.y / 2));
    if (!this.rt || this.rt.width !== w || this.rt.height !== h) {
      this.rt?.dispose();
      this.rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
      this.portalMat.uniforms.map!.value = this.rt.texture;
    }
    this.portalMat.uniforms.resolution!.value.set(this.bufferSize.x, this.bufferSize.y);

    const cam = this.portalCamera;
    const src = camera as THREE.PerspectiveCamera;
    cam.projectionMatrix.copy(src.projectionMatrix);
    cam.projectionMatrixInverse.copy(src.projectionMatrixInverse);
    cam.matrixWorld.copy(src.matrixWorld);
    cam.matrixWorld.elements[12] += PORTAL_OFFSET.x;
    cam.matrixWorld.elements[13] += PORTAL_OFFSET.y;
    cam.matrixWorld.elements[14] += PORTAL_OFFSET.z;
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.portalScene, cam);
    renderer.setRenderTarget(prevTarget);
  }

  override dispose(): void {
    super.dispose();
    this.rt?.dispose();
    this.rt = null;
  }
}
