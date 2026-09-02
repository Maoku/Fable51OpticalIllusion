/**
 * 展示の文言(日本語)。多言語化する場合は同じ形の別ファイルを用意する。
 */
export interface ExhibitText {
  /** 展示番号(C1, F1 など) */
  number?: string;
  title: string;
  /** キャプションプレートの一行説明 */
  subtitle: string;
  /** どう見えるか(ヒントを開く前に感じてほしいこと) */
  look: string;
  /** なぜそう見えるか(種明かし) */
  hint: string;
}

export const exhibitTexts: Record<string, ExhibitText> = {
  'demo-wireframe': {
    number: 'D1',
    title: '斜めの箱',
    subtitle: '演出の確認用: WireframeReveal',
    look: '台の上に、真四角な箱が置かれているように見えます。',
    hint: '実際は奥へ向かって細くなる台形の箱です。ワイヤーフレームを重ねると、本当の形が見えてきます。',
  },
  'demo-guide': {
    number: 'D2',
    title: '二本の線',
    subtitle: '演出の確認用: GuideOverlay',
    look: '上の線のほうが長く見えます。',
    hint: '二本の線は同じ長さです。補助線を重ねると、両端がぴったり揃っていることが分かります。',
  },
  'demo-orbit': {
    number: 'D3',
    title: '触れ合う柱',
    subtitle: '演出の確認用: CameraOrbit',
    look: '二本の柱が先端で触れ合っているように見えます。',
    hint: '柱は奥行き方向に離れています。視点を回すと、二本の間に隙間があることが見えます。',
  },
  'demo-material': {
    number: 'D4',
    title: '白い立方体',
    subtitle: '演出の確認用: MaterialSwap',
    look: 'ただの白い立方体に見えます。',
    hint: '立方体は中が空洞で、金色の球が隠れています。外側を半透明にすると中身が現れます。',
  },
  'demo-light': {
    number: 'D5',
    title: '橙色の板',
    subtitle: '演出の確認用: LightChange',
    look: '台の上の板は、橙色に塗られているように見えます。',
    hint: '板は無彩色の灰色で、橙色の光に照らされているだけです。光を白に戻すと本来の色が見えます。',
  },
  'demo-section': {
    number: 'D6',
    title: '白い球',
    subtitle: '演出の確認用: SectionCut',
    look: '中身の詰まった白い球に見えます。',
    hint: '断面を切ると、殻の内側に赤い芯が入っていることが分かります。',
  },
};
