import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import type { Drawer } from '../../procedural/illusions';
import { makeCanvasTexture } from '../../procedural/textures';
import { BaseExhibit, type ExhibitMeta, type LoadContext } from '../Exhibit';
import { GuideOverlay } from '../effects/GuideOverlay';

export interface PosterOptions {
  base: Drawer;
  guide: Drawer;
  /** ポスターの一辺(正方形、m) */
  size?: number;
  /** ポスター中心の高さ */
  height?: number;
  textureSize?: number;
  /** 元図を薄くする割合 */
  dimBase?: number;
}

/** Canvas 生成テクスチャの額装ポスター。ヒントは GuideOverlay で補助線を重ねる */
export class PosterExhibit extends BaseExhibit {
  constructor(
    meta: ExhibitMeta,
    private readonly opts: PosterOptions,
  ) {
    super(meta);
  }

  protected build(ctx: LoadContext): void {
    const size = this.opts.size ?? 1.1;
    const height = this.opts.height ?? 1.55;
    const texSize = Math.min(
      this.opts.textureSize ?? 1024,
      ctx.quality.tier === 'low' ? 1024 : 2048,
    );
    const mats = getMaterials();

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(size + 0.1, size + 0.1, 0.05),
      mats.matteBlack,
    );
    frame.position.set(0, height, 0.025);
    frame.castShadow = true;
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(size + 0.04, size + 0.04, 0.01),
      new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: 1 }),
    );
    mat.position.set(0, height, 0.052);
    const base = makeCanvasTexture(this.opts.base, { size: texSize, anisotropy: 8 });
    const guide = makeCanvasTexture(this.opts.guide, { size: texSize, anisotropy: 8 });
    // 図版は無灯マテリアルで描く。錯視は色・輝度の正確さに依存し、補助線の重ねと色も一致させたい
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: base, toneMapped: false }),
    );
    poster.position.set(0, height, 0.058);
    this.object.add(frame, mat, poster);

    const caption = createCaptionFor(this.meta.id, { stand: false, tilt: 0, height: 0 });
    caption.position.set(size / 2 + 0.32, height - size / 2 + 0.1, 0.02);
    this.object.add(caption);

    this.setHint(new GuideOverlay(poster, guide, { dimBase: this.opts.dimBase ?? 0 }));
  }
}
