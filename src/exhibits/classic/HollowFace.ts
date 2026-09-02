import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import { faceHeight } from '../../procedural/face';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect } from '../HintEffect';
import { CameraOrbit } from '../effects/CameraOrbit';
import { SectionCut } from '../effects/SectionCut';

export const FACE = { width: 0.56, height: 0.76, relief: 0.13, segments: 72 };

/** 顔のレリーフ。sign = +1 で凸(通常)、-1 で凹(くぼんだ顔) */
export function createFaceGeometry(sign: 1 | -1): THREE.BufferGeometry {
  const { width, height, relief, segments } = FACE;
  const geo = new THREE.PlaneGeometry(
    width,
    height,
    segments,
    Math.round((segments * height) / width),
  );
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (width / 2);
    const v = pos.getY(i) / (height / 2);
    pos.setZ(i, sign * faceHeight(u, v) * relief);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * C7 くぼんだ顔。
 * 顔の型を裏返した凹面。正面から見ると、脳が「顔は凸」と思い込むため
 * 普通の顔のように見え、歩くと顔がこちらを向いて回るように感じる。
 */
export class HollowFace extends BaseExhibit {
  protected build(ctx: LoadContext): void {
    const mats = getMaterials();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.06), mats.matteBlack);
    panel.position.set(0, 1.55, 0.03);
    this.object.add(panel);

    const skin = new THREE.MeshStandardMaterial({
      color: 0xe7d9cb,
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    const hollow = new THREE.Mesh(createFaceGeometry(-1), skin);
    // くぼみの最深部が板の面に触れ、縁が手前に出るように置く(板の中に埋もれないように)
    const depth = FACE.relief * 1.02;
    hollow.position.set(0, 1.55, 0.06 + depth);
    hollow.castShadow = true;
    this.object.add(hollow);
    // 型の縁: くぼみの周りを浅い箱で囲う
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xcfc6ba, roughness: 0.9 });
    const fw = FACE.width;
    const fh = FACE.height;
    const bw = 0.04;
    const bar = (w: number, h: number, x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), frameMat);
      m.position.set(x, 1.55 + y, 0.06 + depth / 2);
      this.object.add(m);
      return m;
    };
    const bars = [
      bar(fw + 2 * bw, bw, 0, fh / 2 + bw / 2),
      bar(fw + 2 * bw, bw, 0, -fh / 2 - bw / 2),
      bar(bw, fh, -fw / 2 - bw / 2, 0),
      bar(bw, fh, fw / 2 + bw / 2, 0),
    ];

    // 上からのスポット(通常の展示照明)。凹面なので陰影が反転し、脳がそれを凸として解釈する
    const spot = new THREE.SpotLight(0xfff1dc, 26, 6, Math.PI / 8, 0.5, 1.6);
    spot.position.set(0.25, 3.2, 1.2);
    spot.target = hollow;
    this.object.add(spot);

    const caption = createCaptionFor(this.meta.id, { stand: false, tilt: 0, height: 0 });
    caption.position.set(0.85, 1.05, 0.02);
    this.object.add(caption);

    // 種明かし: 横へ回り込み、断面で凹みを見せる
    const center = this.toWorld(0, 1.55, 0.02);
    const right = this.rightDir;
    // 鑑賞者から見て左半分を消し、カメラを左へ回す
    const normal = right.clone();
    const startPt = center.clone().addScaledVector(normal, -FACE.width);
    // 回転の向き: 正の sweep でカメラが -right 側へ動くなら正
    const f = this.frontDir;
    const rotated = new THREE.Vector3(
      f.x * Math.cos(0.1) + f.z * Math.sin(0.1),
      0,
      -f.x * Math.sin(0.1) + f.z * Math.cos(0.1),
    );
    const sweepSign = rotated.dot(right) < 0 ? 1 : -1;
    this.setHint(
      new CompositeHintEffect(
        [
          new CameraOrbit(ctx.player, {
            target: center,
            sweep: sweepSign * 1.25,
            lift: 0.1,
            radiusScale: 0.75,
            durationMs: 2200,
          }),
          new SectionCut([hollow, ...bars], {
            normal,
            start: startPt,
            end: center.clone(),
            durationMs: 2200,
          }),
        ],
        { durationMs: 2200 },
      ),
    );
  }
}
