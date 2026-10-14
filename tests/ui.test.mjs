// Verifies the companion UI's connection lifecycle, compact state, and accessible resize controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

async function loadUI({ reducedMotion = false } = {}) {
  const html = await readFile(new URL('../src/ui.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const elements = Object.fromEntries(['shell', 'status', 'sessions', 'dot', 'activity', 'find', 'toggle', 'details'].map(id => [id, {
    textContent: '', disabled: id === 'find', dataset: {}, hidden: false, inert: false, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  }]));
  const sockets = [];
  const parentMessages = [];
  const timers = new Map();
  const frames = new Map();
  let nextTimer = 0;
  let nextFrame = 0;
  class Socket {
    static OPEN = 1;
    constructor(url) { this.url = url; this.readyState = Socket.OPEN; sockets.push(this); }
    send() {}
    open() { this.onopen?.(); }
    close() { this.onclose?.(); }
    authenticate() { this.onmessage?.({ data: JSON.stringify({ type: 'authenticated' }) }); }
  }
  const window = {};
  runInNewContext(script, {
    window,
    document: { getElementById: id => elements[id] },
    parent: { postMessage(message) { parentMessages.push(message.pluginMessage); } },
    WebSocket: Socket,
    Map,
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  window.matchMedia = () => ({ matches: reducedMotion });
  return {
    window, elements, sockets, parentMessages,
    advance() { const scheduled = [...timers]; timers.clear(); for (const [, callback] of scheduled) callback(); },
    frame() { const scheduled = [...frames]; frames.clear(); for (const [, callback] of scheduled) callback(); },
  };
}

test('Figma identity starts one scan; idle time creates no further sockets', async () => {
  const ui = await loadUI();
  assert.equal(ui.sockets.length, 0);
  ui.window.onmessage({ data: { pluginMessage: { type: 'identity', connectionId: 'file-1', fileName: 'Example' } }, source: null });
  assert.equal(ui.sockets.length, 10);
  assert.equal(ui.sockets[0].url, 'ws://localhost:38460');
  assert.equal(ui.sockets[9].url, 'ws://localhost:38469');
  ui.sockets.forEach(socket => socket.close());
  for (let i = 0; i < 100; i++) ui.advance();
  assert.equal(ui.sockets.length, 10);
  assert.equal(ui.elements.status.textContent, 'No agent connected');
  assert.equal(ui.elements.find.disabled, false);
  ui.elements.find.onclick();
  assert.equal(ui.sockets.length, 20);
});

test('a connected session gets two reconnect attempts, then waits for manual search', async () => {
  const ui = await loadUI();
  ui.window.onmessage({ data: { pluginMessage: { type: 'identity', connectionId: 'file-1', fileName: 'Example' } } });
  ui.sockets[0].authenticate();
  ui.sockets.forEach(socket => socket.close());
  ui.advance();
  assert.equal(ui.sockets.length, 11);
  ui.sockets[10].close();
  ui.advance();
  assert.equal(ui.sockets.length, 12);
  ui.sockets[11].close();
  for (let i = 0; i < 100; i++) ui.advance();
  assert.equal(ui.sockets.length, 12);
  assert.equal(ui.elements.status.textContent, 'No agent connected');
  ui.elements.find.onclick();
  assert.equal(ui.sockets.length, 22);
});

test('a socket that opens but fails authentication has a distinct visible error', async () => {
  const ui = await loadUI();
  ui.window.onmessage({ data: { pluginMessage: { type: 'identity', connectionId: 'file-1', fileName: 'Example' } } });
  ui.sockets[0].open();
  ui.sockets.forEach(socket => socket.close());
  assert.match(ui.elements.activity.textContent, /could not pair/);
  assert.equal(ui.elements.status.textContent, 'Connection needs attention');
});

test('collapsing keeps the authenticated socket and resizes after the short transition', async () => {
  const ui = await loadUI();
  ui.window.onmessage({ data: { pluginMessage: { type: 'identity', connectionId: 'file-1', fileName: 'Example' } } });
  ui.sockets[0].authenticate();
  ui.elements.toggle.onclick({ detail: 1 });
  assert.equal(ui.elements.toggle.attributes['aria-expanded'], 'false');
  assert.equal(ui.elements.details.inert, true);
  assert.equal(ui.elements.details.attributes['aria-hidden'], 'true');
  assert.equal(ui.elements.status.textContent, 'Connected');
  assert.equal(ui.elements.sessions.textContent, 'Example');
  assert.equal(ui.sockets.length, 10);
  assert.equal(ui.sockets[0].authenticated, true);
  assert.equal(ui.parentMessages.some(message => message.type === 'resize'), false);
  ui.advance();
  assert.equal(ui.elements.details.hidden, true);
  assert.equal(ui.parentMessages.at(-1).type, 'resize');
  assert.equal(ui.parentMessages.at(-1).height, 56);
  ui.elements.toggle.onclick({ detail: 1 });
  assert.equal(ui.parentMessages.at(-1).type, 'resize');
  assert.equal(ui.parentMessages.at(-1).height, 184);
  ui.frame();
  assert.equal(ui.elements.shell.dataset.collapsed, 'false');
  assert.equal(ui.elements.details.hidden, false);
  assert.equal(ui.elements.details.inert, false);
  assert.equal(ui.elements.toggle.attributes['aria-expanded'], 'true');
  assert.equal(ui.sockets[0].authenticated, true);
});

test('rapid reversal cancels the pending collapse resize', async () => {
  const ui = await loadUI();
  ui.elements.toggle.onclick({ detail: 1 });
  ui.elements.toggle.onclick({ detail: 1 });
  ui.advance(); ui.frame();
  assert.equal(ui.parentMessages.filter(message => message.type === 'resize' && message.height === 56).length, 0);
  assert.equal(ui.elements.details.hidden, false);
  assert.equal(ui.elements.toggle.attributes['aria-expanded'], 'true');
});

test('keyboard and reduced-motion toggles resize immediately', async () => {
  for (const options of [{}, { reducedMotion: true }]) {
    const ui = await loadUI(options);
    ui.elements.toggle.onclick({ detail: options.reducedMotion ? 1 : 0 });
    assert.equal(ui.parentMessages.at(-1).type, 'resize');
    assert.equal(ui.parentMessages.at(-1).height, 56);
    assert.equal(ui.elements.details.hidden, true);
    assert.equal(ui.elements.shell.dataset.motion, 'instant');
    assert.equal(ui.elements.toggle.attributes['aria-label'], 'Expand details');
  }
});

test('errors remain visible in the compact status until the next successful response', async () => {
  const ui = await loadUI();
  ui.window.onmessage({ data: { pluginMessage: { type: 'identity', connectionId: 'file-1', fileName: 'Example' } } });
  ui.sockets[0].authenticate();
  ui.elements.toggle.onclick({ detail: 0 });
  ui.window.onmessage({ data: { pluginMessage: { type: 'response', route: 38460, error: 'Font is unavailable' } } });
  assert.equal(ui.elements.status.textContent, 'Needs attention');
  assert.equal(ui.elements.dot.dataset.state, 'attention');
  assert.equal(ui.elements.toggle.attributes['aria-label'], 'Expand to read error');
  assert.equal(ui.elements.activity.textContent, 'Font is unavailable');
  ui.window.onmessage({ data: { pluginMessage: { type: 'response', route: 38460, result: {} } } });
  assert.equal(ui.elements.status.textContent, 'Connected');
});

test('a partial batch result remains visible as compact attention', async () => {
  const ui = await loadUI();
  ui.window.onmessage({ data: { pluginMessage: { type: 'identity', connectionId: 'file-1', fileName: 'Example' } } });
  ui.sockets[0].authenticate();
  ui.elements.toggle.onclick({ detail: 0 });
  ui.window.onmessage({ data: { pluginMessage: { type: 'response', route: 38460, result: { success: false, failed: { error: 'Layer B may be partially applied.' } } } } });
  assert.equal(ui.elements.status.textContent, 'Needs attention');
  assert.equal(ui.elements.activity.textContent, 'Layer B may be partially applied.');
  assert.equal(ui.elements.toggle.attributes['aria-label'], 'Expand to read error');
});
