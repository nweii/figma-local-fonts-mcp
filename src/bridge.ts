// Routes requests to authenticated Figma Desktop plugins over a loopback-only WebSocket.
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { setTimeout, clearTimeout } from 'node:timers';
import { WebSocket, WebSocketServer } from 'ws';
import { inspectSchema, fontSearchSchema, editSchema } from './schema.ts';

type Connection = { socket: WebSocket; connectionId: string; fileName: string; fileKey: string | null };
type Pending = { socket: WebSocket; resolve: (data: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

export class Bridge {
  connections = new Map<string, Connection>();
  private pending = new Map<string, Pending>();
  private wss?: WebSocketServer;
  port = 0;
  agentCount = 0;
  onAgentCountChange?: (count: number) => void;

  async listen(token: string, firstPort = 38460, lastPort = 38469) {
    for (let port = firstPort; port <= lastPort; port++) {
      const server = new WebSocketServer({ host: '127.0.0.1', port, maxPayload: 2 * 1024 * 1024 });
      try {
        await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
      } catch (error) { server.close(); if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') continue; throw error; }
      this.wss = server;
      this.port = (server.address() as { port: number }).port;
      server.on('connection', socket => {
        let authenticated = false;
        let connectionId = '';
        let agent = false;
        const timer = setTimeout(() => socket.close(1008, 'Authentication required'), 4000);
        socket.on('error', () => socket.close());
        socket.on('message', raw => {
          let message;
          try { message = JSON.parse(raw.toString()); } catch { socket.close(1008, 'Invalid message'); return; }
          if (!authenticated) {
            const supplied = Buffer.from(typeof message.token === 'string' ? message.token : '');
            const expected = Buffer.from(token);
            if (!['hello', 'agentHello'].includes(message.type) || supplied.length !== expected.length || !timingSafeEqual(supplied, expected) || (message.type === 'hello' && (typeof message.connectionId !== 'string' || typeof message.fileName !== 'string'))) {
              socket.close(1008, 'Authentication failed'); return;
            }
            if (message.type === 'agentHello') {
              authenticated = true; agent = true; clearTimeout(timer);
              this.agentCount++; this.onAgentCountChange?.(this.agentCount);
              socket.send(JSON.stringify({ type: 'agentAuthenticated', protocol: 1 }));
              return;
            }
            connectionId = message.connectionId;
            if (this.connections.has(connectionId)) { socket.close(1008, 'Duplicate connection'); return; }
            authenticated = true;
            clearTimeout(timer);
            this.connections.set(connectionId, { socket, connectionId, fileName: message.fileName, fileKey: message.fileKey ?? null });
            socket.send(JSON.stringify({ type: 'authenticated' }));
            return;
          }
          if (agent) {
            if (message.type !== 'agentRequest' || typeof message.id !== 'string') return;
            const answer = async () => {
              if (message.method === 'status') return this.status();
              const schemas = { inspect: inspectSchema, fonts: fontSearchSchema, edit: editSchema };
              if (!Object.hasOwn(schemas, message.method)) throw new Error('Unknown bridge method.');
              const method = message.method as keyof typeof schemas;
              return this.request(method, schemas[method].parse(message.args));
            };
            void answer().then(result => {
              if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'agentResponse', id: message.id, result }));
            }, error => {
              if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'agentResponse', id: message.id, error: String(error.message) }));
            });
            return;
          }
          const pending = this.pending.get(message.id);
          if (message.type !== 'response' || !pending || pending.socket !== socket) return;
          clearTimeout(pending.timer); this.pending.delete(message.id);
          if (message.error) pending.reject(new Error(String(message.error)));
          else pending.resolve(message.result);
        });
        socket.on('close', () => {
          clearTimeout(timer);
          if (agent) { this.agentCount--; this.onAgentCountChange?.(this.agentCount); }
          if (this.connections.get(connectionId)?.socket === socket) this.connections.delete(connectionId);
          for (const [id, pending] of this.pending) if (pending.socket === socket) {
            clearTimeout(pending.timer); this.pending.delete(id);
            pending.reject(new Error('Figma plugin disconnected. An in-progress edit may have applied; inspect before retrying.'));
          }
        });
      });
      return;
    }
    throw new Error('All Agent Font Access ports are in use. Close unused agent sessions and restart.');
  }

  status() {
    return { port: this.port, connections: [...this.connections.values()].map(({ socket: _, ...info }) => info),
      instructions: 'Open the intended file in Figma Desktop and run Plugins > Development > Agent Font Access. If the plugin is already open but no file is connected, click Find agent sessions. Inspect before editing; existing node IDs from the official MCP work here.' };
  }

  async request(method: 'inspect' | 'fonts' | 'edit', args: { connectionId?: string }, timeoutMs = 30000): Promise<unknown> {
    const connection = args.connectionId ? this.connections.get(args.connectionId) : this.connections.size === 1 ? [...this.connections.values()][0] : undefined;
    if (!connection) throw new Error(this.connections.size ? 'Choose a connectionId from figma_local_fonts_status so the correct file is targeted.' : 'Open Figma Desktop and run Plugins > Development > Agent Font Access in the intended file. If the plugin is already open, click Find agent sessions.');
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Figma request timed out. It may still finish. Inspect the node before retrying an edit.')); }, timeoutMs);
      this.pending.set(id, { socket: connection.socket, resolve, reject, timer });
      connection.socket.send(JSON.stringify({ type: 'request', id, method, args, deadline: Date.now() + timeoutMs }), error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
      });
    });
  }

  async close() {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Bridge closed.')); }
    this.pending.clear();
    for (const client of this.wss?.clients ?? []) client.terminate();
    if (this.wss) await new Promise<void>(resolve => this.wss!.close(() => resolve()));
  }
}
