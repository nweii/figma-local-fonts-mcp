# Changelog

## [Unreleased]

## [0.1.0-beta.3] - 2026-10-14

### Added

- Create text directly with locally installed fonts.
- Agent plugins for Claude Code and Codex, including the MCP server, skill, and Figma companion setup files.
- Prepare the Figma companion from npm with `prepare-companion`, without cloning the repository.
- CLI help and version commands.
- Privacy, support, and removal instructions.

### Changed

- Agent chats share one desktop connection. Closing one chat leaves the others connected.
- Connection status includes companion setup steps.
- One plugin ZIP includes configuration for both Claude Code and Codex.

## [0.1.0-beta.2] - 2026-09-30

### Changed

- Clarified local font access, Figma account font uploads, and companion setup in the package documentation.

## [0.1.0-beta.1] - 2026-09-26

### Added

- Local MCP server and Figma Desktop companion for inspecting text, finding fonts, and editing text with revision checks.

[Unreleased]: https://github.com/nweii/figma-local-fonts-mcp/compare/v0.1.0-beta.3...HEAD
[0.1.0-beta.3]: https://github.com/nweii/figma-local-fonts-mcp/releases/tag/v0.1.0-beta.3
[0.1.0-beta.2]: https://www.npmjs.com/package/figma-local-fonts-mcp/v/0.1.0-beta.2
[0.1.0-beta.1]: https://www.npmjs.com/package/figma-local-fonts-mcp/v/0.1.0-beta.1
