import { InitiativesService } from '@core/features/initiatives/node/initiatives-service';
import type { AppDb } from '@core/services/app-db/node/db';

let service: InitiativesService | undefined;

/** The app's one initiatives service, shared by its Wire controller and workspace control. */
export function getInitiativesService(db: AppDb): InitiativesService {
  service ??= new InitiativesService(db);
  return service;
}
