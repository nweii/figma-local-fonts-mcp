# Set up the standalone MCP

The npm package contains the prebuilt local server and files to prepare the Figma companion. Requires Node.js 24 or later and an MCP client that can launch a local process. Companion preparation requires `0.1.0-beta.3` or later.

## Register the server

Register it with the client you use. Choose either runner.

| Client | With npm | With Bun |
| --- | --- | --- |
| Codex | `codex mcp add figma_local_fonts -- "$(command -v npx)" -y figma-local-fonts-mcp@latest` | `codex mcp add figma_local_fonts -- "$(command -v bunx)" figma-local-fonts-mcp@latest` |
| Claude Code | `claude mcp add --scope user --transport stdio figma_local_fonts -- "$(command -v npx)" -y figma-local-fonts-mcp@latest` | `claude mcp add --scope user --transport stdio figma_local_fonts -- "$(command -v bunx)" figma-local-fonts-mcp@latest` |

Start a fresh agent session after registration. Keep active server clients on the same build. If an older server is still running, follow [restart instructions](troubleshooting.md#restart-after-a-source-build) before connecting the replacement.

## Prepare the Figma companion

Ask the agent to call `figma_local_fonts_status` and run its `companion.prepareCommand`. You can also prepare it from the terminal with either runner.

```sh
npx -y figma-local-fonts-mcp@latest prepare-companion
```

```sh
bunx figma-local-fonts-mcp@latest prepare-companion
```

The command returns JSON containing `manifestPath`. It writes the paired companion to your user storage and uses the same private credential as the server. To choose a different location, append `--output /absolute/path/to/companion`. Keep that directory private because its generated `ui.html` contains the pairing credential.

Continue with [Figma Desktop setup](../README.md#connect-figma-desktop). Confirm that status lists your intended file and inspection returns the selected text and font.

Standalone MCP registration does not install the [agent skill](../skills/figma-local-fonts/SKILL.md). Use the [agent plugin](plugin-installation.md) to install the skill and server together. See [uninstall](../README.md#uninstall) for removal and [privacy](../PRIVACY.md) for local storage.
