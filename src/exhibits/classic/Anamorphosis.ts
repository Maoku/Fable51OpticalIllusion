import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { makeCanvasTexture } from '../../procedural/textures';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect } from '../HintEffect';
import { CameraOrbit } from '../effects/CameraOrbit';
import { Reveal } from '../effects/Reveal';
import { makeImagePlane, planePoint, surfaceToImage, type AnamorphPlane } from './anamorphGeometry';

export const ANAMORPH = {
  /** 視点(ローカル、足元は z = eyeZ) */
  eye: new THREE.Vector3(0, 1.6, 3.6),
  /** 見かけの画像の平面の中心と半幅 */
  planeCenter: new THREE.Vector3(0, 1.0, 1.5),
  half: 0.65,
  /** 床の絵の範囲(ローカル x ±、z 0..) と壁の絵の範囲(y 0..) */
  floorX: 2.2,
  floorZ: 2.9,
  wallY: 2.5,
};

/** 見かけの画像: 3 面を塗り分けた立方体 */
export function drawApparentImage(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.clearRect(0, 0, s, s);
  const c = s / 2;
  const r = s * 0.34;
  const pt = (a: number, k = 1) => [c + Math.cos(a) * r * k, c - Math.sin(a) * r * k] as const;
  const top = pt(Math.PI / 2);
  const ur = pt(Math.PI / 6);
  const lr = pt(-Math.PI / 6);
  const bottom = pt(-Math.PI / 2);
  const ll = pt(-Math.PI + Math.PI / 6);
  const ul = pt(Math.PI - Math.PI / 6);
  const face = (points: (readonly [number, number])[], color: string) => {
    ctx.beginPath();
    ctx.moveTo(points[0]![0], points[0]![1]);
    for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#1d1b18';
    ctx.lineWidth = s * 0.012;
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  face([top, ur, [c, c], ul], '#f2c94c'); // 上面(明)
  face([ul, [c, c], bottom, ll], '#c97b2c'); // 左面(中)
  face([[c, c], ur, lr, bottom], '#8a4b1f'); // 右面(暗)
}

/**
 * C8 アナモルフォーシス。
 * 床と壁にまたがる歪んだ絵が、足跡の位置から見たときだけ空中に浮かぶ立方体に見える。
 */
export class Anamorphosis extends BaseExhibit {
  protected build(ctx: LoadContext): void {
    const A = ANAMORPH;
    const eyeW = this.toWorld(A.eye.x, A.eye.y, A.eye.z);
    const centerW = this.toWorld(A.planeCenter.x, A.planeCenter.y, A.planeCenter.z);
    const plane: AnamorphPlane = makeImagePlane(eyeW, centerW, A.half);

    // 見かけの画像
    const src = document.createElement('canvas');
    src.width = 512;
    src.height = 512;
    const sctx = src.getContext('2d')!;
    drawApparentImage(sctx, 512);
    const srcData = sctx.getImageData(0, 0, 512, 512).data;
    const sample = (u: number, v: number): [number, number, number, number] => {
      const px = Math.min(511, Math.max(0, Math.floor(((u + 1) / 2) * 512)));
      const py = Math.min(511, Math.max(0, Math.floor(((1 - v) / 2) * 512)));
      const i = (py * 512 + px) * 4;
      return [srcData[i]!, srcData[i + 1]!, srcData[i + 2]!, srcData[i + 3]!];
    };

    // 床・壁の各テクセルを視点からのレイで逆写像して描く
    const texSize = ctx.quality.tier === 'low' ? 512 : 1024;
    const bake = (toWorldPoint: (a: number, b: number) => THREE.Vector3) =>
      makeCanvasTexture(
        (c, s) => {
          const img = c.createImageData(s, s);
          for (let py = 0; py < s; py++) {
            for (let px = 0; px < s; px++) {
              const a = (px + 0.5) / s;
              const b = 1 - (py + 0.5) / s;
              const uv = surfaceToImage(eyeW, toWorldPoint(a, b), plane);
              const i = (py * s + px) * 4;
              if (!uv || Math.abs(uv[0]) > 1 || Math.abs(uv[1]) > 1) continue;
              const [r, g, bb, al] = sample(uv[0], uv[1]);
              img.data[i] = r;
              img.data[i + 1] = g;
              img.data[i + 2] = bb;
              img.data[i + 3] = al;
            }
          }
          c.putImageData(img, 0, 0);
        },
        { size: texSize, anisotropy: 8 },
      );
    // 床の絵: ローカル x ∈ [-floorX, floorX]、z ∈ [0, floorZ](a → x、b → z が手前ほど大)
    const floorTex = bake((a, b) => this.toWorld((a * 2 - 1) * A.floorX, 0, (1 - b) * A.floorZ));
    const floorDecal = new THREE.Mesh(
      new THREE.PlaneGeometry(A.floorX * 2, A.floorZ),
      new THREE.MeshBasicMaterial({
        map: floorTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    floorDecal.rotation.x = -Math.PI / 2;
    floorDecal.position.set(0, 0.006, A.floorZ / 2);
    floorDecal.renderOrder = 1;
    this.object.add(floorDecal);
    // 壁の絵: ローカル x ∈ [-floorX, floorX]、y ∈ [0, wallY](壁面は z = 0)
    const wallTex = bake((a, b) => this.toWorld((a * 2 - 1) * A.floorX, b * A.wallY, 0));
    const wallDecal = new THREE.Mesh(
      new THREE.PlaneGeometry(A.floorX * 2, A.wallY),
      new THREE.MeshBasicMaterial({
        map: wallTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    wallDecal.position.set(0, A.wallY / 2, 0.012);
    wallDecal.renderOrder = 1;
    this.object.add(wallDecal);

    // 種明かし用: 空中の見かけの画像と、視点からのレイ
    const apparent = new THREE.Mesh(
      new THREE.PlaneGeometry(A.half * 2, A.half * 2),
      new THREE.MeshBasicMaterial({
        map: makeCanvasTexture(drawApparentImage, { size: 512 }),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    apparent.position.copy(this.object.worldToLocal(centerW.clone()));
    apparent.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(plane.right, plane.up, plane.normal),
    );
    apparent.renderOrder = 9;
    const rays: THREE.Vector3[] = [];
    for (const [u, v] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [0, 0],
    ] as const) {
      const q = planePoint(plane, u * 0.75, v * 0.75);
      const d = q.clone().sub(eyeW);
      // 面(床か壁)まで伸ばす
      let t = Infinity;
      if (d.y < 0) t = Math.min(t, -eyeW.y / d.y);
      const wallW = this.toWorld(0, 0, 0);
      const f = this.frontDir; // 壁の法線(鑑賞者側)
      const denom = d.dot(f);
      if (denom < 0) t = Math.min(t, wallW.clone().sub(eyeW).dot(f) / denom);
      if (!Number.isFinite(t)) t = 1;
      rays.push(eyeW.clone(), eyeW.clone().addScaledVector(d, t));
    }
    const rayLines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(
        rays.map((p) => this.object.worldToLocal(p.clone())),
      ),
      new THREE.LineBasicMaterial({
        color: 0x2a9df4,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    rayLines.renderOrder = 10;
    this.object.add(apparent, rayLines);

    const caption = createCaptionFor(this.meta.id, { stand: false, tilt: 0, height: 0 });
    caption.position.set(A.floorX + 0.35, 1.2, 0.02);
    this.object.add(caption);

    this.setHint(
      new CompositeHintEffect(
        [
          new CameraOrbit(ctx.player, {
            target: centerW,
            sweep: 0.95,
            lift: 0.9,
            radiusScale: 0.85,
            durationMs: 2400,
          }),
          new Reveal([apparent, rayLines], { durationMs: 1200 }),
        ],
        { durationMs: 2400 },
      ),
    );
  }

  override async load(ctx: LoadContext): Promise<void> {
    // worldToLocal を使うので先に行列を更新しておく
    this.object.updateMatrixWorld(true);
    await super.load(ctx);
  }
}
