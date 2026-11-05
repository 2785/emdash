import { defineContract, eventStream, procedure } from '@emdash/wire/rpc';
import { z } from 'zod';

export type DesktopUpdateState = {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
  lastCheck?: Date;
  nextCheck?: Date;
  currentVersion: string;
  availableVersion?: string;
  updateInfo?: unknown;
  downloadProgress?: UpdateProgress;
  error?: string;
  errorDetails?: string;
  rollbackVersion?: string;
  releaseNotes?: string;
};

export type UpdateProgress = {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
};

/** A build staged by `pnpm run install:personal`, waiting for a reload to be installed. */
export type PersonalStagedBuild = { builtAt: string; commit?: string };
export type PersonalBuildState = { enabled: boolean; staged: PersonalStagedBuild | null };
export type PersonalBuildStateResult =
  | { success: true; data: PersonalBuildState }
  | { success: false; error: string };

export type DesktopUpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'downloading'; version: string }
  | ({ type: 'progress' } & UpdateProgress)
  | { type: 'downloaded'; version: string }
  | { type: 'installing' }
  | { type: 'error'; message: string; details?: string }
  | { type: 'personal-staged'; build: PersonalStagedBuild | null };

export type UpdateActionResult = { success: true } | { success: false; error: string };
export type UpdateCheckResult =
  | { success: true; result: unknown | null }
  | { success: false; error: string };
export type UpdateStateResult =
  | { success: true; data: DesktopUpdateState }
  | { success: false; error: string };
export type ReleaseNotesResult =
  | { success: true; data: string | null }
  | { success: false; error: string };

const voidInput = z.void();

export const updatesDomain = 'updates' as const;

export const updatesContract = defineContract({
  check: procedure({ input: voidInput, output: z.custom<UpdateCheckResult>() }),
  download: procedure({ input: voidInput, output: z.custom<UpdateStateResult>() }),
  quitAndInstall: procedure({ input: voidInput, output: z.custom<UpdateActionResult>() }),
  openLatest: procedure({ input: voidInput, output: z.custom<UpdateActionResult>() }),
  getState: procedure({ input: voidInput, output: z.custom<UpdateStateResult>() }),
  getReleaseNotes: procedure({ input: voidInput, output: z.custom<ReleaseNotesResult>() }),
  getPersonalBuild: procedure({ input: voidInput, output: z.custom<PersonalBuildStateResult>() }),
  /** Personal builds only: quit cleanly and reopen, installing the staged build if there is one. */
  reloadPersonalBuild: procedure({ input: voidInput, output: z.custom<UpdateActionResult>() }),
  events: eventStream({
    key: z.void(),
    event: z.custom<DesktopUpdateEvent>(),
  }),
});
