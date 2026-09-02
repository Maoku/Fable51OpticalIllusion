import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { creditsMarkdown } from '../../scripts/creditsMarkdown';
import { credits } from '../../src/content/credits';

describe('CREDITS.md', () => {
  it('credits.ts と同期している(npm run credits で再生成する)', () => {
    const current = readFileSync('CREDITS.md', 'utf8');
    expect(current).toBe(creditsMarkdown(credits));
  });

  it('全クレジットの名称が含まれる', () => {
    const md = creditsMarkdown(credits);
    for (const c of credits) expect(md).toContain(c.name);
  });
});
