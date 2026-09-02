import * as THREE from 'three';
import { viewpointInFront, type ExhibitMeta } from '../Exhibit';
import type { ExhibitDefinition } from '../registry';
import { EndlessStair } from './EndlessStair';
import { ForcedPerspectiveGarden } from './ForcedPerspectiveGarden';
import { GANZFELD, GanzfeldChamber } from './GanzfeldChamber';
import { InfinityWell } from './InfinityWell';
import { InvertedPond } from './InvertedPond';
import { TILT, TiltedRoom } from './TiltedRoom';
import { TrilemmaSculpture } from './TrilemmaSculpture';
import { STAIR } from './stairGeometry';

function meta(
  id: string,
  x: number,
  z: number,
  facing: number,
  triggerRadius: number,
  viewDistance: number,
  pitch = 0,
  triggerCenter?: THREE.Vector3,
): ExhibitMeta {
  const position = new THREE.Vector3(x, 0, z);
  const m: ExhibitMeta = {
    id,
    room: 'fable',
    position,
    facing,
    triggerRadius,
    viewpoint: viewpointInFront(position, facing, viewDistance, pitch),
  };
  if (triggerCenter) m.triggerCenter = triggerCenter;
  return m;
}

/** 回廊の窓の位置(corridor.ts の開口に合わせる) */
const WINDOW = { x: 2, z: -13 };

/** Fable の間(と回廊)の展示。配置は fableGallery.ts(x ±10、z -39..-19)に合わせる */
export const fableDefinitions: ExhibitDefinition[] = [
  {
    id: 'trilemma-sculpture',
    room: 'fable',
    create: () =>
      new TrilemmaSculpture(meta('trilemma-sculpture', -6.2, -33, -Math.PI / 2, 3.2, 2.8, 0.0)),
  },
  {
    id: 'tilted-room',
    room: 'fable',
    create: () => {
      // 部屋の中(入口から 1.6 m)が推奨視点。判定の中心も部屋の中心にする
      const facing = Math.PI / 2;
      const position = new THREE.Vector3(5.6, 0, -34);
      const inside = viewpointInFront(position, facing, -0.9, -0.12);
      const center = viewpointInFront(position, facing, -TILT.depth / 2).position;
      return new TiltedRoom({
        id: 'tilted-room',
        room: 'fable',
        position,
        facing,
        triggerRadius: 3.4,
        triggerCenter: center,
        viewpoint: inside,
      });
    },
  },
  {
    id: 'ganzfeld-chamber',
    room: 'fable',
    create: () => {
      const facing = Math.PI / 2;
      const position = new THREE.Vector3(5.6, 0, -24);
      const inside = viewpointInFront(position, facing, -1.2);
      const center = viewpointInFront(position, facing, -GANZFELD.depth / 2).position;
      return new GanzfeldChamber({
        id: 'ganzfeld-chamber',
        room: 'fable',
        position,
        facing,
        triggerRadius: 3.4,
        triggerCenter: center,
        viewpoint: inside,
      });
    },
  },
  {
    id: 'garden-window',
    room: 'fable',
    create: () =>
      new ForcedPerspectiveGarden(
        meta(
          'garden-window',
          WINDOW.x,
          WINDOW.z,
          Math.PI / 2,
          2.6,
          1.3,
          // 水面は水平から 5°〜23° 下に見えるので、その帯を画面の中央寄りへ持ってくる
          -0.15,
          new THREE.Vector3(0.7, 0, WINDOW.z),
        ),
      ),
  },
  {
    id: 'infinity-well',
    room: 'fable',
    create: () => new InfinityWell(meta('infinity-well', -6, -22, -Math.PI / 2, 3.0, 1.5, -0.55)),
  },
  {
    id: 'endless-stair',
    room: 'fable',
    create: () => {
      // 塔の中心。推奨視点は入口の踊り場 L0 で、東側の階段を見上げる
      const position = new THREE.Vector3(-5.3, 0, -13);
      const l0 = new THREE.Vector3(
        position.x + STAIR.ax - STAIR.w / 2,
        0,
        position.z + STAIR.az - STAIR.w / 2,
      );
      return new EndlessStair({
        id: 'endless-stair',
        room: 'fable',
        position,
        facing: Math.PI,
        triggerRadius: 4.6,
        triggerCenter: position.clone(),
        viewpoint: { position: l0, yaw: 0, pitch: 0.12 },
      });
    },
  },
  {
    id: 'inverted-pond',
    room: 'fable',
    // 彫刻の反射が水面に収まる距離と、その反射を画面の中央へ持ってくる俯角
    create: () => new InvertedPond(meta('inverted-pond', -6, -27.5, -Math.PI / 2, 3.4, 2.1, -0.46)),
  },
];
