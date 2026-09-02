import * as THREE from 'three';

/** 横長〜正方形の画面で使う垂直画角(度) */
export const BASE_FOV = 70;
/** 縦長の画面でも確保したい水平画角(度) */
export const MIN_HFOV = 46;
/** 垂直画角の上限(度)。広げすぎると画面の上下の歪みが目立つ */
export const MAX_FOV = 92;

/**
 * 画面のアスペクト比に合わせた垂直画角を返す。
 *
 * PerspectiveCamera.fov は垂直画角なので、縦長の画面では水平画角だけが痩せる。
 * iPhone の縦持ち(アスペクト比 0.46 前後)では水平画角が 36 度ほどまで狭まり、
 * エイムズの部屋のように左右へ広がる展示が見切れてしまう。
 * 水平画角が MIN_HFOV を下回る場合は垂直画角を広げて補い、MAX_FOV で頭打ちにする。
 */
export function fovForAspect(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return BASE_FOV;
  const halfMinHorizontal = Math.tan(THREE.MathUtils.degToRad(MIN_HFOV / 2));
  const fov = 2 * THREE.MathUtils.radToDeg(Math.atan(halfMinHorizontal / aspect));
  return THREE.MathUtils.clamp(fov, BASE_FOV, MAX_FOV);
}
