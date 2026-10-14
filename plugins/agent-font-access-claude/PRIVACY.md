# Privacy and local storage

Agent Font Access connects your agent client to an open Figma Desktop file through a local MCP server and Figma companion. The bridge listens on the loopback interface and makes no requests to hosted services. The companion communicates with that local bridge. Agent Font Access has no analytics or telemetry service.

## Data the agent receives

Status returns connected file names and available file keys. Inspection returns requested text, layer and page metadata, font names, style runs, dimensions, visibility, and revisions. Font search returns available font family and style names. Creation and edits return the affected text layers and their state.

These tool results reach the agent client and provider you choose. Their retention and use depend on that client's settings and provider policies. Figma's own document sync and data policies still apply to your file.

Agent Font Access loads installed fonts through Figma Desktop. It does not read or upload the font files themselves.

## Local storage

On macOS, Agent Font Access uses `~/Library/Application Support/Agent Font Access/`.

| File | Purpose |
| --- | --- |
| `installation.json` | Private credential that authenticates local clients and the companion |
| `companion/manifest.json` and `companion/code.js` | Prepared Figma development plugin files |
| `companion/ui.html` | Paired companion UI containing the credential |

An explicit `prepare-companion --output` writes the companion to your chosen directory instead. A source build also writes paired `plugin/ui.html` in its checkout. Distributable packages contain an unpaired template rather than these credential-bearing UI files.

On Windows, the default directory is `%APPDATA%/Agent Font Access/`. On Linux, it is `$XDG_CONFIG_HOME/Agent Font Access/`, or `~/.config/Agent Font Access/` if that variable is unset. The desktop workflow has been tested on macOS.

The companion keeps inspected snapshots and edit revisions in memory while it runs. The broker holds active connections and pending requests in memory. Agent Font Access does not write document text or tool results to disk. Your agent client may save tool results in chat history or logs.

## Control and removal

Keep `installation.json` and paired `ui.html` files out of commits, distributable archives, and support messages. Processes under your user account that can read the credential can connect to the broker and request operations in connected Figma files.

Closing the companion disconnects its file. Closing every agent client stops the broker after 30 seconds. Removing the agent plugin or MCP registration leaves the shared credential and prepared companion files on disk. Follow [uninstall instructions](README.md#uninstall), then move the storage directory and any custom preparation output to Trash if you want to remove them. Removing the credential requires preparing and pairing the companion again for a later installation.
