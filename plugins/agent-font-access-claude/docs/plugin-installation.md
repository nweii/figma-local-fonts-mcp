# Install the agent plugin

Agent Font Access bundles its skill, local MCP server, and Figma companion setup files in one agent plugin. Requires Node.js 24 or later and Figma Desktop. The packaged server includes its JavaScript dependencies and does not need an npm install after the agent plugin is installed.

## Claude Code

Add the repository marketplace and install the plugin for your user account.

```sh
claude plugin marketplace add nweii/figma-local-fonts-mcp
claude plugin install agent-font-access@agent-font-access --scope user
```

Start a fresh session or reload plugins. The plugin supplies its local MCP registration and the `figma-local-fonts` skill. During development, load a checkout without installing it globally.

```sh
claude --plugin-dir ./plugins/agent-font-access-claude
```

## Codex

Register the repository marketplace.

```sh
codex plugin marketplace add nweii/figma-local-fonts-mcp
```

Open **Plugins** in Codex desktop, choose the **Agent Font Access** marketplace, and install **Agent Font Access**. Start a fresh session after installation. The plugin supplies its skill and local MCP registration. With a Codex CLI that supports `plugin add`, you can also install after marketplace registration.

```sh
codex plugin add agent-font-access@agent-font-access
```

If the plugin's bundled server is working, keep that registration as your only Agent Font Access server. If migrating from a standalone registration, verify the plugin tools first, then remove the old registration using [uninstall instructions](../README.md#uninstall).

## Download a plugin ZIP

The release ZIP contains both clients' manifests and MCP configuration, with one shared server and skill. Claude Code can load the ZIP for a session with `claude --plugin-dir /absolute/path/to/agent-font-access.zip`. For Codex, use the marketplace installation above.

## Set up the Figma companion

Ask the agent to set up Agent Font Access in your intended Figma file. Its status tool returns a `prepareCommand` when the bundled companion needs preparation. The agent can run that command and import the result through native app tools, or give you the full manifest path for the import.

Preparation stores paired files under `~/Library/Application Support/Agent Font Access/companion/` on macOS. Import the returned `manifest.json` through **Plugins → Development → Import plugin from manifest…**, then run **Agent Font Access** in your file. Keep the window open while the agent works.

The files shipped in the agent plugin contain no installation credential. Preparation uses the same private per-user credential as the local server. Figma Community publication is not needed for this development import. See [privacy and storage](../PRIVACY.md) for the generated files and [uninstall](../README.md#uninstall) for removal.

## Build and check a package

From the source repository, generate the distributable plugin.

```sh
npm ci --ignore-scripts
npm run build:plugin
claude plugin validate ./plugins/agent-font-access-claude --strict
```

`plugin-package/plugin.json`, the repository skill, and source code are canonical. `plugins/agent-font-access/` (portable Codex package) and `plugins/agent-font-access-claude/` (native Claude package) are generated and committed for marketplace installation. Regenerate both packages after changing code, skills, or supporting docs; do not edit their copies directly. The Codex package uses portable `plugin.json` and `mcp.json`. The Claude package uses `.claude-plugin/plugin.json` and `.mcp.json`. Both contain the same skill, runtime, and supporting files.
