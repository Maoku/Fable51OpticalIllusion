import type { RoomSpec } from './types';

/**
 * 古典の間と Fable の間を結ぶ回廊。南北の壁は隣室の壁を共有する。
 * 東側(+x)の窓から F4「窓の外の庭」が見える。
 */
export const corridorSpec: RoomSpec = {
  id: 'corridor',
  name: '回廊',
  bounds: { minX: -2, maxX: 2, minZ: -18.85, maxZ: -7.15 },
  height: 3.5,
  openSides: ['north', 'south'],
  floor: { minZ: -19.15, maxZ: -7.15 },
  openings: [],
  lights: [
    { x: 0, z: -10 },
    { x: 0, z: -16 },
  ],
};
