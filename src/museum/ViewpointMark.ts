import * as THREE from 'three';
import { makeCanvasTexture } from '../procedural/textures';

let sharedTexture: THREE.Texture | null = null;

function texture(): THREE.Texture {
  if (sharedTexture) return sharedTexture;
  sharedTexture = makeCanvasTexture(
    (ctx, size) => {
      ctx.clearRect(0, 0, size, size);
      const c = size / 2;
      ctx.strokeStyle = 'rgba(29, 27, 24, 0.55)';
      ctx.lineWidth = size * 0.02;
      ctx.beginPath();
      ctx.arc(c, c, size * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      // 足跡(前方 = 画像の上)
      ctx.fillStyle = 'rgba(29, 27, 24, 0.55)';
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(c + side * size * 0.11, c);
        ctx.rotate(side * 0.12);
        ctx.beginPath();
        ctx.ellipse(0, -size * 0.06, size * 0.05, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, size * 0.1, size * 0.045, size * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // 前方を示す矢印
      ctx.beginPath();
      ctx.moveTo(c, size * 0.04);
      ctx.lineTo(c - size * 0.05, size * 0.12);
      ctx.lineTo(c + size * 0.05, size * 0.12);
      ctx.closePath();
      ctx.fill();
    },
    { size: 256 },
  );
  return sharedTexture;
}

/** 推奨視点を示す床の足跡マーク。yaw の向きが前方 */
export function createViewpointMark(position: THREE.Vector3, yaw: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({
      map: texture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = yaw;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(position.x, 0.004, position.z);
  mesh.renderOrder = 1;
  mesh.name = 'viewpointMark';
  return mesh;
}
