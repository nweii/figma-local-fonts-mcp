# Changelog

## 0.1.0-beta.3 (release candidate)

This candidate is prepared for review and has not been published to npm. The repository remains private during review; marketplace installation requires GitHub access to it. The npm `latest` tag still points to `0.1.0-beta.2`.

- Bundle the skill, local MCP server, and Figma companion preparation files for Claude Code and Codex.
- Include companion preparation in the standalone npm package, with `prepare-companion`, `--help`, and `--version` CLI commands.
- Create text directly with an installed font, loading that font before the layer appears.
- Return setup actions and companion preparation commands through connection status.
- Share one authenticated desktop broker across agent clients instead of reserving a desktop port per chat.
- Keep other clients connected when one closes. Stop the broker 30 seconds after its last agent disconnects.
- Document local storage, data handling, support, and removal for both installation paths.

## 0.1.0-beta.2

- Published package documentation explains local fonts, Figma account font uploads, and companion setup.
- The package runs a separate desktop listener for each client, using one of ten allowed ports. It does not contain the shared-broker change.

## 0.1.0-beta.1

- Initial prebuilt MCP package with status, text inspection, font search, and revision-protected batch editing through a development Figma Desktop companion.
