import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LightCuller } from '../../src/museum/LightCuller';

/** -z を向いた広角カメラ。原点に置き、テストでは位置だけ動かす */
function makeCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(90, 1, 0.1, 500);
  cam.updateProjectionMatrix();
  return cam;
}

/** distance(カットオフ距離)を持つ点光源をカメラの正面(-z)に置く */
function point(z: number, distance: number): THREE.PointLight {
  const l = new THREE.PointLight(0xffffff, 10, distance, 2);
  l.position.set(0, 0, -z);
  return l;
}

function spot(z: number, distance: number): THREE.SpotLight {
  const l = new THREE.SpotLight(0xffffff, 10, distance);
  l.position.set(0, 0, -z);
  return l;
}

function sceneOf(...lights: THREE.Light[]): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(...lights);
  return scene;
}

/** 判定を 1 回強制する */
function step(culler: LightCuller): void {
  culler.interval = 0;
  culler.update(1);
}

describe('LightCuller', () => {
  it('点灯数は視点が動いても変わらない(シェーダ再コンパイルを避ける)', () => {
    const lights = [5, 10, 15, 20, 25, 30].map((z) => point(z, 8));
    const cam = makeCamera();
    const culler = new LightCuller(() => cam, { point: 3, spot: 2 });
    culler.collect(sceneOf(...lights));

    const counts = new Set<number>();
    for (let z = 10; z >= -40; z -= 0.5) {
      cam.position.set(0, 0, z);
      step(culler);
      counts.add(lights.filter((l) => l.visible).length);
    }
    expect([...counts]).toEqual([3]);
    expect(culler.activeCount).toBe(3);
  });

  it('視線を変えても点灯数は変わらない', () => {
    const lights = [5, 10, 15, 20].map((z) => point(z, 8));
    const cam = makeCamera();
    const culler = new LightCuller(() => cam, { point: 2, spot: 2 });
    culler.collect(sceneOf(...lights));

    const counts = new Set<number>();
    for (let k = 0; k < 16; k++) {
      cam.rotation.set(0, (k * Math.PI) / 8, 0, 'YXZ');
      step(culler);
      counts.add(lights.filter((l) => l.visible).length);
    }
    expect([...counts]).toEqual([2]);
  });

  it('種類ごとに上限を分けて数える', () => {
    const points = [4, 8, 12, 16].map((z) => point(z, 6));
    const spots = [5, 9, 13].map((z) => spot(z, 6));
    const cam = makeCamera();
    const culler = new LightCuller(() => cam, { point: 2, spot: 1 });
    culler.collect(sceneOf(...points, ...spots));

    expect(points.filter((l) => l.visible).length).toBe(2);
    expect(spots.filter((l) => l.visible).length).toBe(1);
    expect(culler.count).toBe(7);
    expect(culler.activeCount).toBe(3);
  });

  it('総数が上限以下ならすべて点ける', () => {
    const lights = [4, 8].map((z) => point(z, 6));
    const cam = makeCamera();
    cam.position.set(0, 0, 200);
    const culler = new LightCuller(() => cam, { point: 4, spot: 4 });
    culler.collect(sceneOf(...lights));
    expect(lights.every((l) => l.visible)).toBe(true);
  });

  it('カットオフ距離で正規化した近さの順に残す', () => {
    // 遠いが到達距離の長い光源のほうが、近いが到達距離の短い光源より寄与が大きい
    const far = point(30, 100);
    const near = point(5, 5.5);
    const cam = makeCamera();
    const culler = new LightCuller(() => cam, { point: 1, spot: 1 });
    culler.collect(sceneOf(far, near));
    expect(far.visible).toBe(true);
    expect(near.visible).toBe(false);
  });

  it('影響範囲が視錐台から外れた光源から先に落とす', () => {
    const behind = point(-10, 6); // 真後ろ(+z)。半径 6 の影響範囲ごと画面の外
    const ahead = point(25, 15); // 正面のずっと先。正規化した近さでは behind より不利
    const cam = makeCamera();
    const culler = new LightCuller(() => cam, { point: 1, spot: 1 });
    culler.collect(sceneOf(behind, ahead));
    expect(ahead.visible).toBe(true);
    expect(behind.visible).toBe(false);
  });

  it('カットオフ距離のない光源は cullRange を使う', () => {
    const a = new THREE.PointLight(0xffffff, 10, 0);
    a.position.set(0, 0, -20);
    a.userData.cullRange = 100;
    const b = new THREE.PointLight(0xffffff, 10, 0);
    b.position.set(0, 0, -10);
    b.userData.cullRange = 11;
    const cam = makeCamera();
    const culler = new LightCuller(() => cam, { point: 1, spot: 1 });
    culler.collect(sceneOf(a, b));
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(false);
  });
});
