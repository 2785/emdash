import type { ContractClient } from '@emdash/wire/rpc';
import { domainClient } from '@core/primitives/wire/browser/connection';
import { initiativesContract, initiativesDomain } from '../contract';

export type InitiativesClient = ContractClient<typeof initiativesContract>;

export function getInitiativesClient(): Promise<InitiativesClient> {
  return domainClient<InitiativesClient>(initiativesDomain, initiativesContract);
}
