import * as THREE from 'three';
import { createCaptionFor } from '../../museum/Caption';
import { getMaterials } from '../../museum/materials';
import { createFigure } from '../../procedural/figure';
import { makeCanvasTexture, mulberry32 } from '../../procedural/textures';
import { BaseExhibit, type LoadContext } from '../Exhibit';
import { CompositeHintEffect } from '../HintEffect';
import { LightChange } from '../effects/LightChange';
import { Reveal } from '../effects/Reveal';

const HAZE = new THREE.Color(0xd6dde3);

/** 遠くほど霞の色に寄せる(疑似的な空気遠近) */
function hazed(color: THREE.ColorRepresentation, distance01: number): THREE.Color {
  return new THREE.Color(color).lerp(HAZE, THREE.MathUtils.clamp(distance01, 0, 1) * 0.65);
}

/**
 * F4 窓の外の庭。
 * 回廊の窓から広大な水庭が見えるが、実際は窓の向こう 3 m に置かれた 1/20 スケールのジオラマ。
 * ローカル座標: +z が回廊側(鑑賞者)、-z が窓の向こう。
 */
export class ForcedPerspectiveGarden extends BaseExhibit {
  protected build(_ctx: LoadContext): void {
    const mats = getMaterials();
    const rand = mulberry32(42);

    // 窓ガラスと桟
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.9), mats.glass);
    glass.position.set(0, 1.8, 0.0);
    this.object.add(glass);
    for (const x of [-2.13, 0, 2.13]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 0.06), mats.matteBlack);
      bar.position.set(x, 1.8, 0);
      this.object.add(bar);
    }

    // 外側の囲い: 回廊と両展示室に挟まれた中庭(ローカル x ±5.7、z 0..-8)に収める
    const enclosure = new THREE.Group();
    enclosure.name = 'diorama';
    this.object.add(enclosure);
    const HALF_W = 5.7;
    const DEPTH = 8;
    const SKY_H = 7;
    const outerFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, DEPTH),
      new THREE.MeshStandardMaterial({ color: 0x8e8a84, roughness: 1 }),
    );
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.set(0, -0.01, -DEPTH / 2);
    enclosure.add(outerFloor);

    // 書き割り(空と遠山)。奥と左右の 3 面に同じ絵を張り、天井は空の色で閉じる
    const backdropTex = makeCanvasTexture(
      (c, s) => {
        const g = c.createLinearGradient(0, 0, 0, s);
        g.addColorStop(0, '#b9cbdc');
        g.addColorStop(0.45, '#dfe6ec');
        g.addColorStop(0.62, '#e9e2d8');
        g.addColorStop(1, '#d6dde3');
        c.fillStyle = g;
        c.fillRect(0, 0, s, s);
        const r = mulberry32(3);
        const layers = [
          { y: 0.6, h: 0.16, color: 'rgba(150,168,186,0.55)' },
          { y: 0.66, h: 0.12, color: 'rgba(120,140,160,0.6)' },
          { y: 0.72, h: 0.09, color: 'rgba(96,116,136,0.7)' },
        ];
        for (const L of layers) {
          c.fillStyle = L.color;
          c.beginPath();
          c.moveTo(0, s);
          let x = 0;
          while (x <= s) {
            const y = s * (L.y - L.h * (0.4 + 0.6 * Math.abs(Math.sin((x / s) * 9 + r() * 2))));
            c.lineTo(x, y);
            x += s / 40;
          }
          c.lineTo(s, s);
          c.closePath();
          c.fill();
        }
        // 水面に溶ける霧
        const mist = c.createLinearGradient(0, s * 0.7, 0, s);
        mist.addColorStop(0, 'rgba(214,221,227,0)');
        mist.addColorStop(1, 'rgba(214,221,227,1)');
        c.fillStyle = mist;
        c.fillRect(0, s * 0.7, s, s * 0.3);
      },
      { size: 1024 },
    );
    const backdropMat = new THREE.MeshBasicMaterial({ map: backdropTex, toneMapped: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, SKY_H), backdropMat);
    back.position.set(0, SKY_H / 2, -DEPTH);
    enclosure.add(back);
    for (const sideX of [-HALF_W, HALF_W]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, SKY_H), backdropMat);
      wall.rotation.y = sideX < 0 ? Math.PI / 2 : -Math.PI / 2;
      wall.position.set(sideX, SKY_H / 2, -DEPTH / 2);
      enclosure.add(wall);
    }
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, DEPTH),
      new THREE.MeshBasicMaterial({ color: 0xb9cbdc, toneMapped: false }),
    );
    sky.rotation.x = Math.PI / 2;
    sky.position.set(0, SKY_H, -DEPTH / 2);
    enclosure.add(sky);

    // ジオラマの台(窓から 3.2 m)。水面は目の高さのすぐ下に置き、ほぼ水平方向から見せる
    const tableTop = 1.5;
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 0.12, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.9 }),
    );
    table.position.set(0, tableTop - 0.06, -5.5);
    enclosure.add(table);
    const legs = new THREE.Group();
    for (const [lx, lz] of [
      [-4.4, -3.5],
      [4.4, -3.5],
      [-4.4, -7.5],
      [4.4, -7.5],
    ]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, tableTop - 0.12, 0.12),
        mats.matteBlack,
      );
      leg.position.set(lx!, (tableTop - 0.12) / 2, lz!);
      legs.add(leg);
    }
    enclosure.add(legs);

    // 水面
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, 4.3),
      new THREE.MeshPhysicalMaterial({
        color: 0x6f8a99,
        metalness: 0.75,
        roughness: 0.12,
        envMapIntensity: 1.4,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, tableTop + 0.004, -5.5);
    enclosure.add(water);

    // 手前の生垣: 台の縁と脚を隠し、「水辺のテラスに立っている」ように見せる
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 1 });
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2, 0.62, 0.3), hedgeMat);
    hedge.position.set(0, tableTop - 0.23, -3.05);
    enclosure.add(hedge);
    // 生垣の下は石の植栽壁で床まで覆う(窓の下端から台の脚が見えないように)
    const planter = new THREE.Mesh(
      new THREE.BoxGeometry(HALF_W * 2, tableTop - 0.5, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x7d7a74, map: mats.concrete.map, roughness: 0.95 }),
    );
    planter.position.set(0, (tableTop - 0.5) / 2, -3.05);
    enclosure.add(planter);
    for (let i = 0; i < 26; i++) {
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 + rand() * 0.07, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x35553a, roughness: 1 }),
      );
      bush.position.set(
        -4.1 + (i / 25) * 8.2,
        tableTop + 0.06 + rand() * 0.04,
        -3.05 + (rand() - 0.5) * 0.1,
      );
      bush.scale.set(1.2, 0.8, 1);
      enclosure.add(bush);
    }

    // 石・木・東屋(遠いほど小さく、霞の色に寄せる)
    const stoneMat = (d: number) =>
      new THREE.MeshStandardMaterial({ color: hazed(0x7e7a74, d), roughness: 0.95 });
    const trunkMat = (d: number) =>
      new THREE.MeshStandardMaterial({ color: hazed(0x5a4634, d), roughness: 0.9 });
    const leafMat = (d: number) =>
      new THREE.MeshStandardMaterial({ color: hazed(0x3f7a4a, d), roughness: 0.85 });
    const placeTree = (x: number, z: number, h: number, d: number) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(h * 0.04, h * 0.06, h * 0.45, 8),
        trunkMat(d),
      );
      trunk.position.y = h * 0.225;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(h * 0.3, h * 0.7, 9), leafMat(d));
      crown.position.y = h * 0.45 + h * 0.35;
      g.add(trunk, crown);
      g.position.set(x, tableTop, z);
      g.rotation.y = rand() * Math.PI;
      enclosure.add(g);
    };
    // 手前の岸(窓に近い側 z ≈ -3.4)と奥の岸(z ≈ -7.6)。奥ほど小さい
    for (let i = 0; i < 14; i++) {
      const x = -4.3 + rand() * 8.6;
      const near = rand() < 0.4;
      const z = near ? -3.45 - rand() * 0.25 : -7.2 - rand() * 0.45;
      const d = near ? 0.05 : 0.75;
      placeTree(x, z, near ? 0.36 + rand() * 0.22 : 0.12 + rand() * 0.08, d);
    }
    for (let i = 0; i < 18; i++) {
      const x = -4.4 + rand() * 8.8;
      const near = rand() < 0.5;
      const z = near ? -3.4 - rand() * 0.2 : -7.35 - rand() * 0.3;
      const d = near ? 0.05 : 0.75;
      const r = (near ? 0.05 : 0.02) + rand() * (near ? 0.08 : 0.03);
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stoneMat(d));
      stone.position.set(x, tableTop + r * 0.5, z);
      stone.rotation.set(rand() * 3, rand() * 3, 0);
      stone.scale.set(1, 0.6, 1);
      enclosure.add(stone);
    }
    // 東屋(奥、右)
    const hut = new THREE.Group();
    const hutBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), stoneMat(0.7));
    hutBody.position.y = 0.05;
    const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.09, 4), trunkMat(0.7));
    hutRoof.position.y = 0.145;
    hutRoof.rotation.y = Math.PI / 4;
    hut.add(hutBody, hutRoof);
    hut.position.set(2.6, tableTop, -7.3);
    enclosure.add(hut);
    // 石灯籠(手前、左)
    const lantern = new THREE.Group();
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8), stoneMat(0.05));
    lb.position.y = 0.11;
    const lh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.1), stoneMat(0.05));
    lh.position.y = 0.26;
    const lr = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.06, 4), stoneMat(0.05));
    lr.position.y = 0.33;
    lr.rotation.y = Math.PI / 4;
    lantern.add(lb, lh, lr);
    lantern.position.set(-3.2, tableTop, -3.55);
    enclosure.add(lantern);

    // 庭の光: 夕方の低い光(範囲を限ったスポット)と柔らかな補助光。方向光は館内全体に及ぶので使わない
    const sun = new THREE.SpotLight(0xffe2c0, 60, 18, Math.PI / 3, 0.9, 1.2);
    sun.position.set(-4.5, 4.5, -7.5);
    sun.target = table;
    enclosure.add(sun);
    const hemi = new THREE.PointLight(0xdfe8f0, 8, 12, 1.6);
    hemi.position.set(0, 4.5, -5);
    enclosure.add(hemi);

    // 種明かし: 等身大の人型と 1 m の物差しを現し、光を平坦な白にする
    const person = createFigure(1.7, 0xa65b5b);
    person.position.set(-1.6, 0, -3.3);
    person.rotation.y = Math.PI * 0.15;
    enclosure.add(person);
    const ruler = new THREE.Group();
    const rod = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.0, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.5 }),
    );
    rod.position.y = 0.5;
    ruler.add(rod);
    for (let i = 0; i <= 10; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.045), mats.matteBlack);
      tick.position.set(0, i * 0.1, 0);
      ruler.add(tick);
    }
    ruler.position.set(1.4, tableTop, -3.5);
    enclosure.add(ruler);
    // 光の変化で「夕景」の演出も解く
    this.setHint(
      new CompositeHintEffect(
        [
          new Reveal([person, ruler], { durationMs: 1200 }),
          new LightChange(
            [
              { light: sun, target: { color: 0xffffff, intensity: 25 } },
              { light: hemi, target: { color: 0xffffff, intensity: 16 } },
            ],
            { durationMs: 1200 },
          ),
        ],
        { durationMs: 1200 },
      ),
    );

    const caption = createCaptionFor(this.meta.id, { stand: false, tilt: 0, height: 0 });
    caption.position.set(3.7, 1.15, 0.02);
    this.object.add(caption);
  }
}
