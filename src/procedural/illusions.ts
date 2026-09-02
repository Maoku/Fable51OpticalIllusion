/**
 * 古典錯視の 2D 図版を Canvas に描く関数群。
 * すべて (ctx, size) を受け取り、size × size の正方形に描く。
 */
export type Drawer = (ctx: CanvasRenderingContext2D, size: number) => void;

const PAPER = '#f4f1ec';
const INK = '#1d1b18';
const GUIDE = '#2a9df4';

function paper(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);
}

function dashed(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.strokeStyle = GUIDE;
  ctx.lineWidth = size * 0.006;
  ctx.setLineDash([size * 0.02, size * 0.014]);
  ctx.lineCap = 'butt';
}

// ---------- C4 ミュラー・リヤー ----------

export const MULLER_LYER = { x0: 0.28, x1: 0.72, y1: 0.36, y2: 0.64, fin: 0.07 };

export const drawMullerLyer: Drawer = (ctx, s) => {
  paper(ctx, s);
  const m = MULLER_LYER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = s * 0.012;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (y: number, outward: boolean) => {
    ctx.beginPath();
    ctx.moveTo(s * m.x0, s * y);
    ctx.lineTo(s * m.x1, s * y);
    ctx.stroke();
    for (const x of [m.x0, m.x1]) {
      // outward: 矢羽が外へ開く(> <)、inward: 内へ閉じる(< >)
      const dir = (x === m.x0 ? -1 : 1) * (outward ? 1 : -1);
      ctx.beginPath();
      ctx.moveTo(s * (x + dir * m.fin), s * (y - m.fin));
      ctx.lineTo(s * x, s * y);
      ctx.lineTo(s * (x + dir * m.fin), s * (y + m.fin));
      ctx.stroke();
    }
  };
  line(m.y1, true);
  line(m.y2, false);
};

export const drawMullerLyerGuide: Drawer = (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  const m = MULLER_LYER;
  dashed(ctx, s);
  for (const x of [m.x0, m.x1]) {
    ctx.beginPath();
    ctx.moveTo(s * x, s * (m.y1 - 0.12));
    ctx.lineTo(s * x, s * (m.y2 + 0.12));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = GUIDE;
  ctx.font = `600 ${s * 0.04}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('同じ長さ', s * 0.5, s * (m.y2 + 0.19));
};

// ---------- C5 カフェウォール ----------

export const CAFE_WALL = { rows: 9, cols: 10, mortar: 0.012, margin: 0.06 };

export const drawCafeWall: Drawer = (ctx, s) => {
  paper(ctx, s);
  const c = CAFE_WALL;
  const areaW = s * (1 - c.margin * 2);
  const tile = areaW / c.cols;
  const top = (s - tile * c.rows) / 2;
  ctx.fillStyle = '#8f8b84';
  ctx.fillRect(s * c.margin, top, areaW, tile * c.rows);
  const offsets = [0, 0.25, 0.5, 0.25, 0, -0.25, -0.5, -0.25, 0];
  const mortar = s * c.mortar;
  for (let r = 0; r < c.rows; r++) {
    const off = (offsets[r % offsets.length] ?? 0) * tile;
    for (let i = -1; i <= c.cols; i++) {
      const x = s * c.margin + i * tile + off;
      const dark = ((i % 2) + 2) % 2 === 0;
      ctx.fillStyle = dark ? INK : PAPER;
      const x0 = Math.max(x, s * c.margin);
      const x1 = Math.min(x + tile, s * c.margin + areaW);
      if (x1 <= x0) continue;
      ctx.fillRect(x0, top + r * tile + mortar / 2, x1 - x0, tile - mortar);
    }
  }
};

export const drawCafeWallGuide: Drawer = (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  const c = CAFE_WALL;
  const areaW = s * (1 - c.margin * 2);
  const tile = areaW / c.cols;
  const top = (s - tile * c.rows) / 2;
  ctx.strokeStyle = '#ff4d2e';
  ctx.lineWidth = s * 0.004;
  for (let r = 0; r <= c.rows; r++) {
    const y = top + r * tile;
    ctx.beginPath();
    ctx.moveTo(s * c.margin - s * 0.02, y);
    ctx.lineTo(s * (1 - c.margin) + s * 0.02, y);
    ctx.stroke();
  }
  // 右端に等間隔の目盛り
  ctx.strokeStyle = GUIDE;
  ctx.lineWidth = s * 0.005;
  const rx = s * (1 - c.margin) + s * 0.035;
  ctx.beginPath();
  ctx.moveTo(rx, top);
  ctx.lineTo(rx, top + tile * c.rows);
  ctx.stroke();
  for (let r = 0; r <= c.rows; r++) {
    const y = top + r * tile;
    ctx.beginPath();
    ctx.moveTo(rx - s * 0.012, y);
    ctx.lineTo(rx + s * 0.012, y);
    ctx.stroke();
  }
};

// ---------- C6 エビングハウス ----------

export const EBBINGHAUS = {
  left: { cx: 0.29, cy: 0.5, r: 0.045, ring: 0.165, count: 6, rr: 0.09 },
  right: { cx: 0.72, cy: 0.5, r: 0.045, ring: 0.078, count: 8, rr: 0.022 },
};

function ringCircles(side: typeof EBBINGHAUS.left): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < side.count; i++) {
    const a = (i / side.count) * Math.PI * 2 + Math.PI / 6;
    out.push({
      x: side.cx + Math.cos(a) * side.ring,
      y: side.cy + Math.sin(a) * side.ring,
      r: side.rr,
    });
  }
  return out;
}

export const drawEbbinghaus: Drawer = (ctx, s) => {
  paper(ctx, s);
  for (const side of [EBBINGHAUS.left, EBBINGHAUS.right]) {
    ctx.fillStyle = '#3b6ea5';
    for (const c of ringCircles(side)) {
      ctx.beginPath();
      ctx.arc(s * c.x, s * c.y, s * c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8842b';
    ctx.beginPath();
    ctx.arc(s * side.cx, s * side.cy, s * side.r, 0, Math.PI * 2);
    ctx.fill();
  }
};

export const drawEbbinghausGuide: Drawer = (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  // 周囲の円を紙の色で塗りつぶして消す
  ctx.fillStyle = PAPER;
  for (const side of [EBBINGHAUS.left, EBBINGHAUS.right]) {
    for (const c of ringCircles(side)) {
      ctx.beginPath();
      ctx.arc(s * c.x, s * c.y, s * c.r + s * 0.01, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  dashed(ctx, s);
  const { left, right } = EBBINGHAUS;
  for (const dy of [-left.r, left.r]) {
    ctx.beginPath();
    ctx.moveTo(s * (left.cx - 0.1), s * (left.cy + dy));
    ctx.lineTo(s * (right.cx + 0.1), s * (right.cy + dy));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = GUIDE;
  ctx.font = `600 ${s * 0.04}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('同じ大きさ', s * 0.5, s * 0.66);
};

// ---------- C3 チェッカーシャドウ ----------

export const CHECKER = {
  n: 5,
  margin: 0.09,
  light: 200,
  dark: 118,
  /** 影の中の明るいマスが、光の中の暗いマスと同じ値になる係数 */
  shadow: 118 / 200,
  a: { col: 2, row: 3 },
  b: { col: 3, row: 1 },
  cylinder: { col: 4.25, row: 0.75 },
  ellipse: { cx: 3.3, cy: 1.6, rx: 1.35, ry: 0.95, soft: 0.3 },
};

function checkerSquare(size: number): number {
  return (size * (1 - CHECKER.margin * 2)) / CHECKER.n;
}

/** マスの座標(列・行、単位はマス)から Canvas 座標へ */
export function checkerToCanvas(col: number, row: number, size: number): { x: number; y: number } {
  const sq = checkerSquare(size);
  return { x: size * CHECKER.margin + col * sq, y: size * CHECKER.margin + row * sq };
}

export function isLightSquare(col: number, row: number): boolean {
  return (col + row) % 2 === 0;
}

/** 影の係数(1 = 影なし) */
export function shadowFactor(col: number, row: number): number {
  const e = CHECKER.ellipse;
  const nx = (col - e.cx) / e.rx;
  const ny = (row - e.cy) / e.ry;
  const r = Math.hypot(nx, ny);
  if (r <= 1) return CHECKER.shadow;
  if (r >= 1 + e.soft) return 1;
  const t = (r - 1) / e.soft;
  return CHECKER.shadow + (1 - CHECKER.shadow) * t;
}

export const drawCheckerShadow: Drawer = (ctx, s) => {
  const c = CHECKER;
  const sq = checkerSquare(s);
  ctx.fillStyle = '#d8d3ca';
  ctx.fillRect(0, 0, s, s);
  // ピクセル単位で影の係数を掛けて描く(マスの中は一様、境界だけ柔らかく)
  const step = 4;
  for (let py = 0; py < s; py += step) {
    for (let px = 0; px < s; px += step) {
      const col = (px - s * c.margin) / sq;
      const row = (py - s * c.margin) / sq;
      const inside = col >= 0 && col < c.n && row >= 0 && row < c.n;
      const f = shadowFactor(col + 0.0, row + 0.0);
      let v: number;
      if (inside) {
        const light = isLightSquare(Math.floor(col), Math.floor(row));
        v = (light ? c.light : c.dark) * f;
      } else {
        v = 216 * f;
      }
      const vv = Math.round(v);
      ctx.fillStyle = `rgb(${vv},${vv},${vv})`;
      ctx.fillRect(px, py, step, step);
    }
  }
  // A と B のラベル
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = `700 ${sq * 0.42}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [label, sqr] of [
    ['A', c.a],
    ['B', c.b],
  ] as const) {
    const p = checkerToCanvas(sqr.col + 0.5, sqr.row + 0.5, s);
    ctx.fillStyle = isLightSquare(sqr.col, sqr.row) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.55)';
    ctx.fillText(label, p.x, p.y);
  }
};

export const drawCheckerShadowGuide: Drawer = (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  const c = CHECKER;
  const sq = checkerSquare(s);
  const a = checkerToCanvas(c.a.col + 0.5, c.a.row + 0.5, s);
  const b = checkerToCanvas(c.b.col + 0.5, c.b.row + 0.5, s);
  // A と B を同じ灰色の帯で繋ぐ
  const v = c.dark;
  ctx.strokeStyle = `rgb(${v},${v},${v})`;
  ctx.lineWidth = sq * 0.55;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(a.x, b.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  for (const p of [a, b]) {
    ctx.fillRect(p.x - sq * 0.5, p.y - sq * 0.5, sq, sq);
  }
  ctx.strokeStyle = GUIDE;
  ctx.lineWidth = s * 0.006;
  for (const p of [a, b]) {
    ctx.strokeRect(p.x - sq * 0.5, p.y - sq * 0.5, sq, sq);
  }
};
