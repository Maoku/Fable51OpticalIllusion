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
  openings: [
    // F4「窓の外の庭」を見る大窓(ガラス入り、通り抜け不可)
    { side: 'east', center: -13, width: 6.4, height: 1.9, bottom: 0.85, glazed: true },
  ],
  lights: [
    { x: 0, z: -9.5, intensity: 12 },
    { x: 0, z: -16.5, intensity: 12 },
  ],
};
