import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import type { PlayerController } from '../../player/PlayerController';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect } from '../HintEffect';
import { CameraPath } from '../effects/CameraPath';
import { MaterialSwap } from '../effects/MaterialSwap';
import { Reveal } from '../effects/Reveal';
import { STAIR, stairHeight, stairSeamShift } from './stairGeometry';

/**
 * F6 終わらない階段。
 * 回廊脇の塔の中で、登り続けても同じ踊り場に戻る。
 * ローカル座標はワールドと同じ向き(facing = π)。
 */
export class EndlessStair extends BaseExhibit {
  private player: PlayerController | null = null;
  /** 瞬間移動した回数(デバッグ・テスト用) */
  teleports = 0;

  protected build(ctx: LoadContext): void {
    const S = STAIR;
    const mats = getMaterials();
    this.player = ctx.player;
    const inX = S.ax - S.w;
    const inZ = S.az - S.w;
    const flightH = S.steps * S.rise;
    const totalH = S.loop * S.loops + S.headroom + 0.4;
    const t = 0.3;

    const concrete = new THREE.MeshStandardMaterial({
      color: 0xa8a49d,
      map: mats.concrete.map,
      roughness: 0.9,
    });
    const stepMat = new THREE.MeshStandardMaterial({ color: 0xd9d4cc, roughness: 0.8 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xe8e4de, roughness: 1 });
    const fadeable: THREE.Mesh[] = [];
    // 同じマテリアルの箱はまとめて 1 メッシュにする(描画回数の削減)
    const batches = new Map<THREE.Material, { fade: boolean; geos: THREE.BufferGeometry[] }[]>();
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material,
      fade = false,
      collide = false,
    ) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(x, y, z);
      let list = batches.get(m);
      if (!list) {
        list = [
          { fade: false, geos: [] },
          { fade: true, geos: [] },
        ];
        batches.set(m, list);
      }
      list[fade ? 1 : 0]!.geos.push(geo);
      if (collide) this.addLocalCollider(x, y, z, w, h, d);
    };
    const flush = () => {
      for (const [m, list] of batches) {
        for (const b of list) {
          if (b.geos.length === 0) continue;
          const merged = mergeGeometries(b.geos, false);
          if (!merged) continue;
          const mesh = new THREE.Mesh(merged, m);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.object.add(mesh);
          if (b.fade) fadeable.push(mesh);
          for (const g of b.geos) g.dispose();
        }
      }
      batches.clear();
    };

    // 外壁(東側は回廊の壁と共有。回廊の天井より上だけ作る)
    box(S.ax * 2 + 2 * t, totalH, t, 0, totalH / 2, -S.az - t / 2, concrete, true, true);
    box(S.ax * 2 + 2 * t, totalH, t, 0, totalH / 2, S.az + t / 2, concrete, true, true);
    box(t, totalH, S.az * 2, -S.ax - t / 2, totalH / 2, 0, concrete, true, true);
    const eastTop = totalH - 3.5;
    // 東壁(3.5 m より上)。上の周の偽の戸口 [loop, loop+2.3] を z ∈ [inZ, az] に開ける
    box(t, S.loop - 3.5, S.az * 2, S.ax + t / 2, 3.5 + (S.loop - 3.5) / 2, 0, concrete, true, true);
    box(
      t,
      eastTop - (S.loop + 2.3 - 3.5),
      S.az * 2,
      S.ax + t / 2,
      S.loop + 2.3 + (totalH - S.loop - 2.3) / 2,
      0,
      concrete,
      true,
      true,
    );
    box(t, 2.3, S.az * 2 - S.w, S.ax + t / 2, S.loop + 1.15, -S.w / 2, concrete, true, true);
    // 屋根
    box(S.ax * 2 + 2 * t, t, S.az * 2 + 2 * t, 0, totalH + t / 2, 0, concrete, true, false);
    // 中央の core
    box(inX * 2, totalH, inZ * 2, 0, totalH / 2, 0, concrete, true, true);

    // 偽の戸口の先の袋小路(上の周)
    const stubMat = new THREE.MeshStandardMaterial({
      color: 0xf6f3ee,
      map: mats.plaster.map,
      roughness: 0.95,
    });
    const stubZ = inZ + S.w / 2;
    const stubY = S.loop;
    box(2.2, 0.1, S.w, S.ax + 1.1 + t, stubY - 0.05, stubZ, stubMat, true, false);
    box(2.2, 0.1, S.w, S.ax + 1.1 + t, stubY + 2.35, stubZ, stubMat, true, false);
    box(2.2, 2.5, 0.1, S.ax + 1.1 + t, stubY + 1.2, stubZ - S.w / 2 - 0.05, stubMat, true, true);
    box(2.2, 2.5, 0.1, S.ax + 1.1 + t, stubY + 1.2, stubZ + S.w / 2 + 0.05, stubMat, true, true);
    box(0.1, 2.5, S.w + 0.2, S.ax + 2.2 + t, stubY + 1.2, stubZ, stubMat, true, true);

    // 段・踊り場・天井を周ごとに積む
    const runZ = inZ * 2;
    const runX = inX * 2;
    const treadZ = runZ / S.steps;
    const treadX = runX / S.steps;
    const landingCenters: [number, number][] = [
      [S.ax - S.w / 2, S.az - S.w / 2], // L0 SE
      [S.ax - S.w / 2, -(S.az - S.w / 2)], // L1 NE
      [-(S.ax - S.w / 2), -(S.az - S.w / 2)], // L2 NW
      [-(S.ax - S.w / 2), S.az - S.w / 2], // L3 SW
    ];
    for (let k = 0; k < S.loops; k++) {
      const base = k * S.loop;
      // 踊り場(床板と天井)
      landingCenters.forEach(([lx, lz], i) => {
        const h = base + flightH * i;
        box(S.w, 0.12, S.w, lx, h - 0.06, lz, stepMat);
        box(S.w + 0.1, 0.12, S.w + 0.1, lx, h + S.headroom + 0.06, lz, ceilMat, true);
      });
      // 周ごとに 1 灯(壁は光を遮らないので core の中心から全通路を照らす)
      const lamp = new THREE.PointLight(0xfff1dc, 14, 9, 1.6);
      lamp.position.set(0, base + S.loop / 2 + 1.2, 0);
      lamp.userData.cullRange = 16;
      this.object.add(lamp);
      // フライト A(東、北向き)
      for (let i = 0; i < S.steps; i++) {
        const top = base + (i + 1) * S.rise;
        const z = inZ - (i + 0.5) * treadZ;
        box(
          S.w,
          top - base + 0.12,
          treadZ,
          S.ax - S.w / 2,
          base + (top - base + 0.12) / 2 - 0.12,
          z,
          stepMat,
        );
      }
      // フライト B(北、西向き)
      for (let i = 0; i < S.steps; i++) {
        const top = base + flightH + (i + 1) * S.rise;
        const x = inX - (i + 0.5) * treadX;
        box(
          treadX,
          top - base - flightH + 0.12,
          S.w,
          x,
          base + flightH + (top - base - flightH + 0.12) / 2 - 0.12,
          -(S.az - S.w / 2),
          stepMat,
        );
      }
      // フライト C(西、南向き)
      for (let i = 0; i < S.steps; i++) {
        const top = base + flightH * 2 + (i + 1) * S.rise;
        const z = -inZ + (i + 0.5) * treadZ;
        box(
          S.w,
          top - base - flightH * 2 + 0.12,
          treadZ,
          -(S.ax - S.w / 2),
          base + flightH * 2 + (top - base - flightH * 2 + 0.12) / 2 - 0.12,
          z,
          stepMat,
        );
      }
      // フライト D(南、東向き)
      for (let i = 0; i < S.steps; i++) {
        const top = base + flightH * 3 + (i + 1) * S.rise;
        const x = -inX + (i + 0.5) * treadX;
        box(
          treadX,
          top - base - flightH * 3 + 0.12,
          S.w,
          x,
          base + flightH * 3 + (top - base - flightH * 3 + 0.12) / 2 - 0.12,
          S.az - S.w / 2,
          stepMat,
        );
      }
      // フライトの天井(傾いた板)
      const slope = (run: number) => Math.atan2(flightH, run);
      const slab = (
        cx: number,
        cy: number,
        cz: number,
        len: number,
        rotY: number,
        sign: number,
        run: number,
      ) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, S.w + 0.1), ceilMat);
        mesh.position.set(cx, cy, cz);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.y = rotY;
        mesh.rotation.z = sign * slope(run);
        this.object.add(mesh);
        fadeable.push(mesh);
      };
      const lenZ = Math.hypot(runZ, flightH);
      const lenX = Math.hypot(runX, flightH);
      const midH = S.headroom + flightH / 2 + 0.1;
      slab(S.ax - S.w / 2, base + midH, 0, lenZ, Math.PI / 2, 1, runZ);
      slab(0, base + flightH + midH, -(S.az - S.w / 2), lenX, 0, 1, runX);
      slab(-(S.ax - S.w / 2), base + flightH * 2 + midH, 0, lenZ, -Math.PI / 2, 1, runZ);
      slab(0, base + flightH * 3 + midH, S.az - S.w / 2, lenX, Math.PI, 1, runX);
    }
    // 最上段の終端(到達不能)
    const topH = S.loop * S.loops;
    box(S.w, 0.12, S.w, landingCenters[0]![0], topH - 0.06, landingCenters[0]![1], stepMat);
    flush();

    // 足元の高さ
    this.groundPatch = (wx, wz, wy) => {
      const l = this.toLocal(wx, wy, wz);
      return stairHeight(l.x, l.z, l.y);
    };

    // 種明かし用: 継ぎ目の面
    const seamMat = new THREE.MeshBasicMaterial({
      color: 0xff7a1a,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const seamZ = (S.seamZ[0] + S.seamZ[1]) / 2;
    const seam1 = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.headroom), seamMat);
    seam1.position.set(S.ax - S.w / 2, S.loop + 0.9 + S.headroom / 2, seamZ);
    seam1.rotation.y = Math.PI / 2;
    seam1.renderOrder = 12;
    const seam2 = new THREE.Mesh(new THREE.PlaneGeometry(S.w, 2.3), seamMat.clone());
    seam2.position.set(S.ax + t + 0.05, S.loop + 1.15, stubZ);
    seam2.rotation.y = Math.PI / 2;
    seam2.renderOrder = 12;
    this.object.add(seam1, seam2);

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(S.ax + t + 0.4, 0, S.az - S.w / 2 - 1.1);
    caption.rotation.y = -Math.PI / 2;
    this.object.add(caption);

    const target = this.toWorld(0, S.loop * 0.9, 0);
    this.setHint(
      new CompositeHintEffect(
        [
          new CameraPath(ctx.player, {
            target,
            waypoints: [
              this.toWorld(4.5, 6, 6.5),
              this.toWorld(2.5, 14.5, 7.5),
              this.toWorld(0.5, 18, 5.5),
            ],
            durationMs: 3600,
          }),
          new MaterialSwap(fadeable, { opacity: 0.12 }, { durationMs: 1800 }),
          new Reveal([seam1, seam2], { durationMs: 1400 }),
        ],
        { durationMs: 3600 },
      ),
    );
  }

  override update(): void {
    const p = this.player;
    if (!p || p.cameraOverride) return;
    const l = this.toLocal(p.position.x, p.position.y, p.position.z);
    const shift = stairSeamShift(l.x, l.z, l.y);
    if (shift !== 0) {
      p.position.y += shift;
      this.teleports++;
    }
  }
}
