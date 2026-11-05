import { join } from 'node:path';
import { app } from 'electron';

/** Where the workspace control endpoint publishes its URL and token for local MCP clients. */
export function controlEndpointFile(): string {
  return join(app.getPath('userData'), 'control-endpoint.json');
}
