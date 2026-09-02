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
  /** 一度でも視点を回した(操作案内を消す) */
  'input:looked': undefined;
  /** タッチ操作が主入力になった / 解除された */
  'input:touchmode': { touch: boolean };
  'quality:change': { tier: QualityTier; pixelRatio: number };
  /** モーダル UI の開閉。開いている間はプレイヤー操作を止める */
  'ui:modal': { open: boolean; id: string };
  /** 最寄り展示に入った / 離れた */
  'exhibit:near': { id: string };
  'exhibit:leave': { id: string };
  /** ヒントの開閉要求(ボタン、E キー、タッチ) */
  'hint:toggle': { id: string };
  'hint:open': { id: string };
  'hint:close': { id: string };
  /** 演出の進行度 0..1 */
  'hint:progress': { id: string; t: number };
  /** 展示一覧などから推奨視点へワープ */
  warp: { id: string };
}

export const bus = new EventBus<MuseumEvents>();
