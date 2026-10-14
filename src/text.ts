// Inspects Figma text and applies validated batches after loading their original and requested fonts.
import { validateReplacement, type Edit } from './schema.ts';

export const segmentFields = ['fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'fills', 'textStyleId', 'textCase', 'textDecoration', 'hyperlink', 'boundVariables'] as const;

export function searchFonts(fonts: Array<{ fontName: FontName }>, query: string, limit: number) {
  const needle = query.toLocaleLowerCase();
  const matches = fonts.map(font => font.fontName)
    .filter(font => `${font.family} ${font.style}`.toLocaleLowerCase().includes(needle))
    .sort((a, b) => a.family.localeCompare(b.family) || a.style.localeCompare(b.style));
  return { matches: matches.slice(0, limit), total: matches.length, truncated: matches.length > limit };
}

export function visibilityState(node: BaseNode) {
  const visibilityPath: Array<{ nodeId: string; visible: boolean }> = [];
  for (let ancestor: BaseNode | null = node; ancestor; ancestor = ancestor.parent) {
    if ('visible' in ancestor) visibilityPath.push({ nodeId: ancestor.id, visible: ancestor.visible !== false });
  }
  return {
    visible: 'visible' in node ? node.visible !== false : true,
    effectiveVisible: visibilityPath.every(ancestor => ancestor.visible),
    visibilityPath,
  };
}

export function collectTextNodes(roots: Array<SceneNode | PageNode>, limit = 30) {
  const nodes: TextNode[] = [];
  const seenText = new Set<string>();
  const seenContainers = new Set<string>();
  let truncated = false;
  let hiddenContainers = 0;
  function visit(node: SceneNode | PageNode, explicitText = false) {
    if (truncated) return;
    if (node.type === 'TEXT') {
      if (seenText.has(node.id) || (!explicitText && !visibilityState(node).effectiveVisible)) return;
      seenText.add(node.id);
      if (nodes.length < limit) nodes.push(node);
      else truncated = true;
      return;
    }
    if (!('children' in node) || seenContainers.has(node.id)) return;
    seenContainers.add(node.id);
    if (!visibilityState(node).effectiveVisible) { hiddenContainers++; return; }
    for (const child of node.children) {
      visit(child);
      if (truncated) break;
    }
  }
  for (const root of roots) {
    visit(root, root.type === 'TEXT');
    if (truncated) break;
  }
  return { nodes, truncated, hiddenContainers };
}

export function snapshot(node: TextNode) {
  return {
    nodeId: node.id, name: node.name, characters: node.characters,
    parentId: node.parent?.id ?? null,
    hasMissingFont: node.hasMissingFont,
    emptyFont: node.characters.length ? undefined : node.fontName,
    segments: node.getStyledTextSegments([...segmentFields]),
    paragraphSpacing: node.paragraphSpacing, textAlignHorizontal: node.textAlignHorizontal,
    textAutoResize: node.textAutoResize, width: node.width, height: node.height,
    layoutSizingHorizontal: node.layoutSizingHorizontal, layoutSizingVertical: node.layoutSizingVertical,
    x: node.x, y: node.y, locked: node.locked, ...visibilityState(node),
  };
}

export type Target = { node: TextNode; edit: Edit; expected: string };
export type BatchOutcome = { success: boolean; applied: TextNode[]; failed?: { node: TextNode; error: string }; unattemptedNodeIds: string[] };

function checkTarget(target: Target) {
  const { node, edit, expected } = target;
  if (node.id !== edit.nodeId) throw new Error(`Batch target ${edit.nodeId} does not match its text layer.`);
  if (JSON.stringify(snapshot(node)) !== expected) throw new Error(`Text node ${node.id} changed since inspection. Inspect it again before editing.`);
  for (let ancestor: BaseNode | null = node; ancestor; ancestor = ancestor.parent) {
    if ('locked' in ancestor && ancestor.locked) throw new Error(`Text node ${node.id} or an ancestor is locked. Unlock it in Figma before editing.`);
  }
  if (node.hasMissingFont) throw new Error(`Figma Desktop reports a missing font in node ${node.id}. Install the exact family and style before editing.`);
  if (edit.replacement) {
    validateReplacement(node.characters, snapshot(node).segments, edit.replacement);
    if (node.characters.length - (edit.replacement.end - edit.replacement.start) + edit.replacement.text.length > 20000)
      throw new Error(`Replacement would exceed the 20,000-character limit for node ${node.id}.`);
  }
  const mode = edit.textAutoResize ?? node.textAutoResize;
  if (mode === 'WIDTH_AND_HEIGHT' && (edit.width !== undefined || edit.height !== undefined))
    throw new Error(`Node ${node.id} uses WIDTH_AND_HEIGHT; explicit dimensions require a fixed-width mode.`);
  if (mode === 'HEIGHT' && edit.height !== undefined)
    throw new Error(`Node ${node.id} uses HEIGHT; its height is computed from its width and content.`);
}

function writeTarget(node: TextNode, edit: Edit) {
  if (edit.replacement) {
    const { start, end, text } = edit.replacement;
    // Insert first so an entire single-style replacement inherits the original font.
    if (text.length) node.insertCharacters(start, text, start < node.characters.length ? 'AFTER' : 'BEFORE');
    if (end > start) node.deleteCharacters(start + text.length, end + text.length);
  }
  if (edit.fontName !== undefined) node.fontName = edit.fontName;
  if (edit.fontSize !== undefined) node.fontSize = edit.fontSize;
  if (edit.letterSpacing !== undefined) node.letterSpacing = edit.letterSpacing;
  if (edit.lineHeight !== undefined) node.lineHeight = edit.lineHeight;
  if (edit.paragraphSpacing !== undefined) node.paragraphSpacing = edit.paragraphSpacing;
  if (edit.textAlignHorizontal !== undefined) node.textAlignHorizontal = edit.textAlignHorizontal;
  const mode = edit.textAutoResize ?? node.textAutoResize;
  if (edit.width !== undefined || edit.height !== undefined) {
    node.textAutoResize = 'NONE';
    node.resize(edit.width ?? node.width, edit.height ?? node.height);
  }
  if (edit.textAutoResize !== undefined || edit.width !== undefined || edit.height !== undefined) node.textAutoResize = mode;
}

export async function applyEdits(api: Pick<PluginAPI, 'loadFontAsync' | 'mixed' | 'commitUndo'>, targets: Target[], deadline = Infinity): Promise<BatchOutcome> {
  if (!targets.length || targets.length > 30) throw new Error('A batch must contain 1 to 30 text layers.');
  const fonts = new Map<string, FontName>();
  for (const target of targets) {
    checkTarget(target);
    const { node, edit } = target;
    const current = node.characters.length ? node.getRangeAllFontNames(0, node.characters.length) : node.fontName === api.mixed ? [] : [node.fontName];
    if (!current.length) throw new Error(`Cannot identify the current font for node ${node.id}.`);
    for (const font of [...current, ...(edit.fontName ? [edit.fontName] : [])]) fonts.set(JSON.stringify(font), font);
  }
  for (const font of fonts.values()) {
    try { await api.loadFontAsync(font); }
    catch { throw new Error(`Figma Desktop could not load ${font.family} / ${font.style}. Install that exact font locally. No edit was applied.`); }
  }
  // Loading fonts yields to the editor. Recheck every target before the first write.
  for (const target of targets) checkTarget(target);
  if (Date.now() >= deadline) throw new Error('Request expired while loading fonts. No edit was applied; inspect before retrying.');

  const applied: TextNode[] = [];
  api.commitUndo();
  for (const [index, target] of targets.entries()) {
    if (Date.now() >= deadline) {
      api.commitUndo();
      return { success: false, applied, failed: { node: target.node, error: 'Request expired before this edit. It was not attempted.' }, unattemptedNodeIds: targets.slice(index + 1).map(item => item.node.id) };
    }
    try { writeTarget(target.node, target.edit); applied.push(target.node); }
    catch (error) {
      api.commitUndo();
      return { success: false, applied, failed: { node: target.node, error: `This edit may be partially applied. Inspect before retrying or use Figma Undo. ${String(error)}` }, unattemptedNodeIds: targets.slice(index + 1).map(item => item.node.id) };
    }
  }
  api.commitUndo();
  return { success: true, applied, unattemptedNodeIds: [] };
}
