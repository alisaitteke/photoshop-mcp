/**
 * Sync server.json with package.json before npm publish.
 * Copies version + description so the MCP registry listing never goes stale.
 * Run: npx tsx scripts/sync-server-version.ts   (wired into prepublishOnly)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const serverPath = join(ROOT, 'server.json');
const server = JSON.parse(readFileSync(serverPath, 'utf8'));

const REGISTRY_DESCRIPTION_MAX = 100;

server.version = pkg.version;
server.description =
  pkg.description.length > REGISTRY_DESCRIPTION_MAX
    ? `${pkg.description.slice(0, REGISTRY_DESCRIPTION_MAX - 1).trimEnd()}…`
    : pkg.description;
if (Array.isArray(server.packages)) {
  for (const p of server.packages) {
    if (p.registryType === 'npm') p.version = pkg.version;
  }
}

writeFileSync(serverPath, JSON.stringify(server, null, 2) + '\n');
console.log(`server.json synced to v${pkg.version}`);
