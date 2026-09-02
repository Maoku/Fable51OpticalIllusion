import type { Credit } from '../src/content/credits.ts';

const kindLabel: Record<string, string> = {
  library: 'ライブラリ',
  font: 'フォント',
  texture: 'テクスチャ',
  model: '3D モデル',
  hdri: 'HDRI / 環境',
  other: 'その他',
};

/** credits.ts の内容から CREDITS.md の本文を作る(スクリプトとテストで共有) */
export function creditsMarkdown(credits: readonly Credit[]): string {
  const lines: string[] = [
    '# Credits',
    '',
    'このファイルは `src/content/credits.ts` から `npm run credits` で生成しています。直接編集しないでください。',
    '',
    '展示物・テクスチャ・建築ジオメトリはすべて手続き生成で、外部アセットへの依存は以下に限られます。',
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
  return lines.join('\n');
}
