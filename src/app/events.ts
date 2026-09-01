import { EventBus } from './EventBus';

/** アプリ全体で使うイベント定義。フェーズが進むごとにここへ追加する。 */
export interface MuseumEvents extends Record<string, unknown> {
  'app:ready': undefined;
  'app:resize': { width: number; height: number };
}

export const bus = new EventBus<MuseumEvents>();
