import type { RoomSpec } from './types';

/** Fable の間。天井高 6 m。南側(+z)のドアで回廊へ繋がる */
export const fableGallerySpec: RoomSpec = {
  id: 'fable',
  name: 'Fable の間',
  bounds: { minX: -10, maxX: 10, minZ: -39, maxZ: -19 },
  height: 6,
  openings: [{ side: 'south', center: 0, width: 3, height: 3.5 }],
  floor: { maxZ: -19.15 },
  lights: [
    { x: -5, z: -24, drop: 1.5 },
    { x: 5, z: -24, drop: 1.5 },
    { x: -5, z: -34, drop: 1.5 },
    { x: 5, z: -34, drop: 1.5 },
  ],
};
