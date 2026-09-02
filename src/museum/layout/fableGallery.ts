import type { RoomSpec } from './types';

/** Fable の間。天井高 6 m。南側(+z)のドアで回廊へ繋がる */
export const fableGallerySpec: RoomSpec = {
  id: 'fable',
  name: 'Fable の間',
  bounds: { minX: -10, maxX: 10, minZ: -39, maxZ: -19 },
  height: 6,
  wall: 'concrete',
  skylight: { minX: -1.6, maxX: 1.6, minZ: -36.5, maxZ: -21.5, depth: 1.2 },
  openings: [{ side: 'south', center: 0, width: 3, height: 3.5 }],
  floor: { maxZ: -19.15 },
  lights: [
    { x: -6, z: -23.5, drop: 1.8, intensity: 10 },
    { x: 6, z: -23.5, drop: 1.8, intensity: 10 },
    { x: -6, z: -34.5, drop: 1.8, intensity: 10 },
    { x: 6, z: -34.5, drop: 1.8, intensity: 10 },
  ],
};
