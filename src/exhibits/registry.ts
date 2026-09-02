import type * as THREE from 'three';
import type { ProximityTarget } from '../interaction/ProximityDetector';
import type { Exhibit, ExhibitRoom, LoadContext } from './Exhibit';
import { classicDefinitions } from './classic';
import { fableDefinitions } from './fable';

export interface ExhibitDefinition {
  id: string;
  room: ExhibitRoom;
  create: () => Exhibit;
}

/** 館内に置く展示の一覧。順序が展示一覧の並び順になる */
export const exhibitDefinitions: ExhibitDefinition[] = [...classicDefinitions, ...fableDefinitions];

export const exhibitIds: string[] = exhibitDefinitions.map((d) => d.id);

/** Exhibit[] を生成・シーンに追加し、update を委譲する */
export class ExhibitRegistry {
  readonly exhibits: Exhibit[] = [];
  private readonly byId = new Map<string, Exhibit>();

  constructor(readonly definitions: ExhibitDefinition[] = exhibitDefinitions) {}

  async loadAll(
    ctx: LoadContext,
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    const total = this.definitions.length;
    let done = 0;
    for (const def of this.definitions) {
      const exhibit = def.create();
      await exhibit.load(ctx);
      ctx.scene.add(exhibit.object);
      ctx.museum.addColliders(exhibit.colliders);
      if (exhibit.groundPatch) ctx.museum.groundPatches.push(exhibit.groundPatch);
      if (exhibit.framePatch) ctx.museum.framePatches.push(exhibit.framePatch);
      this.exhibits.push(exhibit);
      this.byId.set(def.id, exhibit);
      done++;
      onProgress?.(done, total);
    }
  }

  get(id: string): Exhibit | undefined {
    return this.byId.get(id);
  }

  update(delta: number, camera: THREE.Camera): void {
    for (const e of this.exhibits) e.update(delta, camera);
  }

  proximityTargets(): ProximityTarget[] {
    return this.exhibits.map((e) => {
      const c = e.meta.triggerCenter ?? e.meta.position;
      return { id: e.meta.id, x: c.x, z: c.z, radius: e.meta.triggerRadius };
    });
  }

  dispose(): void {
    for (const e of this.exhibits) e.dispose();
    this.exhibits.length = 0;
    this.byId.clear();
  }
}
