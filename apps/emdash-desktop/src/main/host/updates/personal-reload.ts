import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { PersonalBuildState, PersonalStagedBuild } from '@core/features/updates/api';
import { updateEvents } from '@core/features/updates/node/event-host';
import { IS_PERSONAL, PRODUCT_NAME } from '@core/primitives/app-identity/api/app-identity';
import { log } from '@main/lib/logger';

/** Where `pnpm run install:personal` stages builds; keep in sync with scripts/install-personal.sh. */
export const PERSONAL_STAGE_DIR = join(homedir(), 'Library', 'Caches', 'emdash-josh', 'staged');
const POLL_INTERVAL_MS = 3_000;
const EXIT_WAIT_SECONDS = 120;

/**
 * Runs detached after the app quits: waits for `pid` to exit, swaps the staged bundle in (copy,
 * verify, then replace, so a failed copy leaves the installed app untouched), and reopens the
 * app. Gives up without touching anything if the app is still running after the wait, which is
 * what happens when the user cancels the quit.
 */
export const RELOAD_HELPER_SCRIPT = `
set -u
pid="$1"; target="$2"; staged="$3"; wait_seconds="$4"
for _ in $(seq 1 $((wait_seconds * 2))); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
if kill -0 "$pid" 2>/dev/null; then echo "$(date) app still running; reload cancelled"; exit 0; fi
sleep 1
if [ -n "$staged" ] && [ -d "$staged" ]; then
  next="$target.next"
  rm -rf "$next"
  if ditto "$staged" "$next" && codesign --verify --deep --strict "$next"; then
    rm -rf "$target" && mv "$next" "$target" && rm -rf "$(dirname "$staged")"
    echo "$(date) installed staged build"
  else
    rm -rf "$next"
    echo "$(date) staged build failed verification; keeping installed app"
  fi
fi
open "$target"
`;

type PersonalReloadDeps = {
  enabled: boolean;
  stageDir: string;
  productName: string;
  /** Path of the running app bundle (`…/Emdash Josh.app`). */
  bundlePath: string;
  pid: number;
  readText(path: string): Promise<string>;
  spawnDetached(args: string[]): void;
  quit(): void;
  emitStaged(build: PersonalStagedBuild | null): void;
};

export class PersonalReloadService {
  private staged: PersonalStagedBuild | null = null;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly deps: PersonalReloadDeps) {}

  async start(): Promise<void> {
    if (!this.deps.enabled || this.timer) return;
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  getState(): PersonalBuildState {
    return { enabled: this.deps.enabled, staged: this.staged };
  }

  /** Quits through the normal shutdown flow, then reopens the app, on the staged build if any. */
  reload(): void {
    if (!this.deps.enabled) throw new Error('Reload is only available in personal builds');
    const stagedApp = this.staged ? join(this.deps.stageDir, `${this.deps.productName}.app`) : '';
    this.deps.spawnDetached([
      String(this.deps.pid),
      this.deps.bundlePath,
      stagedApp,
      String(EXIT_WAIT_SECONDS),
    ]);
    this.deps.quit();
  }

  async refresh(): Promise<void> {
    const next = await this.readStaged();
    if (JSON.stringify(next) === JSON.stringify(this.staged)) return;
    this.staged = next;
    this.deps.emitStaged(next);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async readStaged(): Promise<PersonalStagedBuild | null> {
    try {
      const raw = JSON.parse(await this.deps.readText(join(this.deps.stageDir, 'build.json')));
      if (typeof raw?.builtAt !== 'string') return null;
      return {
        builtAt: raw.builtAt,
        ...(typeof raw.commit === 'string' ? { commit: raw.commit } : {}),
      };
    } catch {
      return null;
    }
  }
}

function bundlePathFromExecPath(execPath: string): string {
  // …/Emdash Josh.app/Contents/MacOS/Emdash Josh → …/Emdash Josh.app
  return dirname(dirname(dirname(execPath)));
}

export function createPersonalReloadService(electron: {
  isPackaged: boolean;
  quit(): void;
}): PersonalReloadService {
  return new PersonalReloadService({
    enabled: IS_PERSONAL && electron.isPackaged && process.platform === 'darwin',
    stageDir: PERSONAL_STAGE_DIR,
    productName: PRODUCT_NAME,
    bundlePath: bundlePathFromExecPath(process.execPath),
    pid: process.pid,
    readText: (path) => readFile(path, 'utf8'),
    spawnDetached: (args) => {
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const logDir = dirname(PERSONAL_STAGE_DIR);
      const child = spawn(
        '/bin/bash',
        [
          '-c',
          `mkdir -p "${logDir}"; exec >>"${logDir}/reload.log" 2>&1; ${RELOAD_HELPER_SCRIPT}`,
          'reload',
          ...args,
        ],
        { detached: true, stdio: 'ignore', env }
      );
      child.unref();
      log.info('Personal reload helper started', { pid: child.pid, staged: args[2] !== '' });
    },
    quit: () => electron.quit(),
    emitStaged: (build) => updateEvents.emit(undefined, { type: 'personal-staged', build }),
  });
}
