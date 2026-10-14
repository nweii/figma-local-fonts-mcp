// Connects independent stdio clients to one authenticated desktop broker without reserving a port per chat.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

export class SharedBridge {
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private socket: WebSocket;
  port: number;
  constructor(socket: WebSocket, port: number) {
    this.socket = socket; this.port = port;
    socket.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      const pending = this.pending.get(message.id);
      if (message.type !== 'agentResponse' || !pending) return;
      clearTimeout(pending.timer); this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(String(message.error)));
      else pending.resolve(message.result);
    });
    socket.on('error', () => socket.close());
    socket.on('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Desktop bridge disconnected. An edit may have applied; reconnect and inspect before retrying.'));
      }
      this.pending.clear();
    });
  }
  status() { return this.call('status', {}); }
  request(method: 'inspect' | 'fonts' | 'edit' | 'create', args: { connectionId?: string }) { return this.call(method, args); }
  private call(method: string, args: unknown): Promise<unknown> {
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Desktop bridge disconnected. Restart this MCP client and inspect before editing.'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Desktop bridge request timed out. Inspect before retrying an edit.')); }, 35000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ type: 'agentRequest', id, method, args }), error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
      });
    });
  }
  async close() { this.socket.close(); }
}

export async function joinSharedBridge(token: string, port = 38460): Promise<SharedBridge> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, { maxPayload: 2 * 1024 * 1024 });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => fail(new Error('The desktop port is occupied by an incompatible server. Stop older Agent Font Access servers and restart.')), 4500);
    function cleanup() { clearTimeout(timer); socket.off('error', fail); socket.off('close', closed); socket.off('message', received); }
    function fail(error: Error) { cleanup(); socket.terminate(); reject(error); }
    function closed() { fail(new Error('Desktop broker authentication failed or an older server occupies its port.')); }
    function received(raw: import('ws').RawData) {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { fail(new Error('Invalid desktop broker response.')); return; }
      if (message.type !== 'agentAuthenticated' || message.protocol !== 1) { fail(new Error('Incompatible desktop broker.')); return; }
      cleanup(); resolve();
    }
    socket.once('error', fail); socket.once('close', closed); socket.on('message', received);
    socket.once('open', () => socket.send(JSON.stringify({ type: 'agentHello', token })));
  });
  return new SharedBridge(socket, port);
}

export async function connectSharedBridge(token: string, brokerFile: URL): Promise<SharedBridge> {
  try { return await joinSharedBridge(token); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ECONNREFUSED') throw error; }
  const child = spawn(process.execPath, [fileURLToPath(brokerFile)], { detached: true, stdio: 'ignore' });
  child.unref();
  let launchError: Error | undefined;
  child.on('error', error => { launchError = error; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    await new Promise(resolve => setTimeout(resolve, 50));
    try { return await joinSharedBridge(token); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ECONNREFUSED') throw error; }
  }
  throw new Error('Desktop broker could not start. Check local permissions and restart the MCP client.');
}
