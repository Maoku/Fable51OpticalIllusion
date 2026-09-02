import * as THREE from 'three';

/** 簡素な人型の人形。足元が原点、身長 `height` */
export function createFigure(
  height: number,
  color: THREE.ColorRepresentation = 0x5b7fa6,
): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe9cdb5, roughness: 0.8 });
  const h = height;
  const headR = h * 0.065;
  const legH = h * 0.45;
  const torsoH = h * 0.32;
  const legR = h * 0.045;

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(legR, legH - legR * 2, 4, 8), mat);
    leg.position.set(side * h * 0.06, legH / 2, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.09, torsoH - h * 0.1, 4, 12), mat);
  torso.position.y = legH + torsoH / 2 - h * 0.02;
  torso.castShadow = true;
  g.add(torso);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.03, torsoH * 0.8, 4, 8), mat);
    arm.position.set(side * h * 0.13, legH + torsoH * 0.45, 0);
    arm.rotation.z = side * 0.12;
    arm.castShadow = true;
    g.add(arm);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.025, h * 0.025, h * 0.03, 8), skin);
  neck.position.y = legH + torsoH - h * 0.01;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 20, 14), skin);
  head.position.y = h - headR;
  head.castShadow = true;
  g.add(head);
  g.name = 'figure';
  return g;
}
