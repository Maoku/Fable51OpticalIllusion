/**
 * src/content/credits.ts から CREDITS.md を生成する。
 * 実行: npm run credits
 */
import { writeFileSync } from 'node:fs';
import { credits } from '../src/content/credits.ts';
import { creditsMarkdown } from './creditsMarkdown.ts';

writeFileSync('CREDITS.md', creditsMarkdown(credits));
console.log(`CREDITS.md を生成しました(${credits.length} 件)`);
