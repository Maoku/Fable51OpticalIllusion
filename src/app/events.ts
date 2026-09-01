import { EventBus } from './EventBus';
import type { QualityTier } from './Quality';

/** アプリ全体で使うイベント定義。フェーズが進むごとにここへ追加する。 */
export interface MuseumEvents extends Record<string, unknown> {
  'app:ready': undefined;
  'app:resize': { width: number; height: number };
  /** ヒント開閉などのアクションキーが押された */
  'input:interact': undefined;
  /** PointerLock の取得・解除 */
  'input:lockchange': { locked: boolean };
  /** タッチ操作が主入力になった / 解除された */
  'input:touchmode': { touch: boolean };
  'quality:change': { tier: QualityTier; pixelRatio: number };
  /** モーダル UI の開閉。開いている間はプレイヤー操作を止める */
  'ui:modal': { open: boolean; id: string };
}

export const bus = new EventBus<MuseumEvents>();
