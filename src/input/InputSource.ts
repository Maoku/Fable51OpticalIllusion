export interface MoveVector {
  /** 左右(右が正) -1..1 */
  x: number;
  /** 前後(前が正) -1..1 */
  y: number;
}

export interface LookDelta {
  /** このフレームの yaw 回転量(ラジアン、左回りが正) */
  yaw: number;
  /** このフレームの pitch 回転量(ラジアン、上向きが正) */
  pitch: number;
}

/** 移動ベクトルと視点回転を返す共通インターフェース。 */
export interface InputSource {
  readonly move: MoveVector;
  /** 蓄積した視点回転量を返してリセットする */
  consumeLook(): LookDelta;
  /** このフレームでヒント開閉などのアクションが押されたか(押下エッジ) */
  readonly interactPressed: boolean;
  /** ダッシュ中か */
  readonly sprint: boolean;
  attach(el: HTMLElement): void;
  detach(): void;
  /** フレーム末に呼び、押下エッジをリセットする */
  endFrame(): void;
}
