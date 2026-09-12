/**
 * Generate site/data/tools.json and site/data/meta.json from the tool source.
 *
 * Single source of truth for tool count and catalog: parses every
 * `src/tools/**.ts` file with the TypeScript compiler API and extracts each
 * MCP tool's `name`, `description` and `inputSchema` — no runtime imports,
 * so it works without native deps (better-sqlite3 etc.).
 *
 * Run: npx tsx scripts/generate-site-data.ts   (wired into site prebuild)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = join(ROOT, 'src', 'tools');
const OUT_DIR = join(ROOT, 'site', 'data');

// typescript lives in site/node_modules (site devDependency)
const require = createRequire(join(ROOT, 'site', 'package.json'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ts = require('typescript') as typeof import('typescript');

type Param = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enum?: string[];
};

type ToolEntry = {
  name: string;
  short: string;
  description: string;
  category: string;
  categoryId: string;
  kind: 'atomic' | 'recipe';
  params: Param[];
  source: string;
};

const CATEGORY_BY_FILE: Record<string, { id: string; label: string }> = {
  'state-tools.ts': { id: 'state', label: 'Connection & state' },
  'document-tools.ts': { id: 'document', label: 'Documents' },
  'layer-tools.ts': { id: 'layers', label: 'Layers' },
  'layer-ordering-tools.ts': { id: 'layers', label: 'Layers' },
  'layer-properties-tools.ts': { id: 'layers', label: 'Layers' },
  'layer-transform-tools.ts': { id: 'transform', label: 'Transform' },
  'filter-tools.ts': { id: 'filters', label: 'Filters' },
  'adjustment-tools.ts': { id: 'adjustments', label: 'Color & tone' },
  'color-adjustment-tools.ts': { id: 'adjustments', label: 'Color & tone' },
  'text-tools.ts': { id: 'text', label: 'Text' },
  'selection-tools.ts': { id: 'selection', label: 'Selections & masks' },
  'mask-tools.ts': { id: 'selection', label: 'Selections & masks' },
  'history-tools.ts': { id: 'history', label: 'History & undo' },
  'action-tools.ts': { id: 'automation', label: 'Actions & scripts' },
  'image-tools.ts': { id: 'image', label: 'Image' },
  'image-placement-tools.ts': { id: 'image', label: 'Image' },
  'smart-object-tools.ts': { id: 'smart-objects', label: 'Smart Objects' },
  'stack-tools.ts': { id: 'image', label: 'Image' },
  'generative-tools.ts': { id: 'generative', label: 'Generative AI' },
  'neural-tools.ts': { id: 'generative', label: 'Generative AI' },
  'style-tools.ts': { id: 'styles', label: 'Layer styles' },
  'data-tools.ts': { id: 'data', label: 'Data-driven graphics' },
  'export-tools.ts': { id: 'export', label: 'Export' },
};

function listToolFiles(): string[] {
  const files: string[] = [];
  for (const name of readdirSync(TOOLS_DIR)) {
    const full = join(TOOLS_DIR, name);
    if (name.endsWith('-tools.ts')) files.push(full);
  }
  const recipes = join(TOOLS_DIR, 'recipes');
  if (existsSync(recipes)) {
    for (const name of readdirSync(recipes)) {
      if (name.endsWith('.ts') && name !== 'index.ts' && !name.startsWith('_')) {
        files.push(join(recipes, name));
      }
    }
  }
  return files.sort();
}

let constTable = new Map<string, string>();

function collectConsts(sf: ts.SourceFile): Map<string, string> {
  const table = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const text = literalText(node.initializer);
      if (text) table.set(node.name.text, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return table;
}

function literalText(node: ts.Node | undefined): string {
  if (!node) return '';
  if (ts.isIdentifier(node)) return constTable.get(node.text) ?? '';
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return (
      node.head.text +
      node.templateSpans.map((s) => `\${…}` + s.literal.text).join('')
    );
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return literalText(node.left) + literalText(node.right);
  }
  if (ts.isParenthesizedExpression(node)) return literalText(node.expression);
  return '';
}

function prop(obj: ts.ObjectLiteralExpression, key: string): ts.Expression | undefined {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p)) {
      const n = p.name;
      const name = ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : '';
      if (name === key) return p.initializer;
    }
  }
  return undefined;
}

function arrayStrings(node: ts.Expression | undefined): string[] {
  if (!node || !ts.isArrayLiteralExpression(node)) return [];
  return node.elements.map(literalText).filter(Boolean);
}

function schemaType(node: ts.Expression | undefined): string {
  if (!node || !ts.isObjectLiteralExpression(node)) return 'any';
  const t = literalText(prop(node, 'type'));
  if (t === 'array') {
    const items = prop(node, 'items');
    const it = items && ts.isObjectLiteralExpression(items) ? literalText(prop(items, 'type')) : '';
    return it ? `${it}[]` : 'array';
  }
  return t || 'any';
}

function extractParams(schema: ts.Expression | undefined): Param[] {
  if (!schema || !ts.isObjectLiteralExpression(schema)) return [];
  const props = prop(schema, 'properties');
  const required = new Set(arrayStrings(prop(schema, 'required')));
  if (!props || !ts.isObjectLiteralExpression(props)) return [];
  const out: Param[] = [];
  for (const p of props.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const n = p.name;
    const name = ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : '';
    if (!name) continue;
    const def = p.initializer;
    const enumVals = ts.isObjectLiteralExpression(def) ? arrayStrings(prop(def, 'enum')) : [];
    out.push({
      name,
      type: schemaType(def),
      required: required.has(name),
      description: ts.isObjectLiteralExpression(def) ? literalText(prop(def, 'description')) : '',
      ...(enumVals.length ? { enum: enumVals } : {}),
    });
  }
  return out;
}

function extractTools(file: string): ToolEntry[] {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  constTable = collectConsts(sf);
  const rel = file.replace(ROOT + '/', '');
  const isRecipe = rel.includes('/recipes/');
  const cat = isRecipe
    ? { id: 'recipes', label: 'Recipes' }
    : (CATEGORY_BY_FILE[basename(file)] ?? { id: 'other', label: 'Other' });
  const found: ToolEntry[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const nameNode = prop(node, 'name');
      const name = literalText(nameNode);
      if (name.startsWith('photoshop_') && prop(node, 'description')) {
        const description = literalText(prop(node, 'description')).replace(/\s+/g, ' ').trim();
        found.push({
          name,
          short: name.replace(/^photoshop_(recipe_)?/, ''),
          description,
          category: cat.label,
          categoryId: cat.id,
          kind: name.startsWith('photoshop_recipe_') ? 'recipe' : 'atomic',
          params: extractParams(prop(node, 'inputSchema')),
          source: rel,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function main(): void {
  const tools: ToolEntry[] = [];
  const seen = new Set<string>();
  for (const f of listToolFiles()) {
    for (const t of extractTools(f)) {
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      tools.push(t);
    }
  }
  tools.sort((a, b) => a.name.localeCompare(b.name));

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
  const atomic = tools.filter((t) => t.kind === 'atomic').length;
  const recipes = tools.filter((t) => t.kind === 'recipe').length;

  const categories = Array.from(
    tools.reduce((m, t) => {
      const c = m.get(t.categoryId) ?? { id: t.categoryId, label: t.category, count: 0 };
      c.count += 1;
      m.set(t.categoryId, c);
      return m;
    }, new Map<string, { id: string; label: string; count: number }>()).values(),
  ).sort((a, b) => b.count - a.count);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, 'tools.json'),
    JSON.stringify({ total: tools.length, atomic, recipes, categories, tools }, null, 2) + '\n',
  );

  const stars = readStars();
  writeFileSync(
    join(OUT_DIR, 'meta.json'),
    JSON.stringify(
      {
        version: pkg.version,
        toolsTotal: tools.length,
        toolsAtomic: atomic,
        toolsRecipes: recipes,
        stars,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );

  console.log(`site data: ${tools.length} tools (${atomic} atomic + ${recipes} recipes), stars=${stars ?? 'n/a'}`);
}

/** GitHub star count from env (set by CI) or last cached value. */
function readStars(): number | null {
  const fromEnv = process.env.SITE_GITHUB_STARS;
  if (fromEnv && /^\d+$/.test(fromEnv)) return Number(fromEnv);
  try {
    const prev = JSON.parse(readFileSync(join(OUT_DIR, 'meta.json'), 'utf8')) as { stars?: number };
    return typeof prev.stars === 'number' ? prev.stars : null;
  } catch {
    return null;
  }
}

main();
