# Working on Agent Font Access

Read [README.md](README.md) for setup and user-visible behavior. For operating the tools during a design task, use [the agent skill](skills/figma-local-fonts/SKILL.md).

## Implementation boundaries

Keep MCP input validation in `src/schema.ts`, canvas mutation in `src/text.ts`, and socket routing in `src/bridge.ts`. The companion UI relays requests to the Figma sandbox; the canvas surface stays limited to text creation and edits. Creation loads its intended font before adding or revealing a layer.

Preserve font loading, revision checks, request expiry, and explicit file targeting when changing edits. Preserve loopback binding and installation authentication when changing transport. Discovery and reconnect attempts must terminate so an absent agent remains a quiet idle state.

The installation credential belongs in per-user application support, outside the source tree and npm package. `.local.json` is a private migration source for older installations. Edit source files and run the build rather than editing generated output. Keep credentials out of tool output and distributable files.

## Verification

Use `package.json` for the check, build, and test commands. For changed non-trivial behavior, run the relevant regression checks and build before a live test. Report automated coverage separately from a Figma Desktop result. A live write test uses a disposable layer and ends only after inspection confirms the original content and formatting have been restored.

When connection states or actions change, update the UI, MCP guidance, agent skill, and troubleshooting references together. Keep setup in the README and link to it from agent instructions.
