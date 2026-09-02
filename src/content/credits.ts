/**
 * 使用アセット・ライブラリのクレジット情報。
 * `public/assets/` に置いたファイルは必ずここに登録する(単体テストで検出)。
 * `CREDITS.md` はこのファイルから `npm run credits` で生成する。
 */
export type CreditKind = 'library' | 'font' | 'texture' | 'model' | 'hdri' | 'other';

export interface Credit {
  /** 表示名 */
  name: string;
  /** 作者・提供元 */
  author: string;
  /** 出典 URL */
  url: string;
  /** ライセンス(SPDX 表記) */
  license: string;
  /** ライセンス本文の URL */
  licenseUrl?: string;
  /** 改変の有無 */
  modified: boolean;
  /** 用途 */
  usage: string;
  /** `public/assets/` 配下の相対パス(外部ファイルを置く場合) */
  files?: string[];
  kind: CreditKind;
}

export const credits: Credit[] = [
  {
    name: 'three.js',
    author: 'three.js authors',
    url: 'https://threejs.org/',
    license: 'MIT',
    licenseUrl: 'https://github.com/mrdoob/three.js/blob/dev/LICENSE',
    modified: false,
    usage: '3D 描画ライブラリ',
    kind: 'library',
  },
  {
    name: 'Noto Sans JP',
    author: 'Google (Google Fonts)',
    url: 'https://fonts.google.com/noto/specimen/Noto+Sans+JP',
    license: 'OFL-1.1',
    licenseUrl: 'https://openfontlicense.org/',
    modified: false,
    usage: 'UI とキャプションプレートのフォント(Google Fonts から配信)',
    kind: 'font',
  },
];
