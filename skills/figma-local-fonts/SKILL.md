---
name: figma-local-fonts
description: Use when editing Figma text with locally installed fonts, when the remote MCP cannot load a requested font, or when setting up or recovering Agent Font Access.
---

# Agent Font Access

Use the local tools for copy, font selection, typography, and text-box reflow that need fonts installed on the user's Mac. Use the official Figma MCP for design context, creation, frame layout, and screenshots. Route these operations without asking the user to choose a tool.

Inspect the relevant text together, discover exact font names when choosing a typeface, then batch related changes. The MCP instructions and schemas define the fields, limits, and preflight checks. Reuse the returned revisions and states for follow-up edits; inspect again after an external change, timeout, or uncertain result.

Frame and instance inspection skips hidden text. Direct text targets include visibility flags; check `effectiveVisible` before treating a returned layer as visible on the canvas. Edit hidden text only when the user’s request includes it.

For new text, the official MCP can create the layer using an available font. Apply the intended installed font, copy, and dimensions through the local tool before considering the design complete. A placeholder font is an intermediate state, not a substitute for the requested typeface.

An edit is complete when every target reports success and its returned state matches the requested copy, fonts, sizing, and unaffected styles. After a composition or wrapping change, check a screenshot for clipping and alignment. A remote resize alone does not establish that missing-font text has reflowed correctly.

## Set up Agent Font Access

When the local tools are unavailable, follow [source installation](../../README.md#installation), including registration and the Figma development import. For published-package testing, follow the [package guide](../../docs/package-testing.md). Agent clients share one desktop broker; use the incompatible-server recovery in troubleshooting if an older build occupies its port. Setup is complete when local status lists the intended file and inspection returns the intended text.

## Recover a connection or edit

For a missing connection, failed font load, stale revision, mixed-style replacement, partial batch, or timeout, follow the matching state in [troubleshooting](../../docs/troubleshooting.md). Use the batch's applied, failed, and unattempted targets to identify remaining work. Complete returned states and revisions can support the next edit directly; re-inspect when a state is missing, uncertain, or changed externally. Connection recovery ends when status lists the intended file; edit recovery ends when returned states or fresh inspection confirm the requested text and formatting.
