/**
 * インストール済み依存パッケージのライセンスを一覧化し、
 * 方針(IMPLEMENTATION_PLAN.md §9)に反するものがあれば失敗する。
 * 実行: npm run licenses
 */
import { readFileSync } from 'node:fs';

const ALLOWED = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-3.0',
  'OFL-1.1',
  'Unlicense',
  'BlueOak-1.0.0',
  'MPL-2.0',
  'Python-2.0',
  'MIT-0',
  'PSF-2.0',
  'W3C',
  'Zlib',
]);
const FORBIDDEN = /NC|ND|UNLICENSED|SEE LICENSE/i;

function isAllowed(expr) {
  if (!expr) return false;
  if (FORBIDDEN.test(expr)) return false;
  const cleaned = expr.replace(/[()]/g, '');
  if (cleaned.includes(' OR ')) return cleaned.split(' OR ').some((e) => isAllowed(e.trim()));
  if (cleaned.includes(' AND ')) return cleaned.split(' AND ').every((e) => isAllowed(e.trim()));
  return ALLOWED.has(cleaned.trim());
}

const lock = JSON.parse(readFileSync('node_modules/.package-lock.json', 'utf8'));
const rows = [];
const bad = [];
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/')) continue;
  const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  let license = info.license;
  if (!license) {
    try {
      const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf8'));
      license =
        pkg.license ??
        (Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type).join(' OR ') : undefined);
    } catch {
      license = undefined;
    }
  }
  rows.push({ name, version: info.version, license: license ?? 'UNKNOWN', dev: !!info.dev });
  if (!isAllowed(license)) bad.push({ name, version: info.version, license: license ?? 'UNKNOWN' });
}

rows.sort((a, b) => a.name.localeCompare(b.name));
const summary = {};
for (const r of rows) summary[r.license] = (summary[r.license] ?? 0) + 1;

console.log(`依存パッケージ: ${rows.length} 件`);
for (const [license, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${license.padEnd(28)} ${count}`);
}
console.log('');
console.log('本番依存(dependencies):');
for (const r of rows.filter((r) => !r.dev)) console.log(`  ${r.name}@${r.version}  ${r.license}`);

if (bad.length > 0) {
  console.error('');
  console.error('方針に反するか不明なライセンスのパッケージ:');
  for (const b of bad) console.error(`  ${b.name}@${b.version}  ${b.license}`);
  process.exit(1);
}
console.log('');
console.log('すべての依存パッケージがライセンス方針を満たしています。');
