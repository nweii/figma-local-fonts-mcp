---
name: figma-local-fonts
description: Use when setting up Agent Font Access, creating or editing Figma text with fonts installed on the computer, or recovering its local font connection.
---

# Agent Font Access

Use the bundled local tools for text creation, copy, typography, font selection, and wrapping. Use the official Figma tools for surrounding layout, non-text layers, and screenshots.

## Connect the intended file

1. Find the `figma_local_fonts_` tools (status, inspect, search, create, edit); client prefixes vary. If they are missing, check that the Agent Font Access agent plugin is installed and enabled, inspect its MCP launch error, and start a fresh session if needed. Follow [plugin installation](../../docs/plugin-installation.md) for registration. If only some tools are available, check the installed version against the release notes and upgrade that installation. Preserve an existing working installation rather than adding a duplicate standalone server.
2. Call status. When no companion is connected, follow its `companion.nextAction` and `prepareCommand`. The bundled preparation script creates paired Figma files in private user storage and returns the full manifest path. It does not print the credential. For a standalone server without these resources, follow [source setup](../../docs/source-setup.md).
3. Open the intended file in Figma Desktop. Check **Plugins → Development** for Agent Font Access; a disconnected companion may be installed but closed. Import the returned manifest if needed, run the companion, and click **Find agent sessions** if the server started later. Use native app tools when available. Otherwise give the user the full manifest path and this exact action; complete file preparation first.
4. Confirm status lists the intended file and inspect the user's selected text or exact node IDs. Match its page, text, and font before writing. Keep the companion window open; collapsing its details preserves the connection.

Setup is complete when the intended file is connected and local inspection returns the intended text and font. Installing the agent plugin or starting the server alone does not establish a Figma connection. Keep credential-bearing files out of output, commits, archives, and support messages.

## Create or edit text

Inspect relevant text together. Search installed fonts when choosing a typeface or when an exact family/style is unknown.

For new text, identify its parent and use `figma_local_fonts_create` with the exact local font and intended formatting. It loads the font before adding the layer. Copy neighboring typography from inspected values instead of introducing a placeholder font. See [creation fields and limits](../../docs/text-tools.md#create-text) for supported parents, auto layout, colors, and wrapping.

For existing text, batch related changes using inspected revisions. A font change intentionally applies across the whole layer; copy replacements stay within one style run. Container inspection skips hidden descendants; explicit text targets return visibility flags. Treat `effectiveVisible` as the rendered visibility and edit hidden text only when requested.

## Verify and recover

Check every returned state against the requested text, fonts, sizing, and preserved formatting. After wrapping or composition changes, inspect a screenshot for clipping and alignment. Completion requires matching states and a passing visual check where layout changed.

For a missing connection, font failure, stale revision, mixed-style replacement, partial batch, or timeout, follow the matching [troubleshooting entry](../../docs/troubleshooting.md). Reuse complete returned states and revisions for follow-up edits; inspect again after an external change or uncertain result. For partial batches, retry only remaining work. For a timed-out creation, inspect the parent before retrying to avoid a duplicate.
