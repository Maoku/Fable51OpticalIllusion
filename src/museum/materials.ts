import * as THREE from 'three';
import {
  createConcreteTexture,
  createOakFloorTexture,
  createPlasterTexture,
} from '../procedural/textures';

export interface MuseumMaterials {
  plaster: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  oakFloor: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  /** 展示台などのマット白 */
  matteWhite: THREE.MeshStandardMaterial;
  /** キャプションプレートなどの黒 */
  matteBlack: THREE.MeshStandardMaterial;
  /** 天窓の空(発光) */
  sky: THREE.MeshBasicMaterial;
  /** 窓ガラス */
  glass: THREE.MeshPhysicalMaterial;
}

let cached: MuseumMaterials | null = null;

/** 館内共通のマテリアル。白い漆喰、打放しコンクリート、オーク材の床 */
export function getMaterials(): MuseumMaterials {
  if (cached) return cached;
  const plasterTex = createPlasterTexture();
  const concreteTex = createConcreteTexture();
  const oakTex = createOakFloorTexture();
  cached = {
    plaster: new THREE.MeshStandardMaterial({
      color: 0xf6f3ee,
      map: plasterTex,
      roughness: 0.95,
      metalness: 0,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0xb5b3ae,
      map: concreteTex,
      roughness: 0.85,
      metalness: 0,
    }),
    oakFloor: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: oakTex,
      roughness: 0.55,
      metalness: 0,
    }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xf8f6f2, roughness: 1, metalness: 0 }),
    matteWhite: new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.7, metalness: 0 }),
    matteBlack: new THREE.MeshStandardMaterial({ color: 0x1d1b18, roughness: 0.6, metalness: 0.1 }),
    sky: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcfe3f5).multiplyScalar(2.2) }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdfe9ee,
      transparent: true,
      opacity: 0.12,
      roughness: 0.05,
      metalness: 0,
      depthWrite: false,
    }),
  };
  return cached;
}
