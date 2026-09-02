# Optical Illusion Museum 修正計画書

- 作成日: 2026-09-02
- 改訂: 2026-09-02(未決事項の回答を反映。v2)
- 元資料: [REFINE_PLAN.md](./REFINE_PLAN.md)(修正項目の一覧)
- 関連: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)(初版の実装計画)、[exhibits/](./exhibits/)(Fable の間の展示仕様メモ)
- ステータス: R0(調査)完了。原因は §5.2・§5.4 のとおり実測で確定した。R1 以降を実装中

---

## 1. 目的と進め方

REFINE_PLAN.md に挙がった 8 項目(展示 7 点 + 操作方法)を、原因の分析 → 修正方針 → 影響範囲 → 検証方法の順に整理する。

方針は次の 3 点。

- **原因を先に確定する。** 幾何の問題(F4、F6)は数値で示し、修正前に失敗する単体テストを書く。知覚の問題(C1、F2)は「なぜ効かないか」を言葉にしてから設計を変える。描画設定の問題(C7、F3)は実 GPU で切り分ける
- **既存の枠組みに乗せる。** `HintEffect` の部品、`groundPatch` のようなパッチ機構、`ctx` 経由の依存注入を踏襲し、新しい概念は最小限(視界フレームの傾き、局所フォグ、水面反射の 3 つ)に留める
- **PR は項目ごとに小さく。** 各フェーズ(§7)は単独でマージでき、`npm run lint` / `npm test` / `npm run build` と手元の `npm run test:e2e` を通してから push する(E2E は CI では走らない。README 参照)

### 完成の定義

- REFINE_PLAN.md の 8 項目すべてについて、§3〜§6 の受け入れ基準を満たす
- 変更した展示の推奨視点スクリーンショット(`Docs/screenshots/`)を撮り直し、`Docs/exhibits/` の仕様メモと `src/content/exhibits.ja.ts` の文言が実装と一致している
- README の操作説明を更新し、「マウス操作とブラウザフォーカスがかちあう」旨の注記を外せる状態になっている

---

## 2. 修正項目の一覧と優先度

| # | 項目 | 症状(REFINE_PLAN) | 原因の分類 | 確度 | 優先 | 規模 |
|---|------|--------------------|-----------|------|------|------|
| M1 | 操作方法 | PointerLock が UI 操作とかちあう。右ドラッグで視点回転にしたい | 設計 | 確定 | 高 | M |
| F6 | 終わらない階段 | 登る途中で天井が狭まりカメラがめり込む | 幾何のバグ(天井スラブの傾き方向) | 確定(R0 で実測) | 高 | S |
| F4 | 窓の外の庭 | 水庭が生垣で見えない。フォグと被写界深度がない | 幾何(視線が遮られる)+ 未実装 | 確定(計算)/ 仕様 | 高 | L |
| F2 | 傾きの部屋 | 球が登らず下って見える | 知覚(画面の水平が基準になる) | 高 | 高 | M |
| F7 | 逆さの水面 | 水面に見えない | 表現(反射も揺らぎもない) | 確定 | 中 | L |
| F3 | 色の部屋 | エッジが見えて奥行きが消えない | 描画(high ティアの GTAO が角を暗くする) | 確定(R0 で実測) | 中 | S |
| C1 | エイムズの部屋 | ヒントの斜め視点でサイズ比較が分かりにくい | 演出設計 | 確定 | 中 | M |
| C7 | くぼんだ顔 | 白い顔にライトが強く当たり分かりにくい | パラメータ(反射率・光量・光の向き) | 確定 | 中 | S |

規模: S = 半日以内、M = 1〜2 日、L = 2〜4 日の目安。

---

## 3. 操作方法(M1): 右ドラッグで視点回転

### 3.1 現状と問題

- `KeyboardMouseInput` はキャンバスを左クリックすると PointerLock を要求する(`autoLock`)。ロック中はカーソルが消えるので「ヒントを見る」などの DOM ボタンが押せず、Esc で解除してから押す必要がある。README にも「ヒント表示は E キーがおすすめ」と注記している
- `HelpOverlay` を閉じた瞬間にもロックを要求する(`App.setupUi` の `onStart`)
- ロックが取れない環境ではドラッグルックにフォールバックしており、ドラッグ操作の実装自体は既にある

### 3.2 修正方針

PC の既定を「ボタンを押しながらドラッグして見回す」に変え、PointerLock は既定の流れから外す。

| 項目 | 内容 |
|------|------|
| 視点回転 | **右ボタン**を押しながらドラッグ(主)。**左ボタン**のドラッグも同じ動作にする(トラックパッド利用者向け。§9-1 で決定) |
| コンテキストメニュー | キャンバス上の `contextmenu` を `preventDefault` する(右ドラッグでメニューが出ないように) |
| ドラッグ中 | `setPointerCapture` でキャンバスがポインタを保持し、UI の上を通っても回転が続く。`body` に `is-dragging` を付けてカーソルを `grabbing` にする |
| UI との共存 | DOM ボタンは `pointer-events: auto` なのでキャンバスに `pointerdown` が届かない。ドラッグの終点がボタン上でも click は発火しない(同一要素で down/up していないため) |
| 感度 | ドラッグは移動量が画面幅に制限されるので、PointerLock 時の 0.0022 rad/px より高い 0.0035 rad/px 程度から調整する |
| PointerLock | 既定では使わない。`L` キーで任意に切り替えられるオプションとして残す(Esc で解除。§9-1) |
| 案内 | HUD の「画面をクリックすると視点を操作できます」を「マウスの右ボタンを押しながらドラッグすると見回せます」に変え、最初に視点を回すまで表示する |
| 文言 | `HelpOverlay` の PC 行、README の操作表を更新し、README 冒頭の「現行」の注記を外す |

### 3.3 変更ファイル

- `src/input/MouseLook.ts`(新規): DOM 非依存の `MouseLookCore`(`TouchInputCore` と同じ構造)。ボタン種別つきのポインタ列から yaw/pitch を計算する
- `src/input/KeyboardMouseInput.ts`: コアを使う形に置き換え、`autoLock` を `lockAllowed` に改め、`L` キーで `requestLock`/`releaseLock` を切り替える。ポインタキャプチャの例外は握り潰す(対象のポインタが既にない環境で回転が止まらないように)
- `src/app/App.ts`: `onStart` の `requestLock()` を削除し、ドラッグ状態を `body.is-dragging` と `input:looked` イベントへ流す。`contextmenu` 抑止は `KeyboardMouseInput` 側で行う
- `src/ui/Hud.ts`: `isLocked`/`isDragFallback` に代えて「一度でも視点を回したか」で案内を出す(`HudOptions` は不要になったので削除)
- `src/ui/HelpOverlay.ts`、`README.md`、`src/styles/main.css`(`is-dragging`)

### 3.4 テストと受け入れ基準

- 単体(`tests/unit/MouseLook.test.ts`): 右ドラッグで yaw/pitch が変わる、左ドラッグも同じ、ボタンを押していない移動では変わらない、up で止まる、`consumeLook` でリセット
- E2E(`tests/e2e/controls.spec.ts`): `page.mouse` の右ボタンドラッグで `player.yaw` が変わる。キャンバスを左クリックしても `document.pointerLockElement` が null のまま。ドラッグ直後に「ヒントを見る」を click できる(Esc 不要)。コンテキストメニューが出ない(`contextmenu` イベントが `defaultPrevented`)
- 既存 E2E(`hint.spec.ts` の E キー、`smoke.spec.ts` のキーボード移動)が通る

---

## 4. 古典の間

### 4.1 C1 エイムズの部屋: ヒントの視点

#### 現状と原因

種明かしは `CameraOrbit`(部屋の中心を注視して 63° 回り、1.9 m 上がる)+ 壁の半透明化 + 部屋の実際の稜線。斜め上からの視点では台形の形は伝わるが、二体の人形は依然としてカメラからの距離が違う(左奥の人形の方が遠い)ため、「同じ身長」という結論が画面上のサイズから読めない。

#### 修正方針

「二体から等距離の視点」へカメラを移す。二体からの距離が同じなら見かけの大きさが同じになり、それ自体が種明かしになる。

- `amesGeometry.ts` に `equalDistanceViewpoint(p, distance, lift)` を追加する。人形の実位置 L・R(`figureApparentPositions` を `amesTransform` した点)の中点 M から、L–R に垂直な水平方向(鑑賞者側 +z)へ `distance` 進み、`|C−L| = |C−R|` となる高さ y を解いて求める(3 次元の垂直二等分面上の点)。既定値では概ねローカル (−1.8, 2.3, 0.45) 付近になり、歪んだ手前の壁(その x での z ≈ −0.18)より 0.6 m 手前、古典の間の天井(4 m)より下に収まる
- `CameraOrbit` を `CameraPath` に置き換え、経由点 1 つ(少し高い位置)と終点 `equalDistanceViewpoint` を通り、注視点は二体の胸の高さの中点にする。所要時間 2600 ms は維持
- 壁の半透明化(0.35)と稜線、人形の脇の橙の目盛りは維持する。等距離の視点では二本の目盛りが同じ長さに見える
- 代替案(検証で読みにくければ切り替える): `TransformLerp` で左の人形を右の人形の隣まで歩かせ、近づくにつれて大きくなる様子を覗き窓からそのまま見せる

#### 変更ファイル

`src/exhibits/classic/amesGeometry.ts`、`src/exhibits/classic/AmesRoom.ts`、`tests/unit/amesGeometry.test.ts`

#### テストと受け入れ基準

- 単体: `equalDistanceViewpoint` の点が L・R から等距離(誤差 1e-9)、歪んだ手前の壁の外側(鑑賞者側)、`realBounds` の外にある
- E2E: ヒント完了時(progress = 1)に二体の頭頂と足元を `Vector3.project(camera)` で画面へ投影し、見かけの身長の比が 1 ± 0.05 に収まる
- 目視: `ames-room-hint.png` を撮り直し、台形の形と「同じ大きさの二体」が一枚で読める

### 4.2 C7 くぼんだ顔: ライティングと材質

#### 現状と原因

- 肌色 0xe7d9cb(反射率が高い)にスポット強度 26 を正面上方(0.25, 3.2, 1.2)から当てており、顔がほぼ白飛びして陰影の勾配が見えない。Bloom のしきい値(線形 1.25)を超えて滲んでいる可能性もある
- 古典の間の点光源 2 灯(強度 26)と半球光(0.7)、環境マップ(0.35)が影側を埋め、コントラストをさらに下げている
- 凹面の顔を凸と誤読させる錯視は、陰影がはっきり見えることが前提。正面からの光は起伏を平坦にする

#### 修正方針

| 項目 | 現状 | 変更 |
|------|------|------|
| 肌の色 | 0xe7d9cb | 中間調の石膏色 0xb8a894 前後 |
| roughness / envMapIntensity | 0.75 / 1.0 | 0.9 / 0.15(環境光の写り込みで陰影を埋めない) |
| スポット強度・角度・penumbra | 26 / π/8 / 0.5 | 12 / π/9 / 0.35 |
| スポットの位置 | (0.25, 3.2, 1.2) 正面上 | (−1.1, 2.9, 0.9) 左上から斜めに当て、鼻筋と眼窩の陰影を横断させる |
| 起伏の深さ `FACE.relief` | 0.13 | 0.16(枠の奥行きは `relief` から導出しているので追従する) |
| 目 | なし | 眼窩の位置に暗い虹彩の円盤(半径 0.03、縦 0.75 倍、0x4a4038)。顔と認識されやすくなり、凸の解釈が強まる。断面の演出でも一緒に切る |

種明かし(`SectionCut` + `CameraOrbit`)は変えない。

#### 変更ファイル

`src/exhibits/classic/HollowFace.ts`(必要なら `src/procedural/face.ts` の目の位置を返す関数)

#### 受け入れ基準

- 推奨視点で鼻・眼窩・口の陰影が読め、顔が凸のレリーフとして見える。左右に歩くと顔が追ってくる感覚が残る
- 顔の周りに Bloom の滲みが出ない(線形輝度がしきい値 1.25 を超えない)
- `hollow-face.png` / `hollow-face-hint.png` を撮り直す

---

## 5. Fable の間・回廊

### 5.1 F2 傾きの部屋: 球が下って見える

#### 現状と原因

幾何は設計どおりで、球は世界では 6° の下り、部屋に対しては 6° の登りになっている(`room.rotation.z = +12°`、`track.rotation.z = −6°`、球は +x → −x)。問題は知覚の側にある。

- カメラは常に世界の水平を保つので、**画面の枠そのものが真の水平の基準**になる。鑑賞者には部屋が 12° 傾いて見え、球は画面上で 6° 下へ転がる。錯視が成立するには「部屋の床を水平だと思い込む」必要があるが、画面上では部屋が傾いていることが一目で分かる
- 実物のミステリースポットは、視界の大半を部屋が占め、三半規管が混乱することで部屋の座標系が勝つ。画面の中では同じ条件を作れない
- 人形と下げ振りについても同じ理由で「部屋が傾き、人形はまっすぐ」という真実がそのまま見えてしまい、錯視になっていない

#### 修正方針

部屋の中では**カメラの向きを部屋の座標系に合わせる**。床と壁が画面上で水平・垂直になり、代わりに球・人形・下げ振りが傾いて見える。種明かしでカメラを世界の水平へ戻し、部屋全体が傾いていたことを見せる。

1. **視界フレームの傾き(新機構)**
   - `Exhibit` に `framePatch?: (x, z) => { axis: Vector3; angle: number } | null` を追加する。`groundPatch` と同様に `Museum.framePatches` に登録し、`PlayerController.frameAt` から参照する
   - `PlayerController.syncCamera` で yaw/pitch のクォータニオンに、軸・角度のクォータニオンを `premultiply` する(世界座標での回転)。yaw は傾いたフレームの上方向まわりになるので、見回しても部屋は水平のまま
   - `TiltedRoom` は、部屋のローカル z 軸(入口の軸、世界座標)を軸に `TILT.angle × blend × (1 − hintT)` を返す。`blend` は純関数 `tiltFrameBlend(lx, lz)`: 部屋の中で 1、入口前の帯 `ramp`(0.9 m)で smoothstep により 1 → 0、外で 0。位置だけで決まるので状態を持たず、ワープや後退でも破綻しない
   - `cameraOverride`(演出中)には適用しない
2. **軌道の傾き `TILT.trackAngle` を 6° → 9°** にする。世界では 3° の下り(ほとんど水平に見える)、部屋に対しては 9° の登り。フレームを合わせた画面上では球が明確に上へ転がる
3. **種明かし**: 既存の `WireframeReveal`(真の水平線・重力の矢印)と `MaterialSwap`(壁の半透明化)に、`hintT` を進める小さな `HintEffect`(F3 の `whiten` と同じ作り)を加え、視界が世界の水平へ戻る。所要 1200 → 1600 ms
4. **文言**: `exhibits.ja.ts` の hint を「部屋全体が 12° 傾いています。中に入ると視界も部屋に合わせて傾くので、床と壁が水平に見え、本当は下り坂を転がる球が登っているように、鉛直に立つ人形が傾いているように見えます。…」に改める。`Docs/exhibits/F2-tilted-room.md` の「カメラは水平を保つので」を書き換える

#### 変更ファイル

`src/exhibits/Exhibit.ts`、`src/exhibits/registry.ts`、`src/museum/Museum.ts`、`src/player/PlayerController.ts`、`src/exhibits/fable/TiltedRoom.ts`、`src/content/exhibits.ja.ts`、`Docs/exhibits/F2-tilted-room.md`

#### テストと受け入れ基準

- 単体: `tiltFrameBlend` が部屋の中で 1、帯の中央で 0.5 付近、外で 0。`PlayerController` に軸・角度を与えると、カメラの上方向ベクトルが 12° 傾く(three.js の数学クラスは node で動く)
- E2E: 推奨視点(部屋の中)へワープするとカメラの上方向の y 成分が cos 12° ≈ 0.978。ヒントを開くと 1 に戻り、閉じると再び傾く。部屋を出ると 1
- 目視: 部屋の中で球が坂を登り、人形と下げ振りが傾いて見える。`tilted-room.png` / `-hint.png` を撮り直す
- リスク(§8): カメラの傾きによる不快感。帯での滑らかな遷移と 12° という小さな角度で抑える

### 5.2 F3 色の部屋: エッジが見える

#### 現状と原因(R0 で確定)

内装は無灯の `MeshBasicMaterial` 一色なので、材質やライトからは稜線は出ない。原因は **high ティアの GTAO(SSAO 相当)** だった。スクリーンスペースの遮蔽は深度と法線だけを見るため、無灯の壁でも床・壁・天井の入隅が暗くなり、稜線が浮かび上がる。

実測(R0): 実 GPU(Apple A18 Pro / ANGLE Metal)と SwiftShader の双方で、推奨視点のカメラを固定したまま `GTAOPass.enabled` だけを切り替えて比較した。GTAO を切ると床・壁・天井の 6 本の稜線がすべて消え、画面は一様な色面になる(PNG の圧縮後サイズも 150 KB → 50 KB に落ち、階調がほぼ失われることを裏づける)。GTAO を戻すと稜線が再び現れる。ドア越しの外光や内装の床の段差は関与していない。

`Docs/screenshots/ganzfeld-chamber.png` に稜線がないのは、SwiftShader が `detectTier` で low と判定されて GTAO が無効になるため。実 GPU の high とはこの点だけが違う。

#### 修正方針

- `PostProcess` に AO の一時停止 API を足す: `suppressAO(key: string, on: boolean)`(キー集合が空でないあいだ `GTAOPass.enabled = false`)。F4 の被写界深度と衝突しないようキーで管理する
- `LoadContext` に `post: PostProcess` を追加し、展示から参照できるようにする
- `GanzfeldChamber.update` で、プレイヤーが内装の箱の中(ローカル座標、余白 0.3 m)にいる間だけ `suppressAO('ganzfeld', true)` にする。一様な部屋の中では AO の切り替わりは目に見えない
- 任意(スコープ外候補): ドアの外が見えることも奥行きの手がかりになる。入口に短い前室(光の暗室)を付ける案は今回は見送る

#### 変更ファイル

`src/app/PostProcess.ts`、`src/exhibits/Exhibit.ts`(`LoadContext`)、`src/app/App.ts`、`src/exhibits/fable/GanzfeldChamber.ts`、`Docs/exhibits/F3-ganzfeld-chamber.md`

#### テストと受け入れ基準

- E2E(`?quality=high`): 部屋の中へワープすると `__museum.post.aoEnabled` が false、外へ出ると true
- 目視(実 GPU、high): 壁・床・天井の入隅が識別できない。`SHOT_QUERY=&quality=high` で `ganzfeld-chamber.png` を撮り直す(SwiftShader でも GTAO は正しく描かれる。時間はかかる)

### 5.3 F4 窓の外の庭: 水庭が見えない、フォグと被写界深度

#### 現状と原因

計算で確認した。

- 目の高さは 1.6 m、水面は 1.504 m(`tableTop` 1.5)。生垣の箱の上端は 1.58 m、その上の球体は最大 1.76 m。推奨視点(窓から 1.3 m)から一番遠い水面(z = −7.65)への視線は、生垣の位置(z = −3.05)で高さ 1.553 m を通る。**視線は生垣より低く、水面はどこも見えない**
- 生垣がなくても、目が水面のわずか 0.1 m 上にあるため、水面の見かけの厚みは約 0.6°(720p で数ピクセル)。「広大な水庭」にならない
- 中央の桟(x = 0)が視野の中心を塞いでいる
- フォグと被写界深度は IMPLEMENTATION_PLAN §5.2 の F4 に書かれているが未実装。奥行きは頂点色で霞の色に寄せる(`hazed`)静的な近似だけ

#### 修正方針 A: 配置の再設計(水面を主役にする)

| 要素 | 現状 | 変更 | 根拠 |
|------|------|------|------|
| 水面の高さ | 1.504 | **0.90**(窓の腰 0.85 と同じ高さ) | 目が 0.7 m 上になり、見下ろす角度がつく |
| 台 | 天面 1.5、z −3.2〜−7.8、脚あり | 床から立ち上がる一体の塊、z **−1.45〜−7.75**、x ±4.75。脚は廃止 | 手前に寄せて水面の見かけの厚みを稼ぐ。窓の腰(0.85)が z = −1.3 で高さ 0.1 以下を隠すので、台の前の床は見えない |
| 縁の隠蔽 | 生垣 + 石の植栽壁 | **石の護岸**(x ±5.7、高さ 0〜0.95、z −1.3、厚 0.3)。天端が水面より 5 cm 高い縁石になる | 台の縁と正面を隠しつつ、水面を遮らない |
| 生垣 | 全幅 | 廃止。護岸の両端に低い植え込みを数個残す | 中央の水面を空ける |
| 手前の岸の木・石・灯籠 | z ≈ −3.4、中央にも | 左右(x の絶対値が 3.2 を超える側)の z −1.6〜−2.6 に寄せる。高さ 0.4〜0.6 | 中央を水面に譲る |
| 中景 | なし | 小島 1 つ(z ≈ −4.5)に 0.25 m の木 | 近・中・遠の大きさの勾配を作る |
| 奥の岸 | z −7.2〜−7.6 | 維持。岸の帯(高さ 0.92)を追加 | |
| 桟 | x = −2.13, 0, 2.13 | **x = ±1.6** の 2 本(3 枚のガラス) | 中央を塞がない |
| 推奨視点 | pitch +0.02 | pitch **−0.10** | 水面の帯(水平から 4°〜14° 下)を画面中央へ |
| 種明かしの人型・物差し | (−1.6, 0, −3.3) 等 | 護岸の向こうの水の中(−1.4, 0.9, −1.8)、物差し (1.6, 0.9, −1.7) | 頭頂 2.6 m が窓の上端 2.75 に収まる |

計算: 推奨視点から手前の水際(z = −1.45)への俯角は atan(0.7/2.75) ≈ 14°、奥の水際(z = −7.75)は atan(0.7/9.05) ≈ 4.4°。水面は垂直画角のうち約 10°(720p で約 100 px)を占める。

#### 修正方針 B: 局所フォグ

three.js のフォグはシーン全体に掛かるので、**ジオラマ以外の材質でフォグを無効化**して局所化する。

- `scene.fog = new THREE.Fog(HAZE, 2.5, 11)`。カメラが窓から 1.3 m のとき、ジオラマはカメラから 2.75〜9.3 m にあり、この範囲に勾配が乗る。水面はフラグメントごとに霞むので、遠くの水面が霧に溶ける
- `applyFogScope(scene, allowedRoots)`: ジオラマの `enclosure` 配下を除くすべての `Material` に `fog = false` を立て `needsUpdate` する。書き割り(空・遠山)と天井の空の面も `fog = false`(絵の階調を保つ)。`registry.loadAll` の後、`warmUpShaders` の前に 1 回実行する(`fog` はシェーダの define なので、先に確定させないと最初のフレームで再コンパイルが走る)
- 種明かしに `FogChange`(`LightChange` と同じ作りの小さな `HintEffect`)を加え、near/far を大きくして霞を消す。手描きの書き割りが 8 m 先に現れ、「霞も演出」だったことが分かる

#### 修正方針 C: 被写界深度(限定的に)

懸念を先に述べる。**浅い被写界深度はミニチュアの手がかり**(ティルトシフト写真が実景を模型に見せるのと同じ)で、広大な庭に見せたい F4 では逆効果になりうる。実際の遠景は事実上パンフォーカスなので、「遠景のわずかな軟化」に限定して入れる。

- `PostProcess.setDepthOfField({ focus, aperture, maxblur } | null)`: `BokehPass` を RenderPass(と GTAO)の後、Bloom の前に挿す。コンポーザーがある mid/high のみ。low は対象外
- `ForcedPerspectiveGarden.update` で、プレイヤーが F4 の判定圏内にいて窓の方(内向き法線との内積 > 0.5)を見ている間だけ有効にする。focus は手前の岸(約 2.8 m)、`maxblur` は 0.004 程度から始め、奥の岸だけがわずかに柔らかくなる値に詰める
- `?dof=0` / `?dof=1` で強制できるようにし、フェーズ R3 で A/B を行う。模型感が増すと判断したら既定 OFF で出荷し、フォグだけを残す(A/B の実施は §9-2 で決定)

#### 文言・仕様メモ

- `exhibits.ja.ts` の F4 hint「窓の向こう 3 m に置かれた」→「窓の向こう 1.5 m から始まる 1/20 スケールのジオラマ」。README の F4 行「3 m 先の 1/20 のジオラマ」も同様(§9-5 で決定)
- `Docs/exhibits/F4-garden-window.md` を配置・フォグ・被写界深度の記述に更新

#### 変更ファイル

`src/exhibits/fable/ForcedPerspectiveGarden.ts`、`src/exhibits/fable/index.ts`(推奨視点の pitch)、`src/museum/layout/corridor.ts`(桟は展示側なので変更なし。窓の開口は維持)、`src/app/PostProcess.ts`、`src/app/App.ts`(`applyFogScope` 呼び出し)、新規 `src/exhibits/effects/FogChange.ts`、新規 `src/museum/fogScope.ts`

#### テストと受け入れ基準

- 単体: `visibleWaterBand(eye, sill, waterY, nearZ, farZ, occluders)` のような純関数で、推奨視点から水面が遮られず、見かけの角度幅が 8° 以上あることを検証する(設計値を守るガード)。`applyFogScope` を Object3D の合成ツリーに掛け、ジオラマ外の材質だけ `fog = false` になる
- E2E: 起動後、ジオラマ外で `material.fog === true` の材質が 0 個。F4 の判定圏内で `__museum.post.dofEnabled` が true(mid/high)、離れると false
- 目視: 窓から水面が広く見え、奥ほど霞む。種明かしで霞が消え人型が現れる。`garden-window.png` / `-hint.png` を撮り直す

### 5.4 F6 終わらない階段: 天井にめり込む

#### 現状と原因(計算で確認)

`EndlessStair.build` のフライト天井 `slab()` は、箱を `rotation.z = +slope` で傾けてから `rotation.y` で向きを決める(Euler 順序 'YXZ' → 行列 Ry·Rx·Rz なので z 回転が先に効く)。`+slope` は常に「箱のローカル +x 端が高い」。

| フライト | 登る向き | `rotation.y` | ローカル +x 端の向き(高い側) | 判定 |
|---------|---------|-------------|-----------------------------|------|
| A(東) | 北(−z) | π/2 | −z | 正 |
| B(北) | 西(−x) | 0 | +x | **逆** |
| C(西) | 南(+z) | −π/2 | +z | 正 |
| D(南) | 東(+x) | π | −x | **逆** |

B の頂部(x = −1.65、段の高さ base + 2.8)で天井の下面は base + 3.93 → **天井高 1.13 m**。目の高さ 1.6 m のカメラ(base + 4.4)はスラブの上に出る。D も同様。フライトの下端側では逆に天井が 1.5 m 高く、踊り場の天井との段差になっている。「登っている最中に高さが狭まった部分があってカメラがめり込む」と一致する。

実測(R0): 組み上がったジオメトリの三角形を集め、各段の足元から真上へレイを飛ばして頭上の高さを測った。

| フライト | 登る向き | 頭上の高さ(最小 〜 最大) | 判定 |
|---------|---------|--------------------------|------|
| A(東) | 北 | 2.36 〜 2.36 m | 正 |
| B(北) | 西 | **1.31** 〜 3.41 m | 逆 |
| C(西) | 南 | 2.36 〜 2.36 m | 正 |
| D(南) | 東 | **1.31** 〜 3.41 m | 逆 |

B・D では登るほど天井が下がり、頂部で 1.31 m まで狭まる。目の高さ 1.6 m を 0.3 m 下回るため、カメラが天井を突き抜ける。

#### 修正方針

- 天井の高さを純関数 `stairCeilingHeight(x, z, currentY)` として `stairGeometry.ts` に定義する。踊り場は床から、フライトは段の勾配線(`StairRegion.slopeHeight`)から `headroom` 上。周回の選択は `stairHeight` と同じ規則
- `slab()` を「低い端と高い端の 2 点から向き・傾き・中心を決める」形に書き換え、`sign` 引数を廃止する。板の下面がちょうど勾配線 + `headroom` を通るよう、法線方向へ厚みの半分だけ持ち上げる
- 結果(実測): 全フライトで頭上 2.413 m(段の中央)、踊り場 2.50 m。修正前の A・C は 2.359 m だったので 5 cm ほど上がり、B・D の 1.31 m は解消した

#### 変更ファイル

`src/exhibits/fable/stairGeometry.ts`、`src/exhibits/fable/EndlessStair.ts`、`tests/unit/stairGeometry.test.ts`、`tests/e2e/stair.spec.ts`、`Docs/exhibits/F6-endless-stair.md`

#### テストと受け入れ基準

- 単体(修正前に書いて失敗させる): 各フライトを 20 点ずつ標本化し、`stairCeilingHeight − stairRegion.height ≥ headroom − 0.2` かつ `≥ 1.6 + 0.4`。踊り場とフライトの境界で天井高の差が 0.15 m 未満
- E2E(R0 で追加済み、現在は赤): `tests/e2e/stair.spec.ts` の「どのフライトでも頭上が確保され、カメラが天井にめり込まない」。組み上がったジオメトリの三角形から真上への当たり判定を自前で解き、各フライトの頭上の最小値が 2.0 m を超えること、4 本のフライトの高さの差が 0.2 m 未満であることを確かめる。既存の継ぎ目テストが通る
- 目視: 1 周登って天井が狭まる箇所がない。`endless-stair.png` / `-hint.png` を撮り直す

### 5.5 F7 逆さの水面: 水面に見えない

#### 現状と原因

- 水面は `MeshPhysicalMaterial`(opacity 0.42、metalness 0.55、roughness 0.05)の平板で、周囲の**実際の反射がない**(環境マップの鈍い光沢のみ)。揺らぎもない
- metalness 0.55 では水のフレネル特性(正面では暗く、浅い角度で強く反射)が出ず、灰青色のガラス板に見える
- 水面下に吊るした逆さの彫刻は「反射」ではなく「ガラスの下の物体」として読まれる

#### 修正方針

**平面反射(Reflector)で本物の映り込みを作り、「鏡の中にだけある彫刻」を映す。**

1. `src/exhibits/fable/WaterSurface.ts`(three.js `Reflector` を元にした自前実装。MIT)
   - オプション: `textureWidth`(high 512 / mid 256)、揺らぎ用の法線マップ(`makeCanvasTexture` で生成したノイズ 2 層をゆっくり流し、UV を 0.02 程度歪める)、フレネル(基準反射率 F0 = 0.15 前後から調整。物理値 0.02 では暗すぎる)、水の基本色(暗色 0x1f2a30)、`reflectionStrength`(種明かし用)
   - `onBeforeReflect` / `onAfterReflect` コールバック: 反射の描画中だけ**立方体の彫刻を非表示、球の彫刻を表示**に切り替える。層(layers)を使わないので影の設定に影響しない
   - 1 フレームに 1 回だけ反射を描く(`renderer.info.render.frame` で判定。GTAO の法線パスでも `onBeforeRender` が呼ばれるため)。水盤が視錐台の外か 12 m 以上離れているときは描かない(`InfinityWell` と同じ判定)
2. 彫刻の配置(mid/high): 立方体(本物)と球(鏡の中だけ)を**同じ位置に直立**させて置く。反射は鏡像として自然に上下逆になる。水面下の逆さの彫刻は置かない
3. low ティア: 反射描画を避け、現行方式(半透明の板 + 水面下の逆さの球)を残す
4. 種明かし(mid/high): 球の彫刻を主画面に半透明(0.55、青白)で `Reveal` し、`reflectionStrength` を 1 → 0.35 に落とす小さな `HintEffect` を組み合わせる。「反射に映っていたのはこの彫刻」が一枚で分かる。low は現行の `MaterialSwap` + `LightChange`
5. 文言(両ティアで成立する表現に): 「水面は鏡ですが、映っているのはあなたの目には見えない別の彫刻(球を積んだもの)です。種明かしで、その彫刻を見えるようにします。」(§9-4 で決定)。`Docs/exhibits/F7-inverted-pond.md` を更新
6. 任意(フェーズ R6): F4 の水面にも `WaterSurface` を低解像度で流用し、空と遠山の書き割りを映す

#### 変更ファイル

新規 `src/exhibits/fable/WaterSurface.ts`、`src/exhibits/fable/InvertedPond.ts`、`src/content/exhibits.ja.ts`、`src/app/App.ts`(`warmUpShaders` で反射描画時のみ見える材質もコンパイルする: 球の彫刻を一時的に visible にして compile)、`Docs/exhibits/F7-inverted-pond.md`

#### テストと受け入れ基準

- E2E(`?quality=high`): 推奨視点で `reflectionRenders` カウンタが増える。背を向けると増えない(視錐台外)。ヒント開閉で `reflectionStrength` が 1 → 0.35 → 1
- 性能: 実機 mid(スマホ)で推奨視点 30 fps 以上(`?stats=1`)
- 目視: 水盤の縁・天井・光が水面に映り、わずかに揺らぐ。反射の中の彫刻が水上と違う形をしている。`inverted-pond.png` / `-hint.png` を撮り直す

---

## 6. 横断的な変更

| 変更 | 内容 | 使う項目 |
|------|------|---------|
| `LoadContext.post` | 展示から `PostProcess` を参照できるようにする | F3(AO 停止)、F4(被写界深度) |
| `PostProcess` API | `suppressAO(key, on)`、`setDepthOfField(params)` / `setDepthOfField(null)`、`aoEnabled` / `dofEnabled`(テスト用の読み取り) | F3、F4 |
| 視界フレームの傾き | `Exhibit.framePatch` → `Museum.framePatches` → `PlayerController.frameAt`。`syncCamera` で軸・角度を `premultiply` | F2 |
| 局所フォグ | `scene.fog` + `applyFogScope(scene, allowedRoots)`。`loadAll` 後・`warmUpShaders` 前に実行 | F4 |
| 新しい演出部品 | `FogChange`(フォグの near/far を補間)。`reflectionStrength` のようなユニフォーム補間は展示内の小さな `HintEffect` で済ませる | F4、F7 |
| 水面 | `WaterSurface`(平面反射 + 揺らぎ + フレネル + 可視切替コールバック) | F7(任意で F4) |
| 入力 | `MouseLookCore`(DOM 非依存)、右/左ドラッグ、PointerLock は `L` キーの任意機能 | M1 |
| 文書 | `Docs/exhibits/F2,F3,F4,F6,F7`、`exhibits.ja.ts`(F2、F4、F7)、README(操作表、注記、F4 行)、`Docs/screenshots/` の撮り直し | 全体 |

`IMPLEMENTATION_PLAN.md` は初版の記録として変更せず、本書を改訂の記録とする。

---

## 7. 実装フェーズ

各フェーズは単独でマージ可能な PR とする(ブランチ名は既存の `fix/<topic>` に合わせる)。

| フェーズ | 内容 | 依存 | 規模 | 完了条件 |
|---------|------|------|------|---------|
| R0 調査 ✔ | 実 GPU で F3 の原因を切り分け。F6 の天井高テストを書いて失敗を確認 | なし | S | 完了。F3 の原因は GTAO と確定(§5.2)。F6 の E2E が赤(頭上 1.31 m、§5.4)。現状のスクリーンショットは `Docs/screenshots/` の git 履歴を基準とする |
| R1 操作方法 ✔ | §3。`MouseLookCore`、右/左ドラッグ、`L` キー、HUD・ヘルプ・README | なし | M | 完了。単体 10 件、E2E `controls.spec.ts` 6 件が緑。ドラッグ直後にヒントボタンを押せることを E2E で確認した |
| R1' 小修正 ✔ | F6(§5.4)、C7(§4.2)。別 PR に分けた | R0 | S+S | 完了。F6 は単体 6 件と E2E が緑、全フライトで頭上 2.413 m。C7 は陰影が読めるようになり、スクリーンショットを撮り直した |
| R2 傾きの部屋 | §5.1。視界フレームの機構と `TiltedRoom` の変更、文言 | なし | M | E2E で傾き/復帰を確認。目視で球が登る |
| R3 ポストプロセスと回廊 | `LoadContext.post`、`PostProcess` API、F3(§5.2)、F4(§5.3 A・B・C)。F3 を先に小さな PR、F4 を続ける | R0 | S + L | F3: 実 GPU で稜線が消える。F4: 水面が見え、霞が掛かる。被写界深度の A/B 判断 |
| R4 水面 | §5.5。`WaterSurface`、`InvertedPond` の再構成、low の代替、文言 | なし | L | E2E と実機 mid の fps。目視 |
| R5 エイムズの部屋 | §4.1。等距離視点と `CameraPath` | なし | M | E2E で見かけの身長比 1 ± 0.05 |
| R6 仕上げ | 全展示のスクリーンショット撮り直し、`Docs/exhibits/` と README の最終確認、任意で F4 に `WaterSurface` を流用 | R1〜R5 | S | §1 の完成の定義 |

推奨順: R0 → R1 → R1' → R3(F3) → R2 → R3(F4) → R4 → R5 → R6。R1 と R1' は利用者への影響が大きく修正が小さいので先に出す。

---

## 8. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| F2 のカメラ傾けで不快感が出る | 中 | 入口の帯(0.9 m)で smoothstep 遷移。角度は 12° に留める。R2 のレビューで確認し、受け入れられなければ軌道角(9°)の変更だけを残す(採用は §9-3 で決定。撤回はこの時点で判断) |
| F4 の被写界深度が模型感を強める | 中 | 遠景のみの弱いぼかしに限定し、`?dof=` で A/B(§9-2)。悪化すれば既定 OFF |
| 局所フォグの漏れ(ジオラマ外の材質にフォグが掛かる) | 中 | `applyFogScope` を `loadAll` 後に一括適用し、E2E で「ジオラマ外に `fog = true` が 0 個」を検証。演出が後から作る材質は `build` 時点で存在する |
| F7 の反射描画で mid ティアの fps が落ちる | 中 | 反射テクスチャ 256、視錐台・距離での間引き、1 フレーム 1 回の保証。実機で 30 fps を確認できなければ mid も low 方式へ |
| F7 の反射で影マップ・光源間引きと干渉 | 低 | Reflector と同じく反射描画中は `shadowMap.autoUpdate` を止める。`LightCuller` はメインカメラ基準のまま(反射側は同じ光源集合を描く) |
| F3 の原因が GTAO ではない | 中 | R0 で切り分け、他要因なら本書 §5.2 を改訂してから着手する |
| 右ドラッグが使えない入力環境(トラックパッド) | 低 | 左ドラッグも許可。PointerLock を `L` キーで残す |
| E2E が SwiftShader で遅く、GTAO・反射のテストが時間切れ | 中 | `?timescale=3` と長いポーリングを踏襲。GTAO・反射の E2E はフラグの読み取りを主とし、描画結果は目視と screenshots に委ねる |
| 文言と実装のずれ(F2、F4、F7) | 低 | 各 PR に `exhibits.ja.ts` と `Docs/exhibits/` の更新を含める。`content.test.ts` で id の整合を維持 |

---

## 9. 決定事項

着手前に確認した 5 点への回答(2026-09-02)と、計画への反映。

| # | 論点 | 決定 | 計画への反映 |
|---|------|------|--------------|
| 1 | 操作方法: 左ドラッグも視点回転に含めるか | 含める | §3.2 のとおり右・左どちらのボタンでもドラッグで見回せる。PointerLock については指示がないため、推奨どおり `L` キーの任意機能として残す(削除はしない) |
| 2 | F4 の被写界深度 | A/B で判断する | §5.3 C を実装し、`?dof=0` / `?dof=1` で比較する。フェーズ R3 の完了条件に「A/B の結論(既定 ON か OFF か)」を含める。模型感が増すと判断したら既定 OFF、フォグのみで出荷 |
| 3 | F2 のカメラを部屋に合わせて傾ける案 | 採用 | §5.1 の視界フレームの機構(`framePatch`)と軌道角 9° を実装する。不快感の確認はフェーズ R2 のレビューで行う(§8) |
| 4 | F7 の説明文の変更 | 可 | §5.5-5 の文言で `exhibits.ja.ts` と `Docs/exhibits/F7-inverted-pond.md` を更新する |
| 5 | F4 の文言「窓の向こう 3 m」→「1.5 m から」 | 変えてよい | `exhibits.ja.ts`、README の F4 行、`Docs/exhibits/F4-garden-window.md` を §5.3 の配置に合わせて更新する |
