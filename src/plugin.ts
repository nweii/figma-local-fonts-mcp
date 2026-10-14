// Runs inside Figma Desktop and handles authenticated bridge requests forwarded by its UI.
import { inspectSchema, fontSearchSchema, editSchema, createSchema } from './schema.ts';
import { applyEdits, collectTextNodes, searchFonts, snapshot, createText, type CreateParent, type Target } from './text.ts';

figma.showUI(__html__, { width: 280, height: 184, themeColors: true, title: 'Agent Font Access' });
const connectionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const revisions = new Map<string, { revision: string; state: string }>();
let queue = Promise.resolve();

function describe(node: TextNode) {
  if (node.characters.length > 20000) throw new Error(`Text node ${node.id} exceeds the 20,000-character inspection limit.`);
  const state = snapshot(node);
  const revision = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  revisions.set(node.id, { revision, state: JSON.stringify(state) });
  return { ...state, revision };
}

async function handle(method: string, input: unknown, deadline: number) {
  if (method === 'fonts') {
    const args = fontSearchSchema.parse(input);
    return { connectionId, query: args.query, ...searchFonts(await figma.listAvailableFontsAsync(), args.query, args.limit) };
  }
  if (method === 'inspect') {
    const args = inspectSchema.parse(input);
    const roots: Array<SceneNode | PageNode> = [];
    if (args.nodeIds) {
      for (const id of args.nodeIds) {
        const node = await figma.getNodeByIdAsync(id.replace(/^(\d+)-(\d+)$/, '$1:$2'));
        if (!node || (node.type !== 'TEXT' && !('children' in node))) throw new Error(`Node ${id} is not a text layer or container in this file.`);
        roots.push(node as SceneNode | PageNode);
      }
    } else roots.push(...figma.currentPage.selection);
    const { nodes, truncated, hiddenContainers } = collectTextNodes(roots);
    return { connectionId, fileName: figma.root.name, fileKey: figma.fileKey ?? null, pageName: figma.currentPage.name, nodes: nodes.map(describe), truncated,
      hint: nodes.length ? undefined : hiddenContainers
        ? 'Hidden containers were skipped. Select an individual text layer to inspect it, or make its container visible in Figma.'
        : 'Select a text layer or frame in Figma, or provide text node IDs from the official MCP.' };
  }
  if (method === 'create') {
    const args = createSchema.parse(input);
    if (args.connectionId !== connectionId) throw new Error('The target file connection changed. Check status again.');
    const parent = await figma.getNodeByIdAsync(args.parentId.replace(/^(\d+)-(\d+)$/, '$1:$2'));
    if (!parent || !['PAGE', 'FRAME', 'GROUP', 'COMPONENT', 'SECTION'].includes(parent.type)) throw new Error('The target parent does not support text creation.');
    const node = await createText(figma, parent as CreateParent, args, deadline);
    return { success: true, connectionId, fileName: figma.root.name, pageName: figma.currentPage.name, created: describe(node) };
  }
  if (method === 'edit') {
    const args = editSchema.parse(input);
    if (args.connectionId !== connectionId) throw new Error('The target file connection changed. Inspect the file again.');
    const targets: Target[] = [];
    for (const edit of args.edits) {
      const saved = revisions.get(edit.nodeId);
      if (!saved || saved.revision !== edit.revision) throw new Error(`Inspection revision for node ${edit.nodeId} expired. Inspect it again.`);
      const node = await figma.getNodeByIdAsync(edit.nodeId);
      if (!node || node.type !== 'TEXT') throw new Error(`The inspected text layer ${edit.nodeId} no longer exists.`);
      targets.push({ node, edit, expected: saved.state });
    }
    const outcome = await applyEdits(figma, targets, deadline);
    const describeAfter = (node: TextNode) => {
      try { return describe(node); }
      catch (error) { return { nodeId: node.id, readError: String((error as Error).message ?? error) }; }
    };
    return { success: outcome.success, connectionId, fileName: figma.root.name,
      applied: outcome.applied.map(describeAfter),
      failed: outcome.failed && { nodeId: outcome.failed.node.id, error: outcome.failed.error, state: describeAfter(outcome.failed.node) },
      unattemptedNodeIds: outcome.unattemptedNodeIds };
  }
  throw new Error('Unknown bridge operation.');
}

figma.ui.onmessage = message => {
  if (message.type === 'resize' && (message.height === 56 || message.height === 184)) {
    figma.ui.resize(280, message.height);
    return;
  }
  if (message.type === 'ready') {
    figma.ui.postMessage({ type: 'identity', connectionId, fileName: figma.root.name, fileKey: figma.fileKey ?? null });
    return;
  }
  if (message.type !== 'request') return;
  queue = queue.then(async () => {
    if (Date.now() > message.deadline) throw new Error('Request expired before it could run. Inspect before retrying.');
    return handle(message.method, message.args, message.deadline);
  }).then(result => {
    figma.ui.postMessage({ type: 'response', route: message.route, id: message.id, result });
  }).catch(error => {
    figma.ui.postMessage({ type: 'response', route: message.route, id: message.id, error: String(error.message ?? error) });
  });
};
