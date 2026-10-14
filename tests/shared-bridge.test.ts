// Checks that many chats share one desktop listener, authenticate independently, and preserve request routing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { Bridge } from '../src/bridge.ts';
import { joinSharedBridge, type SharedBridge } from '../src/shared.ts';

test('twelve chats share one port and closing one leaves others usable', async () => {
  const broker = new Bridge();
  await broker.listen('fixture-token', 0, 0);
  const clients: SharedBridge[] = [];
  try {
    clients.push(...await Promise.all(Array.from({ length: 12 }, () => joinSharedBridge('fixture-token', broker.port))));
    assert.equal(broker.agentCount, 12);
    const statuses = await Promise.all(clients.map(client => client.status()));
    assert.ok(statuses.every(status => (status as { port: number }).port === broker.port), 'Every chat must reuse the desktop listener');
    await clients[0].close();
    assert.equal((await clients[1].status() as { port: number }).port, broker.port);
    await assert.rejects(joinSharedBridge('wrong-token', broker.port), /authentication failed/);
    const plugin = new WebSocket(`ws://127.0.0.1:${broker.port}`);
    await once(plugin, 'open');
    const authenticated = once(plugin, 'message');
    plugin.send(JSON.stringify({ type: 'hello', token: 'fixture-token', connectionId: 'example-file', fileName: 'Example file', fileKey: 'fixture-file' }));
    await authenticated;
    plugin.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'request') plugin.send(JSON.stringify({ type: 'response', id: message.id, result: { method: message.method, nodeIds: message.args.nodeIds } }));
    });
    const reads = await Promise.all(clients.slice(1).map((client, index) => client.request('inspect', { connectionId: 'example-file', nodeIds: [String(index)] } as { connectionId: string })));
    assert.deepEqual(reads, Array.from({ length: 11 }, (_, index) => ({ method: 'inspect', nodeIds: [String(index)] })));
    await assert.rejects(clients[1].request('edit', { connectionId: 'example-file' }), /Required/);
    await assert.rejects(clients[1].request('inspect', { connectionId: 'wrong-file' }), /Choose a connectionId/);
  } finally { await Promise.all(clients.map(client => client.close())); await broker.close(); }
});
