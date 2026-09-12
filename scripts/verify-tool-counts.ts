/**
 * Fail if any doc reports a tool count that no longer matches the source.
 *
 * The numbers in README/docs are written by hand; site/data/tools.json is derived
 * from src/tools by generate-site-data.ts. This keeps the two in sync.
 *
 * Run: npm run verify:tool-counts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'site', 'data', 'tools.json');

const FILES = [
  'README.md',
  'docs/architecture.md',
  'docs/available-tools.md',
  'docs/development.md',
  'docs/prompt-layer.md',
  'docs/social-preview.md',
  'server.json',
];

function main(): void {
  if (!existsSync(DATA)) {
    execSync('npx tsx scripts/generate-site-data.ts', { cwd: ROOT, stdio: 'inherit' });
  }
  const data = JSON.parse(readFileSync(DATA, 'utf8')) as {
    total: number;
    atomic: number;
    recipes: number;
  };

  const allowed = new Set([data.total, data.atomic, data.recipes]);
  const problems: string[] = [];

  // Counts as written in prose: "116 tools", "100 atomic", "16 recipe workflows".
  // Deliberately narrow so test-run tallies and image widths are not flagged.
  const COUNT = /\b(\d{2,3})\s+(?:total\s+)?(?:atomic|recipe|tools?\b)/gi;

  for (const file of FILES) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const match of line.matchAll(COUNT)) {
        const n = Number(match[1]);
        if (allowed.has(n)) continue;
        problems.push(
          `${file}:${i + 1} reports ${n} — expected ${data.total}/${data.atomic}/${data.recipes}\n    ${line.trim()}`,
        );
      }
    });
  }

  if (problems.length) {
    console.error(
      `Tool counts are out of date (source of truth: ${data.total} total = ${data.atomic} atomic + ${data.recipes} recipes)\n`,
    );
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }

  console.log(`tool counts consistent: ${data.total} = ${data.atomic} atomic + ${data.recipes} recipes`);
}

main();
