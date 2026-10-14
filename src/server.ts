// Exposes text tools to MCP clients and routes them to the local Figma Desktop plugin.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { inspectSchema, fontSearchSchema, editSchema, createSchema } from './schema.ts';
import { connectSharedBridge } from './shared.ts';
import { getInstallationToken } from './installation.ts';
import { companionSetup, connectionStatus } from './setup.ts';

const sourceRoot = new URL('../', import.meta.url);
const bridge = await connectSharedBridge(await getInstallationToken(), new URL('./broker.js', import.meta.url));
const server = new McpServer({ name: 'figma-local-fonts-mcp', version: '0.1.0-beta.2' }, {
  instructions: 'Agent clients share one local desktop broker; closing another chat leaves this connection usable. Use official Figma tools for layout and Agent Font Access for text that needs fonts installed on this Mac. Create new text directly with figma_local_fonts_create after identifying its exact installed font and intended parent; the font loads before the layer appears. Creation is not idempotent: after a timeout inspect the parent before retrying to avoid a duplicate. Inspect selected text or explicit frame/text IDs locally. Container inspection returns visible text; an explicit text ID can inspect a hidden layer. Search installed fonts when an exact family and style is needed. Submit one batch of 1–30 unique inspected text nodes with their revisions; a fontName change intentionally changes the font family and style across the whole text layer, while copy replacement stays in one style run. The plugin loads all original and requested fonts before any write. Check every returned state. A failed batch reports applied, failed, and unattempted nodes. Use its fresh failed state to plan remaining changes; inspect again if that state is unreadable or the request timed out. If status has no connection, run Agent Font Access in the intended Figma Desktop file; if already open, click Find agent sessions.'
});
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
async function result(action: () => unknown | Promise<unknown>) {
  try {
    const value = await action();
    return { content: [{ type: 'text' as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown>,
      ...(typeof value === 'object' && value !== null && 'success' in value && value.success === false ? { isError: true } : {}) };
  } catch (error) {
    const message = String((error as Error).message);
    const recovery = /Choose a connectionId|connection changed/.test(message)
      ? { statusTool: 'figma_local_fonts_status', nextAction: 'SELECT_CONNECTION', instructions: 'Call status and choose the current connectionId for the intended file.' }
      : /Open Figma Desktop|plugin disconnected/.test(message)
        ? { statusTool: 'figma_local_fonts_status', ...companionSetup(sourceRoot) } : undefined;
    return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: message, recovery }) }], structuredContent: { error: message, ...(recovery ? { recovery } : {}) } };
  }
}
server.registerTool('figma_local_fonts_status', {
  title: 'Agent Font Access connections', description: 'List connected Figma Desktop files. Call first to identify the target file before inspecting or editing local-font text.',
  inputSchema: {}, annotations: readAnnotations,
}, () => result(async () => connectionStatus(await bridge.status() as Parameters<typeof connectionStatus>[0], sourceRoot)));
server.registerTool('figma_local_fonts_inspect', {
  title: 'Inspect local Figma text', description: 'Inspect selected text or explicit text and container IDs. Containers return effectively visible nested text, including instances, up to 30 layers; explicit text IDs can inspect hidden text. Returns font runs, visibility, dimensions, and revisions for editing.',
  inputSchema: inspectSchema.shape, annotations: readAnnotations,
}, args => result(() => bridge.request('inspect', inspectSchema.parse(args))));
server.registerTool('figma_local_fonts_search', {
  title: 'Find installed Figma fonts', description: 'Search fonts available to the open Figma Desktop file by family or style. Returns bounded matches with exact family and style names to use for an intentional font change.',
  inputSchema: fontSearchSchema.shape, annotations: readAnnotations,
}, args => result(() => bridge.request('fonts', fontSearchSchema.parse(args))));
server.registerTool('figma_local_fonts_create', {
  title: 'Create text with an installed font', description: 'Create one text layer directly with an exact local font, loaded before any layer appears. Supply the intended file connection, parent on the current page, name, text, font, size, and position. Returns the created node and revision for subsequent edits. If a response times out, inspect the parent before retrying to avoid a duplicate.',
  inputSchema: createSchema.innerType().shape, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, args => result(() => bridge.request('create', createSchema.parse(args))));
server.registerTool('figma_local_fonts_edit', {
  title: 'Edit Figma text with local fonts', description: 'Edit 1–30 unique inspected text layers in one batch. Supply connectionId and edits with each nodeId, revision, and requested changes. All fonts and targets are checked before writing. A failed write returns applied states, the failing node state, and unattempted IDs; use those states before retrying.',
  inputSchema: editSchema.shape, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
}, args => result(() => bridge.request('edit', editSchema.parse(args))));
await server.connect(new StdioServerTransport());
console.error(`Agent Font Access shares desktop bridge on 127.0.0.1:${bridge.port}`);
let closing = false;
async function close() { if (closing) return; closing = true; await bridge.close(); await server.close(); process.exit(0); }
process.on('SIGINT', close);
process.on('SIGTERM', close);
process.stdin.on('end', close);
