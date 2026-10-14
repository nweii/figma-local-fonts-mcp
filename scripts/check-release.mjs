// Installs the npm archive and exercises shipped setup and MCP entry points before assembling private review artifacts.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const temporary = await mkdtemp(join(tmpdir(), 'font-release-check-'));
const destination = join(root, 'release');
const execute = promisify(execFile);
const run = (command, args, cwd = root) => execute(command, args, { cwd, maxBuffer: 16 * 1024 * 1024 });
const checks = [];
async function verifyServer(name, command, args, cwd) {
  const client = new Client({ name: 'release-check', version: '1' });
  try {
    await client.connect(new StdioClientTransport({ command, args, cwd, stderr: 'pipe' }));
    assert.equal(client.getServerVersion().version, version);
    const tools = (await client.listTools()).tools.map(tool => tool.name).sort();
    assert.deepEqual(tools, ['create', 'edit', 'inspect', 'search', 'status'].map(tool => `figma_local_fonts_${tool}`).sort());
    const result = await client.callTool({ name: 'figma_local_fonts_status', arguments: {} });
    assert.ok(!result.isError);
    const status = result.structuredContent;
    assert.equal(status.server.state, 'running');
    checks.push({ name, tools: tools.length, status: status.state });
    // Font search is read-only. Exercise the artifact against an open companion when one is available.
    if (status.connections.length) {
      const fonts = await client.callTool({ name: 'figma_local_fonts_search', arguments: { connectionId: status.connections[0].connectionId, query: 'Karrik', limit: 10 } });
      assert.ok(!fonts.isError);
      checks.push({ name: `${name} live font search`, matches: fonts.structuredContent.matches.length });
    }
  } finally { await client.close(); }
}
async function verifyCompanion(command, args, cwd, name) {
  const output = join(temporary, `${name} paired companion`);
  const { stdout } = await run(command, [...args, '--output', output], cwd);
  const result = JSON.parse(stdout);
  assert.equal(result.manifestPath, join(output, 'manifest.json'));
  const ui = await readFile(join(output, 'ui.html'), 'utf8');
  assert.ok(!ui.includes('__BRIDGE_TOKEN__'));
  const credential = ui.match(/const token = '([a-f0-9]{64})';/)?.[1];
  assert.ok(credential);
  assert.ok(!stdout.includes(credential));
  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
  assert.ok((await readFile(join(output, manifest.main))).length);
  checks.push({ name: `${name} companion preparation`, credentialInResult: false });
}
try {
  await mkdir(destination, { recursive: true });
  await run('npm', ['run', 'build', '--', '--unpaired']);
  await run('npm', ['run', 'build:plugin']);
  const { stdout } = await run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination, '--cache', join(temporary, 'cache')]);
  const [archive] = JSON.parse(stdout);
  const files = archive.files.map(file => file.path);
  assert.ok(!files.some(path => /(?:^|\/)(?:installation\.json|\.local\.json|ui\.html)$/.test(path)));
  assert.ok(files.includes('figma/ui.template.html'));
  const tarball = join(destination, archive.filename);
  const installation = join(temporary, 'npm installation with spaces');
  await mkdir(installation);
  await run('npm', ['install', '--prefix', installation, '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(temporary, 'cache'), tarball]);
  const installed = join(installation, 'node_modules', 'figma-local-fonts-mcp');
  const cli = join(installed, 'bin', 'figma-local-fonts-mcp.mjs');
  assert.match((await run(process.execPath, [cli, '--help'], installation)).stdout, /prepare-companion/);
  assert.equal((await run(process.execPath, [cli, '--version'], installation)).stdout.trim(), version);
  await assert.rejects(run(process.execPath, [cli, 'unknown-command'], installation), error => error.code === 1 && /Usage:/.test(error.stderr));
  checks.push({ name: 'installed npm help, version, and invalid command', passed: true });
  await verifyCompanion(process.execPath, [cli, 'prepare-companion'], installation, 'npm CLI');
  await verifyCompanion(process.execPath, [join(installed, 'dist/prepare-companion.mjs')], installation, 'npm status command');
  await verifyServer('npm archive', process.execPath, [cli], installation);
  await verifyServer('npm archive via npx', 'npx', ['--no-install', 'figma-local-fonts-mcp'], installation);
  assert.equal((await run('bunx', ['--no-install', 'figma-local-fonts-mcp', '--version'], installation)).stdout.trim(), version);
  checks.push({ name: 'installed npm via bunx', passed: true });
  const artifacts = [tarball];
  for (const name of ['agent-font-access', 'agent-font-access-claude']) {
    const plugin = join(temporary, `${name} with spaces`);
    await cp(join(root, 'plugins', name), plugin, { recursive: true });
    await verifyCompanion(process.execPath, [join(plugin, 'scripts/prepare-companion.mjs')], plugin, name);
    await verifyServer(name, process.execPath, [join(plugin, 'server/server.mjs')], plugin);
    assert.ok((await readFile(join(plugin, 'figma/ui.template.html'), 'utf8')).includes('__BRIDGE_TOKEN__'));
  }
  const combined = join(temporary, 'combined plugin');
  await cp(join(root, 'plugins/agent-font-access'), combined, { recursive: true });
  await cp(join(root, 'plugins/agent-font-access-claude/.claude-plugin'), join(combined, '.claude-plugin'), { recursive: true });
  await cp(join(root, 'plugins/agent-font-access-claude/.mcp.json'), join(combined, '.mcp.json'));
  const zip = resolve(destination, `agent-font-access-${version}.zip`);
  await run('zip', ['-qr', zip, '.'], combined);
  const extracted = join(temporary, 'extracted plugin with spaces');
  await run('unzip', ['-q', zip, '-d', extracted]);
  const portable = JSON.parse(await readFile(join(extracted, 'mcp.json'), 'utf8')).mcpServers.figma_local_fonts;
  const claude = JSON.parse(await readFile(join(extracted, '.mcp.json'), 'utf8')).mcpServers.figma_local_fonts;
  await run('claude', ['plugin', 'validate', extracted, '--strict']);
  await verifyServer('combined ZIP for Codex', portable.command, portable.args.map(arg => arg.replace('${PLUGIN_ROOT}', extracted)), extracted);
  await verifyServer('combined ZIP for Claude Code', claude.command, claude.args.map(arg => arg.replace('${CLAUDE_PLUGIN_ROOT}', extracted)), extracted);
  checks.push({ name: 'combined ZIP native manifest', passed: true });
  artifacts.push(zip);
  const report = { version, checks, artifacts: await Promise.all(artifacts.map(async path => ({ file: path.slice(destination.length + 1), sha256: createHash('sha256').update(await readFile(path)).digest('hex') }))) };
  await writeFile(join(destination, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await rm(temporary, { recursive: true, force: true }); }
