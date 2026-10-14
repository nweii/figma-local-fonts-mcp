// Verifies stable user credentials survive package installs and concurrent startup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getInstallationToken } from '../src/installation.ts';

test('migrates an existing private source credential without changing its value', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-font-access-'));
  try {
    const legacy = join(directory, 'legacy.json');
    const state = join(directory, 'state', 'installation.json');
    const token = 'a'.repeat(64);
    await writeFile(legacy, JSON.stringify({ token }), { mode: 0o600 });
    assert.equal(await getInstallationToken(legacy, state), token);
    assert.equal(await getInstallationToken(undefined, state), token);
    assert.equal(JSON.parse(await readFile(state, 'utf8')).token, token);
    assert.equal((await stat(state)).mode & 0o777, 0o600);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('concurrent packaged starts share one new installation credential', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-font-access-'));
  try {
    const state = join(directory, 'state', 'installation.json');
    const tokens = await Promise.all(Array.from({ length: 8 }, () => getInstallationToken(undefined, state)));
    assert.equal(new Set(tokens).size, 1);
    assert.match(tokens[0], /^[a-f0-9]{64}$/);
    assert.equal(JSON.parse(await readFile(state, 'utf8')).token, tokens[0]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
