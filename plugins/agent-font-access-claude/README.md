# Agent Font Access

Agent Font Access lets agents create and edit Figma text using fonts installed on your computer, without uploading those fonts to Figma. It pairs a local MCP server with a companion plugin in Figma Desktop.

Use Figma’s official MCP for surrounding layout and screenshots. The desktop workflow has been tested on macOS.

The Figma companion is installed through a development import. Either the agent plugin or standalone npm package can prepare its files for you.

## When to use it

Use Agent Font Access when Figma Desktop can use a font that your agent’s remote Figma tools cannot load. As of October 2026, Figma’s remote MCP can access fonts uploaded to a Figma account, but cannot access fonts installed only on your computer. Account uploads are another option if your account supports them. See [Figma’s MCP server FAQ](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs).

## Installation

You need Node.js 24 or later, Figma Desktop with edit access to a file, and the required fonts installed locally.

Install the [agent plugin for Claude Code or Codex](docs/plugin-installation.md) to get the skill, local server, and Figma companion setup files together. The standalone setup below works with other MCP clients.

For Claude Code, install from the repository marketplace.

```sh
claude plugin marketplace add nweii/figma-local-fonts-mcp
claude plugin install agent-font-access@agent-font-access --scope user
```

For Codex, follow the [marketplace and desktop installation steps](docs/plugin-installation.md#codex).

### Connect the standalone server

For an MCP client with a setup form, use either `npx` or `bunx`.

| Command | Arguments |
| --- | --- |
| `npx` | `-y`, `figma-local-fonts-mcp@latest` |
| `bunx` | `figma-local-fonts-mcp@latest` |

Follow [standalone setup](docs/package-testing.md) to register the server and prepare the Figma companion without cloning this repository. Use [source setup](docs/source-setup.md) for development.

### Connect Figma Desktop

1. Ask the agent to call `figma_local_fonts_status` and run its `prepareCommand` if preparation is needed. The command returns the full manifest path.
2. In Figma Desktop, select **Plugins → Development → Import plugin from manifest…** and choose that manifest. Import it once per installation.
3. Open the intended file and run **Plugins → Development → Agent Font Access**. If the companion is already open, click **Find agent sessions**.
4. Ask the agent to call `figma_local_fonts_status`. It should list the intended file.
5. Select a text layer and ask the agent to inspect it. Confirm that the returned text and font match your selection.

Keep the companion window open while inspecting or editing. Closing it disconnects the file. You can collapse its details into a compact status panel without disconnecting.

### Let an agent set it up

```text
Set up Agent Font Access for my local MCP client using README.md#installation. Preserve an existing working registration. Call status and follow its setup actions, including prepareCommand when present. Keep the installation credential private. Prepare the files before giving me the full manifest path and Figma import steps. After the companion opens in my intended file, verify that status lists that file and inspection returns my selected text and font. Report the checks that passed and any remaining manual step. Ask before testing a write on a disposable duplicate.
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

See [text operations and limits](docs/text-tools.md) for copy replacement, mixed styles, batch limits, and wrapping dimensions. The [agent skill](skills/figma-local-fonts/SKILL.md) provides setup, routing, and recovery guidance. It is included in the agent plugin; standalone MCP registration does not install it.

## Troubleshooting

If the agent’s server starts after the companion, click **Find agent sessions**. Ask the agent to check `figma_local_fonts_status` for setup actions.

See [troubleshooting](docs/troubleshooting.md) for missing connections, unavailable fonts, stale revisions, partial edits, and conflicting server builds.

## Privacy and network access

The bridge connects only through this computer's loopback interface. It makes no requests to hosted services and does not upload font files. Text, styles, and file metadata returned through MCP reach the agent client and provider you use. Figma's normal document sync still applies.

See [privacy and local storage](PRIVACY.md) for stored files, credentials, and data handling.

## Uninstall

If you installed the agent plugin, remove **Agent Font Access** through your client's plugin manager. The CLI equivalents are below.

```sh
claude plugin uninstall agent-font-access@agent-font-access --scope user
codex plugin remove agent-font-access@agent-font-access
```

If you registered the standalone MCP, remove that registration instead.

```sh
claude mcp remove --scope user figma_local_fonts
codex mcp remove figma_local_fonts
```

Close the companion and remove its development entry in Figma. Close agent sessions still using the server so the shared broker can stop. Removing a registration leaves the installation credential and paired companion files on disk. See [local storage](PRIVACY.md#local-storage) for their locations. Move that directory to Trash if you want to remove those files too. Source checkouts and npm caches are separate from these files.

## Development

Run the checks from the source repository directory.

```sh
npm run check
npm run build
npm test
```

Run `npm run check:release` to install and exercise the npm archive, check the bundled agent servers, and assemble review archives under `release/`. This check uses npm, Bun, Claude Code CLI, `zip`, and `unzip`. It downloads npm dependencies and prepares temporary paired files; it does not publish.

The tests cover text preservation, direct creation, MCP routing, and connection recovery. For a live check, use a disposable layer, verify its text and font, then remove it.

Follow [release instructions](docs/releasing.md) to publish through GitHub Actions and npm trusted publishing.

After source changes, build again and restart the MCP clients and shared broker so they load the rebuilt code. Reopen the Figma companion to load its generated files. See [development restart instructions](docs/troubleshooting.md#restart-after-a-source-build).

## Support

For setup problems, start with [troubleshooting](docs/troubleshooting.md). Report reproducible bugs in [GitHub issues](https://github.com/nweii/figma-local-fonts-mcp/issues), with the package version, operating system, client, and steps to reproduce. Use fictional text in examples and keep credentials and paired UI files out of reports. For vulnerabilities, follow [security reporting](SECURITY.md).

## AI usage

The implementation and documentation were developed with AI coding agents under human direction.

## License

[MIT](LICENSE) © 2026 Nathan Cheng.
