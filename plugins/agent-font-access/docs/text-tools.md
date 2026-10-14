# Text operations and limits

Agent Font Access creates and edits text layers. Use Figma’s official MCP for surrounding layout, non-text layers, and screenshots. Its node IDs can be passed to the local inspection tool.

## Inspect text

Inspection of frames and instances returns text whose own layer and ancestors are visible. Hidden descendants do not consume the 30-layer limit. A directly selected or explicitly requested text layer can still be inspected when hidden; `visible` and `effectiveVisible` distinguish its own setting from ancestor visibility.

Inspection returns a revision for each text layer. Supply that revision with an edit. Inspect again after an external change, a timeout, or an uncertain result. Another agent’s inspection of the same node can supersede a revision.

## Edit copy and formatting

Each batch targets 1–30 unique text layers. Each text layer is limited to 20,000 UTF-16 code units for inspection and copy edits. Copy replacement uses UTF-16 offsets and stays within one style run per target. Split replacements that span different styles into separate edits, using the updated revision after each successful edit.

Font discovery returns exact family and style names available in Figma Desktop. Setting `fontName` deliberately changes the font family and style across the entire target layer. Other text styles remain intact unless the request changes them.

## Create text

Use `figma_local_fonts_create` with the intended `connectionId`, `parentId`, `name`, `characters`, exact `fontName`, `fontSize`, and parent-relative `x` and `y`. Search local fonts or inspect neighboring text to identify its typeface. Optional properties include a solid RGB color (values from 0 to 1), opacity, line height, letter spacing, paragraph spacing, alignment, and wrapping dimensions.

The parent must be a visible, unlocked page, frame, group, component, or section on the current page. Creation inside component instances is not supported. In auto layout, `AUTO` lets the parent position the text; use `layoutPositioning: "ABSOLUTE"` to honor `x` and `y`.

The tool loads the requested font before creating a layer, configures the layer while hidden, and reveals it after applying all properties. The text is created with one uniform font and style. A failed font load creates no layer; a construction failure removes its incomplete layer. The result includes the created node’s state and revision for subsequent edits.

Creation is not idempotent. If a call times out or its response is lost, inspect the parent before retrying so you do not create a duplicate.

## Set wrapping dimensions

For wrapping text, use `textAutoResize: "HEIGHT"` with an explicit width. Height is calculated locally. Fixed boxes use `"NONE"`. With `"WIDTH_AND_HEIGHT"`, omit explicit width and height. Tool schemas expose the accepted fields and limits.

## Check the result

The plugin validates every target and loads all original and requested fonts before writing. A preflight failure leaves the batch unapplied. A runtime failure can leave a partial batch; the result identifies applied states, the failing target, and unattempted targets.

Check `success` and every returned state before continuing. Figma Undo can reverse the batch. After a composition or wrapping change, check a screenshot for clipping and alignment. A remote resize alone does not establish that missing-font text has reflowed correctly.

See [troubleshooting](troubleshooting.md) for stale revisions, partial edits, and timeouts.
