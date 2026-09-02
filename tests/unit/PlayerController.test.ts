import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CompositeInput } from '../../src/input/CompositeInput';
import { PlayerController } from '../../src/player/PlayerController';

const TILT = THREE.MathUtils.degToRad(12);
/** 傾きの間の軸: 部屋のローカル +z がワールドの -x を向く */
const AXIS = new THREE.Vector3(-1, 0, 0);

function make(): { camera: THREE.PerspectiveCamera; player: PlayerController } {
  const camera = new THREE.PerspectiveCamera();
  const player = new PlayerController(camera, new CompositeInput([]));
  return { camera, player };
}

/** カメラから見た上方向(ワールド座標) */
function cameraUp(camera: THREE.Camera): THREE.Vector3 {
  return new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
}

describe('PlayerController の視界の傾き', () => {
  it('傾きがなければカメラは傾かない(見上げてもロールしない)', () => {
    const { camera, player } = make();
    player.teleport({ yaw: 0.7, pitch: 0 });
    expect(cameraUp(camera).angleTo(new THREE.Vector3(0, 1, 0))).toBeCloseTo(0, 6);
    // 見上げても左右の傾きは出ない
    player.teleport({ yaw: 0.7, pitch: -0.2 });
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    expect(right.y).toBeCloseTo(0, 6);
  });

  it('傾きを与えるとカメラがその角度だけ傾く', () => {
    const { camera, player } = make();
    player.frameAt = () => ({ axis: AXIS, angle: TILT });
    player.teleport({ yaw: 0, pitch: 0 });
    const up = cameraUp(camera);
    expect(up.angleTo(new THREE.Vector3(0, 1, 0))).toBeCloseTo(TILT, 6);
    expect(up.y).toBeCloseTo(Math.cos(TILT), 6);
  });

  it('傾いた部屋の鉛直は、画面の上下に揃って見える', () => {
    const { camera, player } = make();
    player.frameAt = () => ({ axis: AXIS, angle: TILT });
    // 部屋の「上」(部屋と同じだけ傾いた方向)
    const roomUp = new THREE.Vector3(0, 1, 0).applyAxisAngle(AXIS, TILT);
    for (const yaw of [0, 0.9, Math.PI, -1.4]) {
      player.teleport({ yaw, pitch: 0 });
      // カメラ座標へ移すと、部屋の上はまっすぐ上を向く
      const inView = roomUp.clone().applyQuaternion(camera.quaternion.clone().invert());
      expect(inView.angleTo(new THREE.Vector3(0, 1, 0)), `yaw=${yaw}`).toBeCloseTo(0, 6);
    }
  });

  it('傾いていても、進む向きと画面の正面はほぼ一致する', () => {
    // 移動は yaw をそのまま使う。枠を傾けると画面の正面の水平成分がわずかにずれるが、
    // 12° の傾きでも 1° 未満なので、見ている方へ歩ける感覚は保たれる
    const { camera, player } = make();
    player.frameAt = () => ({ axis: AXIS, angle: TILT });
    for (const yaw of [0, 0.4, 0.79, 1.2, 2.4, -0.8]) {
      player.teleport({ yaw, pitch: 0 });
      const forward = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .setY(0)
        .normalize();
      const heading = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      expect(forward.angleTo(heading), `yaw=${yaw}`).toBeLessThan(0.02);
    }
  });

  it('角度 0 の枠は何もしない', () => {
    const { camera, player } = make();
    player.frameAt = () => ({ axis: AXIS, angle: 0 });
    player.teleport({ yaw: 0.3, pitch: 0 });
    expect(cameraUp(camera).angleTo(new THREE.Vector3(0, 1, 0))).toBeCloseTo(0, 6);
  });

  it('演出がカメラを持っている間は傾けない', () => {
    const { camera, player } = make();
    player.frameAt = () => ({ axis: AXIS, angle: TILT });
    player.cameraOverride = {
      position: new THREE.Vector3(0, 2, 3),
      lookAt: new THREE.Vector3(0, 1, 0),
    };
    player.teleport({ yaw: 0, pitch: 0 });
    expect(cameraUp(camera).angleTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(0.7);
    expect(camera.position.toArray()).toEqual([0, 2, 3]);
  });
});
