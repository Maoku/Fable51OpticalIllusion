import * as THREE from 'three';

export interface CanvasTextureOptions {
  size?: number;
  repeat?: [number, number];
  anisotropy?: number;
  srgb?: boolean;
}

/** Canvas を描画関数で塗り、three.js のテクスチャにする */
export function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  opts: CanvasTextureOptions = {},
): THREE.CanvasTexture {
  const size = opts.size ?? 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  tex.anisotropy = opts.anisotropy ?? 4;
  return tex;
}

/** 決定的な擬似乱数(テクスチャの再現性のため) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** オーク材の床板テクスチャ(1 タイル = 2 m × 2 m 相当) */
export function createOakFloorTexture(repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  return makeCanvasTexture(
    (ctx, size) => {
      const rand = mulberry32(7);
      const plankW = size / 8; // 8 枚 / 2 m = 25 cm 幅
      ctx.fillStyle = '#b48a5c';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 8; i++) {
        const x = i * plankW;
        const offset = rand() * size;
        let y = -offset;
        while (y < size) {
          const len = size * (0.6 + rand() * 0.7);
          const tone = 0.85 + rand() * 0.3;
          ctx.fillStyle = `rgb(${Math.round(176 * tone)}, ${Math.round(132 * tone)}, ${Math.round(86 * tone)})`;
          ctx.fillRect(x, y, plankW, len);
          // 木目
          ctx.strokeStyle = `rgba(80, 50, 20, ${0.08 + rand() * 0.08})`;
          ctx.lineWidth = 1;
          for (let g = 0; g < 6; g++) {
            const gx = x + rand() * plankW;
            ctx.beginPath();
            ctx.moveTo(gx, y);
            ctx.bezierCurveTo(gx + 4, y + len * 0.3, gx - 4, y + len * 0.6, gx + 2, y + len);
            ctx.stroke();
          }
          // 板の継ぎ目
          ctx.fillStyle = 'rgba(40, 25, 10, 0.35)';
          ctx.fillRect(x, y + len - 1, plankW, 2);
          y += len;
        }
        ctx.fillStyle = 'rgba(40, 25, 10, 0.4)';
        ctx.fillRect(x, 0, 1.5, size);
      }
    },
    { size: 512, repeat, anisotropy: 8 },
  );
}

/** 漆喰壁の微細なムラ */
export function createPlasterTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    (ctx, size) => {
      const rand = mulberry32(11);
      ctx.fillStyle = '#f2efe9';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 4000; i++) {
        const v = 235 + Math.floor(rand() * 20);
        ctx.fillStyle = `rgba(${v}, ${v - 2}, ${v - 6}, 0.35)`;
        const r = 1 + rand() * 6;
        ctx.beginPath();
        ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { size: 256, repeat: [4, 4] },
  );
}

/** 打放しコンクリート */
export function createConcreteTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    (ctx, size) => {
      const rand = mulberry32(23);
      ctx.fillStyle = '#a9a7a2';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 6000; i++) {
        const v = 140 + Math.floor(rand() * 60);
        ctx.fillStyle = `rgba(${v}, ${v}, ${v - 3}, 0.25)`;
        const r = 0.5 + rand() * 3;
        ctx.beginPath();
        ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 型枠の目地(セパ穴)
      ctx.fillStyle = 'rgba(60, 60, 58, 0.5)';
      for (let gx = 0; gx < 2; gx++) {
        for (let gy = 0; gy < 2; gy++) {
          ctx.beginPath();
          ctx.arc(size * (0.25 + gx * 0.5), size * (0.25 + gy * 0.5), 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(70, 70, 68, 0.35)';
      ctx.fillRect(0, size / 2 - 1, size, 2);
      ctx.fillRect(size / 2 - 1, 0, 2, size);
    },
    { size: 512, repeat: [2, 2] },
  );
}
