import type { ContractClient } from '@emdash/wire/rpc';
import { domainClient } from '@core/primitives/wire/browser/connection';
import { workspaceControlContract, workspaceControlDomain } from '../contract';

export type WorkspaceControlClient = ContractClient<typeof workspaceControlContract>;

export function getWorkspaceControlClient(): Promise<WorkspaceControlClient> {
  return domainClient<WorkspaceControlClient>(workspaceControlDomain, workspaceControlContract);
}
