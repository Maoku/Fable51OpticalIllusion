import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect } from '../HintEffect';
import { LightChange } from '../effects/LightChange';
import { MaterialSwap } from '../effects/MaterialSwap';

export const POND = { outer: 2.6, inner: 2.2, rimHeight: 1.05, waterY: 1.0, basinFloor: 0.06 };

/**
 * F7 逆さの水面。
 * 静かな水盤に映る彫刻の「反射」が本物と違う形をしている。
 * 水面は半透明の板で、その下に逆さの別の彫刻を吊るしてある。
 */
export class InvertedPond extends BaseExhibit {
  protected build(_ctx: LoadContext): void {
    const mats = getMaterials();
    const P = POND;
    const stone = new THREE.MeshStandardMaterial({
      color: 0x8d8a85,
      map: mats.concrete.map,
      roughness: 0.9,
    });

    // 水盤(縁と内側)
    const rimShape = new THREE.Shape();
    const ho = P.outer / 2;
    const hi = P.inner / 2;
    rimShape.moveTo(-ho, -ho);
    rimShape.lineTo(ho, -ho);
    rimShape.lineTo(ho, ho);
    rimShape.lineTo(-ho, ho);
    rimShape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-hi, -hi);
    hole.lineTo(-hi, hi);
    hole.lineTo(hi, hi);
    hole.lineTo(hi, -hi);
    hole.closePath();
    rimShape.holes.push(hole);
    const rim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(rimShape, { depth: P.rimHeight, bevelEnabled: false }),
      stone,
    );
    rim.rotation.x = -Math.PI / 2;
    rim.castShadow = true;
    rim.receiveShadow = true;
    this.object.add(rim);
    const basinMat = new THREE.MeshStandardMaterial({
      color: 0x2b3238,
      roughness: 0.7,
      side: THREE.BackSide,
    });
    const basin = new THREE.Mesh(
      new THREE.BoxGeometry(P.inner, P.rimHeight - P.basinFloor, P.inner),
      basinMat,
    );
    basin.position.y = (P.rimHeight + P.basinFloor) / 2;
    this.object.add(basin);
    this.addLocalCollider(0, P.rimHeight / 2, 0, P.outer, P.rimHeight, P.outer);

    // 中央の島: 水面に浮かぶ薄い円盤と、それを支える細い柱(水面下の彫刻が柱に隠れないように)
    const island = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.08, 32), stone);
    island.position.y = P.waterY + 0.04;
    this.object.add(island);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, P.waterY, 12), stone);
    post.position.y = P.waterY / 2;
    this.object.add(post);

    // 本物の彫刻(水面の上): 積み重ねた立方体
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.5 });
    const upright = new THREE.Group();
    for (const [i, size] of [0.34, 0.26, 0.18].entries()) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), white);
      cube.position.y = [0.17, 0.34 + 0.13, 0.6 + 0.09][i]!;
      cube.rotation.y = i * 0.5;
      cube.castShadow = true;
      upright.add(cube);
    }
    upright.position.y = P.waterY + 0.08;
    this.object.add(upright);

    // 偽の「反射」(水面の下): 積み重ねた球を逆さに
    const ghost = new THREE.MeshStandardMaterial({
      color: 0xd9dde2,
      roughness: 0.35,
      metalness: 0.1,
    });
    const inverted = new THREE.Group();
    for (const [i, r] of [0.19, 0.14, 0.1].entries()) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), ghost);
      s.position.y = -[0.19, 0.38 + 0.14, 0.66 + 0.1][i]!;
      inverted.add(s);
    }
    inverted.position.y = P.waterY;
    this.object.add(inverted);

    // 水面: 半透明で映り込みのある板
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(P.inner, P.inner),
      new THREE.MeshPhysicalMaterial({
        color: 0x9fb6c4,
        transparent: true,
        opacity: 0.42,
        metalness: 0.55,
        roughness: 0.05,
        envMapIntensity: 1.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = P.waterY;
    water.renderOrder = 2;
    this.object.add(water);

    // 水盤の中の弱い光(偽の反射を薄く照らす)
    const under = new THREE.PointLight(0xbfd3e0, 4, 4, 1.8);
    under.position.set(0.5, P.waterY - 0.25, 0.5);
    this.object.add(under);
    const top = new THREE.SpotLight(0xfff3e4, 18, 6, Math.PI / 7, 0.5, 1.8);
    top.position.set(0.6, P.rimHeight + 2.6, 0.9);
    top.target = upright;
    this.object.add(top);

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(P.outer / 2 + 0.4, 0, 0.8);
    this.object.add(caption);

    this.setHint(
      new CompositeHintEffect(
        [
          new MaterialSwap([water], { opacity: 0.04 }, { durationMs: 1200 }),
          new LightChange([{ light: under, target: { intensity: 10, color: 0xffffff } }], {
            durationMs: 1200,
          }),
        ],
        { durationMs: 1200 },
      ),
    );
  }
}
