import { createController, type Controller } from '@emdash/wire/rpc';
import { updatesContract, type DesktopUpdateState, type PersonalBuildState } from '../api';
import { updateEvents } from './event-host';

export type UpdateOperations = {
  checkForUpdates(): Promise<unknown | null>;
  downloadUpdate(): void;
  quitAndInstall(): void;
  openLatestRelease(): Promise<void>;
  getState(): DesktopUpdateState;
  fetchReleaseNotes(): Promise<string | null>;
  getPersonalBuild(): PersonalBuildState;
  reloadPersonalBuild(): void;
  checkPersonalUpdates(): Promise<void>;
  formatError(error: unknown): string;
};

export function createUpdatesWireController(updateOperations: UpdateOperations): Controller {
  return createController(updatesContract, {
    check: async () => {
      try {
        const result = await updateOperations.checkForUpdates();
        return { success: true as const, result: result ?? null };
      } catch (error) {
        return { success: false as const, error: updateOperations.formatError(error) };
      }
    },
    download: async () => {
      try {
        updateOperations.downloadUpdate();
        return { success: true as const, data: updateOperations.getState() };
      } catch (error) {
        return { success: false as const, error: updateOperations.formatError(error) };
      }
    },
    quitAndInstall: async () => {
      try {
        updateOperations.quitAndInstall();
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: updateOperations.formatError(error) };
      }
    },
    openLatest: async () => {
      try {
        await updateOperations.openLatestRelease();
        return { success: true as const };
      } catch (error) {
        return {
          success: false as const,
          error: updateOperations.formatError(error),
        };
      }
    },
    getPersonalBuild: async () => {
      try {
        return { success: true as const, data: updateOperations.getPersonalBuild() };
      } catch (error) {
        return { success: false as const, error: updateOperations.formatError(error) };
      }
    },
    checkPersonalUpdates: async () => {
      try {
        await updateOperations.checkPersonalUpdates();
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: updateOperations.formatError(error) };
      }
    },
    reloadPersonalBuild: async () => {
      try {
        updateOperations.reloadPersonalBuild();
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: updateOperations.formatError(error) };
      }
    },
    getState: async () => {
      try {
        return { success: true as const, data: updateOperations.getState() };
      } catch (error) {
        return { success: false as const, error: updateOperations.formatError(error) };
      }
    },
    getReleaseNotes: async () => {
      try {
        return { success: true as const, data: await updateOperations.fetchReleaseNotes() };
      } catch (error) {
        return { success: false as const, error: updateOperations.formatError(error) };
      }
    },
    events: updateEvents,
  });
}
