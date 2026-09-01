import * as THREE from 'three';
import { CompositeInput } from '../input/CompositeInput';
import { KeyboardMouseInput } from '../input/KeyboardMouseInput';
import { TouchInput } from '../input/TouchInput';
import { hasTouch, isMobileDevice, isTouchPrimary } from '../input/device';
import { Museum } from '../museum/Museum';
import { PlayerController } from '../player/PlayerController';
import { HelpOverlay } from '../ui/HelpOverlay';
import { LoadingScreen } from '../ui/LoadingScreen';
import { TouchControls } from '../ui/TouchControls';
import { h, uiRoot } from '../ui/dom';
import { Loop } from './Loop';
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
  readonly keyboard = new KeyboardMouseInput();
  readonly touch = new TouchInput();
  readonly input: CompositeInput;
  readonly player: PlayerController;
  readonly isMobile = isMobileDevice();

  museum!: Museum;
  help!: HelpOverlay;
  touchControls!: TouchControls;
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

    this.quality = new QualityController(this.renderer, {
      isMobile: this.isMobile,
      gpu: readGpuName(this.renderer),
      forceTier: readForcedTier(),
    });

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
    this.input = new CompositeInput([this.keyboard, this.touch]);
    this.player = new PlayerController(this.camera, this.input);

    this.loop = new Loop(() => this.render());

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  async start(): Promise<void> {
    const loading = new LoadingScreen();
    loading.setProgress(0.1, '建物を組み立てています…');
    await nextFrame();

    this.scene.background = new THREE.Color(0xe9e4dc);
    this.museum = new Museum();
    this.scene.add(this.museum.group);
    this.player.colliders = this.museum.colliders;
    this.player.teleport(this.museum.spawn);
    loading.setProgress(0.6, '入力を準備しています…');
    await nextFrame();

    this.setupUi();
    this.setupInput();

    this.loop.add(this.quality);
    this.loop.add(this.player);
    this.loop.add(this.touchControls);
    this.loop.start();

    loading.setProgress(1);
    await loading.hide();
    this.help.show();

    document.body.dataset.ready = '1';
    bus.emit('app:ready', undefined);
  }

  private setupInput(): void {
    this.input.attach(this.canvas);
    this.keyboard.onLockChange = (locked) => bus.emit('input:lockchange', { locked });
    this.touch.onFirstTouch = () => this.setTouchMode(true);
    if (isTouchPrimary()) this.setTouchMode(true);

    bus.on('ui:modal', ({ open, id }) => {
      if (open) this.modals.add(id);
      else this.modals.delete(id);
      const anyOpen = this.modals.size > 0;
      this.player.enabled = !anyOpen;
      this.keyboard.autoLock = !anyOpen;
      if (anyOpen) this.keyboard.releaseLock();
    });
  }

  private setupUi(): void {
    this.touchControls = new TouchControls(this.touch);
    this.help = new HelpOverlay({
      touch: isTouchPrimary(),
      onStart: () => {
        if (!this.touchMode) this.keyboard.requestLock();
      },
    });

    const topBar = h('div', { className: 'topbar' }, [
      h('button', {
        className: 'btn btn--icon',
        text: '?',
        attrs: { type: 'button', 'aria-label': '操作方法', 'data-testid': 'help-button' },
        onClick: () => this.help.toggle(),
      }),
    ]);
    uiRoot().appendChild(topBar);

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

  resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    bus.emit('app:resize', { width, height });
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
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
