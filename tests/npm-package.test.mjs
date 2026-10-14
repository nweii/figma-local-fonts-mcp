// Checks that the npm archive can supply companion setup and every local documentation link without a source checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';

const cache = mkdtempSync(join(tmpdir(), 'font-npm-cache-'));
const [archive] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--cache', cache], { encoding: 'utf8' }));
rmSync(cache, { recursive: true, force: true });
const files = new Set(archive.files.map(file => file.path));
test('npm ships companion resources, preparation, and linked documentation', () => {
  for (const path of ['dist/companion.js', 'figma/code.js', 'figma/manifest.json', 'figma/ui.template.html', 'dist/prepare-companion.mjs', 'PRIVACY.md', 'SECURITY.md']) {
    assert.ok(files.has(path), `Missing ${path} in npm archive`);
  }
  assert.ok(!files.has('plugin/ui.html'));
  assert.ok(readFileSync('figma/ui.template.html', 'utf8').includes('__BRIDGE_TOKEN__'));
  for (const path of files) {
    if (!path.endsWith('.md')) continue;
    for (const match of readFileSync(path, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(?:[a-z]+:|\/)/i.test(target)) continue;
      const resolved = posix.normalize(posix.join(posix.dirname(path), target));
      assert.ok(files.has(resolved), `${path} links to missing ${resolved}`);
    }
  }
});

test('CLI help and malformed commands finish without starting the MCP server', () => {
  const cli = 'bin/figma-local-fonts-mcp.mjs';
  assert.match(execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8', timeout: 3000 }), /prepare-companion/);
  assert.throws(() => execFileSync(process.execPath, [cli, 'prepare-companion', '--output'], { encoding: 'utf8', timeout: 3000, stdio: 'pipe' }), error => error.status === 1 && /Usage:/.test(error.stderr));
});
