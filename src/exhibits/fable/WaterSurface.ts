import * as THREE from 'three';
import { makeCanvasTexture } from '../../procedural/textures';

export interface WaterSurfaceOptions {
  /** 反射テクスチャの一辺(px) */
  resolution?: number;
  /** 水そのものの色(反射が弱いところに出る) */
  color?: THREE.ColorRepresentation;
  /** 波の歪みの強さ(投影座標に対する比) */
  distortion?: number;
  /** 波紋のスケール(面 1 枚あたりの繰り返し数) */
  waveScale?: number;
  /** 正面から見たときの反射の強さ。物理的には 0.02 前後だが、暗くなりすぎるので上げる */
  fresnelBase?: number;
  /** 反射面を作るときの near 面の押し出し量 */
  clipBias?: number;
  /** 反射を描く直前 / 直後(鏡の中だけに置くものを切り替える) */
  onBeforeReflect?: () => void;
  onAfterReflect?: () => void;
}

const VERT = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vProjected;
varying vec2 vWaveUv;
varying vec3 vWorldPos;

void main() {
  vWaveUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vProjected = textureMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAG = /* glsl */ `
uniform sampler2D tReflection;
uniform sampler2D tWaves;
uniform vec3 waterColor;
uniform float time;
uniform float distortion;
uniform float waveScale;
uniform float reflectionStrength;
uniform float fresnelBase;
varying vec4 vProjected;
varying vec2 vWaveUv;
varying vec3 vWorldPos;

void main() {
  // 2 枚の波紋を別の速さで流し、法線の傾きを足し合わせる
  vec2 uv1 = vWaveUv * waveScale + vec2(time * 0.013, time * 0.009);
  vec2 uv2 = vWaveUv * waveScale * 1.7 - vec2(time * 0.011, time * 0.016);
  vec2 slope = (texture2D(tWaves, uv1).rg - 0.5) + (texture2D(tWaves, uv2).rg - 0.5);

  vec4 projected = vProjected;
  projected.xy += slope * distortion * projected.w;
  vec3 reflected = texture2DProj(tReflection, projected).rgb;

  // フレネル。正面から覗くと水の色、浅い角度では鏡になる
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 normal = normalize(vec3(slope.x * 0.6, 1.0, slope.y * 0.6));
  float facing = clamp(dot(viewDir, normal), 0.0, 1.0);
  float fresnel = fresnelBase + (1.0 - fresnelBase) * pow(1.0 - facing, 3.0);

  vec3 color = mix(waterColor, reflected, clamp(fresnel * reflectionStrength, 0.0, 1.0));
  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** 波紋の傾きを R(x)・G(z)に入れたタイル可能なテクスチャ */
function createWaveTexture(): THREE.Texture {
  const tex = makeCanvasTexture(
    (ctx, size) => {
      const image = ctx.createImageData(size, size);
      const waves = [
        { ax: 3, az: 2, amp: 1.0, phase: 0 },
        { ax: -2, az: 5, amp: 0.7, phase: 1.7 },
        { ax: 6, az: -3, amp: 0.45, phase: 3.1 },
        { ax: -5, az: -6, amp: 0.3, phase: 5.2 },
      ];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const u = (x / size) * Math.PI * 2;
          const v = (y / size) * Math.PI * 2;
          let dx = 0;
          let dz = 0;
          for (const w of waves) {
            // 高さ h = amp * sin(ax·u + az·v + phase) の傾き
            const c = Math.cos(w.ax * u + w.az * v + w.phase) * w.amp;
            dx += c * w.ax;
            dz += c * w.az;
          }
          const i = (y * size + x) * 4;
          image.data[i] = Math.round(THREE.MathUtils.clamp(dx / 18 + 0.5, 0, 1) * 255);
          image.data[i + 1] = Math.round(THREE.MathUtils.clamp(dz / 18 + 0.5, 0, 1) * 255);
          image.data[i + 2] = 255;
          image.data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    },
    { size: 256, srgb: false },
  );
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * 平面反射の水面。
 *
 * three.js の Reflector と同じく、水面で鏡映したカメラでシーンを描いて
 * 投影座標で貼る。加えて波紋で歪ませ、フレネルで見る角度による反射の強さを変える。
 *
 * `onBeforeReflect` / `onAfterReflect` で「鏡の中にだけあるもの」を差し替えられる。
 * 層(layers)を使わないので、影や光源の間引きの設定に影響しない。
 *
 * 反射は 1 フレームに 1 回だけ描く。`requestReflection()` を呼んだ次の描画で 1 回だけ
 * 更新するので、ポストプロセスが同じシーンを何度も走査しても増えない。
 */
export class WaterSurface extends THREE.Mesh {
  readonly reflectionTarget: THREE.WebGLRenderTarget;
  /** 反射を描いた回数(テスト用) */
  reflectionRenders = 0;

  private readonly virtualCamera = new THREE.PerspectiveCamera();
  private readonly reflectorPlane = new THREE.Plane();
  private readonly normal = new THREE.Vector3();
  private readonly reflectorWorldPosition = new THREE.Vector3();
  private readonly cameraWorldPosition = new THREE.Vector3();
  private readonly rotationMatrix = new THREE.Matrix4();
  private readonly lookAtPosition = new THREE.Vector3(0, 0, -1);
  private readonly clipPlane = new THREE.Vector4();
  private readonly view = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly q = new THREE.Vector4();
  private readonly textureMatrix = new THREE.Matrix4();
  private readonly clipBias: number;
  private readonly opts: WaterSurfaceOptions;
  private pending = false;

  constructor(geometry: THREE.BufferGeometry, opts: WaterSurfaceOptions = {}) {
    const resolution = opts.resolution ?? 512;
    const targetOptions: THREE.RenderTargetOptions = {
      samples: 0,
      type: THREE.HalfFloatType,
      depthBuffer: true,
    };
    const reflectionTarget = new THREE.WebGLRenderTarget(resolution, resolution, targetOptions);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        tReflection: { value: reflectionTarget.texture },
        tWaves: { value: createWaveTexture() },
        textureMatrix: { value: new THREE.Matrix4() },
        waterColor: { value: new THREE.Color(opts.color ?? 0x1f2a30) },
        time: { value: 0 },
        distortion: { value: opts.distortion ?? 0.035 },
        waveScale: { value: opts.waveScale ?? 2.2 },
        reflectionStrength: { value: 1 },
        fresnelBase: { value: opts.fresnelBase ?? 0.35 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    super(geometry, material);
    this.reflectionTarget = reflectionTarget;
    this.clipBias = opts.clipBias ?? 0.003;
    this.opts = opts;
    this.name = 'waterSurface';
    this.onBeforeRender = this.renderReflection;
  }

  private get uniforms(): Record<string, THREE.IUniform> {
    return (this.material as THREE.ShaderMaterial).uniforms;
  }

  /** 波を進める */
  advance(delta: number): void {
    this.uniforms['time']!.value += delta;
  }

  /** 0 で水の色だけ、1 で通常の反射 */
  set reflectionStrength(v: number) {
    this.uniforms['reflectionStrength']!.value = v;
  }

  get reflectionStrength(): number {
    return this.uniforms['reflectionStrength']!.value as number;
  }

  /** 次の描画で 1 回だけ反射を更新する */
  requestReflection(): void {
    this.pending = true;
  }

  private readonly renderReflection = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void => {
    if (!this.pending) return;
    this.pending = false;

    this.reflectorWorldPosition.setFromMatrixPosition(this.matrixWorld);
    this.cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
    this.rotationMatrix.extractRotation(this.matrixWorld);
    this.normal.set(0, 0, 1).applyMatrix4(this.rotationMatrix);
    this.view.subVectors(this.reflectorWorldPosition, this.cameraWorldPosition);
    // 裏側から見ているときは描かない
    if (this.view.dot(this.normal) > 0) return;

    this.view.reflect(this.normal).negate().add(this.reflectorWorldPosition);
    this.rotationMatrix.extractRotation(camera.matrixWorld);
    this.lookAtPosition.set(0, 0, -1).applyMatrix4(this.rotationMatrix);
    this.lookAtPosition.add(this.cameraWorldPosition);
    this.target.subVectors(this.reflectorWorldPosition, this.lookAtPosition);
    this.target.reflect(this.normal).negate().add(this.reflectorWorldPosition);

    const vc = this.virtualCamera;
    vc.position.copy(this.view);
    vc.up.set(0, 1, 0).applyMatrix4(this.rotationMatrix).reflect(this.normal);
    vc.lookAt(this.target);
    const perspective = camera as THREE.PerspectiveCamera;
    vc.far = perspective.far;
    vc.near = perspective.near;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(perspective.projectionMatrix);

    // 投影座標(0..1 のスクリーン座標へ写す行列)
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    this.textureMatrix.multiply(this.matrixWorld);
    (this.uniforms['textureMatrix']!.value as THREE.Matrix4).copy(this.textureMatrix);

    // 水面より下を切る(near 面を水面に寄せる)
    this.reflectorPlane.setFromNormalAndCoplanarPoint(this.normal, this.reflectorWorldPosition);
    this.reflectorPlane.applyMatrix4(vc.matrixWorldInverse);
    this.clipPlane.set(
      this.reflectorPlane.normal.x,
      this.reflectorPlane.normal.y,
      this.reflectorPlane.normal.z,
      this.reflectorPlane.constant,
    );
    const projection = vc.projectionMatrix;
    const e = projection.elements;
    this.q.x = (Math.sign(this.clipPlane.x) + e[8]!) / e[0]!;
    this.q.y = (Math.sign(this.clipPlane.y) + e[9]!) / e[5]!;
    this.q.z = -1;
    this.q.w = (1 + e[10]!) / e[14]!;
    this.clipPlane.multiplyScalar(2 / this.clipPlane.dot(this.q));
    e[2] = this.clipPlane.x;
    e[6] = this.clipPlane.y;
    e[10] = this.clipPlane.z - this.clipBias;
    e[14] = this.clipPlane.w;

    this.visible = false;
    this.opts.onBeforeReflect?.();
    const previousTarget = renderer.getRenderTarget();
    const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const previousXrEnabled = renderer.xr.enabled;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.reflectionTarget);
    if (renderer.autoClear === false) renderer.clear();
    renderer.render(scene, vc);
    renderer.xr.enabled = previousXrEnabled;
    renderer.shadowMap.autoUpdate = previousShadowAutoUpdate;
    renderer.setRenderTarget(previousTarget);
    this.opts.onAfterReflect?.();
    this.visible = true;
    this.reflectionRenders++;
  };

  dispose(): void {
    this.reflectionTarget.dispose();
    (this.uniforms['tWaves']!.value as THREE.Texture).dispose();
    (this.material as THREE.Material).dispose();
    this.geometry.dispose();
  }
}
