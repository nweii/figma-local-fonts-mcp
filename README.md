# Agent Font Access

Agent Font Access lets agents create and edit Figma text using fonts installed on your computer, without uploading those fonts to Figma. It pairs a local MCP server with a companion plugin in Figma Desktop.

Use Figma’s official MCP for surrounding layout and screenshots. The desktop workflow has been tested on macOS.

This is a development plugin that requires a source build and a manual import into Figma Desktop.

## When to use it

Use Agent Font Access when Figma Desktop can use a font that your agent’s remote Figma tools cannot load. As of October 2026, Figma’s remote MCP can access fonts uploaded to a Figma account, but cannot access fonts installed only on your computer. Account uploads are another option if your account supports them. See [Figma’s MCP server FAQ](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs).

## Installation

You need Node.js 24 or later, Figma Desktop with edit access to a file, the required fonts installed locally, and an MCP client that can launch a local process.

### Connect the published server

For an MCP client with a setup form, enter these values.

| Field | Value |
| --- | --- |
| Command | `npx` |
| Arguments | `-y`, `figma-local-fonts-mcp@latest` |

The equivalent CLI commands are in [package setup](docs/package-testing.md). The Figma companion also needs to be built and imported from this repository.

The published beta does not include the direct-creation tool or shared-server fix. To test those changes, use the source setup below. See [release notes](CHANGELOG.md).

### Build the companion or test source changes

Follow [source setup](docs/source-setup.md) to build the companion and obtain its manifest. That guide also provides the source-server registration for unpublished changes.

### Connect Figma Desktop

1. In Figma Desktop, select **Plugins → Development → Import plugin from manifest…** and choose `plugin/manifest.json` from this repository. Import it once per installation.
2. Open the intended file and run **Plugins → Development → Agent Font Access**. If the companion is already open, click **Find agent sessions**.
3. Ask the agent to call `figma_local_fonts_status`. It should list the intended file.
4. Select a text layer and ask the agent to inspect it. Confirm that the returned text and font match your selection.

Keep the companion window open while inspecting or editing. Closing it disconnects the file. You can collapse its details into a compact status panel without disconnecting.

### Let an agent set it up

```text
Set up Agent Font Access for my local MCP client using README.md#installation. Use the source build when I need changes not yet published to npm. Keep the installation credential private. Give me the full manifest path for the Figma import. After I open the companion in my intended file, verify that status lists that file and inspection returns my selected text and font. Report which checks passed and any remaining manual step. Ask before testing a write on a disposable duplicate.
```

## Usage

Select text in Figma, or give the agent a node link, then ask for a change such as “Increase the selected heading to 24 while keeping its font.” For existing text, the agent inspects it before applying changes against its returned revision. For new text, the agent identifies the intended parent and exact local font, then creates the layer with that font already loaded.

| Tool | Purpose |
| --- | --- |
| `figma_local_fonts_status` | List connected desktop files |
| `figma_local_fonts_inspect` | Read selected or specified text, including fonts, styles, dimensions, and revisions |
| `figma_local_fonts_search` | Find exact font family and style names available in Figma Desktop |
| `figma_local_fonts_create` | Create a text layer directly with its installed font, position, color, and wrapping dimensions |
| `figma_local_fonts_edit` | Apply a batch of changes using each target’s inspected revision |

Edits preserve formatting that the request does not change. The plugin checks every target and loads all required fonts before writing. A failed font load creates no layer. For edits, a preflight failure leaves the batch unapplied; a runtime failure can leave a partial batch. Check every returned state before continuing. Figma Undo can reverse the batch.

See [text operations and limits](docs/text-tools.md) for copy replacement, mixed styles, batch limits, and wrapping dimensions. The optional [agent skill](skills/figma-local-fonts/SKILL.md) provides routing and recovery guidance; registration does not install it automatically.

## Troubleshooting

If the agent’s server starts after the companion, click **Find agent sessions**. Ask the agent to check `figma_local_fonts_status` for setup actions.

See [troubleshooting](docs/troubleshooting.md) for missing connections, unavailable fonts, stale revisions, partial edits, and conflicting server builds.

## Privacy and network access

Agent clients share one local connection to Figma Desktop. The bridge listens only on this computer’s loopback interface.

The bridge makes no requests to hosted services and does not upload font files. Figma’s normal document sync still applies. Text, style metadata, and file names returned through MCP are available to the agent provider you use.

On macOS, the installation credential lives at `~/Library/Application Support/Agent Font Access/installation.json`. The development build embeds it in generated `plugin/ui.html`. Generated credential-bearing files are excluded from Git and the npm package. Keep them out of archives and support messages. Clients running under your user account with access to this credential can connect to the broker.

## Uninstall

Remove the server from the client where you registered it.

```sh
codex mcp remove figma_local_fonts
```

```sh
claude mcp remove --scope user figma_local_fonts
```

Close the companion and remove its development entry in Figma. Close agent sessions still using the server so the shared broker can stop. Removal leaves the source directory, installed dependencies, and installation credential on disk.

## Development

Run the checks from the repository directory.

```sh
npm run check
npm run build
npm test
```

The tests cover text preservation, direct creation, MCP routing, and connection recovery. For a live check, use a disposable layer, verify its text and font, then remove it.

After source changes, build again and restart the MCP clients and shared broker so they load the rebuilt code. Reopen the Figma companion to load its generated files. See [development restart instructions](docs/troubleshooting.md#restart-after-a-source-build).

## AI usage

The implementation and documentation were developed with AI coding agents under human direction.

## License

[MIT](LICENSE) © 2026 Nathan Cheng.
