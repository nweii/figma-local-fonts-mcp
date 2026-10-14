// Guards the build against a mismatch between Figma's development allowlist and the plugin UI connection scan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateNetworkAccess } from '../scripts/validate-network.mjs';

const manifest = JSON.parse(await readFile(new URL('../plugin/manifest.json', import.meta.url), 'utf8'));
const ui = await readFile(new URL('../src/ui.html', import.meta.url), 'utf8');

test('development allowlist matches the UI WebSocket scan', () => {
  assert.doesNotThrow(() => validateNetworkAccess(manifest, ui));
  const missingPort = structuredClone(manifest);
  missingPort.networkAccess.devAllowedDomains.pop();
  assert.throws(() => validateNetworkAccess(missingPort, ui), /does not match/);
  const numericIp = structuredClone(manifest);
  numericIp.networkAccess.devAllowedDomains[0] = 'ws://127.0.0.1:38460';
  assert.throws(() => validateNetworkAccess(numericIp, ui), /numeric IP/);
  assert.throws(() => validateNetworkAccess(manifest, ui.replace('ws://localhost:', 'ws://127.0.0.1:')), /invalid/);
});
