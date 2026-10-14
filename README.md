# Agent Font Access

Agent Font Access lets agents edit Figma text using fonts installed on your computer, without uploading those fonts to Figma. It pairs a local MCP server with a companion plugin in Figma Desktop for copy changes, typography, font selection, and text-box sizing with local reflow.

Use it alongside Figma’s official MCP for design creation, screenshots, and surrounding layout. Agent Font Access edits existing text layers and requires a local agent client. The desktop workflow has been tested on macOS; other operating systems have not been verified.

This is a development plugin that requires a source build and a manual import into Figma Desktop.

## When to use it

Use Agent Font Access when Figma Desktop can use a font that your agent’s remote Figma tools cannot load. As of October 2026, Figma’s remote MCP can access fonts uploaded to a Figma account, but cannot access fonts installed only on your computer. Account uploads are another option if your account supports them. See [Figma’s MCP server FAQ](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs).

No Figma personal access token is required. The companion does not change the official MCP’s plan requirements or usage limits.

## Installation

You need Node.js 24 or later, Figma Desktop with edit access to a file, the required fonts installed locally, and an MCP client that can launch a local process. Browser-only agent clients cannot launch this server.

### Build the source

Clone this repository and build the server and companion.

```sh
git clone https://github.com/nweii/figma-local-fonts-mcp.git
cd figma-local-fonts-mcp
npm ci --ignore-scripts
npm run build
```

The build creates the Figma companion using a private installation credential stored outside the repository. The server uses that credential to accept connections from your companion.

### Connect your agent

Run the command for your client from the repository directory. It registers the built server so the agent can call its text tools.

**Codex**

```sh
codex mcp add figma_local_fonts -- "$(command -v node)" "$PWD/dist/server.js"
```

**Claude Code**

```sh
claude mcp add --scope user --transport stdio figma_local_fonts -- "$(command -v node)" "$PWD/dist/server.js"
```

Start a fresh agent session after registration. Keep the repository at the registered path.

### Connect Figma Desktop

1. In Figma Desktop, select **Plugins → Development → Import plugin from manifest…** and choose `plugin/manifest.json` from this repository. Import it once per installation.
2. Open the intended file and run **Plugins → Development → Agent Font Access**. If the companion is already open, click **Find agent sessions**.
3. Ask the agent to call `figma_local_fonts_status`. It should list the intended file.
4. Select a text layer and ask the agent to inspect it. Confirm that the returned text and font match your selection.

Keep the companion window open while inspecting or editing. Closing it disconnects the file. You can collapse its details into a compact status panel without disconnecting.

For the combined design workflow, also connect the agent to Figma’s official remote MCP with its canvas-writing tools. Agent Font Access supplies the local text tools; your official Figma connection supplies creation, layout, and screenshots.

### Let an agent set it up

```text
Build and register Agent Font Access for my local MCP client using README.md#installation. Keep the installation credential private. Give me the full manifest path for the Figma import. After I open the companion in my intended file, verify that status lists that file and inspection returns my selected text and font. Report which checks passed and any remaining manual step. Ask before testing a write on a disposable duplicate.
```

The [published npm beta](https://www.npmjs.com/package/figma-local-fonts-mcp) is an alternate server installation for existing testers. It requires a separately built companion and may differ from this source build. See [package testing](docs/package-testing.md) and [release notes](CHANGELOG.md).

## Usage

Select text in Figma, or give the agent a node link, then ask for a change such as “Increase the selected heading to 24 while keeping its font.” The agent inspects the text before applying changes against its returned revision.

| Tool | Purpose |
| --- | --- |
| `figma_local_fonts_status` | List connected desktop files |
| `figma_local_fonts_inspect` | Read selected or specified text, including fonts, styles, dimensions, and revisions |
| `figma_local_fonts_search` | Find exact font family and style names available in Figma Desktop |
| `figma_local_fonts_edit` | Apply a batch of changes using each target’s inspected revision |

Edits preserve formatting that the request does not change. The plugin checks every target and loads all required fonts before writing. A preflight failure leaves the batch unapplied; a runtime failure can leave a partial batch. Check every returned state before continuing. Figma Undo can reverse the batch.

See [text operations and limits](docs/text-tools.md) for copy replacement, mixed styles, batch limits, and wrapping dimensions. The optional [agent skill](skills/figma-local-fonts/SKILL.md) provides routing and recovery guidance; registration does not install it automatically.

## Troubleshooting

The companion searches when it opens or when you click **Find agent sessions**. After a dropped connection, it tries twice to reconnect, then waits for another manual search. An agent started later may need that button.

See [troubleshooting](docs/troubleshooting.md) for missing connections, unavailable fonts, stale revisions, partial edits, and conflicting server builds.

## Privacy and network access

Agent clients share one desktop broker on IPv4 loopback port 38460. Each chat keeps its own MCP connection without reserving another desktop port. The broker exits 30 seconds after its last agent disconnects. The companion scans ports 38460–38469 and connects through `localhost`.

The bridge makes no requests to hosted services and does not upload font files. Figma’s normal document sync still applies. Text, style metadata, and file names returned through MCP are available to the agent provider you use. “Local” describes the bridge, not where the AI model runs.

On macOS, the installation credential lives at `~/Library/Application Support/Agent Font Access/installation.json`. The development build embeds it in generated `plugin/ui.html`. Generated credential-bearing files are excluded from Git and the npm package. Keep them out of archives and support messages. Clients running under your user account with access to this credential can connect to the broker.

Installing dependencies contacts the npm registry. Cloning this repository contacts GitHub. These setup operations are separate from the running bridge.

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

Build before packing; the npm package includes the prebuilt server, shared broker, and entry point. It excludes the companion’s credential-bearing UI.

The tests exercise text preservation with a Figma API fixture, MCP routing, and connection behavior. They do not establish that every installed font works in Figma Desktop. For a live write check, use a disposable text layer, verify the edit preserves its font, restore the original values, and inspect again.

After source changes, build again and restart the MCP clients and shared broker so they load the rebuilt code. Reopen the Figma companion to load its generated files. See [development restart instructions](docs/troubleshooting.md#restart-after-a-source-build).

## AI usage

The implementation and documentation were developed with AI coding agents under human direction.

## License

[MIT](LICENSE) © 2026 Nathan Cheng.
