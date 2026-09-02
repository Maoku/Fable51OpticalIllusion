import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { createPedestal } from '../../museum/Pedestal';
import { getMaterials } from '../../museum/materials';
import { makeCanvasTexture } from '../../procedural/textures';
import { BaseExhibit, viewpointInFront, type ExhibitMeta, type LoadContext } from '../Exhibit';
import { CompositeHintEffect } from '../HintEffect';
import {
  CameraOrbit,
  GuideOverlay,
  LightChange,
  MaterialSwap,
  SectionCut,
  WireframeReveal,
} from '../effects';
import type { ExhibitDefinition } from '../registry';

export type PlaceholderKind = 'wireframe' | 'guide' | 'orbit' | 'material' | 'light' | 'section';

/**
 * 演出パターンの動作確認用の仮展示(箱)。
 * 各パターンが Exhibit / HintEffect の枠組みで動くことを確かめる。
 */
export class PlaceholderExhibit extends BaseExhibit {
  constructor(
    meta: ExhibitMeta,
    readonly kind: PlaceholderKind,
  ) {
    super(meta);
  }

  protected build(ctx: LoadContext): void {
    const mats = getMaterials();
    const caption = createCaptionFor(this.meta.id);
    caption.position.set(0.7, 0, 0.5);
    this.object.add(caption);

    switch (this.kind) {
      case 'wireframe': {
        const ped = createPedestal({ width: 0.8, depth: 0.8, height: 0.9 });
        this.object.add(ped.mesh);
        this.addLocalCollider(
          ped.box.cx,
          ped.box.cy,
          ped.box.cz,
          ped.box.sx,
          ped.box.sy,
          ped.box.sz,
        );
        // 奥へ細くなる台形の箱。正面からは直方体に見える
        const geo = new THREE.BoxGeometry(0.5, 0.4, 0.9);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const z = pos.getZ(i);
          const s = z < 0 ? 0.55 : 1;
          pos.setX(i, pos.getX(i) * s);
          pos.setY(i, pos.getY(i) * s);
        }
        geo.computeVertexNormals();
        const box = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({ color: 0xf0ede7, roughness: 0.6 }),
        );
        box.position.y = ped.top + 0.2;
        box.castShadow = true;
        this.object.add(box);
        this.setHint(new WireframeReveal([box], { color: 0x2a9df4 }));
        break;
      }
      case 'guide': {
        const w = 1.2;
        const hgt = 0.9;
        const base = makeCanvasTexture((c, s) => {
          c.fillStyle = '#f4f1ec';
          c.fillRect(0, 0, s, s);
          c.strokeStyle = '#1d1b18';
          c.lineWidth = s * 0.012;
          c.lineCap = 'round';
          for (const [y, dir] of [
            [s * 0.35, 1],
            [s * 0.65, -1],
          ] as const) {
            c.beginPath();
            c.moveTo(s * 0.3, y);
            c.lineTo(s * 0.7, y);
            c.stroke();
            for (const x of [s * 0.3, s * 0.7]) {
              const sign = x < s / 2 ? -dir : dir;
              c.beginPath();
              c.moveTo(x + sign * s * 0.06, y - s * 0.06);
              c.lineTo(x, y);
              c.lineTo(x + sign * s * 0.06, y + s * 0.06);
              c.stroke();
            }
          }
        });
        const guide = makeCanvasTexture((c, s) => {
          c.clearRect(0, 0, s, s);
          c.strokeStyle = '#2a9df4';
          c.lineWidth = s * 0.008;
          c.setLineDash([s * 0.02, s * 0.015]);
          for (const x of [s * 0.3, s * 0.7]) {
            c.beginPath();
            c.moveTo(x, s * 0.25);
            c.lineTo(x, s * 0.75);
            c.stroke();
          }
        });
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.08, hgt + 0.08, 0.04),
          mats.matteBlack,
        );
        frame.position.set(0, 1.5, 0);
        const poster = new THREE.Mesh(
          new THREE.PlaneGeometry(w, hgt),
          new THREE.MeshStandardMaterial({ map: base, roughness: 0.9 }),
        );
        poster.position.set(0, 1.5, 0.021);
        this.object.add(frame, poster);
        caption.position.set(w / 2 + 0.3, 0, 0.3);
        this.setHint(new GuideOverlay(poster, guide));
        break;
      }
      case 'orbit': {
        const ped = createPedestal({ width: 1.2, depth: 1.2, height: 0.5 });
        this.object.add(ped.mesh);
        this.addLocalCollider(
          ped.box.cx,
          ped.box.cy,
          ped.box.cz,
          ped.box.sx,
          ped.box.sy,
          ped.box.sz,
        );
        const mat = new THREE.MeshStandardMaterial({ color: 0xe7e2da, roughness: 0.5 });
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), mat);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), mat);
        // 正面(+z)から見ると先端が触れて見えるが、奥行きで 0.3 m 離れている
        a.position.set(-0.05, ped.top + 0.45, 0.15);
        a.rotation.z = -0.35;
        b.position.set(0.16, ped.top + 0.45, -0.15);
        b.rotation.z = 0.35;
        a.castShadow = b.castShadow = true;
        this.object.add(a, b);
        const center = this.toWorld(0, ped.top + 0.6, 0);
        this.setHint(
          new CameraOrbit(ctx.player, { target: center, sweep: Math.PI * 0.5, lift: 0.6 }),
        );
        break;
      }
      case 'material': {
        const ped = createPedestal({ width: 0.8, depth: 0.8, height: 0.9 });
        this.object.add(ped.mesh);
        this.addLocalCollider(
          ped.box.cx,
          ped.box.cy,
          ped.box.cz,
          ped.box.sx,
          ped.box.sy,
          ped.box.sz,
        );
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.4 }),
        );
        cube.position.y = ped.top + 0.25;
        cube.castShadow = true;
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 32, 16),
          new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 }),
        );
        core.position.y = ped.top + 0.25;
        this.object.add(cube, core);
        this.setHint(new MaterialSwap([cube], { opacity: 0.12 }));
        break;
      }
      case 'light': {
        const ped = createPedestal({ width: 0.8, depth: 0.8, height: 0.9 });
        this.object.add(ped.mesh);
        this.addLocalCollider(
          ped.box.cx,
          ped.box.cy,
          ped.box.cz,
          ped.box.sx,
          ped.box.sy,
          ped.box.sz,
        );
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.02, 0.5),
          new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.9 }),
        );
        plate.position.y = ped.top + 0.01;
        const lamp = new THREE.SpotLight(0xff8a2a, 40, 4, Math.PI / 7, 0.5, 2);
        lamp.position.set(0, ped.top + 1.6, 0.3);
        lamp.target = plate;
        this.object.add(plate, lamp);
        this.setHint(new LightChange([{ light: lamp, target: { color: 0xffffff } }]));
        break;
      }
      case 'section': {
        const ped = createPedestal({ width: 0.8, depth: 0.8, height: 0.9 });
        this.object.add(ped.mesh);
        this.addLocalCollider(
          ped.box.cx,
          ped.box.cy,
          ped.box.cz,
          ped.box.sx,
          ped.box.sy,
          ped.box.sz,
        );
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 48, 24),
          new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.5 }),
        );
        shell.position.y = ped.top + 0.3;
        shell.castShadow = true;
        const core = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.16, 0.16),
          new THREE.MeshStandardMaterial({ color: 0xc23b22, roughness: 0.6 }),
        );
        core.position.y = ped.top + 0.3;
        this.object.add(shell, core);
        const c = this.toWorld(0, ped.top + 0.3, 0);
        // 見る側(正面)の半分を削って中を見せる: 法線は正面から奥へ向く
        const normal = this.frontDir.negate();
        const start = c.clone().addScaledVector(normal, -0.35);
        const end = c.clone();
        this.setHint(
          new CompositeHintEffect([new SectionCut([shell], { normal, start, end })], {
            durationMs: 1200,
          }),
        );
        break;
      }
    }
  }
}

export function createPlaceholderDefinitions(): ExhibitDefinition[] {
  const make = (
    id: string,
    kind: PlaceholderKind,
    x: number,
    z: number,
    facing: number,
    distance = 2.0,
  ): ExhibitDefinition => ({
    id,
    room: 'classic',
    create: () => {
      const position = new THREE.Vector3(x, 0, z);
      return new PlaceholderExhibit(
        {
          id,
          room: 'classic',
          position,
          facing,
          triggerRadius: 2.8,
          viewpoint: viewpointInFront(position, facing, distance),
        },
        kind,
      );
    },
  });
  return [
    make('demo-wireframe', 'wireframe', -5, -5.5, Math.PI, 1.8),
    make('demo-guide', 'guide', 5, -6.8, Math.PI, 2.2),
    make('demo-orbit', 'orbit', -7.5, 0, -Math.PI / 2, 2.2),
    make('demo-material', 'material', 7.5, 0, Math.PI / 2, 1.8),
    make('demo-light', 'light', -5, 5.5, 0, 1.8),
    make('demo-section', 'section', 5, 5.5, 0, 1.6),
  ];
}
