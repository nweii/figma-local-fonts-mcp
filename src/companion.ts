// Prepares a paired Figma development companion in private user storage from credential-free plugin resources.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getInstallationToken, installationFile } from './installation.ts';

export const companionDirectory = join(dirname(installationFile), 'companion');

export async function prepareCompanion(root: URL, output = companionDirectory, stateFile = installationFile) {
  const [manifest, code, template] = await Promise.all([
    readFile(new URL('figma/manifest.json', root), 'utf8'),
    readFile(new URL('figma/code.js', root)),
    readFile(new URL('figma/ui.template.html', root), 'utf8'),
  ]);
  if (!template.includes('__BRIDGE_TOKEN__')) throw new Error('The companion template is missing its pairing placeholder.');
  const token = await getInstallationToken(undefined, stateFile);
  await mkdir(output, { recursive: true, mode: 0o700 });
  await writeFile(join(output, 'code.js'), code);
  await writeFile(join(output, 'ui.html'), template.replace('__BRIDGE_TOKEN__', token), { mode: 0o600 });
  await writeFile(join(output, 'manifest.json'), manifest);
  return { manifestPath: join(output, 'manifest.json'), nextAction: 'IMPORT_OR_OPEN_COMPANION',
    instructions: 'In Figma Desktop, import this manifest under Plugins > Development, then run Agent Font Access in the intended file. Keep its window open.' };
}
