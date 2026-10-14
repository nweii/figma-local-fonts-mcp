// Defines the narrow text operations accepted by both the MCP server and Figma plugin.
import { z } from 'zod';

export const inspectSchema = z.object({
  connectionId: z.string().optional().describe('Plugin connection from figma_local_fonts_status. Omit only when exactly one file is connected.'),
  nodeIds: z.array(z.string().min(1)).min(1).max(30).optional().describe('Figma text or container IDs, including IDs from the official MCP. Containers return effectively visible text; an explicit text ID can inspect a hidden layer.'),
}).strict();

export const fontSearchSchema = z.object({
  connectionId: z.string().optional().describe('Plugin connection from status. Omit only when exactly one file is connected.'),
  query: z.string().trim().min(1).max(100).describe('Case-insensitive family or style search; returns exact installed names.'),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();

export const editTargetSchema = z.object({
  nodeId: z.string().min(1),
  revision: z.string().min(1).describe('Revision returned by local inspection; prevents stale edits.'),
  replacement: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    text: z.string().max(20000),
  }).strict().optional().describe('Optional replacement at UTF-16 offsets from inspection. A replacement must stay inside one style run; unaffected text keeps its styling.'),
  fontSize: z.number().positive().max(1000).optional().describe('Set size across this text node without changing its font families or weights.'),
  fontName: z.object({ family: z.string().trim().min(1).max(100), style: z.string().trim().min(1).max(100) }).strict().optional().describe('Intentional whole-node font replacement using an exact installed family and style.'),
  letterSpacing: z.object({ unit: z.enum(['PIXELS', 'PERCENT']), value: z.number().min(-1000).max(10000) }).strict().optional(),
  lineHeight: z.union([
    z.object({ unit: z.literal('AUTO') }).strict(),
    z.object({ unit: z.enum(['PIXELS', 'PERCENT']), value: z.number().positive().max(10000) }).strict(),
  ]).optional(),
  paragraphSpacing: z.number().nonnegative().max(10000).optional(),
  textAlignHorizontal: z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']).optional(),
  width: z.number().min(0.01).max(100000).optional(),
  height: z.number().min(0.01).max(100000).optional(),
  textAutoResize: z.enum(['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']).optional(),
}).strict().refine(value => Object.keys(value).some(key => !['nodeId', 'revision'].includes(key)), 'Provide at least one text change.');

export const editSchema = z.object({
  connectionId: z.string().min(1).describe('Exact connectionId returned by local inspection.'),
  edits: z.array(editTargetSchema).min(1).max(30).superRefine((edits, context) => {
    const seen = new Set<string>();
    for (const [index, edit] of edits.entries()) {
      if (seen.has(edit.nodeId)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'nodeId'], message: 'Each text node may appear only once per batch.' });
      seen.add(edit.nodeId);
    }
  }),
}).strict();

export type Edit = z.infer<typeof editTargetSchema>;
export type EditBatch = z.infer<typeof editSchema>;
export type Inspect = z.infer<typeof inspectSchema>;

export interface StyleRun { start: number; end: number; [key: string]: unknown }

export function validateReplacement(text: string, runs: StyleRun[], replacement: NonNullable<Edit['replacement']>) {
  const { start, end } = replacement;
  if (start > end || end > text.length) throw new Error('Replacement offsets are outside the inspected text.');
  for (const position of [start, end]) {
    const previous = text.charCodeAt(position - 1);
    const next = text.charCodeAt(position);
    if (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff)
      throw new Error('Replacement splits a Unicode surrogate pair. Use complete characters.');
  }
  if (start !== end && runs.filter(run => run.start < end && run.end > start).length > 1)
    throw new Error('Replacement spans multiple text styles. Edit each style run separately to preserve typography.');
}
