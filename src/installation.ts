// Keeps the local bridge credential in stable user storage outside npm packages.
import { randomBytes } from 'node:crypto';
import { chmod, link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const userData = process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support')
  : process.platform === 'win32' ? process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
  : process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
export const installationFile = join(userData, 'Agent Font Access', 'installation.json');

function validToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

async function readToken(path: string) {
  const settings: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (typeof settings !== 'object' || settings === null || !('token' in settings) || !validToken(settings.token))
    throw new Error(`Invalid Agent Font Access installation credential at ${path}.`);
  return settings.token;
}

export async function getInstallationToken(legacyFile?: string, stateFile = installationFile) {
  try {
    const token = await readToken(stateFile);
    await chmod(stateFile, 0o600);
    return token;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  let token: string | undefined;
  if (legacyFile) {
    try { token = await readToken(legacyFile); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  token ??= randomBytes(32).toString('hex');
  await mkdir(dirname(stateFile), { recursive: true, mode: 0o700 });
  const tempFile = `${stateFile}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tempFile, JSON.stringify({ token }), { flag: 'wx', mode: 0o600 });
  try {
    try { await link(tempFile, stateFile); return token; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = await readToken(stateFile);
      await chmod(stateFile, 0o600);
      return existing;
    }
  } finally { await unlink(tempFile); }
}
