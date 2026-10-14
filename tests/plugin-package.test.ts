// Verifies portable/native plugin wiring and starts a copied bundled MCP without repository dependencies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { prepareCompanion } from '../src/companion.ts';
import { pathToFileURL } from 'node:url';

const plugin = 'plugins/agent-font-access';
test('native and portable manifests share the same runtime and canonical skill', async () => {
  const portable = JSON.parse(await readFile(`${plugin}/mcp.json`, 'utf8'));
  const claude = JSON.parse(await readFile('plugins/agent-font-access-claude/.mcp.json', 'utf8'));
  assert.equal(portable.mcpServers.figma_local_fonts.command, 'node');
  assert.equal(portable.mcpServers.figma_local_fonts.type, 'stdio');
  assert.equal(portable.mcpServers.figma_local_fonts.args[0], '${PLUGIN_ROOT}/server/server.mjs');
  assert.equal(claude.mcpServers.figma_local_fonts.args[0], '${CLAUDE_PLUGIN_ROOT}/server/server.mjs');
  assert.equal(await readFile(`${plugin}/skills/figma-local-fonts/SKILL.md`, 'utf8'), await readFile('skills/figma-local-fonts/SKILL.md', 'utf8'));
  assert.ok((await readFile(`${plugin}/figma/ui.template.html`, 'utf8')).includes('__BRIDGE_TOKEN__'));
});
test('copied plugin starts and discovers five tools without node_modules or source checkout', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'font-plugin-test-'));
  const copy = join(directory, 'plugin with spaces');
  const client = new Client({ name: 'plugin-package-test', version: '1' });
  try {
    await cp(plugin, copy, { recursive: true });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(copy, 'server/server.mjs')], cwd: copy, stderr: 'pipe' }));
    assert.equal((await client.listTools()).tools.length, 5);
    const status = await client.callTool({ name: 'figma_local_fonts_status', arguments: {} });
    assert.equal(status.isError, undefined);
  } finally { await client.close(); await rm(directory, { recursive: true, force: true }); }
});
test('companion preparation pairs private files without disclosing the credential in its result', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'font-companion-test-'));
  try {
    const state = join(directory, 'installation.json');
    const output = join(directory, 'companion');
    const result = await prepareCompanion(pathToFileURL(join(process.cwd(), plugin) + '/'), output, state);
    const token = JSON.parse(await readFile(state, 'utf8')).token;
    assert.equal(result.manifestPath, join(output, 'manifest.json'));
    assert.ok((await readFile(join(output, 'ui.html'), 'utf8')).includes(token));
    assert.ok(!JSON.stringify(result).includes(token));
    assert.ok(!(await readFile(join(output, 'ui.html'), 'utf8')).includes('__BRIDGE_TOKEN__'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
