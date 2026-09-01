import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { credits } from '../../src/content/credits';

const ASSET_DIR = join(process.cwd(), 'public', 'assets');
const ALLOWED_LICENSES =
  /^(CC0-1\.0|CC-BY-4\.0|CC-BY-3\.0|MIT|BSD-[23]-Clause|Apache-2\.0|OFL-1\.1|ISC|0BSD|Unlicense)$/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === '.gitkeep' || name === '.DS_Store') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(relative(ASSET_DIR, p));
  }
  return out;
}

describe('credits', () => {
  it('public/assets の全ファイルが credits.ts に登録されている', () => {
    const registered = new Set(credits.flatMap((c) => c.files ?? []));
    const files = walk(ASSET_DIR);
    const missing = files.filter((f) => !registered.has(f));
    expect(missing, `未登録のアセット: ${missing.join(', ')}`).toEqual([]);
  });

  it('登録済みファイルが実在する', () => {
    const files = new Set(walk(ASSET_DIR));
    const ghost = credits.flatMap((c) => c.files ?? []).filter((f) => !files.has(f));
    expect(ghost, `存在しない登録: ${ghost.join(', ')}`).toEqual([]);
  });

  it('ライセンスが許可リストに含まれる', () => {
    for (const c of credits) {
      expect(c.license, `${c.name} のライセンス ${c.license}`).toMatch(ALLOWED_LICENSES);
    }
  });

  it('必須項目が埋まっている', () => {
    for (const c of credits) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.author.length).toBeGreaterThan(0);
      expect(c.url).toMatch(/^https?:\/\//);
      expect(c.usage.length).toBeGreaterThan(0);
    }
  });
});
