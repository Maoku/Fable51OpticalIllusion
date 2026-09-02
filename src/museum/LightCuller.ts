import * as THREE from 'three';
import type { Updatable } from '../app/Loop';

/** 同時に点灯させる光源の上限(種類ごと) */
export interface LightBudget {
  point: number;
  spot: number;
}

/**
 * 既定の点灯上限(合計 13 灯)。
 *
 * 館内 16 地点 × 4 方向の 64 視点で「全 19 灯を点けた画」との画素差を測って決めた。
 * 旧実装(範囲判定・4〜16 灯で変動)との比較:
 *
 * | 方式        | 点灯数     | 平均誤差 | 平均差分画素 | 最大差分画素 |
 * | ----------- | ---------- | -------- | ------------ | ------------ |
 * | 旧(範囲)  | 4〜16 変動 | 0.093    | 0.96 %       | 13.1 %       |
 * | 8p+5s       | 13 固定    | 0.025    | 0.31 %       | 11.6 %       |
 * | 10p+6s      | 16 固定    | 0.005    | 0.03 %       | 0.03 %       |
 *
 * 10p+6s ならほぼ完全に一致するが、旧実装の最大点灯数と並ぶので、点灯数の少ない
 * 部屋(古典ホールは 4〜6 灯だった)で常時その負荷を払うことになる。
 * 8p+5s は旧実装より誤差が小さく、かつ旧実装の最大より軽いので、こちらを既定にする。
 */
export const DEFAULT_LIGHT_BUDGET: LightBudget = { point: 8, spot: 5 };

/** 視錐台の外に出た光源に付ける下駄。実質「最後に落とす」印 */
const OUT_OF_VIEW = 1e6;

interface Entry {
  light: THREE.Light;
  /** 光が届かなくなる距離(カットオフ距離、なければ cullRange) */
  reach: number;
  pos: THREE.Vector3;
  /** 小さいほど画面への寄与が大きい */
  score: number;
}

/**
 * 距離と視錐台による光源の間引き。
 *
 * three.js はシーン内の可視な点光源・スポットをすべて各フラグメントで評価するため、
 * 効かない光源は visible = false にして計算から外したい。
 *
 * ただし **点灯数は常に一定に保つ**必要がある。three.js は点灯数を
 * `NUM_POINT_LIGHTS` などのマクロとしてシェーダに焼き込むので、点灯数が変わると
 * lights.state.version が上がり、そのフレームで描くマテリアルが *すべて* 再コンパイル
 * される。館内を 1 周するだけで 20 秒ぶんの停止が入り、これが歩き回ったときの
 * 引き攣りの正体だった。
 *
 * そこで「範囲内かどうか」ではなく「効く順に budget 灯」を点ける方式にして、
 * 点灯数を min(総数, budget) で固定する。順位は
 *   - 影響範囲が視錐台からはみ出しきっている光源(見える画素に寄与できない)を最後に、
 *   - 残りはカットオフ距離で正規化した視点からの近さ順
 * で決める。
 *
 * 光源の `userData.cullRange`(m)は、カットオフ距離を持たない光源の到達距離として使う。
 */
export class LightCuller implements Updatable {
  private readonly point: Entry[] = [];
  private readonly spot: Entry[] = [];
  /** ソート用の作業領域(毎フレームの確保を避ける) */
  private readonly order: number[] = [];
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  private readonly viewInverse = new THREE.Matrix4();
  private timer = 0;
  /** 判定の間隔(秒)。視線でも点灯先が変わるので短めに回す */
  interval = 0.1;
  readonly budget: LightBudget;

  constructor(
    private readonly getCamera: () => THREE.Camera,
    budget: LightBudget = DEFAULT_LIGHT_BUDGET,
  ) {
    this.budget = { ...budget };
  }

  /** ルート以下の点光源・スポットを登録する */
  collect(root: THREE.Object3D, defaultRange = 18): void {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const isSpot = o instanceof THREE.SpotLight;
      if (!isSpot && !(o instanceof THREE.PointLight)) return;
      // three.js は distance を超えた位置では減衰が厳密に 0 になる。
      // distance を持たない光源だけ cullRange(なければ defaultRange)で代用する。
      const reach =
        o.distance > 0
          ? o.distance
          : ((o.userData.cullRange as number | undefined) ?? defaultRange);
      const pos = new THREE.Vector3();
      o.getWorldPosition(pos);
      (isSpot ? this.spot : this.point).push({ light: o, reach, pos, score: 0 });
    });
    this.apply();
  }

  get count(): number {
    return this.point.length + this.spot.length;
  }

  /** 常に点灯している数(一定)。シェーダの再コンパイルを避けるため変化しない */
  get activeCount(): number {
    return (
      Math.min(this.point.length, this.budget.point) + Math.min(this.spot.length, this.budget.spot)
    );
  }

  update(delta: number): void {
    this.timer += delta;
    if (this.timer < this.interval) return;
    this.timer = 0;
    this.apply();
  }

  private apply(): void {
    const camera = this.getCamera();
    // update の時点では matrixWorldInverse がまだ前フレームのものなので自分で作る
    camera.updateMatrixWorld();
    this.viewInverse.copy(camera.matrixWorld).invert();
    this.viewProjection.multiplyMatrices(
      (camera as THREE.PerspectiveCamera).projectionMatrix,
      this.viewInverse,
    );
    this.frustum.setFromProjectionMatrix(this.viewProjection);
    const eye = camera.position;
    this.applyGroup(this.point, this.budget.point, eye);
    this.applyGroup(this.spot, this.budget.spot, eye);
  }

  private applyGroup(entries: Entry[], budget: number, eye: THREE.Vector3): void {
    if (entries.length === 0) return;
    if (entries.length <= budget) {
      for (const e of entries) e.light.visible = true;
      return;
    }
    for (const e of entries) {
      // 展示の演出で動かす光源もあるので、位置は毎回取り直す
      e.light.getWorldPosition(e.pos);
      const distance = e.pos.distanceTo(eye);
      e.score = this.outsideView(e) ? OUT_OF_VIEW + distance : distance / e.reach;
    }
    const order = this.order;
    order.length = entries.length;
    for (let i = 0; i < entries.length; i++) order[i] = i;
    order.sort((a, b) => entries[a]!.score - entries[b]!.score);
    for (let i = 0; i < order.length; i++) {
      entries[order[i]!]!.light.visible = i < budget;
    }
  }

  /** 影響範囲(半径 reach の球)が視錐台の外に出きっているか = 見える画素に寄与しないか */
  private outsideView(e: Entry): boolean {
    for (const plane of this.frustum.planes) {
      if (plane.distanceToPoint(e.pos) < -e.reach) return true;
    }
    return false;
  }
}
