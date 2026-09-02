import * as THREE from 'three';
import type { Updatable } from '../app/Loop';
import { bus } from '../app/events';
import type { CompositeInput } from '../input/CompositeInput';
import { resolveCircle, type AABB } from './Collision';

const PITCH_LIMIT = Math.PI / 2 - 0.05;
/** 1 サブステップあたりの最大移動距離(m)。壁のすり抜け防止 */
const MAX_STEP = 0.15;

export interface Pose {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
}

/** 入力をカメラの移動に変換し、コリジョンで補正する一人称コントローラ。 */
export class PlayerController implements Updatable {
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  radius = 0.35;
  eyeHeight = 1.6;
  walkSpeed = 3.0;
  sprintSpeed = 5.0;
  /** 加速の時定数の逆数(大きいほど機敏) */
  acceleration = 12;
  /** false の間は移動も視点操作も受け付けない(UI 表示中など) */
  enabled = true;
  /** 移動のみ禁止(演出中の視点固定など) */
  frozen = false;
  colliders: readonly AABB[] = [];
  /** 足元の高さ(将来の段差用) */
  groundY = 0;
  /** 演出がカメラを直接動かすときの上書き。null なら通常の一人称 */
  cameraOverride: { position: THREE.Vector3; lookAt: THREE.Vector3 } | null = null;

  private readonly velocity = new THREE.Vector3();
  private tween: {
    from: Pose;
    to: Pose;
    elapsed: number;
    duration: number;
    resolve: () => void;
  } | null = null;
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpPos = { x: 0, z: 0 };

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    readonly input: CompositeInput,
    colliders: readonly AABB[] = [],
  ) {
    this.colliders = colliders;
    this.camera.rotation.order = 'YXZ';
  }

  teleport(pose: Partial<Pose>): void {
    if (pose.position) this.position.copy(pose.position);
    if (pose.yaw !== undefined) this.yaw = pose.yaw;
    if (pose.pitch !== undefined) this.pitch = pose.pitch;
    this.velocity.set(0, 0, 0);
    this.syncCamera();
  }

  get pose(): Pose {
    return { position: this.position.clone(), yaw: this.yaw, pitch: this.pitch };
  }

  /** 指定の姿勢へ滑らかに移動する。duration が 0 なら即座に移動 */
  moveTo(pose: Pose, duration = 0.6): Promise<void> {
    this.tween?.resolve();
    this.tween = null;
    if (duration <= 0) {
      this.teleport(pose);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.tween = {
        from: this.pose,
        to: { position: pose.position.clone(), yaw: pose.yaw, pitch: pose.pitch },
        elapsed: 0,
        duration,
        resolve,
      };
    });
  }

  get isMoving(): boolean {
    return this.tween !== null;
  }

  private updateTween(delta: number): void {
    const tw = this.tween;
    if (!tw) return;
    tw.elapsed += delta;
    const raw = Math.min(1, tw.elapsed / tw.duration);
    const e = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
    this.position.lerpVectors(tw.from.position, tw.to.position, e);
    this.yaw = tw.from.yaw + shortestAngle(tw.from.yaw, tw.to.yaw) * e;
    this.pitch = THREE.MathUtils.lerp(tw.from.pitch, tw.to.pitch, e);
    this.velocity.set(0, 0, 0);
    if (raw >= 1) {
      this.tween = null;
      tw.resolve();
    }
  }

  update(delta: number): void {
    const input = this.input;
    const look = input.consumeLook();
    const tweening = this.tween !== null;
    if (this.enabled && !tweening && !this.cameraOverride) {
      this.yaw += look.yaw;
      this.pitch = THREE.MathUtils.clamp(this.pitch + look.pitch, -PITCH_LIMIT, PITCH_LIMIT);
    }
    this.updateTween(delta);

    const move = input.poll();
    const speed = input.sprint ? this.sprintSpeed : this.walkSpeed;
    const canMove = this.enabled && !this.frozen && !tweening;

    // 目標速度(ワールド座標)
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const targetX = canMove ? (move.x * cos - move.y * sin) * speed : 0;
    const targetZ = canMove ? (-move.x * sin - move.y * cos) * speed : 0;

    const k = 1 - Math.exp(-this.acceleration * delta);
    this.velocity.x += (targetX - this.velocity.x) * k;
    this.velocity.z += (targetZ - this.velocity.z) * k;

    this.tmpDir.set(this.velocity.x * delta, 0, this.velocity.z * delta);
    const dist = this.tmpDir.length();
    if (dist > 1e-6) {
      const steps = Math.max(1, Math.ceil(dist / MAX_STEP));
      const stepX = this.tmpDir.x / steps;
      const stepZ = this.tmpDir.z / steps;
      for (let i = 0; i < steps; i++) {
        this.tmpPos.x = this.position.x + stepX;
        this.tmpPos.z = this.position.z + stepZ;
        resolveCircle(
          this.tmpPos,
          this.radius,
          this.colliders,
          this.position.y + 0.2,
          this.position.y + this.eyeHeight + 0.2,
        );
        this.position.x = this.tmpPos.x;
        this.position.z = this.tmpPos.z;
      }
    }
    this.position.y = this.groundY;

    if (this.enabled && input.interactPressed) {
      bus.emit('input:interact', undefined);
    }
    input.endFrame();
    this.syncCamera();
  }

  private syncCamera(): void {
    if (this.cameraOverride) {
      this.camera.position.copy(this.cameraOverride.position);
      this.camera.lookAt(this.cameraOverride.lookAt);
      return;
    }
    this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}

/** a から b への最短の角度差(-π..π) */
export function shortestAngle(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
