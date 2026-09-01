import type * as THREE from 'three';
import type { Updatable } from '../app/Loop';
import { bus } from './events';

export type QualityTier = 'high' | 'mid' | 'low';

export interface QualitySettings {
  tier: QualityTier;
  /** devicePixelRatio の上限 */
  maxPixelRatio: number;
  /** 影マップの解像度(px)。0 なら動的な影なし */
  shadowMapSize: number;
  /** 動的な影(1 灯)を使うか */
  dynamicShadows: boolean;
  bloom: boolean;
  ssao: boolean;
}

export const TIER_SETTINGS: Record<QualityTier, QualitySettings> = {
  high: {
    tier: 'high',
    maxPixelRatio: 2.0,
    shadowMapSize: 2048,
    dynamicShadows: true,
    bloom: true,
    ssao: true,
  },
  mid: {
    tier: 'mid',
    maxPixelRatio: 1.5,
    shadowMapSize: 1024,
    dynamicShadows: true,
    bloom: true,
    ssao: false,
  },
  low: {
    tier: 'low',
    maxPixelRatio: 1.0,
    shadowMapSize: 0,
    dynamicShadows: false,
    bloom: false,
    ssao: false,
  },
};

const TIER_ORDER: QualityTier[] = ['high', 'mid', 'low'];

/** GPU のレンダラ文字列とモバイル判定から初期ティアを決める */
export function detectTier(gpu: string | null | undefined, isMobile: boolean): QualityTier {
  const s = (gpu ?? '').toLowerCase();
  if (/swiftshader|llvmpipe|software|microsoft basic render/.test(s)) return 'low';
  if (isMobile) {
    if (
      /adreno \(tm\) [1-5]\d\d|adreno [1-5]\d\d|mali-[4t]|mali-g[1-5]\d|powervr|videocore/.test(s)
    ) {
      return 'low';
    }
    return 'mid';
  }
  if (/intel|iris|uhd graphics|hd graphics/.test(s) && !/arc/.test(s)) return 'mid';
  return 'high';
}

export function lowerTier(tier: QualityTier): QualityTier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.min(i + 1, TIER_ORDER.length - 1)] ?? 'low';
}

export interface PixelRatioAdjustOptions {
  current: number;
  avgFps: number;
  targetFps: number;
  min: number;
  max: number;
  step?: number;
}

/**
 * 実測 fps から次の pixelRatio を決める。
 * 目標の 85% を下回れば 1 段下げ、目標をほぼ満たしていれば 1 段上げる。
 */
export function adjustPixelRatio(o: PixelRatioAdjustOptions): number {
  const step = o.step ?? 0.25;
  const clamp = (v: number) => Math.min(o.max, Math.max(o.min, v));
  if (o.avgFps < o.targetFps * 0.85) return clamp(o.current - step);
  if (o.avgFps >= o.targetFps * 0.97) return clamp(o.current + step);
  return clamp(o.current);
}

export interface QualityControllerOptions {
  isMobile: boolean;
  gpu: string | null;
  /** 判定ウィンドウ(秒) */
  windowSeconds?: number;
  /** 初期ティアを固定する(デバッグ用) */
  forceTier?: QualityTier;
}

/**
 * 起動時の GPU 情報でティアを決め、以後は実測 fps で pixelRatio を動的に調整する。
 * pixelRatio が下限に張り付いても fps が出ない場合はティアを 1 段下げる。
 */
export class QualityController implements Updatable {
  settings: QualitySettings;
  pixelRatio: number;
  readonly targetFps: number;
  readonly minPixelRatio: number;
  readonly windowSeconds: number;
  /** 動的調整を止める(演出中など) */
  paused = false;

  private frames = 0;
  private time = 0;
  private lowStreak = 0;
  private readonly devicePixelRatio: number;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    opts: QualityControllerOptions,
  ) {
    const tier = opts.forceTier ?? detectTier(opts.gpu, opts.isMobile);
    this.settings = TIER_SETTINGS[tier];
    this.targetFps = opts.isMobile ? 30 : 55;
    this.minPixelRatio = opts.isMobile ? 0.6 : 0.75;
    this.windowSeconds = opts.windowSeconds ?? 2;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.pixelRatio = Math.min(this.devicePixelRatio, this.settings.maxPixelRatio);
    this.apply();
  }

  get tier(): QualityTier {
    return this.settings.tier;
  }

  setTier(tier: QualityTier): void {
    if (tier === this.settings.tier) return;
    this.settings = TIER_SETTINGS[tier];
    this.pixelRatio = Math.min(this.pixelRatio, this.settings.maxPixelRatio);
    this.apply();
  }

  update(delta: number): void {
    if (this.paused) return;
    this.frames++;
    this.time += delta;
    if (this.time < this.windowSeconds) return;
    const avgFps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;

    const next = adjustPixelRatio({
      current: this.pixelRatio,
      avgFps,
      targetFps: this.targetFps,
      min: this.minPixelRatio,
      max: Math.min(this.devicePixelRatio, this.settings.maxPixelRatio),
    });

    if (avgFps < this.targetFps * 0.7 && next <= this.minPixelRatio + 1e-6) {
      this.lowStreak++;
      if (this.lowStreak >= 3 && this.settings.tier !== 'low') {
        this.lowStreak = 0;
        this.setTier(lowerTier(this.settings.tier));
        return;
      }
    } else {
      this.lowStreak = 0;
    }

    if (Math.abs(next - this.pixelRatio) > 1e-6) {
      this.pixelRatio = next;
      this.apply();
    }
  }

  private apply(): void {
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = this.settings.dynamicShadows;
    bus.emit('quality:change', { tier: this.settings.tier, pixelRatio: this.pixelRatio });
  }
}

/** WEBGL_debug_renderer_info からレンダラ名を取る(取れなければ null) */
export function readGpuName(renderer: THREE.WebGLRenderer): string | null {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const name = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      if (typeof name === 'string') return name;
    }
    const fallback = gl.getParameter(gl.RENDERER);
    return typeof fallback === 'string' ? fallback : null;
  } catch {
    return null;
  }
}
