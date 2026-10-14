# Troubleshooting

## “No agent connected”

Ask the agent to check its Agent Font Access registration and launch errors. Start an agent session with the local MCP server enabled, then click **Find agent sessions** in the Figma companion. Confirm that `figma_local_fonts_status` lists the intended file.

The companion makes one discovery scan across the allowed local ports. Unused ports can produce connection-refused messages during that scan. It does not keep scanning while idle. A previously connected session receives two reconnect attempts before the companion returns to waiting. A manual search starts another discovery scan.

## “Connecting to Figma…”

The companion UI has not received its startup message from the Figma plugin. Close and reopen **Agent Font Access**. After changing source files, build again using the [development steps](../README.md#development), then reopen it.

## “The companion could not pair with the server”

The server and companion may have different installation credentials. Call status and run its `companion.prepareCommand` to regenerate the paired files. For a source installation, rebuild the checkout whose development manifest you imported. Restart the MCP server and reopen the companion. If the manifest path changed, import the returned manifest. Keep the installation credential and generated `ui.html` private; checking this does not require pasting their contents into an agent conversation.

## The agent has no local text tools

For an agent plugin, check that Agent Font Access is installed and enabled. For a standalone MCP, check the client's `figma_local_fonts` registration. Inspect the server launch error and confirm that its command resolves. Follow [installation](../README.md#installation) if registration is missing, then start a fresh agent session.

## “Figma Desktop reports a missing font”

Install the exact font family and style named by inspection, and confirm that Figma Desktop can use it. A font-loading failure must be resolved before the requested edit can succeed. Preserve the intended typeface while resolving availability.

## “Inspection revision for node … expired” or “Text node … changed since inspection”

Inspect the target again, then apply the remaining requested change against the returned revision. Another edit or inspection may have invalidated the previous revision.

## “Replacement spans multiple text styles”

Split the replacement into edits contained within individual inspected style runs. Recalculate offsets and use the returned revision after each successful edit. Match the result to the requested copy and preserved formatting before continuing.

## A batch reports a failed target

Check `success`, `applied`, `failed`, and `unattemptedNodeIds`. Applied targets include their updated state and revision. The failed target may be partly changed. Use its returned state and revision to decide what remains; inspect again if that state is missing, contains a read error, or no longer matches the canvas. Re-inspect unattempted targets if earlier changes affected their layout. Retry only the remaining work, or use Figma Undo to reverse the batch.

## “Figma request timed out”

Inspect all requested targets before retrying. The batch may have applied even when its result did not reach the agent. Confirm the final text and formatting before submitting another change.

## Explicit dimensions are rejected

Use `HEIGHT` and a width when text should wrap and grow vertically. Use `NONE` for a fixed box. With `WIDTH_AND_HEIGHT`, omit explicit dimensions. Height is computed in `HEIGHT` mode, so omit it from the request.

## “All Agent Font Access ports are in use”

This error comes from a server that reserves a port per chat. Stop those older servers, register the shared-broker build with your client, then restart the client and click **Find agent sessions**. Shared-broker clients use one desktop listener regardless of the number of chats.

## A frame inspection omits text

Container inspection skips text hidden by its own visibility setting or an ancestor. Request the exact text ID to inspect a hidden layer and check `visible` and `effectiveVisible`. If `truncated` is true, target a smaller visible container. Figma’s remote MCP can also omit invisible instance children; compare exact visible targets before assuming the two connections have different document versions.

## An incompatible server occupies the desktop port

The shared broker uses port 38460. Stop the older Agent Font Access process holding that port and start a client registered with the shared-broker build. Keep every active client on the same build. Confirm status lists the intended file before editing. Closing one client leaves the others connected; after the last client disconnects, the broker stops within 30 seconds.

## Restart after a source build

Close the Figma companion and every agent session using this server. The shared broker stops 30 seconds after the last client disconnects. Start the rebuilt MCP client, reopen the companion, and verify status and inspection before editing. Keeping an old client open keeps its broker running with the code it loaded at startup.

## The server is running but no file is connected

Call `figma_local_fonts_status`. Follow its `companion.nextAction` and run `companion.prepareCommand` when present. Preparation returns the full manifest path for Figma Desktop import. A disconnected companion may already be installed but closed; check the development menu before importing it again. Agents can prepare the files and use native app tools to import or open the companion when available. For source builds, follow the returned build instructions. An older npm version may require an upgrade; check the [release notes](../CHANGELOG.md).

## A creation response was lost

Inspect the intended parent before retrying `figma_local_fonts_create`. A timed-out request may have created its layer. Reuse the returned node if it exists; repeat creation only after confirming it did not occur.
