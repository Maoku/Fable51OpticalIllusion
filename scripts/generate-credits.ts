/**
 * src/content/credits.ts から CREDITS.md を生成する。
 * 実行: npm run credits
 */
import { writeFileSync } from 'node:fs';
import { credits } from '../src/content/credits.ts';

const kindLabel: Record<string, string> = {
  library: 'ライブラリ',
  font: 'フォント',
  texture: 'テクスチャ',
  model: '3D モデル',
  hdri: 'HDRI / 環境',
  other: 'その他',
};

const lines: string[] = [
  '# Credits',
  '',
  'このファイルは `src/content/credits.ts` から `npm run credits` で生成しています。直接編集しないでください。',
  '',
  '| 名称 | 作者 | 種別 | ライセンス | 改変 | 用途 | ファイル |',
  '|------|------|------|-----------|------|------|----------|',
];

for (const c of credits) {
  const license = c.licenseUrl ? `[${c.license}](${c.licenseUrl})` : c.license;
  const files = c.files?.length ? c.files.map((f) => `\`public/assets/${f}\``).join('<br>') : '-';
  lines.push(
    `| [${c.name}](${c.url}) | ${c.author} | ${kindLabel[c.kind] ?? c.kind} | ${license} | ${c.modified ? 'あり' : 'なし'} | ${c.usage} | ${files} |`,
  );
}
lines.push('');

writeFileSync('CREDITS.md', lines.join('\n'));
console.log(`CREDITS.md を生成しました(${credits.length} 件)`);
