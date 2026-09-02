import * as THREE from 'three';
import {
  drawCafeWall,
  drawCafeWallGuide,
  drawEbbinghaus,
  drawEbbinghausGuide,
  drawMullerLyer,
  drawMullerLyerGuide,
} from '../../procedural/illusions';
import { viewpointInFront, type ExhibitMeta } from '../Exhibit';
import type { ExhibitDefinition } from '../registry';
import { AmesRoom } from './AmesRoom';
import { ANAMORPH, Anamorphosis } from './Anamorphosis';
import { CheckerShadow } from './CheckerShadow';
import { HollowFace } from './HollowFace';
import { PenroseTriangle } from './PenroseTriangle';
import { PosterExhibit } from './PosterExhibit';

const WALL_X = 8.85; // 古典の間の壁の内面

function meta(
  id: string,
  x: number,
  z: number,
  facing: number,
  triggerRadius: number,
  viewDistance: number,
  pitch = 0,
): ExhibitMeta {
  const position = new THREE.Vector3(x, 0, z);
  return {
    id,
    room: 'classic',
    position,
    facing,
    triggerRadius,
    viewpoint: viewpointInFront(position, facing, viewDistance, pitch),
  };
}

/** 古典の間の展示。配置は classicHall.ts の部屋(x ±9、z ±7)に合わせる */
export const classicDefinitions: ExhibitDefinition[] = [
  {
    id: 'ames-room',
    room: 'classic',
    create: () => {
      const position = new THREE.Vector3(5.0, 0, -1.2);
      const facing = Math.PI;
      return new AmesRoom({
        id: 'ames-room',
        room: 'classic',
        position,
        facing,
        triggerRadius: 3.2,
        viewpoint: { position: new THREE.Vector3(5.0, 0, -1.2 + 0.6), yaw: 0, pitch: 0 },
      });
    },
  },
  {
    id: 'penrose-triangle',
    room: 'classic',
    create: () => {
      const m = { position: new THREE.Vector3(-4.5, 0, -4.6), facing: Math.PI };
      const viewpoint = PenroseTriangle.viewpointFor(m);
      return new PenroseTriangle({
        id: 'penrose-triangle',
        room: 'classic',
        position: m.position,
        facing: m.facing,
        triggerRadius: 3.2,
        // 視点は 5.5 m 離れているので、判定の中心を視点と展示の中間に置く
        triggerCenter: m.position.clone().lerp(viewpoint.position, 0.5),
        viewpoint,
      });
    },
  },
  {
    id: 'checker-shadow',
    room: 'classic',
    create: () => new CheckerShadow(meta('checker-shadow', 7.2, 3.6, Math.PI / 2, 2.8, 1.9, -0.28)),
  },
  {
    id: 'muller-lyer',
    room: 'classic',
    create: () =>
      new PosterExhibit(meta('muller-lyer', -WALL_X, 3.6, -Math.PI / 2, 2.6, 2.2), {
        base: drawMullerLyer,
        guide: drawMullerLyerGuide,
      }),
  },
  {
    id: 'cafe-wall',
    room: 'classic',
    create: () =>
      new PosterExhibit(meta('cafe-wall', -WALL_X, 0, -Math.PI / 2, 2.6, 2.2), {
        base: drawCafeWall,
        guide: drawCafeWallGuide,
      }),
  },
  {
    id: 'ebbinghaus',
    room: 'classic',
    create: () =>
      new PosterExhibit(meta('ebbinghaus', -WALL_X, -3.6, -Math.PI / 2, 2.6, 2.2), {
        base: drawEbbinghaus,
        guide: drawEbbinghausGuide,
      }),
  },
  {
    id: 'hollow-face',
    room: 'classic',
    create: () => new HollowFace(meta('hollow-face', 2.5, 6.85, 0, 2.3, 2.0)),
  },
  {
    id: 'anamorphosis',
    room: 'classic',
    create: () => {
      // 南の壁の内面。絵は壁から部屋側(-z)へ床に広がり、視点は壁から 4.6 m の位置
      const position = new THREE.Vector3(-4.2, 0, 6.85);
      const facing = 0;
      const viewpoint = viewpointInFront(position, facing, ANAMORPH.eye.z, -0.08);
      return new Anamorphosis({
        id: 'anamorphosis',
        room: 'classic',
        position,
        facing,
        triggerRadius: 1.6,
        triggerCenter: viewpoint.position.clone(),
        viewpoint,
      });
    },
  },
];
