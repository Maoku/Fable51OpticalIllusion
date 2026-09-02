// 連番フレーム(capture.mjs)とテロップ(telops.mjs)から 15 秒の PV を書き出す。
// 編集指示は Docs/SHOOTING_PLAN.md §7。テロップは 0.15 秒のフェードイン・アウト付き。
//
//   node Docs/shooting/encode.mjs
//
// 既定の入出力:
//   FRAMES=Docs/screenshots/pv/frames  TELOPS=Docs/screenshots/pv/telops
//   OUT=Docs/screenshots/pv/pv-15s.mp4(GIF=1 で README 用の GIF も作る)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const FRAMES = process.env.FRAMES ?? 'Docs/screenshots/pv/frames';
const TELOPS = process.env.TELOPS ?? 'Docs/screenshots/pv/telops';
const OUT = process.env.OUT ?? 'Docs/screenshots/pv/pv-15s.mp4';
const FPS = Number(process.env.FPS ?? 60);
const DURATION = Number(process.env.DURATION ?? 15);
const FADE = Number(process.env.FADE ?? 0.15);
const CRF = process.env.CRF ?? '17';

const telops = JSON.parse(readFileSync(`${TELOPS}/telops.json`, 'utf8'));
mkdirSync(dirname(OUT), { recursive: true });

// [0:v] が素材、[1:v] 以降がテロップ。1 枚ずつアルファをフェードさせて重ねる
const inputs = ['-framerate', String(FPS), '-i', `${FRAMES}/frame_%06d.png`];
const filters = [];
let last = '0:v';
telops.forEach((t, i) => {
  inputs.push('-loop', '1', '-framerate', String(FPS), '-i', `${TELOPS}/${t.file}`);
  const src = `${i + 1}:v`;
  const outFade = Math.max(t.in, t.out - FADE);
  filters.push(
    `[${src}]format=rgba,` +
      `fade=t=in:st=${t.in}:d=${FADE}:alpha=1,` +
      `fade=t=out:st=${outFade}:d=${FADE}:alpha=1[t${i}]`,
  );
  const next = i === telops.length - 1 ? 'v' : `v${i}`;
  filters.push(
    `[${last}][t${i}]overlay=0:0:enable='between(t,${t.in},${t.out})':format=auto[${next}]`,
  );
  last = next;
});

const args = [
  '-y',
  ...inputs,
  '-filter_complex',
  filters.join(';'),
  '-map',
  '[v]',
  '-t',
  String(DURATION),
  '-r',
  String(FPS),
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  CRF,
  '-pix_fmt',
  'yuv420p',
  '-color_primaries',
  'bt709',
  '-color_trc',
  'bt709',
  '-colorspace',
  'bt709',
  '-movflags',
  '+faststart',
  OUT,
];
console.log('ffmpeg', args.filter((a) => a !== '-filter_complex').length, '引数で書き出し中…');
execFileSync('ffmpeg', ['-loglevel', 'error', '-stats', ...args], { stdio: 'inherit' });
console.log(`書き出し: ${OUT}`);

if (process.env.GIF === '1') {
  // README 用の GIF。10 MB に収めるため 720x405 / 12 fps / 96 色まで落とす
  // (960x540 / 15 fps では 15 MB を超える。ブルームの階調が GIF と相性が悪い)
  const gif = OUT.replace(/\.mp4$/, '.gif');
  const palette = `${dirname(OUT)}/palette.png`;
  const vf = `fps=${process.env.GIF_FPS ?? 12},scale=${process.env.GIF_WIDTH ?? 720}:-1:flags=lanczos`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', OUT, '-vf', `${vf},palettegen=max_colors=96:stats_mode=diff`, palette]); // prettier-ignore
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', OUT, '-i', palette, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=none:new=1`, gif]); // prettier-ignore
  rmSync(palette, { force: true });
  console.log(`書き出し: ${gif}`);
}
