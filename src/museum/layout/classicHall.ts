import type { RoomSpec } from './types';

/** 古典の間。入口から見て手前の部屋。北側(-z)のドアで回廊へ繋がる */
export const classicHallSpec: RoomSpec = {
  id: 'classic',
  name: '古典の間',
  bounds: { minX: -9, maxX: 9, minZ: -7, maxZ: 7 },
  height: 4,
  openings: [{ side: 'north', center: 0, width: 3, height: 3 }],
  lights: [
    { x: -4.5, z: -3 },
    { x: 4.5, z: -3 },
    { x: -4.5, z: 3 },
    { x: 4.5, z: 3 },
  ],
};

/** 入館時の位置と向き(yaw 0 = -z を向く) */
export const classicSpawn = { x: 0, z: 5, yaw: 0 };
