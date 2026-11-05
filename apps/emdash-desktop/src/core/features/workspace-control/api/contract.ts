import { defineContract, procedure } from '@emdash/wire/rpc';
import { z } from 'zod';

/** How an MCP client outside the app reaches workspace control (via the stdio bridge). */
export type AgentConnection =
  | { available: false }
  | {
      available: true;
      /** argv for the stdio bridge, environment first (`env VAR=1 <executable> <script> ...`). */
      command: string[];
    };

export const workspaceControlDomain = 'workspaceControl' as const;

export const workspaceControlContract = defineContract({
  connection: procedure({ input: z.void(), output: z.custom<AgentConnection>() }),
});
