import type * as THREE from 'three';

/** フォグを効かせたくないマテリアルに立てる印(書き割りなど) */
export interface FogAwareMaterial extends THREE.Material {
  fog?: boolean;
}

function materialsOf(object: THREE.Object3D): THREE.Material[] {
  const mesh = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
  if (!mesh.material) return [];
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * three.js のフォグはシーン全体に掛かるので、効かせたい範囲を絞る。
 * `scopes` の配下にあるマテリアルだけ `fog` を残し、それ以外では切る。
 *
 * `material.userData.noFog` が立っているものは、範囲の中でも切る(空や遠山の
 * 書き割りは、それ自体が霞を描いた絵なので二重に掛けない)。
 *
 * `fog` はシェーダの define なので、切り替えるとプログラムを作り直すことになる。
 * 展示を全部読み込んだ直後、シェーダを用意する前に 1 回だけ呼ぶこと。
 */
export function applyFogScope(scene: THREE.Scene, scopes: readonly THREE.Object3D[]): void {
  const inScope = new Set<THREE.Material>();
  for (const root of scopes) {
    root.traverse((o) => {
      for (const m of materialsOf(o)) inScope.add(m);
    });
  }
  scene.traverse((o) => {
    for (const m of materialsOf(o)) {
      const mat = m as FogAwareMaterial;
      if (mat.fog === undefined) continue;
      const want = inScope.has(m) && mat.userData?.noFog !== true;
      if (mat.fog !== want) {
        mat.fog = want;
        mat.needsUpdate = true;
      }
    }
  });
}
