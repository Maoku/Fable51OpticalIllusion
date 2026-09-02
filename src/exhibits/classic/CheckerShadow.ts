import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { createPedestal } from '../../museum/Pedestal';
import {
  CHECKER,
  checkerToCanvas,
  drawCheckerShadow,
  drawCheckerShadowGuide,
} from '../../procedural/illusions';
import { makeCanvasTexture } from '../../procedural/textures';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { GuideOverlay } from '../effects/GuideOverlay';

/**
 * C3 チェッカーシャドウ。
 * 市松模様と影は Canvas に厳密な値で焼き込み(A と B は同じ画素値)、
 * 円柱は実体のメッシュとして板の上に立てる。板は無灯マテリアルで色を正確に保つ。
 */
export class CheckerShadow extends BaseExhibit {
  private cylinder: THREE.Mesh | null = null;

  protected build(_ctx: LoadContext): void {
    const ped = createPedestal({ width: 1.5, depth: 1.5, height: 0.72 });
    this.object.add(ped.mesh);
    this.addLocalCollider(ped.box.cx, ped.box.cy, ped.box.cz, ped.box.sx, ped.box.sy, ped.box.sz);

    const boardSize = 1.3;
    const tilt = THREE.MathUtils.degToRad(22);
    const tex = makeCanvasTexture(drawCheckerShadow, { size: 1024, anisotropy: 8 });
    const guide = makeCanvasTexture(drawCheckerShadowGuide, { size: 1024, anisotropy: 8 });
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(boardSize, boardSize),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    // 板を寝かせ(+y → -z)、手前を下げて鑑賞者側へ傾ける
    board.rotation.x = -Math.PI / 2 + tilt;
    board.position.set(0, ped.top + 0.03 + (boardSize / 2) * Math.sin(tilt), 0);
    this.object.add(board);

    // 板の縁
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(boardSize + 0.06, boardSize + 0.06, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.7 }),
    );
    rim.position.z = -0.02;
    board.add(rim);

    // 円柱(板の座標系で置く。板の +z が法線)
    const size = 1024;
    const p = checkerToCanvas(CHECKER.cylinder.col, CHECKER.cylinder.row, size);
    const u = p.x / size - 0.5;
    const v = 0.5 - p.y / size;
    const r = boardSize * 0.075;
    const h = boardSize * 0.42;
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 40),
      new THREE.MeshStandardMaterial({ color: 0x3c8f4e, roughness: 0.55 }),
    );
    cyl.rotation.x = Math.PI / 2;
    cyl.position.set(u * boardSize, v * boardSize, h / 2);
    cyl.castShadow = false;
    board.add(cyl);
    this.cylinder = cyl;

    // 焼き込んだ影と整合する方向(右奥上)からのスポット。板は無灯なので円柱だけに効く
    const lamp = new THREE.SpotLight(0xfff1dc, 30, 6, Math.PI / 6, 0.6, 2);
    lamp.position.set(1.4, ped.top + 2.2, -1.2);
    lamp.target = ped.mesh;
    this.object.add(lamp);

    const caption = createCaptionFor(this.meta.id);
    caption.position.set(1.05, 0, 0.55);
    this.object.add(caption);

    this.setHint(new GuideOverlay(board, guide, { durationMs: 900 }));
  }
}
