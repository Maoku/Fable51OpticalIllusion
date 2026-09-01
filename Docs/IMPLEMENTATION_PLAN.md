# Optical Illusion Museum 実装計画書

- 作成日: 2026-09-02
- 改訂: 2026-09-02(未決事項の回答を反映。v2)
- 元資料: [PLAN.md](./PLAN.md)
- ステータス: レビュー済み方針に基づく実装計画。展示の個別仕様は各フェーズ着手時に詳細化する

---

## 1. 目的とゴール

PLAN.md の要求を整理すると、本プロジェクトのゴールは次の 3 点に集約される。

| # | 要求 | 実装上の意味 |
|---|------|--------------|
| G1 | ブラウザ上で動作する 3D ミュージアム | WebGL ベースの 3D シーン。インストール不要、URL を開くだけで遊べる。PC とモバイルの両方で動作する |
| G2 | Optical Illusion をテーマにした展示を鑑賞して楽しむ | 空間内を移動し、複数の展示物(錯視)を自由に鑑賞できる。古典錯視に加え、3D 空間でしか成立しない Fable オリジナル展示を持つ |
| G3 | 見え方のヒントは非表示。ボタンを押すと説明が見られる | 展示ごとに「ヒント」を持ち、初期状態は非表示。ユーザー操作で開閉し、テキストに加えて 3D 上の演出で種明かしをする |

### 完成の定義(MVP)

- PC ブラウザ(Chrome / Safari / Firefox 最新)で 60fps 前後、モバイル(iOS Safari / Android Chrome の直近 2 世代)で 30fps 以上で動作する
- 2 つの展示室(古典の間・Fable の間)を一人称視点で歩き回れる。PC はキーボード + マウス、モバイルは仮想スティック + タッチドラッグで操作できる
- 古典の間に 5 点以上、Fable の間に 4 点以上の展示がある
- 各展示に近づくと「ヒントを見る」ボタンが表示され、押すとテキスト解説と 3D 演出による種明かしが行われる。再度押すと元の見え方に戻る
- 展示一覧から任意の展示の推奨視点へワープできる
- 使用アセットはすべてライセンス上問題がなく、クレジット画面に表記されている
- `main` ブランチで `npm run build` が通り、デプロイワークフローが手動実行可能な状態になっている(公開はユーザーの指示があるまで行わない)

---

## 2. 決定事項

前版の未決事項に対する回答と、それを受けた方針。

| # | 論点 | 決定 | 計画への反映 |
|---|------|------|--------------|
| 1 | 対象デバイス | モバイルも対応 | Phase 1 でタッチ操作を実装。品質ティアで描画負荷を自動調整(§3.3) |
| 2 | 展示の選定 | Fable オリジナルの展示室を追加。近代美術として景観が美しく、3D ミュージアムである意義を感じられる内容 | 「Fable の間」を新設し、視点・光・空間の操作でしか成立しない 7 点を設計(§5.2)。建築とライティングの方針を定義(§5.3) |
| 3 | ヒントの粒度 | 演出も含める | 全展示にヒント演出を必須化。演出フレームワーク `HintEffect` を Phase 2 で整備(§4.5) |
| 4 | ホスティング | GitHub Pages 公開はユーザーの指示で行う | デプロイワークフローは `workflow_dispatch`(手動)のみ。CI はビルドとテストまで。実装側から公開操作は行わない(§8) |
| 5 | アセットのライセンス | 問題のない範囲で利用。表記が必要なら行う。有償・商用許可が必要なものは使わない | ライセンス方針を明文化(§9)。原則として手続き生成でアセット依存を最小化し、使う場合は CC0 / CC-BY / OFL / MIT 等に限定。`CREDITS.md` と館内クレジット画面を用意 |

---

## 3. スコープと技術スタック

### 3.1 MVP に含めるもの

- 2 部屋構成(古典の間、Fable の間)と、それらを結ぶ回廊
- 一人称視点の移動とコリジョン。PC: WASD + マウスルック、モバイル: 仮想スティック + タッチドラッグ
- 展示物の抽象化(`Exhibit`)とヒント演出の抽象化(`HintEffect`)
- 古典錯視 8 点、Fable オリジナル 7 点(優先度で MVP 最低ラインを定義)
- 近接検出 → ヒントボタン → テキスト + 演出の開閉
- 展示一覧からのワープ、操作説明、ローディング、クレジット画面
- 端末性能に応じた品質ティア

### 3.2 MVP に含めないもの(将来候補)

- WebXR(VR ヘッドセット)対応
- 多言語対応(文言は言語別ファイルに分離しておく)
- サウンド / BGM
- 閲覧済み展示の保存
- ジャイロによる視点操作(iOS の権限フローが必要なため後回し)

### 3.3 技術スタック

| 領域 | 採用 | ライセンス | 理由 |
|------|------|-----------|------|
| 言語 | TypeScript | Apache-2.0 | 展示インターフェースの型安全性 |
| 3D | Three.js | MIT | ブラウザ 3D の標準。Reflector、RenderTarget、ポストプロセスの実装例が豊富 |
| ビルド | Vite | MIT | `.gitignore` の `dist/` `*.local` と整合。HMR が高速 |
| UI | 素の HTML/CSS + DOM 操作 | - | ヒントパネル等は DOM オーバーレイ。フレームワーク不要の規模 |
| 仮想スティック | 自前実装(Pointer Events) | - | 依存を増やさない。必要なら nipplejs(MIT)へ差し替え可 |
| 状態管理 | 自前の型付き EventBus | - | イベント数が少ない |
| Lint / Format | ESLint + Prettier | MIT | 標準構成 |
| テスト | Vitest + Playwright | MIT / Apache-2.0 | ロジックは単体テスト、起動とヒントフローは E2E |
| ホスティング | GitHub Pages | - | 静的サイト。公開はユーザー指示で手動実行 |

品質ティア(起動時の GPU 情報と最初の数秒の実測 fps で決定し、以後は動的に調整):

| ティア | 対象の目安 | devicePixelRatio 上限 | 影 | ポストプロセス |
|--------|-----------|----------------------|----|---------------|
| high | デスクトップ dGPU | 2.0 | 2048px、動的 1 灯 | Bloom + ACES + SSAO |
| mid | ノート iGPU、上位スマホ | 1.5 | 1024px、動的 1 灯 | Bloom + ACES |
| low | 廉価スマホ | 1.0 | ベイク済み影のみ | ACES のみ |

### 3.4 検討して見送ったもの

- React Three Fiber: DOM UI との二重管理が増える。素の Three.js で十分
- Babylon.js: バンドルが大きい。必要機能は Three.js で足りる
- 物理エンジン: 移動コリジョンは AABB とレイキャストで十分
- ジャイロ視点操作: iOS 13 以降で権限要求 UI が必要。MVP ではタッチドラッグに統一

---

## 4. アーキテクチャ

### 4.1 ディレクトリ構成

```
Fable51OpticalIllusion/
├── Docs/
│   ├── PLAN.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── screenshots/             # 推奨視点の見え方の記録
├── public/
│   └── assets/                  # 外部アセット(ライセンス表を §9 で管理)
├── src/
│   ├── main.ts
│   ├── app/
│   │   ├── App.ts               # レンダラ・シーン・ループの統括
│   │   ├── Loop.ts
│   │   ├── EventBus.ts
│   │   ├── Quality.ts           # 品質ティア判定と動的解像度
│   │   └── PostProcess.ts       # Bloom / ACES / SSAO(ティア依存)
│   ├── input/
│   │   ├── InputSource.ts       # 移動ベクトルと視点回転を返す共通インターフェース
│   │   ├── KeyboardMouseInput.ts
│   │   └── TouchInput.ts        # 仮想スティック(左)+ ドラッグルック(右)
│   ├── player/
│   │   ├── PlayerController.ts
│   │   └── Collision.ts
│   ├── museum/
│   │   ├── Museum.ts            # 部屋群と回廊の組み立て
│   │   ├── Room.ts              # 床・壁・天井・開口・照明の生成
│   │   ├── Pedestal.ts
│   │   ├── Caption.ts           # 展示キャプションプレート
│   │   ├── materials.ts         # 漆喰・コンクリート・オーク材などの共通マテリアル
│   │   └── layout/
│   │       ├── classicHall.ts   # 古典の間の配置
│   │       ├── fableGallery.ts  # Fable の間の配置
│   │       └── corridor.ts
│   ├── exhibits/
│   │   ├── Exhibit.ts           # インターフェースと基底クラス
│   │   ├── HintEffect.ts        # 演出の抽象化(§4.5)
│   │   ├── registry.ts
│   │   ├── classic/
│   │   │   ├── AmesRoom.ts
│   │   │   ├── PenroseTriangle.ts
│   │   │   ├── HollowFace.ts
│   │   │   ├── Anamorphosis.ts
│   │   │   ├── CheckerShadow.ts
│   │   │   └── PosterExhibit.ts # ミュラー・リヤー、カフェウォール、エビングハウス
│   │   └── fable/
│   │       ├── TrilemmaSculpture.ts
│   │       ├── TiltedRoom.ts
│   │       ├── GanzfeldChamber.ts
│   │       ├── ForcedPerspectiveGarden.ts
│   │       ├── InfinityWell.ts
│   │       ├── EndlessStair.ts
│   │       └── InvertedPond.ts
│   ├── procedural/
│   │   ├── textures.ts          # Canvas による錯視テクスチャ生成
│   │   ├── silhouetteSolid.ts   # 三方向シルエットから立体を生成(§5.2 F1)
│   │   └── noise.ts
│   ├── interaction/
│   │   └── ProximityDetector.ts
│   ├── ui/
│   │   ├── Hud.ts
│   │   ├── HintPanel.ts
│   │   ├── TouchControls.ts     # 仮想スティックの DOM 描画
│   │   ├── LoadingScreen.ts
│   │   ├── HelpOverlay.ts
│   │   ├── ExhibitList.ts
│   │   └── Credits.ts
│   ├── content/
│   │   ├── exhibits.ja.ts
│   │   └── credits.ts           # アセットのクレジット情報(CREDITS.md と同期)
│   └── styles/
│       └── main.css
├── tests/
│   ├── unit/
│   └── e2e/
├── .github/workflows/
│   ├── ci.yml                   # push / PR で lint・test・build
│   └── deploy.yml               # workflow_dispatch のみ。自動実行しない
├── CREDITS.md
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 4.2 主要コンポーネント

```
main.ts
  └─ App
       ├─ Quality ─────────────── ティア決定、pixelRatio と影解像度を Renderer に反映
       ├─ Renderer / Scene / Camera / PostProcess
       ├─ Loop ────────────────── 毎フレーム update(delta) を配信
       ├─ InputSource ─────────── 端末に応じて KeyboardMouseInput / TouchInput を選択
       ├─ PlayerController ───── 入力 → カメラ移動(Collision で補正)
       ├─ Museum ──────────────── Room × 2 + Corridor、照明、環境
       ├─ ExhibitRegistry ─────── Exhibit[] を生成・シーンに追加・update を委譲
       ├─ ProximityDetector ──── 最寄り展示を判定し EventBus へ通知
       └─ UI ───────────────────── EventBus を購読して DOM を更新
```

### 4.3 入力の抽象化

```ts
export interface InputSource {
  /** -1..1 の移動ベクトル(前後・左右) */
  readonly move: { x: number; y: number };
  /** このフレームの視点回転量(ラジアン) */
  consumeLook(): { yaw: number; pitch: number };
  /** ヒント開閉などのアクション */
  readonly interactPressed: boolean;
  attach(el: HTMLElement): void;
  detach(): void;
}
```

- `KeyboardMouseInput`: PointerLock が取れれば使用、拒否された場合はドラッグルックに自動フォールバック
- `TouchInput`: 画面左半分で始まったタッチを仮想スティック、右半分をドラッグルックとして扱う。HUD のヒントボタンは常時表示位置を固定し、タッチで押しやすい大きさにする
- 判定は `navigator.maxTouchPoints` と `pointer: coarse` メディアクエリで行い、どちらの入力も同時に有効にしておく(タッチ対応ノート PC 対策)

### 4.4 Exhibit インターフェース

```ts
export interface ExhibitMeta {
  id: string;
  room: 'classic' | 'fable';
  position: Vector3;
  facing: number;
  triggerRadius: number;
  viewpoint?: { position: Vector3; yaw: number; pitch: number }; // 推奨視点
}

export interface Exhibit {
  readonly meta: ExhibitMeta;
  readonly object: Object3D;
  readonly hint: HintEffect;                  // 演出は必須
  load(ctx: LoadContext): Promise<void>;      // ctx.quality でティアに応じた生成
  update(delta: number, camera: Camera): void;
  dispose(): void;
}
```

### 4.5 ヒント演出フレームワーク(G3)

演出はテキストと同じく「初期状態は非表示」「ボタンで開く」「再度押すか離れると閉じる」を必ず守る。演出は途中状態を持つため、進行度 `t` を 0→1 に補間する形で統一する。

```ts
export interface HintEffect {
  /** 0 = 通常の見え方、1 = 種明かし完了 */
  apply(t: number): void;
  readonly durationMs: number;
  /** 演出中にプレイヤーを推奨視点へ固定するか */
  readonly lockViewpoint: boolean;
}
```

イベントフロー:

```
PlayerController が移動
  → ProximityDetector が最寄り展示を判定
  → EventBus.emit('exhibit:near', { id })     ※離れたら 'exhibit:leave'
  → Hud が「ヒントを見る」ボタンを表示(モバイルでは大きめの固定ボタン)
  → ボタン押下 / E キー / タッチ
  → EventBus.emit('hint:toggle', { id })
  → HintPanel がテキストを表示し、HintEffect.apply(t) を durationMs かけて 0→1 に補間
  → 再度押下で 1→0 に戻す。'exhibit:leave' でも同様に戻してからパネルを閉じる
```

演出の代表パターン(複数の展示で共有する部品として `HintEffect` の実装を用意):

| パターン | 内容 | 使う展示 |
|----------|------|----------|
| WireframeReveal | 実形状のワイヤーフレームをフェードインで重ねる | エイムズの部屋、傾きの間、窓の外の庭 |
| GuideOverlay | 補助線・ガイドをテクスチャ切替で表示 | ポスター展示、チェッカーシャドウ |
| CameraOrbit | 推奨視点から少し離れた軌道へカメラを移動して分解を見せる | ペンローズの三角形、三面の彫刻 |
| MaterialSwap | 半透明化・単色化で内部構造を見せる | 逆さの水面、無限の井戸 |
| LightChange | 光源の色温度・位置を変えて恒常性を破る | 色の部屋 |
| SectionCut | クリッピング平面で断面を見せる | くぼんだ顔、無限の井戸 |

---

## 5. 展示計画

### 5.1 古典の間(Classic Hall)

既知の錯視を正確に再現し、3D 空間で「実際に歩いて視点を変えられる」ことを体験する部屋。

| # | 展示 | 種別 | 3D での実現方法 | ヒント演出 | 優先度 |
|---|------|------|-----------------|-----------|--------|
| C1 | エイムズの部屋 | 視点依存 | 台形に歪んだ小部屋。覗き窓から見ると直方体に見える。左右に同サイズの人形 | WireframeReveal で実形状を重ね、人形の間に等長の目盛りを表示 | 高 |
| C2 | ペンローズの三角形 | 視点依存 | 3 本の角柱を空間的にずらして配置 | CameraOrbit で視点を回し、分解される様子を見せる | 高 |
| C3 | チェッカーシャドウ | 3D 再現 | 市松模様と円柱、影を 3D で構築 | GuideOverlay で 2 マスを切り出し、色見本として並べる | 高 |
| C4 | ミュラー・リヤー | 2D ポスター | Canvas 生成テクスチャの額装 | GuideOverlay で等長の補助線 | 高 |
| C5 | カフェウォール | 2D ポスター | 同上 | 水平ガイドを重ねる | 中 |
| C6 | エビングハウス | 2D ポスター | 同上 | 周囲の円をフェードアウトして中心円を比較 | 中 |
| C7 | くぼんだ顔 | 視点依存 | 顔メッシュを裏返して配置。顔メッシュは手続き生成か CC0 素材(§9) | SectionCut で断面を見せる | 中 |
| C8 | アナモルフォーシス | 視点依存 | 床と壁にまたがる歪んだ図形 | 推奨視点からのレイを線で可視化 | 低 |

### 5.2 Fable の間(Fable Gallery)

Fable オリジナルの展示室。テーマは「光と余白」。すべての作品は「歩く」「光が変わる」「空間が繋がる」という 3D 空間の性質そのものを素材にしており、写真や平面では体験できないものだけを置く。

| # | 作品名 | 概念 | 3D での実現方法 | ヒント演出 | 優先度 |
|---|--------|------|-----------------|-----------|--------|
| F1 | 三面の彫刻 | 一つの白い彫刻が、正面からは円、側面からは正方形、真上からは三角に見える | 三方向のシルエットの交差から立体を手続き生成(`silhouetteSolid`)。3 灯のスポットで 3 面の壁に影を落とす | CameraOrbit で 3 方向を巡り、各壁の影を順に照らす | 高 |
| F2 | 傾きの間 | 床も壁も 12° 傾いた小部屋。水平を保つカメラのため、置かれた球が坂を「登る」ように見え、鉛直に立つ人形が傾いて見える | 部屋全体を回転させて配置。中の球は部屋のローカル座標で「下り」へ転がるアニメーション | WireframeReveal で真の水平線と重力ベクトルを表示し、部屋の外壁を半透明化 | 高 |
| F3 | 色の部屋 | 角が丸められ、均一な光で満たされた部屋。奥行きが消え、置かれた 2 枚の同じ灰色の板が、光の色の移ろいで別の色に見える | 角を丸めた部屋ジオメトリと、ゆっくり色温度が変わるエリアライト。フォグで境界を溶かす | LightChange で白色光に切り替え、稜線をエッジラインで描いて奥行きを回復。2 枚の板を並べて同色と示す | 高 |
| F4 | 窓の外の庭 | 回廊の窓から広大な水庭が見える。実際は窓の向こう 3 m に置かれた 1/20 スケールのジオラマ | 強制遠近法。スケール差のある木・石・水面を配置し、フォグと被写界深度で距離感を偽装 | 壁を半透明化し、ジオラマの横に等身大の人型を立たせてスケールを示す | 高 |
| F5 | 無限の井戸 | 床に開いた井戸が底なしに見える。覗き込むと自分の足元の光がどこまでも続く | 無限鏡。RenderTarget を再帰的に参照する簡易実装(low ティアでは同心リング + フォグで代替) | SectionCut で井戸を断面表示し、深さ 30 cm しかないことを見せる | 中 |
| F6 | 終わらない階段 | 回廊の一角に、登り続けても同じ踊り場に戻る階段がある | 4 辺の階段を配置し、特定の段を跨いだ瞬間にプレイヤーを継ぎ目なくテレポート。継ぎ目は視界の外側に置く | カメラを俯瞰へ引き、階段の切れ目とテレポート位置を表示 | 中 |
| F7 | 逆さの水面 | 静かな水盤に映る彫刻の反射が、本物とは違う形をしている | 水面は不透明な反射ではなく、水面下に逆さの別の彫刻を置いた半透明の板。水面のマテリアルで見かけ上の反射を演出 | MaterialSwap で水を透明にし、水面下の逆さの彫刻を見せる | 中 |

MVP 最低ラインは F1〜F4 の 4 点。F5〜F7 は Phase 5 で順次追加する。

### 5.3 空間デザインの方針(景観)

「3D ミュージアムである意義」は展示物だけでなく空間そのものにも持たせる。

- 建築: 白い漆喰壁と打放しコンクリート、オーク材の床。天井高は古典の間 4 m、Fable の間 6 m。Fable の間は天窓から柔らかい方向光が落ち、時間とともに光の角度がゆっくり動く
- 動線: 入口 → 古典の間 → 回廊(F4「窓の外の庭」と F6「終わらない階段」)→ Fable の間。回廊の窓から見える水庭が両室を繋ぐ視覚的な軸になる
- 光: 古典の間は展示の正確性を優先し均一な照明。Fable の間は展示ごとに光の質を変える(F1 は硬いスポット、F3 は面光源、F7 は水面の反射光)
- 色: 壁と床は無彩色に近い低彩度。色は展示物と光だけが持つ
- 環境: 空と外光は手続き生成のスカイか CC0 の HDRI(Poly Haven)を使用
- キャプション: 各展示の脇に小さなプレート。フォントは OFL ライセンスのもの(Google Fonts)

---

## 6. 実装フェーズ

各フェーズは単独でマージ可能な粒度とし、完了条件を満たしてから次へ進む。

### Phase 0: プロジェクト初期化

- Vite + TypeScript + Three.js の雛形
- ESLint / Prettier / Vitest / Playwright の設定
- `ci.yml`(lint・test・build)。`deploy.yml` は `workflow_dispatch` のみで作成し、実行はしない
- `CREDITS.md` と `content/credits.ts` の雛形
- 空のシーン(床と光源)を表示

完了条件: `npm run dev` で床が表示される。CI が緑。

### Phase 1: 空間・移動・モバイル入力

- `Room` と `Museum`: 2 部屋 + 回廊の箱を `layout/` から生成。まずは白い箱でよい
- `InputSource` と `KeyboardMouseInput` / `TouchInput`、`TouchControls` の DOM
- `PlayerController`、`Collision`
- `Quality`: ティア判定と動的 pixelRatio
- `HelpOverlay`(PC / モバイルで文言を切替)、`LoadingScreen`
- 実機確認: iPhone Safari と Android Chrome で 30fps 以上

完了条件: PC とスマホの両方で 2 部屋を歩き回れ、壁を突き抜けない。

### Phase 2: 展示基盤とヒント演出基盤

- `Exhibit`、`HintEffect`、`Pedestal`、`Caption`、`registry`
- `ProximityDetector` と EventBus イベント定義
- `Hud`、`HintPanel`(t の補間、開閉アニメーション)
- 演出の共有部品: WireframeReveal、GuideOverlay、CameraOrbit、MaterialSwap、LightChange、SectionCut
- 仮展示(箱)で全パターンの動作を確認

完了条件: 仮展示に近づくとボタンが出て、押すとテキストと演出が同期して進行し、離れると元に戻る。PC とスマホの両方で操作できる。

### Phase 3: 古典の間

- `procedural/textures.ts` で C4〜C6 のテクスチャ生成、`PosterExhibit`
- C3 チェッカーシャドウ、C1 エイムズの部屋、C2 ペンローズの三角形
- `ExhibitList` からのワープと推奨視点
- 幾何計算(エイムズの部屋の台形比率、ペンローズの配置)は関数化して単体テスト

完了条件: 優先度「高」の C1〜C4 が揃い、推奨視点で錯視が成立し、ヒント演出が動く。

### Phase 4: Fable の間(コア 4 点)と景観

- `materials.ts` と照明設計、天窓と時間変化する光、`PostProcess`
- F1 三面の彫刻(`silhouetteSolid` の実装と単体テスト)
- F2 傾きの間
- F3 色の部屋
- F4 窓の外の庭(回廊)
- 回廊の窓からの眺めと動線の調整。推奨視点のスクリーンショットを `Docs/screenshots/` に保存

完了条件: F1〜F4 が揃い、Fable の間の景観が方針(§5.3)を満たす。mid ティアのスマホで 30fps 以上。

### Phase 5: 追加展示

- F5 無限の井戸(low ティア代替を含む)
- F6 終わらない階段(テレポートの継ぎ目検証)
- F7 逆さの水面
- C5〜C8

完了条件: 追加した各展示が全ティアで破綻なく動く。

### Phase 6: 仕上げ

- `Credits` 画面と `CREDITS.md` の最終化
- パフォーマンス調整(ドローコール、テクスチャ圧縮、影のベイク)
- ブラウザ横断・実機の目視確認
- README(操作説明、ローカル起動、デプロイ手順)
- デプロイワークフローの動作確認はユーザーの指示があった時点で行う

完了条件: MVP の完成定義をすべて満たし、ユーザーが `deploy.yml` を手動実行すれば公開できる状態。

---

## 7. テストと品質

| 対象 | 手段 | 内容 |
|------|------|------|
| `ProximityDetector` | Vitest | 距離判定、最寄り選択、ヒステリシス |
| `Collision` | Vitest | AABB 押し戻しの境界値 |
| `EventBus` | Vitest | 購読・解除・型 |
| `TouchInput` | Vitest | Pointer Events のシーケンスからスティック値と回転量が正しく出る |
| `Quality` | Vitest | GPU 情報と fps からのティア判定、動的解像度の上下限 |
| `silhouetteSolid` | Vitest | 生成した立体の 3 方向投影が入力シルエットと一致する |
| 錯視の幾何 | Vitest | エイムズの部屋の台形比率、ペンローズの配置が推奨視点で閉じる |
| `content` / `credits` | Vitest | 全展示 id に文言がある。`public/assets` の全ファイルが `credits.ts` に載っている |
| 起動 | Playwright | ページ読込 → キャンバス表示 → コンソールエラーなし(デスクトップとモバイルエミュレーション) |
| ヒントフロー | Playwright | ワープ → ボタン表示 → 押下 → パネルと演出 → 再押下で復帰。タッチ操作でも同様 |
| 錯視の見え方 | 目視 | 推奨視点のスクリーンショットを `Docs/screenshots/` に保存し PR で比較 |
| 実機 | 手動 | iPhone Safari と Android Chrome で各フェーズ末に確認 |

---

## 8. CI とデプロイの運用

- `ci.yml`: push と PR で lint、単体テスト、ビルド、E2E スモークを実行する
- `deploy.yml`: `workflow_dispatch` のみをトリガーとし、`main` を GitHub Pages に公開する。自動デプロイは設定しない
- 公開はユーザーの明示的な指示があったときに、ユーザー自身または指示を受けた作業者がワークフローを手動実行する。実装作業の一環として公開操作は行わない
- Vite の `base` は Pages のリポジトリパスに合わせて設定しておき、ローカルでは `/` で動くようにする

---

## 9. アセットとライセンス方針

### 9.1 原則

- 展示物、テクスチャ、建築ジオメトリは可能な限り手続き生成し、外部アセットへの依存を最小化する
- 外部アセットを使う場合は、次のライセンスに限定する

| 区分 | 可否 | 例 |
|------|------|-----|
| パブリックドメイン相当 | 可 | CC0(Poly Haven の HDRI など) |
| 表記義務あり | 可(表記する) | CC-BY 4.0、MIT、BSD、Apache-2.0、OFL(フォント) |
| 非商用限定・改変禁止 | 不可 | CC-BY-NC、CC-BY-ND |
| 有償・商用許可が別途必要 | 不可 | ストック素材、有償モデル、商用ライセンスが必要なフォント |
| ライセンス不明 | 不可 | 出典が追えない画像・モデル |

### 9.2 運用

- `public/assets/` に置くファイルは必ず `content/credits.ts` に「名称、作者、出典 URL、ライセンス、改変の有無」を登録する。登録漏れは単体テストで検出する
- `CREDITS.md` を `credits.ts` から生成し、館内の `Credits` 画面にも同じ内容を表示する
- 依存ライブラリのライセンスは `npm` の `license-checker` 相当のスクリプトで CI 時に一覧化し、上記の可否表に反さないことを確認する
- 顔メッシュ(C7)は手続き生成を第一候補とし、外部素材を使う場合は CC0 のものに限る

### 9.3 現時点で想定する外部アセット

| 用途 | 候補 | ライセンス | 表記 |
|------|------|-----------|------|
| 環境光・空 | Poly Haven HDRI | CC0 | 任意(表記する) |
| キャプションのフォント | Google Fonts(OFL のもの) | OFL 1.1 | 必要 |
| 3D ライブラリ | Three.js | MIT | 必要 |

---

## 10. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| モバイルで描画負荷が高く 30fps を割る | 高 | 品質ティアと動的解像度。影のベイク。Fable の間のポストプロセスは mid 以上のみ |
| 視点依存錯視が推奨視点以外で分かりにくい | 中 | 展示一覧からのワープと、床の足跡マークで推奨視点を明示 |
| PointerLock がブラウザや環境で拒否される | 中 | ドラッグルックへ自動フォールバック |
| F5 無限鏡、F6 テレポートが端末により破綻する | 中 | low ティア用の代替表現を用意。テレポートの継ぎ目は E2E で座標検証 |
| 錯視の幾何計算のミス | 高 | 計算を関数化し Vitest で数値検証。推奨視点のスクリーンショットを保存 |
| 外部アセットのライセンス違反 | 高 | §9 の運用と単体テストによる登録漏れ検出 |
| iOS Safari の WebGL 制約(メモリ、テクスチャ上限) | 中 | テクスチャは 2048px 以下、RenderTarget の数を制限 |
| 誤って公開してしまう | 中 | デプロイは手動トリガーのみ。CI から Pages への書き込み権限を与えない |

---

## 11. 次のアクション

- [ ] Phase 0 の着手(雛形作成、CI、`deploy.yml` の手動トリガー設定)
- [ ] Phase 1 でモバイル実機確認の手順を README に記載
- [ ] Fable の間の各作品について、着手時に 1 ページの仕様メモを `Docs/exhibits/` に追加
