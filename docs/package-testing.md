# Test the published package

The npm package contains a prebuilt MCP server. It requires Node.js 24 or later and a local MCP client. It does not include the Figma companion’s credential-bearing UI. Build and import the companion using the [source installation](../README.md#installation) before using package tools with a file.

Check the [release notes](../CHANGELOG.md) before mixing a published server with the source companion. All active server clients should use the same build. Use the source installation when you need behavior that has not been published.

Register the published server with the client you use.

**Codex**

```sh
codex mcp add figma_local_fonts -- "$(command -v npx)" -y figma-local-fonts-mcp@latest
```

**Claude Code**

```sh
claude mcp add --scope user --transport stdio figma_local_fonts -- "$(command -v npx)" -y figma-local-fonts-mcp@latest
```

Start a fresh agent session after registration. Open Agent Font Access in the intended Figma Desktop file, or click **Find agent sessions** if it is already running. Confirm that status lists the file and inspection returns the selected text and font.

The package uses the same per-user installation credential as the source build. Installing it does not automatically install the [agent skill](../skills/figma-local-fonts/SKILL.md). Removing its client registration leaves the npm cache and installation credential on disk.
