export type RoomId = 'classic' | 'corridor' | 'fable';
export type Side = 'north' | 'south' | 'east' | 'west';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** 壁の開口(ドア・窓)。`center` は壁に沿った座標(北・南壁は x、東・西壁は z) */
export interface Opening {
  side: Side;
  center: number;
  width: number;
  height: number;
  /** 床からの高さ。ドアは 0、窓は腰の高さ */
  bottom?: number;
  /** 窓ガラスを入れるか(通り抜け不可) */
  glazed?: boolean;
}

export interface LightSpot {
  x: number;
  z: number;
  /** 天井からの下げ幅(m) */
  drop?: number;
  intensity?: number;
  color?: number;
}

export interface RoomSpec {
  id: RoomId;
  name: string;
  bounds: Bounds;
  height: number;
  wallThickness?: number;
  openings: Opening[];
  /** 壁を作らない辺(隣室の壁を共有する) */
  openSides?: Side[];
  /** 床の範囲(省略時は bounds を壁厚の半分だけ広げる) */
  floor?: Partial<Bounds>;
  lights: LightSpot[];
}
