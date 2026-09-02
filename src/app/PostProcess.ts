import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { QualitySettings } from './Quality';

/**
 * ティアに応じたポストプロセス。
 * high: Bloom + ACES + GTAO(SSAO 相当)、mid: Bloom + ACES、low: ACES のみ(直接描画)。
 */
export class PostProcess {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private ao: GTAOPass | null = null;
  private settings: QualitySettings | null = null;
  /** AO を止めたい展示のキー。1 つでも入っていれば AO を切る */
  private readonly aoSuppressors = new Set<string>();
  private width = 1;
  private height = 1;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {}

  get enabled(): boolean {
    return this.composer !== null;
  }

  /** AO(GTAO)が実際に効いているか。テストと展示側の判定に使う */
  get aoEnabled(): boolean {
    return this.ao !== null && this.ao.enabled;
  }

  /**
   * AO を一時的に止める / 戻す。
   * スクリーンスペースの遮蔽は無灯のマテリアルでも入隅を暗くするので、
   * 陰影を消したい展示(F3 色の部屋)の中では切る必要がある。
   * 複数の展示が同時に要求しても取り違えないよう、キーの集合で管理する。
   */
  suppressAO(key: string, on: boolean): void {
    const had = this.aoSuppressors.size > 0;
    if (on) this.aoSuppressors.add(key);
    else this.aoSuppressors.delete(key);
    if (had !== this.aoSuppressors.size > 0) this.applyAo();
  }

  private applyAo(): void {
    if (this.ao) this.ao.enabled = this.aoSuppressors.size === 0;
  }

  configure(settings: QualitySettings): void {
    if (
      this.settings &&
      this.settings.bloom === settings.bloom &&
      this.settings.ssao === settings.ssao
    ) {
      this.settings = settings;
      return;
    }
    this.settings = settings;
    this.dispose();
    if (!settings.bloom && !settings.ssao) return;

    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.setSize(this.width, this.height);
    composer.addPass(new RenderPass(this.scene, this.camera));

    if (settings.ssao) {
      const ao = new GTAOPass(this.scene, this.camera, this.width, this.height);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.6;
      ao.updateGtaoMaterial({ radius: 0.3, distanceExponent: 1.5, scale: 1.0, samples: 12 });
      composer.addPass(ao);
      this.ao = ao;
      // ティアが変わって作り直したときも、止めている展示の中なら止めたままにする
      this.applyAo();
    }
    if (settings.bloom) {
      // しきい値はトーンマッピング前の線形値。白い壁(≈1.0)が滲まないよう、天窓の空(≈2.2)だけが超える値にする
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height),
        0.22,
        0.3,
        1.25,
      );
      composer.addPass(bloom);
      this.bloom = bloom;
    }
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(width, height);
    }
  }

  /** pixelRatio が変わったときに呼ぶ */
  refresh(): void {
    this.setSize(this.width, this.height);
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.composer?.dispose();
    this.bloom?.dispose();
    this.ao?.dispose();
    this.composer = null;
    this.bloom = null;
    this.ao = null;
  }
}
