# Text operations and limits

Agent Font Access edits existing text layers. Use Figma’s official MCP for creating layers, surrounding layout, and screenshots. Its node IDs can be passed to the local inspection tool.

## Inspect text

Inspection of frames and instances returns text whose own layer and ancestors are visible. Hidden descendants do not consume the 30-layer limit. A directly selected or explicitly requested text layer can still be inspected when hidden; `visible` and `effectiveVisible` distinguish its own setting from ancestor visibility.

Inspection returns a revision for each text layer. Supply that revision with an edit. Inspect again after an external change, a timeout, or an uncertain result. Another agent’s inspection of the same node can supersede a revision.

## Edit copy and formatting

Each batch targets 1–30 unique text layers. Each text layer is limited to 20,000 UTF-16 code units for inspection and copy edits. Copy replacement uses UTF-16 offsets and stays within one style run per target. Split replacements that span different styles into separate edits, using the updated revision after each successful edit.

Font discovery returns exact family and style names available in Figma Desktop. Setting `fontName` deliberately changes the font family and style across the entire target layer. Other text styles remain intact unless the request changes them.

For new text, create the layer through the official MCP with an available font, then use the local tool to apply the intended installed font, copy, and dimensions. Verify the intended font before considering the design complete.

## Set wrapping dimensions

For wrapping text, use `textAutoResize: "HEIGHT"` with an explicit width. Height is calculated locally. Fixed boxes use `"NONE"`. With `"WIDTH_AND_HEIGHT"`, omit explicit width and height. Tool schemas expose the accepted fields and limits.

## Check the result

The plugin validates every target and loads all original and requested fonts before writing. A preflight failure leaves the batch unapplied. A runtime failure can leave a partial batch; the result identifies applied states, the failing target, and unattempted targets.

Check `success` and every returned state before continuing. Figma Undo can reverse the batch. After a composition or wrapping change, check a screenshot for clipping and alignment. A remote resize alone does not establish that missing-font text has reflowed correctly.

See [troubleshooting](troubleshooting.md) for stale revisions, partial edits, and timeouts.
