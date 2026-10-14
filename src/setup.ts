// Gives agents concrete recovery steps without assuming an unconnected companion is uninstalled.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { companionDirectory } from './companion.ts';

type Status = { port: number; connections: Array<{ connectionId: string; fileName: string; fileKey: string | null }> };

export function companionSetup(root: URL) {
  if (existsSync(new URL('figma/ui.template.html', root))) {
    const script = existsSync(new URL('dist/prepare-companion.mjs', root)) ? 'dist/prepare-companion.mjs' : 'scripts/prepare-companion.mjs';
    const prepareCommand = ['node', fileURLToPath(new URL(script, root))];
    const manifestPath = join(companionDirectory, 'manifest.json');
    const built = existsSync(manifestPath) && existsSync(join(companionDirectory, 'code.js')) && existsSync(join(companionDirectory, 'ui.html'));
    return { manifestPath, built, prepareCommand, nextAction: built ? 'OPEN_COMPANION' : 'PREPARE_COMPANION',
      instructions: built ? `Open the intended Figma Desktop file and run Agent Font Access. Import ${manifestPath} if it is not already in Plugins > Development.`
        : 'Run prepareCommand to create the paired companion, then import the returned manifest path in Figma Desktop.',
      agentCanPrepareFiles: true, requiresFigmaAction: true, guide: 'https://github.com/nweii/figma-local-fonts-mcp/blob/main/docs/plugin-installation.md' };
  }
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
