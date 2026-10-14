# Changelog

## Unreleased

- Create text directly with an installed font, loading that font before the layer appears.
- Connection status gives agents setup actions and the companion manifest path when available.

- Agent clients share one authenticated desktop broker instead of reserving a desktop port per chat.
- Closing one client leaves other clients connected. The broker stops 30 seconds after its last agent disconnects.
- The companion identifies its shared desktop connection separately from individual agent sessions.
- The README uses source installation as the primary setup path.

## 0.1.0-beta.2

- Published package documentation explains local fonts, Figma account font uploads, and companion setup.
- The package runs a separate desktop listener for each client, using one of ten allowed ports. It does not contain the shared-broker change.

## 0.1.0-beta.1

- Initial prebuilt MCP package with status, text inspection, font search, and revision-protected batch editing through a development Figma Desktop companion.
