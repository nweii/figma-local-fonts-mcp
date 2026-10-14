// Provides a diagnostic MCP client for verifying the installed local bridge from a terminal.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
const client = new Client({ name: 'local-fonts-diagnostic', version: '1' });
const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../dist/server.js', import.meta.url))], stderr: 'inherit' });
try {
  await client.connect(transport);
  for (let i = 0; i < 15; i++) {
    const status = await client.callTool({ name: 'figma_local_fonts_status', arguments: {} });
    if (status.structuredContent?.connections?.length) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const name = `figma_local_fonts_${process.argv[2] || 'status'}`;
  const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};
  console.log(JSON.stringify(await client.callTool({ name, arguments: args }), null, 2));
} finally { await client.close(); }
