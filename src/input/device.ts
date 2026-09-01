/** タッチが主入力の端末か(スマホ・タブレット) */
export function isTouchPrimary(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse && hasTouch();
}

/** タッチ入力が使える端末か(タッチ対応ノート PC を含む) */
export function hasTouch(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

/** モバイル OS か。品質ティアの初期判定に使う */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return true;
  // iPadOS 13 以降はデスクトップ UA を名乗る
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
