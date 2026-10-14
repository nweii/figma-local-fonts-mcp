// Gives agents concrete recovery steps without assuming an unconnected companion is uninstalled.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Status = { port: number; connections: Array<{ connectionId: string; fileName: string; fileKey: string | null }> };

export function companionSetup(root: URL) {
  const manifestPath = fileURLToPath(new URL('plugin/manifest.json', root));
  const available = existsSync(manifestPath);
  const built = available && existsSync(new URL('plugin/code.js', root)) && existsSync(new URL('plugin/ui.html', root));
  return { manifestPath: available ? manifestPath : null, built,
    nextAction: built ? 'OPEN_COMPANION' : available ? 'BUILD_COMPANION' : 'GET_COMPANION_SOURCE',
    instructions: built
      ? `In Figma Desktop, open the intended file and run Plugins > Development > Agent Font Access. If it is not in that menu, import ${manifestPath}. If already running, click Find agent sessions.`
      : available
        ? 'Build this source checkout with npm ci --ignore-scripts and npm run build, then import its plugin/manifest.json in Figma Desktop.'
        : 'This MCP package supplies the server, but not a paired Figma companion. Obtain the source repository, build it with npm ci --ignore-scripts and npm run build, then import plugin/manifest.json in Figma Desktop.',
    agentCanPrepareFiles: !built, requiresFigmaAction: true,
    guide: 'https://github.com/nweii/figma-local-fonts-mcp#installation' };
}

export function connectionStatus(status: Status, root: URL) {
  const connected = status.connections.length > 0;
  return { ...status, state: connected ? 'connected' : 'waiting_for_companion',
    server: { state: 'running', transport: 'stdio', tools: ['status', 'inspect', 'search', 'create', 'edit'].map(name => `figma_local_fonts_${name}`) },
    companion: connected ? { state: 'connected', nextAction: 'INSPECT_TEXT', instructions: 'Choose the intended connectionId, then inspect the selection or exact node IDs.' }
      : { state: 'not_connected', installed: 'unknown', ...companionSetup(root) } };
}
