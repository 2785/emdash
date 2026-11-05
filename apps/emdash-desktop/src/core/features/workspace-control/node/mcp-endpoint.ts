import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmod, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import type { ControlCaller, WorkspaceControlService } from './workspace-control-service';

/** Header an Emjosh agent session sends to identify the conversation it runs in. */
export const CALLER_CONVERSATION_HEADER = 'x-emjosh-conversation';

/** Written to the endpoint file so local MCP clients can find and authenticate to Emjosh. */
export type ControlEndpointInfo = { url: string; token: string };

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** MCP tools over the control service, bound to one caller. */
export function buildControlMcpServer(
  service: WorkspaceControlService,
  caller: ControlCaller,
  version: string
): McpServer {
  const server = new McpServer({ name: 'emjosh', version });

  server.registerTool(
    'list_projects',
    {
      description: 'List the projects (repositories) open in Emjosh.',
      inputSchema: {},
    },
    async () => json(await service.listProjects())
  );

  server.registerTool(
    'list_workspaces',
    {
      description:
        'List Emjosh workspaces (tasks: a branch/worktree with its agent conversations) with ' +
        'their branch, agent status, last activity, and pull request state.',
      inputSchema: {
        projectId: z.string().optional().describe('Only workspaces of this project.'),
        includeArchived: z.boolean().optional().describe('Include archived workspaces.'),
      },
    },
    async (input) => json(await service.listWorkspaces(input))
  );

  server.registerTool(
    'current_workspace',
    {
      description: 'Describe the workspace this conversation is running in.',
      inputSchema: {},
    },
    async () => json(await service.currentWorkspace(caller))
  );

  server.registerTool(
    'archive_workspaces',
    {
      description:
        'Archive workspaces (reversible from Emjosh). The calling workspace is never archived. ' +
        'Confirm with the user before archiving anything they did not explicitly ask for.',
      inputSchema: { workspaceIds: z.array(z.string()).min(1) },
    },
    async ({ workspaceIds }) => json(await service.archiveWorkspaces(caller, workspaceIds))
  );

  server.registerTool(
    'create_workspace',
    {
      description:
        'Create a workspace in a project: a new branch and worktree, optionally with a first ' +
        'prompt for its agent, which starts working right away.',
      inputSchema: {
        projectId: z.string(),
        name: z.string().optional().describe('Workspace name; generated when omitted.'),
        baseBranch: z
          .string()
          .optional()
          .describe("Branch to start from; the project's default branch when omitted."),
        prompt: z.string().optional().describe('First message for the new workspace agent.'),
        provider: z
          .string()
          .optional()
          .describe("Agent to run (e.g. 'claude'); defaults to the calling workspace's agent."),
      },
    },
    async (input) => json(await service.createWorkspace(caller, input))
  );

  return server;
}

function bearerMatches(header: string | undefined, token: string): boolean {
  const presented = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const a = Buffer.from(presented);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function callerFrom(req: IncomingMessage): ControlCaller {
  const header = req.headers[CALLER_CONVERSATION_HEADER];
  const conversationId = Array.isArray(header) ? header[0] : header;
  return { conversationId: conversationId?.trim() || null };
}

export type ControlMcpEndpoint = {
  readonly info: ControlEndpointInfo;
  close(): Promise<void>;
};

/**
 * Serves the control MCP tools on loopback at `/mcp`, stateless (one server per request).
 * Requests must carry the bearer token from the endpoint file, which only the user can read.
 */
export async function startControlMcpEndpoint(options: {
  service: WorkspaceControlService;
  endpointFile: string;
  version: string;
  onError?(error: unknown): void;
}): Promise<ControlMcpEndpoint> {
  const token = randomBytes(32).toString('base64url');

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url?.split('?')[0] !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    if (!bearerMatches(req.headers.authorization, token)) {
      res.writeHead(401).end();
      return;
    }
    const mcp = buildControlMcpServer(options.service, callerFrom(req), options.version);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void mcp.close();
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
  };

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      options.onError?.(error);
      if (!res.headersSent) res.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  const info: ControlEndpointInfo = { url: `http://127.0.0.1:${port}/mcp`, token };
  await writeFile(options.endpointFile, JSON.stringify(info), { mode: 0o600 });
  await chmod(options.endpointFile, 0o600);

  return {
    info,
    async close() {
      await rm(options.endpointFile, { force: true });
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
