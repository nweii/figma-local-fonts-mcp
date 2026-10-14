// Holds the shared Figma Desktop connection and exits after all agent clients have disconnected.
import { Bridge } from './bridge.ts';
import { getInstallationToken } from './installation.ts';

const bridge = new Bridge();
let idle: ReturnType<typeof setTimeout>;
let closing = false;
async function close() {
  if (closing) return;
  closing = true; clearTimeout(idle);
  await bridge.close(); process.exit(0);
}
bridge.onAgentCountChange = count => {
  clearTimeout(idle);
  if (count === 0 && !closing) idle = setTimeout(() => void close(), 30000);
};
try { await bridge.listen(await getInstallationToken(), 38460, 38460); }
catch (error) {
  // Concurrent clients can launch brokers together; only the process that binds the port survives.
  if (String((error as Error).message).includes('ports are in use')) process.exit(0);
  throw error;
}
bridge.onAgentCountChange(0);
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
