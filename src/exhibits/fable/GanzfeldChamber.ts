import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect, type HintEffect } from '../HintEffect';
import { LightChange } from '../effects/LightChange';
import { TransformLerp } from '../effects/TransformLerp';
import { WireframeReveal } from '../effects/WireframeReveal';

export const GANZFELD = { width: 5, depth: 4.2, height: 3.2, doorWidth: 1.6, doorHeight: 2.4 };

/**
 * F3 色の部屋。
 * 均一な光で満たされた部屋。壁・床・天井は無灯の同一色で塗られ、陰影も稜線も見えないため奥行きが消える。
 * 2 枚の同じ灰色の板は、それぞれ暖色・寒色の光に照らされ、別の色に見える。
 */
export class GanzfeldChamber extends BaseExhibit {
  private surfaces: THREE.MeshBasicMaterial | null = null;
  private elapsed = 0;
  /** 種明かしの進行度。1 で白色光になる */
  private hintT = 0;
  private readonly tmpColor = new THREE.Color();

  protected build(_ctx: LoadContext): void {
    const G = GANZFELD;
    const mats = getMaterials();
    const hw = G.width / 2;
    const t = 0.12;

    // 内装: 無灯マテリアル(色は毎フレーム更新)
    const surfaces = new THREE.MeshBasicMaterial({ color: 0xe9d9d0, toneMapped: false });
    this.surfaces = surfaces;
    const parts: THREE.Mesh[] = [];
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surfaces);
      mesh.position.set(x, y, z);
      this.object.add(mesh);
      parts.push(mesh);
      return mesh;
    };
    box(G.width + 2 * t, t, G.depth + 2 * t, 0, -t / 2 + 0.01, -G.depth / 2);
    box(G.width + 2 * t, t, G.depth + 2 * t, 0, G.height + t / 2, -G.depth / 2);
    box(G.width + 2 * t, G.height, t, 0, G.height / 2, -G.depth - t / 2);
    box(t, G.height, G.depth, -hw - t / 2, G.height / 2, -G.depth / 2);
    box(t, G.height, G.depth, hw + t / 2, G.height / 2, -G.depth / 2);
    const side = (G.width - G.doorWidth) / 2;
    box(side, G.height, t, -hw + side / 2, G.height / 2, t / 2);
    box(side, G.height, t, hw - side / 2, G.height / 2, t / 2);
    box(
      G.doorWidth,
      G.height - G.doorHeight,
      t,
      0,
      G.doorHeight + (G.height - G.doorHeight) / 2,
      t / 2,
    );
    // 外側は普通の壁材で覆う(外から見たときの見た目)
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(G.width + 2 * t + 0.02, G.height + t + 0.02, G.depth + 2 * t + 0.02),
      new THREE.MeshStandardMaterial({
        color: 0xd9d6d1,
        map: mats.concrete.map,
        roughness: 0.9,
        side: THREE.BackSide,
      }),
    );
    shell.position.set(0, (G.height + t) / 2, -G.depth / 2);
    shell.visible = false; // 内側からしか見えない箱の裏面は不要
    this.object.add(shell);

    // 通行止め
    this.addLocalCollider(0, 1.6, -G.depth - 0.1, G.width + 0.5, 3.2, 0.3);
    this.addLocalCollider(-hw - 0.1, 1.6, -G.depth / 2, 0.3, 3.2, G.depth);
    this.addLocalCollider(hw + 0.1, 1.6, -G.depth / 2, 0.3, 3.2, G.depth);
    this.addLocalCollider(-hw + side / 2, 1.6, 0, side, 3.2, 0.3);
    this.addLocalCollider(hw - side / 2, 1.6, 0, side, 3.2, 0.3);

    // 2 枚の同じ灰色の板
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.85 });
    const boards: THREE.Group[] = [];
    const lamps: THREE.SpotLight[] = [];
    for (const [i, x] of [-1.3, 1.3].entries()) {
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.03), boardMat);
      board.position.y = 1.35;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.9, 10),
        mats.matteBlack,
      );
      post.position.y = 0.45;
      const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.02, 24),
        mats.matteBlack,
      );
      foot.position.y = 0.01;
      g.add(board, post, foot);
      g.position.set(x, 0, -2.6);
      this.object.add(g);
      boards.push(g);
      this.addLocalCollider(x, 0.9, -2.6, 0.5, 1.8, 0.4);

      // 暖色 / 寒色のスポット(板だけを照らす。内装は無灯なので光の輪は見えない)
      const lamp = new THREE.SpotLight(
        i === 0 ? 0xffb27a : 0x7fb0ff,
        14,
        5,
        Math.PI / 10,
        0.7,
        1.5,
      );
      lamp.position.set(x * 0.8, G.height - 0.2, -1.4);
      lamp.target = board;
      this.object.add(lamp);
      lamps.push(lamp);
    }

    // 種明かし用: 稜線
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(G.width, G.height, G.depth)),
      new THREE.LineBasicMaterial({
        color: 0x2a9df4,
        transparent: true,
        opacity: 0,
        depthTest: false,
      }),
    );
    edges.position.set(0, G.height / 2, -G.depth / 2);
    edges.renderOrder = 11;
    this.object.add(edges);

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(hw + 0.5, 0, 0.6);
    this.object.add(caption);

    const whiten: HintEffect = {
      durationMs: 1400,
      lockViewpoint: false,
      apply: (t) => {
        this.hintT = t;
      },
    };
    const wire = new WireframeReveal([], { durationMs: 1400 }).addLine(edges);
    this.setHint(
      new CompositeHintEffect(
        [
          whiten,
          wire,
          new LightChange(
            lamps.map((l) => ({ light: l, target: { color: 0xffffff } })),
            { durationMs: 1400 },
          ),
          new TransformLerp(
            [
              { object: boards[0]!, position: new THREE.Vector3(-0.4, 0, -2.6) },
              { object: boards[1]!, position: new THREE.Vector3(0.4, 0, -2.6) },
            ],
            { durationMs: 1400 },
          ),
        ],
        { durationMs: 1400 },
      ),
    );
  }

  override update(delta: number): void {
    if (!this.surfaces) return;
    this.elapsed += delta;
    // 60 秒で暖色 → 寒色 → 暖色とゆっくり巡る淡い色
    const hue = 0.08 + 0.5 * (0.5 - 0.5 * Math.cos((this.elapsed / 60) * Math.PI * 2));
    this.tmpColor.setHSL(hue, 0.35, 0.82);
    this.tmpColor.lerp(new THREE.Color(0xf4f2ee), this.hintT);
    this.surfaces.color.copy(this.tmpColor);
  }
}
