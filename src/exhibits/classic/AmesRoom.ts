import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { createFigure } from '../../procedural/figure';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect } from '../HintEffect';
import { CameraOrbit } from '../effects/CameraOrbit';
import { MaterialSwap } from '../effects/MaterialSwap';
import { WireframeReveal } from '../effects/WireframeReveal';
import {
  DEFAULT_AMES,
  amesTransform,
  apparentEdges,
  figureApparentPositions,
  realBounds,
  realQuads,
  type AmesParams,
} from './amesGeometry';

/**
 * C1 エイムズの部屋。
 * 覗き窓(推奨視点)からは直方体に見えるが、実際は左奥が右奥の 2 倍遠い台形の部屋。
 * 同じ大きさの人形が左右の隅に立ち、右の人形が大きく見える。
 */
export class AmesRoom extends BaseExhibit {
  readonly params: AmesParams = DEFAULT_AMES;

  protected build(ctx: LoadContext): void {
    const p = this.params;
    const quads = realQuads(p);

    // 四角形をひとつのジオメトリにまとめる(頂点色、両面)
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    for (const quad of quads) {
      const [a, b, c, d] = quad.points;
      color.setHex(quad.color);
      for (const v of [a, b, c, a, c, d]) {
        positions.push(v.x, v.y, v.z);
        colors.push(color.r, color.g, color.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const roomMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const room = new THREE.Mesh(geo, roomMat);
    room.castShadow = true;
    room.receiveShadow = true;
    room.name = 'amesRoom';
    this.object.add(room);

    // 部屋の中の照明(覗き窓からの見え方を明るく保つ)
    const inner = new THREE.PointLight(0xfff3e2, 6, 6, 2);
    const center = amesTransform({ x: 0, y: p.ceilY - 0.2, z: -p.depth / 2 }, p.eye, p.skew);
    inner.position.copy(center);
    this.object.add(inner);

    // 同じ身長の人形を左右の隅に(実際の床の高さに置く)
    const ticks: THREE.Line[] = [];
    const [left, right] = figureApparentPositions(p);
    for (const [i, ap] of [left, right].entries()) {
      const real = amesTransform(ap, p.eye, p.skew);
      const fig = createFigure(p.figureHeight, i === 0 ? 0x5b7fa6 : 0xa65b5b);
      fig.position.copy(real);
      // 覗き窓の方を向かせる
      fig.rotation.y = Math.atan2(p.eye.x - real.x, p.eye.z - real.z);
      this.object.add(fig);

      // 種明かし用: 同じ長さの目盛り
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(real.x + (i === 0 ? 0.25 : -0.25), real.y, real.z),
        new THREE.Vector3(real.x + (i === 0 ? 0.25 : -0.25), real.y + p.figureHeight, real.z),
      ]);
      const tick = new THREE.Line(
        tickGeo,
        new THREE.LineBasicMaterial({
          color: 0xff7a1a,
          transparent: true,
          opacity: 0,
          depthTest: false,
        }),
      );
      tick.renderOrder = 11;
      this.object.add(tick);
      ticks.push(tick);
    }

    // 見かけの直方体の辺を歪めた「本当の辺」。壁越しに見せる
    const edgePts: THREE.Vector3[] = [];
    for (const [a, b] of apparentEdges(p)) {
      edgePts.push(amesTransform(a, p.eye, p.skew), amesTransform(b, p.eye, p.skew));
    }
    const edges = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(edgePts),
      new THREE.LineBasicMaterial({
        color: 0x2a9df4,
        transparent: true,
        opacity: 0,
        depthTest: false,
      }),
    );
    edges.renderOrder = 10;
    this.object.add(edges);

    // 通行止め(部屋の実際の範囲)
    const b = realBounds(p);
    this.addLocalCollider(
      (b.min.x + b.max.x) / 2,
      (b.min.y + b.max.y) / 2,
      (b.min.z + b.max.z) / 2,
      b.max.x - b.min.x + 0.1,
      b.max.y - b.min.y,
      b.max.z - b.min.z + 0.1,
    );

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(1.9, 0, 0.9);
    this.object.add(caption);

    const wire = new WireframeReveal([], { throughWalls: true, durationMs: 1400 });
    wire.addLine(edges);
    for (const t of ticks) wire.addLine(t);
    const roomCenter = this.toWorld(
      (b.min.x + b.max.x) / 2,
      (b.min.y + b.max.y) / 2,
      (b.min.z + b.max.z) / 2,
    );
    this.setHint(
      new CompositeHintEffect(
        [
          new CameraOrbit(ctx.player, {
            target: roomCenter,
            sweep: 1.1,
            lift: 1.9,
            radiusScale: 1.35,
            durationMs: 2600,
          }),
          new MaterialSwap([room], { opacity: 0.35 }, { durationMs: 1400 }),
          wire,
        ],
        { durationMs: 2600 },
      ),
    );
  }
}
