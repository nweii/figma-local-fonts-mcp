// Exercises authenticated local routing, ambiguous file rejection, timeouts, and MCP discovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { Bridge } from '../src/bridge.ts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function connect(bridge: Bridge, id: string, token = 'test-secret') {
  const socket = new WebSocket(`ws://localhost:${bridge.port}`);
  await once(socket, 'open');
  const response = once(socket, 'message');
  socket.send(JSON.stringify({ type: 'hello', token, connectionId: id, fileName: id }));
  await response;
  return socket;
}
test('auth rejects unknown clients; two files require explicit routing', async () => {
  const bridge = new Bridge(); await bridge.listen('test-secret', 0, 0);
  try {
    const unauthenticated = new WebSocket(`ws://127.0.0.1:${bridge.port}`);
    await once(unauthenticated, 'open'); const closed = once(unauthenticated, 'close');
    unauthenticated.send(JSON.stringify({ type: 'hello', token: 'wrong', connectionId: 'bad', fileName: 'bad' }));
    await closed; assert.equal(bridge.connections.size, 0);
    const a = await connect(bridge, 'a'); await connect(bridge, 'b');
    await assert.rejects(bridge.request('inspect', {}), /Choose a connectionId/);
    a.on('message', raw => { const message = JSON.parse(raw.toString()); a.send(JSON.stringify({ type: 'response', id: message.id, result: { file: 'a' } })); });
    assert.deepEqual(await bridge.request('inspect', { connectionId: 'a' }), { file: 'a' });
    await assert.rejects(bridge.request('edit', { connectionId: 'b' }, 20), /timed out/);
  } finally { await bridge.close(); }
});
test('twelve SDK clients discover five tools and share one desktop broker', async () => {
  const clients = Array.from({ length: 12 }, () => new Client({ name: 'integration-test', version: '1' }));
  try {
    await Promise.all(clients.map(client => client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/server.js'], stderr: 'pipe' }))));
    const listed = await clients[0].listTools(); assert.equal(listed.tools.length, 5);
    const statuses = await Promise.all(clients.map(client => client.callTool({ name: 'figma_local_fonts_status', arguments: {} })));
    assert.ok(statuses.every(status => !status.isError && (status.structuredContent as { port?: number } | undefined)?.port === 38460));
    await clients[0].close();
    const remaining = await clients[1].callTool({ name: 'figma_local_fonts_status', arguments: {} });
    assert.equal(remaining.isError, undefined);
    const edit = await clients[1].callTool({ name: 'figma_local_fonts_edit', arguments: { connectionId: 'not-a-file', edits: [{ nodeId: '1:2', revision: 'r', fontSize: 24 }] } });
    assert.equal(edit.isError, true);
  } finally { await Promise.all(clients.map(client => client.close())); }
});
