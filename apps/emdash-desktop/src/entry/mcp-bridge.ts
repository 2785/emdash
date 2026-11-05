/**
 * stdio MCP server that forwards to the running Emjosh's control endpoint, for MCP clients
 * outside Emjosh (e.g. `claude mcp add emjosh -- <this>`). Run with ELECTRON_RUN_AS_NODE=1.
 * Usage: mcp-bridge.js <endpoint-file>; set EMJOSH_CONVERSATION_ID to act as a conversation.
 */
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { type EndpointInfo, forwardMessage } from '@main/core/workspace-control/mcp-bridge-forward';

const endpointFile = process.argv[2];

async function readEndpoint(): Promise<EndpointInfo | null> {
  if (!endpointFile) return null;
  try {
    const info = JSON.parse(await readFile(endpointFile, 'utf8')) as Partial<EndpointInfo>;
    return typeof info.url === 'string' && typeof info.token === 'string'
      ? { url: info.url, token: info.token }
      : null;
  } catch {
    return null;
  }
}

let queue = Promise.resolve();
createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  queue = queue.then(async () => {
    const replies = await forwardMessage(line, readEndpoint, {
      conversationId: process.env.EMJOSH_CONVERSATION_ID,
    });
    for (const reply of replies) process.stdout.write(`${reply}\n`);
  });
});
