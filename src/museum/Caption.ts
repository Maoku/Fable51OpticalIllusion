import * as THREE from 'three';
import { exhibitTexts } from '../content/exhibits.ja';
import { makeCanvasTexture } from '../procedural/textures';
import { getMaterials } from './materials';

export const CAPTION_FONT =
  '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif';

export interface CaptionOptions {
  /** プレートの幅(m) */
  width?: number;
  /** 床からプレート中心までの高さ */
  height?: number;
  /** 傾き(ラジアン)。0 で鉛直 */
  tilt?: number;
  /** スタンド付きにする(壁掛けなら false) */
  stand?: boolean;
}

/** 展示キャプションプレートのテクスチャを描く */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  size: number,
  title: string,
  subtitle: string,
  number?: string,
): void {
  const w = size;
  const h = size / 2;
  ctx.fillStyle = '#f4f1ec';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1d1b18';
  ctx.textBaseline = 'top';
  if (number) {
    ctx.font = `500 ${size * 0.05}px ${CAPTION_FONT}`;
    ctx.fillStyle = 'rgba(29, 27, 24, 0.55)';
    ctx.fillText(number, size * 0.06, size * 0.06);
  }
  ctx.fillStyle = '#1d1b18';
  ctx.font = `700 ${size * 0.085}px ${CAPTION_FONT}`;
  ctx.fillText(title, size * 0.06, size * 0.13);
  ctx.font = `400 ${size * 0.05}px ${CAPTION_FONT}`;
  ctx.fillStyle = 'rgba(29, 27, 24, 0.75)';
  wrapText(ctx, subtitle, size * 0.06, size * 0.27, w - size * 0.12, size * 0.07);
  ctx.fillStyle = '#b08d63';
  ctx.fillRect(size * 0.06, h - size * 0.045, size * 0.2, size * 0.008);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  let line = '';
  let yy = y;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

/** キャプションプレート。ローカル +z が正面 */
export function createCaption(
  title: string,
  subtitle: string,
  opts: CaptionOptions & { number?: string } = {},
): THREE.Group {
  const width = opts.width ?? 0.36;
  const height = opts.height ?? 1.0;
  const tilt = opts.tilt ?? THREE.MathUtils.degToRad(-25);
  const stand = opts.stand ?? true;
  const group = new THREE.Group();
  group.name = 'caption';

  const canvas = makeCanvasTexture(
    (ctx, size) => {
      // 2:1 のプレートなので下半分は使わない
      ctx.clearRect(0, 0, size, size);
      drawCaption(ctx, size, title, subtitle, opts.number);
    },
    { size: 512, anisotropy: 8 },
  );
  canvas.repeat.set(1, 0.5);
  canvas.offset.set(0, 0.5);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(width, width / 2, 0.008), [
    getMaterials().matteBlack,
    getMaterials().matteBlack,
    getMaterials().matteBlack,
    getMaterials().matteBlack,
    new THREE.MeshStandardMaterial({ map: canvas, roughness: 0.6 }),
    getMaterials().matteBlack,
  ]);
  plate.position.y = height;
  plate.rotation.x = tilt;
  plate.castShadow = true;
  group.add(plate);

  if (stand) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, height, 12),
      getMaterials().matteBlack,
    );
    post.position.y = height / 2;
    post.castShadow = true;
    group.add(post);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.02, 24),
      getMaterials().matteBlack,
    );
    base.position.y = 0.01;
    group.add(base);
  }
  return group;
}

/** 展示 id の文言からキャプションを作る */
export function createCaptionFor(id: string, opts: CaptionOptions = {}): THREE.Group {
  const text = exhibitTexts[id];
  const title = text?.title ?? id;
  const subtitle = text?.subtitle ?? '';
  return createCaption(title, subtitle, { ...opts, number: text?.number });
}
