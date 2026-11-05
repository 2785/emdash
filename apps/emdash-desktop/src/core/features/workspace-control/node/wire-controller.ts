import { createController, type Controller } from '@emdash/wire/rpc';
import { type AgentConnection, workspaceControlContract } from '../api/contract';

export function createWorkspaceControlWireController(
  connection: () => AgentConnection
): Controller {
  return createController(workspaceControlContract, {
    connection: async () => connection(),
  });
}
