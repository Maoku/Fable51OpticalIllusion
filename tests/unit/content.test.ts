import { describe, expect, it } from 'vitest';
import { exhibitTexts } from '../../src/content/exhibits.ja';
import { exhibitIds } from '../../src/exhibits/registry';

describe('content', () => {
  it('登録されている全展示 id に文言がある', () => {
    const missing = exhibitIds.filter((id) => !exhibitTexts[id]);
    expect(missing, `文言のない展示: ${missing.join(', ')}`).toEqual([]);
  });

  it('文言の必須項目が埋まっている', () => {
    for (const id of exhibitIds) {
      const t = exhibitTexts[id]!;
      expect(t.title.length, `${id}.title`).toBeGreaterThan(0);
      expect(t.subtitle.length, `${id}.subtitle`).toBeGreaterThan(0);
      expect(t.look.length, `${id}.look`).toBeGreaterThan(0);
      expect(t.hint.length, `${id}.hint`).toBeGreaterThan(0);
    }
  });

  it('展示 id が重複していない', () => {
    expect(new Set(exhibitIds).size).toBe(exhibitIds.length);
  });
});
