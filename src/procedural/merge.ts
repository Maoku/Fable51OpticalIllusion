import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * 色違いの小物を 1 つのメッシュにまとめるバッチ。
 * 色は頂点色として焼き込み、マテリアルは vertexColors で 1 つにする(描画回数の削減)。
 */
export class MeshBatch {
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly color = new THREE.Color();

  add(
    geometry: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    position: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: THREE.Vector3,
  ): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    const count = g.attributes.position!.count;
    const colors = new Float32Array(count * 3);
    this.color.set(color);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = this.color.r;
      colors[i * 3 + 1] = this.color.g;
      colors[i * 3 + 2] = this.color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Matrix4().compose(
      position,
      new THREE.Quaternion().setFromEuler(rotation ?? new THREE.Euler()),
      scale ?? new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    this.geos.push(g);
    if (geometry.index) geometry.dispose();
  }

  /** まとめたメッシュを作る。何も追加されていなければ null */
  build(material: THREE.MeshStandardMaterial): THREE.Mesh | null {
    if (this.geos.length === 0) return null;
    const merged = mergeGeometries(this.geos, false);
    for (const g of this.geos) g.dispose();
    this.geos.length = 0;
    if (!merged) return null;
    material.vertexColors = true;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}
