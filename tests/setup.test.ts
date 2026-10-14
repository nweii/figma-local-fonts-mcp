// Checks actionable setup states for a packaged server, unbuilt source, closed companion, and connected file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { companionSetup, connectionStatus } from '../src/setup.ts';

test('missing or closed companion returns concrete recovery without claiming it is uninstalled', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'font-setup-test-'));
  const root = pathToFileURL(directory + '/');
  try {
    assert.equal(companionSetup(root).nextAction, 'GET_COMPANION_SOURCE');
    await mkdir(join(directory, 'plugin'));
    await writeFile(join(directory, 'plugin', 'manifest.json'), '{}');
    assert.equal(companionSetup(root).nextAction, 'BUILD_COMPANION');
    await writeFile(join(directory, 'plugin', 'ui.html'), 'fixture');
    await writeFile(join(directory, 'plugin', 'code.js'), 'fixture');
    const status = connectionStatus({ port: 38460, connections: [] }, root);
    assert.equal(status.state, 'waiting_for_companion');
    assert.equal(status.server.state, 'running');
    assert.equal(status.companion.nextAction, 'OPEN_COMPANION');
    assert.equal('installed' in status.companion && status.companion.installed, 'unknown');
    assert.equal('manifestPath' in status.companion && status.companion.manifestPath, join(directory, 'plugin', 'manifest.json'));
    const connected = connectionStatus({ port: 38460, connections: [{ connectionId: 'example', fileName: 'Example', fileKey: null }] }, root);
    assert.equal(connected.state, 'connected');
    assert.equal(connected.companion.nextAction, 'INSPECT_TEXT');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('npm resources return an executable preparation command from the installed package', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'font-npm-setup-'));
  try {
    await mkdir(join(directory, 'figma'));
    await mkdir(join(directory, 'dist'));
    await writeFile(join(directory, 'figma/ui.template.html'), '__BRIDGE_TOKEN__');
    await writeFile(join(directory, 'dist/prepare-companion.mjs'), '// fixture');
    const setup = companionSetup(pathToFileURL(directory + '/'));
    assert.equal('agentCanPrepareFiles' in setup && setup.agentCanPrepareFiles, true);
    assert.deepEqual('prepareCommand' in setup && setup.prepareCommand, ['node', join(directory, 'dist/prepare-companion.mjs')]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
