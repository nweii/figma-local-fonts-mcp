# Set up from source

Use this path to build the Figma companion or test server changes before they are published to npm. Requires Node.js 24 or later.

## Build the source

Clone this repository and build the server and companion.

```sh
git clone https://github.com/nweii/figma-local-fonts-mcp.git
cd figma-local-fonts-mcp
npm ci --ignore-scripts
npm run build
```

The build creates the Figma companion using a private installation credential stored outside the repository. The server uses that credential to accept connections from your companion.

## Connect your agent

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

Continue with [Figma Desktop setup](../README.md#connect-figma-desktop). For an existing installation, follow [restart instructions](troubleshooting.md#restart-after-a-source-build) after rebuilding.
