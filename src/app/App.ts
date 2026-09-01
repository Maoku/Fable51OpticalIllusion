import * as THREE from 'three';
import { Loop } from './Loop';
import { bus } from './events';

/** レンダラ・シーン・カメラ・ループを統括する。 */
export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly loop: Loop;
  readonly canvas: HTMLCanvasElement;

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
    this.camera.position.set(0, 1.6, 4);

    this.loop = new Loop(() => this.render());

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  async start(): Promise<void> {
    this.buildPlaceholderScene();
    this.loop.start();
    document.body.dataset.ready = '1';
    bus.emit('app:ready', undefined);
  }

  /** Phase 0 の確認用シーン。床と光源のみ。 */
  private buildPlaceholderScene(): void {
    this.scene.background = new THREE.Color(0xf4f1ec);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xb08d63, roughness: 0.8 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    );
    cube.position.set(0, 0.5, 0);
    cube.castShadow = true;
    this.scene.add(cube);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8d7b68, 0.8);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(4, 8, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    this.camera.lookAt(0, 0.5, 0);
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
