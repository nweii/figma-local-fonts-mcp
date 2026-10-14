// Builds the MCP server and Figma plugin with one local-only installation credential.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateNetworkAccess } from './validate-network.mjs';
import { getInstallationToken } from '../src/installation.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const template = await readFile('src/ui.html', 'utf8');
const manifest = JSON.parse(await readFile('plugin/manifest.json', 'utf8'));
validateNetworkAccess(manifest, template);
await mkdir('dist', { recursive: true });
const token = await getInstallationToken(fileURLToPath(new URL('../.local.json', import.meta.url)));
await build({ entryPoints: ['src/server.ts'], outfile: 'dist/server.js', bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node22' });
await build({ entryPoints: ['src/broker.ts'], outfile: 'dist/broker.js', bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node22' });
await build({ entryPoints: ['src/plugin.ts'], outfile: 'plugin/code.js', bundle: true, platform: 'browser', format: 'iife', target: 'es2017' });
await writeFile('plugin/ui.html', template.replace('__BRIDGE_TOKEN__', token), { mode: 0o600 });
console.log('Built server and Figma Desktop plugin. Import plugin/manifest.json.');
