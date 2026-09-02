import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CompositeInput } from '../input/CompositeInput';
import { KeyboardMouseInput } from '../input/KeyboardMouseInput';
import { TouchInput } from '../input/TouchInput';
import { hasTouch, isMobileDevice, isTouchPrimary } from '../input/device';
import { createPlaceholderDefinitions } from '../exhibits/debug/PlaceholderExhibit';
import { ExhibitRegistry, exhibitDefinitions } from '../exhibits/registry';
import { HintController } from '../interaction/HintController';
import { ProximityDetector } from '../interaction/ProximityDetector';
import { LightCuller } from '../museum/LightCuller';
import { Museum } from '../museum/Museum';
import { createViewpointMark } from '../museum/ViewpointMark';
import { PlayerController } from '../player/PlayerController';
import { Credits } from '../ui/Credits';
import { ExhibitList } from '../ui/ExhibitList';
import { HelpOverlay } from '../ui/HelpOverlay';
import { HintPanel } from '../ui/HintPanel';
import { Hud } from '../ui/Hud';
import { LoadingScreen } from '../ui/LoadingScreen';
import { Stats } from '../ui/Stats';
import { TouchControls } from '../ui/TouchControls';
import { h, uiRoot } from '../ui/dom';
import { Loop } from './Loop';
import { PostProcess } from './PostProcess';
import { BASE_FOV, fovForAspect } from './camera';
import { QualityController, readGpuName } from './Quality';
import { bus } from './events';

/** レンダラ・シーン・カメラ・ループを統括する。 */
export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly loop: Loop;
  readonly canvas: HTMLCanvasElement;
  readonly quality: QualityController;
  readonly post: PostProcess;
  readonly keyboard = new KeyboardMouseInput();
  readonly touch = new TouchInput();
  readonly input: CompositeInput;
  readonly player: PlayerController;
  readonly isMobile = isMobileDevice();

  museum!: Museum;
  help!: HelpOverlay;
  touchControls!: TouchControls;
  registry!: ExhibitRegistry;
  lightCuller!: LightCuller;
  proximity!: ProximityDetector;
  hints!: HintController;
  hud!: Hud;
  hintPanel!: HintPanel;
  list!: ExhibitList;
  credits!: Credits;
  private readonly modals = new Set<string>();

  constructor(private readonly container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'scene';
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = true;
    // 統計はフレーム全体(ポストプロセスの各パスを含む)で集計する
    this.renderer.info.autoReset = false;

    this.quality = new QualityController(this.renderer, {
      isMobile: this.isMobile,
      gpu: readGpuName(this.renderer),
      forceTier: readForcedTier(),
    });

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 200);
    this.input = new CompositeInput([this.keyboard, this.touch]);
    this.player = new PlayerController(this.camera, this.input);

    this.post = new PostProcess(this.renderer, this.scene, this.camera);
    this.loop = new Loop(() => this.render());
    this.loop.timeScale = readTimeScale();

    window.addEventListener('resize', () => this.resize());
    // iOS はツールバーの開閉や回転で resize が来ないことがあるので、実サイズも監視する
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.resize()).observe(container);
    }
    this.resize();
  }

  async start(): Promise<void> {
    const loading = new LoadingScreen();
    loading.setProgress(0.1, '建物を組み立てています…');
    await nextFrame();

    this.scene.background = new THREE.Color(0xe9e4dc);
    // 反射用の環境(手続き生成)。水面や金属にうっすら映り込む
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this.museum = new Museum();
    this.scene.add(this.museum.group);
    this.player.colliders = this.museum.colliders;
    this.player.groundAt = (x, z, y) => this.museum.groundAt(x, z, y);
    for (const sky of this.museum.skyLights) sky.applyQuality(this.quality.settings);
    this.post.configure(this.quality.settings);
    bus.on('quality:change', ({ tier }) => {
      for (const sky of this.museum.skyLights) sky.applyQuality(this.quality.settings);
      this.post.configure(this.quality.settings);
      this.post.refresh();
      void tier;
    });
    this.player.teleport(this.museum.spawn);
    loading.setProgress(0.25, 'フォントを読み込んでいます…');
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);

    loading.setProgress(0.3, '展示を設営しています…');
    const demo = new URLSearchParams(window.location.search).get('demo') === '1';
    this.registry = new ExhibitRegistry(
      demo ? [...exhibitDefinitions, ...createPlaceholderDefinitions()] : exhibitDefinitions,
    );
    await this.registry.loadAll(
      {
        quality: this.quality.settings,
        post: this.post,
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        museum: this.museum,
        player: this.player,
      },
      (done, total) => loading.setProgress(0.3 + 0.55 * (done / total)),
    );
    for (const e of this.registry.exhibits) {
      if (e.meta.viewpoint) {
        this.scene.add(createViewpointMark(e.meta.viewpoint.position, e.meta.viewpoint.yaw));
      }
    }
    loading.setProgress(0.88, '入力を準備しています…');
    await nextFrame();

    this.setupUi();
    this.setupInput();
    this.setupInteraction();

    this.lightCuller = new LightCuller(() => this.camera);
    this.lightCuller.collect(this.scene);
    this.loop.add(this.lightCuller);

    // 光源の点灯数が決まったこの時点でシェーダをまとめて用意する。
    // 初めて見る展示のマテリアルをフレーム内でコンパイルすると数百 ms 固まるため
    loading.setProgress(0.94, 'シェーダを準備しています…');
    await this.warmUpShaders();

    this.loop.add(this.quality);
    // 演出(カメラの上書き)を先に更新し、同じフレームでカメラへ反映する
    this.loop.add(this.hints);
    this.loop.add(this.player);
    this.loop.add({ update: (delta) => this.registry.update(delta, this.camera) });
    for (const sky of this.museum.skyLights) this.loop.add(sky);
    this.loop.add(this.touchControls);
    this.loop.start();

    loading.setProgress(1);
    await loading.hide();
    this.help.show();

    document.body.dataset.ready = '1';
    bus.emit('app:ready', undefined);
  }

  /**
   * シーン内の全マテリアルを先にコンパイルしておく。
   * three.js はマテリアルを最初に描くフレームでシェーダをコンパイルするので、
   * 何もしないと新しい部屋へ入るたびにそのフレームが固まる。
   *
   * ポストプロセスがあるときは本番の描画先がレンダーターゲットになり、色空間と
   * トーンマッピングの扱いが変わる(= 別のプログラム)。同じ条件でコンパイルしないと
   * 最初のフレームで全マテリアルを作り直すことになるので、ダミーの
   * レンダーターゲットを挿してから走らせる。
   */
  private async warmUpShaders(): Promise<void> {
    const warm = this.post.enabled ? new THREE.WebGLRenderTarget(1, 1) : null;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(warm);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      // compileAsync が使えない環境では同期版で(それも失敗するなら通常描画に任せる)
      try {
        this.renderer.compile(this.scene, this.camera);
      } catch {
        /* noop */
      }
    } finally {
      this.renderer.setRenderTarget(prev);
      warm?.dispose();
    }
    // 影の深度マテリアルとポストプロセス各パスは compile の対象外なので、
    // ローディング表示のうちに 1 フレーム通しで描いて用意する
    // (影カメラは館内全体を覆うので、この 1 回で全体ぶんが揃う)
    this.render();
    await nextFrame();
  }

  private setupInput(): void {
    this.input.attach(this.canvas);
    this.keyboard.onLockChange = (locked) => bus.emit('input:lockchange', { locked });
    this.keyboard.onDragChange = (dragging) => {
      document.body.classList.toggle('is-dragging', dragging);
      if (dragging) bus.emit('input:looked', undefined);
    };
    this.touch.onFirstTouch = () => this.setTouchMode(true);
    if (isTouchPrimary()) this.setTouchMode(true);

    bus.on('ui:modal', ({ open, id }) => {
      if (open) this.modals.add(id);
      else this.modals.delete(id);
      const anyOpen = this.modals.size > 0;
      this.player.enabled = !anyOpen;
      this.keyboard.lockAllowed = !anyOpen;
      if (anyOpen) this.keyboard.releaseLock();
    });
  }

  private setupInteraction(): void {
    this.proximity = new ProximityDetector(this.registry.proximityTargets());
    this.hints = new HintController(this.registry, this.player);
    this.loop.add({
      update: () => {
        const { entered, left } = this.proximity.update(
          this.player.position.x,
          this.player.position.z,
        );
        if (left) bus.emit('exhibit:leave', { id: left });
        if (entered) bus.emit('exhibit:near', { id: entered });
      },
    });
    bus.on('warp', ({ id }) => void this.warpTo(id));
  }

  /** 展示の推奨視点へワープする */
  async warpTo(id: string, duration = 0): Promise<void> {
    const exhibit = this.registry.get(id);
    const vp = exhibit?.meta.viewpoint;
    if (!vp) return;
    if (this.hints.openId) {
      this.hints.hintPlayer.reset();
    }
    await this.player.moveTo(vp, duration);
  }

  private setupUi(): void {
    this.touchControls = new TouchControls(this.touch);
    this.hud = new Hud();
    this.hintPanel = new HintPanel();
    this.credits = new Credits();
    this.list = new ExhibitList(this.registry.definitions.map((d) => ({ id: d.id, room: d.room })));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!this.help.open) this.list.toggle();
      }
    });
    this.help = new HelpOverlay({
      touch: isTouchPrimary(),
      onCredits: () => this.credits.show(),
    });

    const topBar = h('div', { className: 'topbar' }, [
      h('button', {
        className: 'btn',
        text: '展示一覧',
        attrs: { type: 'button', 'data-testid': 'list-button' },
        onClick: () => this.list.toggle(),
      }),
      h('button', {
        className: 'btn btn--icon',
        text: '?',
        attrs: { type: 'button', 'aria-label': '操作方法', 'data-testid': 'help-button' },
        onClick: () => this.help.toggle(),
      }),
    ]);
    uiRoot().appendChild(topBar);
    // 縦持ちではヒントパネルが画面の上部を占めるので、開いている間は畳む
    bus.on('hint:open', () => topBar.classList.add('is-hint-open'));
    bus.on('hint:close', () => topBar.classList.remove('is-hint-open'));

    if (new URLSearchParams(window.location.search).get('stats') === '1') {
      this.loop.add(
        new Stats(
          this.renderer,
          this.quality,
          () => `lights ${this.lightCuller?.activeCount ?? 0}/${this.lightCuller?.count ?? 0}`,
        ),
      );
    }

    // 開発・テスト用のフック
    window.__museum = this;
  }

  private touchMode = false;

  private setTouchMode(touch: boolean): void {
    if (this.touchMode === touch) return;
    this.touchMode = touch;
    this.touchControls.setVisible(touch);
    this.help.setTouch(touch);
    document.body.classList.toggle('is-touch', touch);
    bus.emit('input:touchmode', { touch });
  }

  private lastWidth = 0;
  private lastHeight = 0;

  resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (width === this.lastWidth && height === this.lastHeight) return;
    this.lastWidth = width;
    this.lastHeight = height;
    const aspect = width / height;
    this.camera.aspect = aspect;
    // 縦持ちで左右が見切れないよう、アスペクト比に応じて垂直画角を広げる
    this.camera.fov = fovForAspect(aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.post?.setSize(width, height);
    bus.emit('app:resize', { width, height });
  }

  render(): void {
    this.renderer.info.reset();
    this.post.render();
  }
}

/** 次の描画フレームまで待つ。バックグラウンドタブでは rAF が止まるので時間でも解放する */
function nextFrame(): Promise<void> {
  return new Promise((r) => {
    const done = () => r();
    requestAnimationFrame(done);
    setTimeout(done, 80);
  });
}

/** `?timescale=3` で時間を早送りする(描画の遅いテスト環境用)。1〜8 に制限 */
function readTimeScale(): number {
  const v = Number(new URLSearchParams(window.location.search).get('timescale'));
  return Number.isFinite(v) && v > 0 ? Math.min(8, v) : 1;
}

/** `?quality=low` のように URL でティアを固定できる(デバッグ用) */
function readForcedTier(): 'high' | 'mid' | 'low' | undefined {
  const q = new URLSearchParams(window.location.search).get('quality');
  return q === 'high' || q === 'mid' || q === 'low' ? q : undefined;
}

declare global {
  interface Window {
    /** E2E テストとデバッグ用 */
    __museum?: App;
  }
}

export { hasTouch };
