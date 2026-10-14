// Builds the MCP server and Figma plugin with one local-only installation credential.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateNetworkAccess } from './validate-network.mjs';
import { getInstallationToken } from '../src/installation.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const template = await readFile('src/ui.html', 'utf8');
const manifest = JSON.parse(await readFile('plugin/manifest.json', 'utf8'));
validateNetworkAccess(manifest, template);
await mkdir('dist', { recursive: true });
await mkdir('figma', { recursive: true });
await build({ entryPoints: ['src/server.ts'], outfile: 'dist/server.js', bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node22' });
await build({ entryPoints: ['src/broker.ts'], outfile: 'dist/broker.js', bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node22' });
await build({ entryPoints: ['src/plugin.ts'], outfile: 'plugin/code.js', bundle: true, platform: 'browser', format: 'iife', target: 'es2017' });
await build({ entryPoints: ['src/companion.ts'], outfile: 'dist/companion.js', bundle: true, platform: 'node', format: 'esm', target: 'node24' });
await build({ entryPoints: ['scripts/prepare-companion.mjs'], outfile: 'dist/prepare-companion.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node24' });
await cp('plugin/code.js', 'figma/code.js');
await cp('plugin/manifest.json', 'figma/manifest.json');
await writeFile('figma/ui.template.html', template);
if (!process.argv.includes('--unpaired')) {
  const token = await getInstallationToken(fileURLToPath(new URL('../.local.json', import.meta.url)));
  await writeFile('plugin/ui.html', template.replace('__BRIDGE_TOKEN__', token), { mode: 0o600 });
  console.log('Built server and Figma Desktop plugin. Import plugin/manifest.json.');
} else console.log('Built server and credential-free companion resources.');
