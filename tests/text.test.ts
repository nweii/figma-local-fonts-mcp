// Verifies batch preflight, font loading, typography preservation, sizing, and partial-write reports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEdits, collectTextNodes, searchFonts, snapshot, type Target } from '../src/text.ts';
import { editSchema, fontSearchSchema, validateReplacement, type Edit } from '../src/schema.ts';

function fixture(id = '1:2') {
  const events: string[] = [];
  const mixed = Symbol('mixed');
  let characters = 'Hello world';
  let styles = Array.from(characters, (_, index) => ({ family: 'Local Custom', style: index < 6 ? 'Regular' : 'Bold' }));
  let size = 20;
  let width = 100;
  let height = 48;
  let autoResize: TextNode['textAutoResize'] = 'NONE';
  let failSize = false;
  let onSize = () => {};
  const node = {
    id, name: 'Fixture', parent: { id: 'parent', visible: true, locked: false, parent: null }, visible: true, locked: false, hasMissingFont: false,
    x: 0, y: 0, layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED',
    paragraphSpacing: 0, textAlignHorizontal: 'LEFT', letterSpacing: { unit: 'PIXELS', value: 0 }, lineHeight: { unit: 'AUTO' },
    get characters() { return characters; },
    get fontName() { return styles.every(font => JSON.stringify(font) === JSON.stringify(styles[0])) ? styles[0] : mixed; },
    set fontName(value: FontName | typeof mixed) { if (typeof value === 'symbol') throw new Error('Mixed is not a writable font.'); events.push(`font:${value.family}/${value.style}`); styles = styles.map(() => value); },
    get fontSize() { return size; },
    set fontSize(value: number) { events.push('size'); size = value; onSize(); if (failSize) throw new Error('Setter failed'); },
    get width() { return width; }, get height() { return height; },
    get textAutoResize() { return autoResize; },
    set textAutoResize(value: TextNode['textAutoResize']) {
      events.push(`auto:${value}`); autoResize = value;
      if (value === 'HEIGHT') height = Math.ceil(characters.length / Math.max(1, Math.floor(width / 10))) * 24;
    },
    resize(nextWidth: number, nextHeight: number) { events.push('resize'); width = nextWidth; height = nextHeight; },
    getStyledTextSegments() {
      const runs: { start: number; end: number; characters: string; fontName: FontName; fontSize: number }[] = [];
      styles.forEach((fontName, index) => {
        const previous = runs.at(-1);
        if (previous && JSON.stringify(previous.fontName) === JSON.stringify(fontName)) { previous.end++; previous.characters += characters[index]; }
        else runs.push({ start: index, end: index + 1, characters: characters[index], fontName, fontSize: size });
      });
      return runs;
    },
    getRangeAllFontNames() { return styles; },
    insertCharacters(start: number, text: string, style: string) {
      events.push('insert');
      const inherited = styles[Math.max(0, Math.min(styles.length - 1, style === 'AFTER' ? start : start - 1))];
      characters = characters.slice(0, start) + text + characters.slice(start);
      styles.splice(start, 0, ...Array.from(text, () => inherited));
    },
    deleteCharacters(start: number, end: number) {
      events.push('delete'); characters = characters.slice(0, start) + characters.slice(end); styles.splice(start, end - start);
    },
  } as unknown as TextNode;
  const api = {
    mixed, loadFontAsync: async (font: FontName) => { events.push(`load:${font.family}/${font.style}`); },
    commitUndo: () => { events.push('undo'); },
  } as unknown as Pick<PluginAPI, 'loadFontAsync' | 'mixed' | 'commitUndo'>;
  const target = (changes: Omit<Edit, 'nodeId' | 'revision'>): Target => ({ node, edit: { nodeId: id, revision: 'r', ...changes }, expected: JSON.stringify(snapshot(node)) });
  return { node, api, events, target, state: () => JSON.stringify(snapshot(node)), failSize: () => { failSize = true; }, onSize: (callback: () => void) => { onSize = callback; } };
}

function inspectionTree() {
  const text = (id: string, visible = true, parent: FrameNode | null = null) => ({ id, type: 'TEXT', visible, parent }) as unknown as TextNode;
  const frame = (id: string, children: SceneNode[], visible = true, parent: FrameNode | null = null) => {
    const node = { id, type: 'FRAME', visible, parent, children } as unknown as FrameNode;
    for (const child of children) (child as unknown as { parent: FrameNode }).parent = node;
    return node;
  };
  return { text, frame };
}

test('container inspection prunes hidden ancestors but explicit hidden text remains inspectable', () => {
  const { text, frame } = inspectionTree();
  const hiddenText = text('hidden-text');
  const hiddenFrame = frame('hidden-frame', [hiddenText], false);
  const root = frame('root', [hiddenFrame]);
  const fromContainer = collectTextNodes([root]);
  assert.deepEqual(fromContainer.nodes, []);
  assert.equal(fromContainer.hiddenContainers, 1);
  assert.equal(fromContainer.truncated, false);
  assert.deepEqual(collectTextNodes([hiddenText]).nodes.map(node => node.id), ['hidden-text']);
  assert.deepEqual(collectTextNodes([root, hiddenText, hiddenText]).nodes.map(node => node.id), ['hidden-text']);
});

test('hidden text and empty containers do not consume the 30-text inspection limit', () => {
  const { text, frame } = inspectionTree();
  const hidden = Array.from({ length: 35 }, (_, index) => frame(`hidden-${index}`, [text(`hidden-text-${index}`)], false));
  const empty = Array.from({ length: 35 }, (_, index) => frame(`empty-${index}`, []));
  const visible = Array.from({ length: 30 }, (_, index) => text(`visible-${index}`));
  const root = frame('root', [...hidden, ...empty, ...visible]);
  const exact = collectTextNodes([root]);
  assert.equal(exact.nodes.length, 30);
  assert.equal(exact.nodes[0].id, 'visible-0');
  assert.equal(exact.truncated, false);
  (root.children as SceneNode[]).push(text('visible-30', true, root));
  assert.equal(collectTextNodes([root]).truncated, true);
});

test('snapshot marks explicit hidden text and detects an ancestor hidden during font loading', async () => {
  const a = fixture();
  const parent = a.node.parent as FrameNode;
  a.node.visible = false;
  const hidden = snapshot(a.node);
  assert.equal(hidden.visible, false);
  assert.equal(hidden.effectiveVisible, false);
  a.node.visible = true;
  a.api.loadFontAsync = async () => { parent.visible = false; };
  await assert.rejects(applyEdits(a.api, [a.target({ fontSize: 28 })]), /changed since inspection/);
  assert.equal(a.node.fontSize, 20);
  assert.equal(a.events.includes('undo'), false);
});

test('shared original fonts load once across a two-target batch and mixed weights remain', async () => {
  const a = fixture('a'); const b = fixture('b');
  const result = await applyEdits(a.api, [a.target({ fontSize: 28 }), b.target({ fontSize: 28 })]);
  assert.equal(result.success, true);
  assert.deepEqual(a.events.filter(event => event.startsWith('load:')), ['load:Local Custom/Regular', 'load:Local Custom/Bold']);
  assert.equal(a.node.fontSize, 28); assert.equal(b.node.fontSize, 28);
  assert.equal(a.node.getStyledTextSegments(['fontName'])[1].fontName.style, 'Bold');
  assert.deepEqual(result.applied.map(node => node.id), ['a', 'b']);
});

test('a later invalid target stops the entire batch before fonts or writes', async () => {
  const a = fixture('a'); const b = fixture('b'); const before = a.state();
  await assert.rejects(applyEdits(a.api, [a.target({ fontSize: 28 }), b.target({ replacement: { start: 0, end: 11, text: 'Other' } })]), /multiple text styles/);
  assert.equal(a.state(), before); assert.deepEqual(a.events, []);
});

test('a change during font loading stops all writes', async () => {
  const a = fixture('a'); const b = fixture('b');
  a.api.loadFontAsync = async () => { b.node.name = 'Changed during load'; };
  await assert.rejects(applyEdits(a.api, [a.target({ fontSize: 28 }), b.target({ fontSize: 28 })]), /changed since inspection/);
  assert.equal(a.node.fontSize, 20); assert.equal(b.node.fontSize, 20);
  assert.equal(a.events.includes('undo'), false);
});

test('stale state and a locked ancestor stop preflight before any font loads', async () => {
  const a = fixture('a'); const b = fixture('b');
  const stale = b.target({ fontSize: 28 });
  b.node.name = 'Edited elsewhere';
  await assert.rejects(applyEdits(a.api, [a.target({ fontSize: 28 }), stale]), /changed since inspection/);
  assert.deepEqual(a.events, []);
  (b.node.parent as FrameNode).locked = true;
  await assert.rejects(applyEdits(a.api, [a.target({ fontSize: 28 }), b.target({ fontSize: 28 })]), /ancestor is locked/);
  assert.deepEqual(a.events, []);
});

test('expiry during font loading stops a batch without writing', async () => {
  const a = fixture('a'); const b = fixture('b');
  await assert.rejects(applyEdits(a.api, [a.target({ fontSize: 28 }), b.target({ fontSize: 28 })], Date.now() - 1), /expired while loading fonts/);
  assert.equal(a.node.fontSize, 20); assert.equal(b.node.fontSize, 20);
  assert.equal(a.events.includes('undo'), false);
});

test('an earlier synchronous edit can move a later auto-layout sibling', async () => {
  const a = fixture('a'); const b = fixture('b');
  const targets = [a.target({ fontSize: 28 }), b.target({ fontSize: 28 })];
  a.onSize(() => { b.node.x += 12; });
  const result = await applyEdits(a.api, targets);
  assert.equal(result.success, true);
  assert.equal(b.node.x, 12); assert.equal(b.node.fontSize, 28);
});

test('an unavailable requested font stops the batch before writes', async () => {
  const a = fixture('a'); const b = fixture('b');
  a.api.loadFontAsync = async font => { if (font.family === 'Unavailable') throw new Error('Missing'); a.events.push(`load:${font.style}`); };
  await assert.rejects(applyEdits(a.api, [a.target({ fontSize: 28 }), b.target({ fontName: { family: 'Unavailable', style: 'Regular' } })]), /could not load Unavailable/);
  assert.equal(a.node.fontSize, 20); assert.equal(typeof b.node.fontName, 'symbol');
  assert.equal(a.events.includes('undo'), false);
});

test('copy replacement preserves a style run; explicit font replacement changes the whole node', async () => {
  const a = fixture();
  await applyEdits(a.api, [a.target({ replacement: { start: 6, end: 11, text: 'Nathan' } })]);
  assert.equal(a.node.characters, 'Hello Nathan');
  assert.equal(a.node.getStyledTextSegments(['fontName'])[0].fontName.style, 'Regular');
  assert.equal(a.node.getStyledTextSegments(['fontName'])[1].fontName.style, 'Bold');
  await applyEdits(a.api, [a.target({ fontName: { family: 'Inter', style: 'Regular' } })]);
  assert.equal(a.node.getStyledTextSegments(['fontName']).length, 1);
  assert.equal(a.node.getStyledTextSegments(['fontName'])[0].fontName.family, 'Inter');
});

test('a width change with HEIGHT temporarily fixes dimensions, then computes wrapped height', async () => {
  const a = fixture();
  await applyEdits(a.api, [a.target({ width: 50, textAutoResize: 'HEIGHT' })]);
  assert.deepEqual(a.events.slice(-5), ['undo', 'auto:NONE', 'resize', 'auto:HEIGHT', 'undo']);
  assert.equal(a.node.width, 50); assert.equal(a.node.height, 72);
  assert.equal(a.node.textAutoResize, 'HEIGHT');
});

test('ambiguous dimensions and subminimum width fail before another target writes', async () => {
  const a = fixture('a'); const b = fixture('b');
  await assert.rejects(applyEdits(a.api, [a.target({ fontSize: 28 }), b.target({ width: 50, textAutoResize: 'WIDTH_AND_HEIGHT' })]), /explicit dimensions/);
  await assert.rejects(applyEdits(a.api, [a.target({ fontSize: 28 }), b.target({ height: 50, textAutoResize: 'HEIGHT' })]), /height is computed/);
  assert.throws(() => editSchema.parse({ connectionId: 'c', edits: [{ nodeId: 'a', revision: 'r', width: 0.001 }] }));
  assert.equal(a.node.fontSize, 20); assert.deepEqual(a.events, []);
});

test('a midbatch setter failure reports applied, possibly partial, and unattempted nodes', async () => {
  const a = fixture('a'); const b = fixture('b'); const c = fixture('c'); b.failSize();
  const result = await applyEdits(a.api, [a.target({ fontSize: 28 }), b.target({ fontSize: 28 }), c.target({ fontSize: 28 })]);
  assert.equal(result.success, false);
  assert.deepEqual(result.applied.map(node => node.id), ['a']);
  assert.equal(result.failed?.node.id, 'b');
  assert.match(result.failed?.error ?? '', /partially applied/);
  assert.deepEqual(result.unattemptedNodeIds, ['c']);
  assert.equal(c.node.fontSize, 20);
});

test('a one-item batch works and invalid duplicate or no-change batches are rejected', async () => {
  const a = fixture();
  const result = await applyEdits(a.api, [a.target({ fontSize: 24 })]);
  assert.equal(result.success, true); assert.equal(result.applied.length, 1);
  assert.throws(() => editSchema.parse({ connectionId: 'c', edits: [{ nodeId: 'x', revision: 'r', fontSize: 24 }, { nodeId: 'x', revision: 'r', fontSize: 25 }] }), /only once/);
  assert.throws(() => editSchema.parse({ connectionId: 'c', edits: [{ nodeId: 'x', revision: 'r' }] }));
  assert.throws(() => editSchema.parse({ connectionId: 'c', edits: Array.from({ length: 31 }, (_, i) => ({ nodeId: String(i), revision: 'r', fontSize: 24 })) }));
});

test('replacement rejects invalid ranges and half-surrogate offsets', () => {
  assert.throws(() => validateReplacement('A👍B', [], { start: 2, end: 3, text: '' }), /surrogate/);
  assert.throws(() => validateReplacement('abc', [], { start: 4, end: 4, text: '' }), /outside/);
  assert.throws(() => validateReplacement('abc', [], { start: 2, end: 1, text: '' }), /outside/);
});

test('font discovery filters and caps exact family and style matches', () => {
  const fonts = [
    { fontName: { family: 'Canela Text', style: 'Bold' } },
    { fontName: { family: 'Canela Text', style: 'Regular' } },
    { fontName: { family: 'Inter', style: 'Regular' } },
  ];
  const found = searchFonts(fonts, 'canela', 1);
  assert.deepEqual(found.matches, [{ family: 'Canela Text', style: 'Bold' }]);
  assert.equal(found.total, 2); assert.equal(found.truncated, true);
  assert.throws(() => fontSearchSchema.parse({ query: '', limit: 100 }));
  assert.throws(() => fontSearchSchema.parse({ query: 'a', limit: 101 }));
});
