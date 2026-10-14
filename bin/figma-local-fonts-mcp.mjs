#!/usr/bin/env node
// Starts the prebuilt Agent Font Access MCP server from its installed package.
// Also prepares its paired Figma companion without a source checkout.
import { readFile } from 'node:fs/promises';

const [command, ...args] = process.argv.slice(2);
const usage = `Usage: figma-local-fonts-mcp [command]

With no command, starts the local MCP server over stdio.

Commands:
  prepare-companion [--output <directory>]  Prepare paired files for Figma development import
  --help                                  Show this help
  --version                               Show the installed version
`;
if (command === undefined) {
  await import('../dist/server.js');
} else if (command === '--help' && !args.length) {
  console.log(usage);
} else if (command === '--version' && !args.length) {
  console.log(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
} else if (command === 'prepare-companion' && (!args.length || (args.length === 2 && args[0] === '--output'))) {
  const { prepareCompanion } = await import('../dist/companion.js');
  console.log(JSON.stringify(await prepareCompanion(new URL('../', import.meta.url), args[1]), null, 2));
} else {
  console.error(usage);
  process.exitCode = 1;
}
