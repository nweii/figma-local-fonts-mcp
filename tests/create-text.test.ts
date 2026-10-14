// Checks font-first creation, destination validation, wrapping, cleanup, and visibility during construction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createText, type CreateParent } from '../src/text.ts';
import { createSchema } from '../src/schema.ts';

function fixture() {
  const events: string[] = [];
  const page = { id: 'page', type: 'PAGE', parent: null, removed: false } as unknown as PageNode;
  const parent = { id: 'frame', type: 'FRAME', parent: page, removed: false, locked: false, visible: true, layoutMode: 'NONE', children: [] as TextNode[],
    appendChild(this: { children: TextNode[] }, node: TextNode) { events.push('append'); this.children.push(node); (node as unknown as { parent: CreateParent }).parent = parent; } } as unknown as FrameNode;
  let characters = ''; let visible = true; let font = { family: 'Inter', style: 'Regular' };
  const node = { id: 'created', parent: page, name: '', fontSize: 12, width: 1, height: 1, textAutoResize: 'WIDTH_AND_HEIGHT', x: 0, y: 0,
    get characters() { return characters; },
    set characters(value: string) { events.push(`text:${font.family}:${visible}`); characters = value; },
    get fontName() { return font; },
    set fontName(value: FontName) { events.push(`font:${value.family}`); font = value; },
    get visible() { return visible; },
    set visible(value: boolean) { events.push(`visible:${value}`); visible = value; },
    resize(this: { width: number; height: number }, width: number, height: number) { events.push('resize'); this.width = width; this.height = height; },
    remove() { events.push('remove'); (parent.children as TextNode[]).splice(0); },
  } as unknown as TextNode;
  const api = { currentPage: page, loadFontAsync: async (font: FontName) => { events.push(`load:${font.family}`); }, commitUndo: () => events.push('undo'),
    createText: () => { events.push('create'); return node; } };
  const args = createSchema.parse({ connectionId: 'file', parentId: 'frame', name: 'Example heading', characters: 'Direct local text', fontName: { family: 'Local Custom', style: 'Regular' }, fontSize: 24, x: 12, y: 20 });
  return { api, parent, node, args, events };
}

test('loads the requested font before creating text and reveals only fully styled text', async () => {
  const f = fixture();
  await createText(f.api, f.parent, f.args);
  assert.equal(f.events[0], 'load:Local Custom');
  assert.ok(f.events.indexOf('load:Local Custom') < f.events.indexOf('create'));
  assert.ok(f.events.includes('text:Local Custom:false'));
  assert.equal((f.node.fontName as FontName).family, 'Local Custom');
  assert.equal(f.node.characters, 'Direct local text');
  assert.equal(f.node.fontSize, 24);
  assert.equal(f.node.parent, f.parent);
  assert.equal(f.node.visible, true);
  assert.equal(f.node.x, 12); assert.equal(f.node.y, 20);
});

test('unavailable fonts and expiry never create a layer', async () => {
  const f = fixture(); f.api.loadFontAsync = async () => { throw new Error('Missing font'); };
  await assert.rejects(createText(f.api, f.parent, f.args), /No layer was created/);
  assert.equal(f.events.includes('create'), false);
  const expired = fixture();
  await assert.rejects(createText(expired.api, expired.parent, expired.args, Date.now() - 1), /No layer was created/);
  assert.equal(expired.events.includes('create'), false);
});

test('locked, hidden, removed, instance, and off-page parents are rejected without creation', async () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.parent.locked = true; },
    (f: ReturnType<typeof fixture>) => { f.parent.visible = false; },
    (f: ReturnType<typeof fixture>) => { Object.assign(f.parent, { removed: true }); },
    (f: ReturnType<typeof fixture>) => { Object.assign(f.parent, { parent: { type: 'INSTANCE', parent: f.api.currentPage } }); },
    (f: ReturnType<typeof fixture>) => { Object.assign(f.parent, { parent: { type: 'PAGE', id: 'other', parent: null } }); },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(createText(f.api, f.parent, f.args));
    assert.deepEqual(f.events, []);
  }
});

test('a destination changed during font loading is rechecked', async () => {
  const f = fixture(); f.api.loadFontAsync = async () => { f.parent.locked = true; };
  await assert.rejects(createText(f.api, f.parent, f.args), /locked/);
  assert.equal(f.events.includes('create'), false);
});

test('wrapping width, color, and absolute auto-layout position are applied before reveal', async () => {
  const f = fixture(); f.parent.layoutMode = 'HORIZONTAL';
  const args = createSchema.parse({ ...f.args, textAutoResize: 'HEIGHT', width: 200, layoutPositioning: 'ABSOLUTE', color: { r: 1, g: 0.5, b: 0 }, opacity: 0.7 });
  await createText(f.api, f.parent, args);
  assert.equal(f.node.width, 200); assert.equal(f.node.textAutoResize, 'HEIGHT');
  assert.equal(f.node.layoutPositioning, 'ABSOLUTE');
  assert.deepEqual(f.node.fills, [{ type: 'SOLID', color: args.color, opacity: 0.7 }]);
});

test('a creation setter failure removes the incomplete layer', async () => {
  const f = fixture(); Object.defineProperty(f.node, 'fills', { set() { throw new Error('Setter failure'); } });
  await assert.rejects(createText(f.api, f.parent, f.args), /layer was removed/);
  assert.equal(f.events.includes('remove'), true);
  assert.equal(f.events.includes('visible:true'), false);
});

test('creation schema rejects ambiguous dimensions, oversized text, and invalid colors', () => {
  const f = fixture();
  for (const changes of [{ width: 200 }, { textAutoResize: 'HEIGHT' }, { textAutoResize: 'NONE', width: 100 }, { characters: 'a'.repeat(20001) }, { color: { r: 255, g: 0, b: 0 } }])
    assert.throws(() => createSchema.parse({ ...f.args, ...changes }));
});
