// Checks that the Figma development allowlist covers exactly the WebSocket addresses scanned by the plugin UI.
import { isIP } from 'node:net';

export function validateNetworkAccess(manifest, ui) {
  const connection = ui.match(/new WebSocket\(`(wss?):\/\/([^/:]+):\$\{port\}`\)/);
  const scan = ui.match(/for\s*\(\s*let\s+port\s*=\s*(\d+)\s*;\s*port\s*<\s*(\d+)\s*;\s*port\+\+\s*\)/);
  if (!connection || !scan) throw new Error('Cannot determine the plugin UI WebSocket host or port range');

  const [, protocol, hostname] = connection;
  const firstPort = Number(scan[1]);
  const endPort = Number(scan[2]);
  if (isIP(hostname) || firstPort < 1 || endPort > 65536 || endPort <= firstPort) {
    throw new Error('Plugin UI WebSocket host or port range is invalid');
  }

  const actual = manifest.networkAccess?.devAllowedDomains;
  if (!Array.isArray(actual) || actual.some(domain => {
    try { return isIP(new URL(domain).hostname.replace(/^\[|\]$/g, '')) !== 0; }
    catch { return true; }
  })) throw new Error('Figma development allowlist contains an invalid or numeric IP URL');

  const expected = Array.from({ length: endPort - firstPort }, (_, index) => `${protocol}://${hostname}:${firstPort + index}`);
  if (actual.length !== expected.length || expected.some(domain => !actual.includes(domain))) {
    throw new Error('Figma development allowlist does not match the plugin UI WebSocket addresses');
  }
}
