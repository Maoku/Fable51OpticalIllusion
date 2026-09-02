import * as THREE from 'three';
import { getMaterials } from './materials';

export interface PedestalOptions {
  width?: number;
  depth?: number;
  height?: number;
  material?: THREE.Material;
  /** 円柱にする */
  round?: boolean;
}

export interface PedestalResult {
  mesh: THREE.Mesh;
  /** ローカル座標での占有箱(中心と寸法) */
  box: { cx: number; cy: number; cz: number; sx: number; sy: number; sz: number };
  /** 天面の高さ */
  top: number;
}

/** 展示台。底面が y = 0 に来るように配置する */
export function createPedestal(opts: PedestalOptions = {}): PedestalResult {
  const width = opts.width ?? 0.6;
  const depth = opts.depth ?? 0.6;
  const height = opts.height ?? 1.0;
  const material = opts.material ?? getMaterials().matteWhite;
  const geo = opts.round
    ? new THREE.CylinderGeometry(width / 2, width / 2, height, 32)
    : new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'pedestal';
  return {
    mesh,
    box: { cx: 0, cy: height / 2, cz: 0, sx: width, sy: height, sz: depth },
    top: height,
  };
}
