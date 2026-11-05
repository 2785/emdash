import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { PersonalBuildState, PersonalStagedBuild } from '@core/features/updates/api';
import { updateEvents } from '@core/features/updates/node/event-host';
import { IS_PERSONAL, PRODUCT_NAME } from '@core/primitives/app-identity/api/app-identity';
import { log } from '@main/lib/logger';

/** Emjosh's cache directory: staged builds, update downloads, and the reload log. */
export function personalCacheDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'emjosh');
  return join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'emjosh');
}

/** Where builds wait for Reload; keep in sync with scripts/install-personal.sh. */
export const PERSONAL_STAGE_DIR = join(personalCacheDir(), 'staged');

/** File name of the staged build: the app bundle on macOS, the AppImage on Linux. */
export function stagedArtifactName(platform: NodeJS.Platform, productName: string): string {
  return platform === 'darwin' ? `${productName}.app` : `${productName}.AppImage`;
}
const POLL_INTERVAL_MS = 3_000;
const EXIT_WAIT_SECONDS = 120;

/**
 * Runs detached after the app quits: waits for `pid` to exit, swaps the staged bundle in, and
 * reopens the app. The swap is two renames on the same volume, so it is near instant and an
 * interrupted helper can't leave a half-copied app behind; the staged bundle was deep-verified
 * when it was staged. Gives up without touching anything if the app is still running after the
 * wait, which is what happens when the user cancels the quit. Every step is logged.
 */
export const RELOAD_HELPER_SCRIPT = `
set -u
pid="$1"; target="$2"; staged="$3"; wait_seconds="$4"
echo "$(date) waiting for pid $pid to exit"
for _ in $(seq 1 $((wait_seconds * 2))); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
if kill -0 "$pid" 2>/dev/null; then echo "$(date) app still running; reload cancelled"; exit 0; fi
echo "$(date) app exited"
sleep 1
if [ -n "$staged" ] && [ -d "$staged" ]; then
  previous="$target.previous"
  rm -rf "$previous"
  if ! codesign --verify --strict "$staged"; then
    echo "$(date) staged build failed verification; keeping installed app"
  elif mv "$target" "$previous" && mv "$staged" "$target"; then
    echo "$(date) installed staged build"
    rm -rf "$previous" "$(dirname "$staged")"
  else
    [ -d "$target" ] || mv "$previous" "$target"
    echo "$(date) swap failed; kept installed app"
  fi
fi
echo "$(date) reopening"
open "$target"
`;

/**
 * Linux counterpart of {@link RELOAD_HELPER_SCRIPT} for AppImages: same arguments and steps,
 * with the AppImage file as the target. Downloads were checked against the release manifest
 * when they were staged.
 */
export const LINUX_RELOAD_HELPER_SCRIPT = `
set -u
pid="$1"; target="$2"; staged="$3"; wait_seconds="$4"
echo "$(date) waiting for pid $pid to exit"
i=0
while [ "$i" -lt $((wait_seconds * 2)) ] && kill -0 "$pid" 2>/dev/null; do sleep 0.5; i=$((i + 1)); done
if kill -0 "$pid" 2>/dev/null; then echo "$(date) app still running; reload cancelled"; exit 0; fi
echo "$(date) app exited"
sleep 1
if [ -n "$staged" ] && [ -f "$staged" ]; then
  previous="$target.previous"
  rm -f "$previous"
  chmod 755 "$staged"
  if mv "$target" "$previous" && mv "$staged" "$target"; then
    echo "$(date) installed staged build"
    rm -rf "$previous" "$(dirname "$staged")"
  else
    [ -f "$target" ] || mv "$previous" "$target"
    echo "$(date) swap failed; kept installed app"
  fi
fi
echo "$(date) reopening"
# Variables the old AppImage runtime and Electron set would confuse the new process.
unset APPDIR APPIMAGE ARGV0 OWD ELECTRON_RUN_AS_NODE
nohup "$target" >/dev/null 2>&1 &
`;

const xmlEscape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A one-shot launchd job running `programArguments`. The helper runs as a launchd job rather
 * than a child process because processes spawned from the app (or from shells inside it) can
 * be torn down along with it when it quits.
 */
export function buildLaunchdJobPlist(job: {
  label: string;
  programArguments: string[];
  logPath: string;
}): string {
  const args = job.programArguments.map((arg) => `<string>${xmlEscape(arg)}</string>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${xmlEscape(job.label)}</string>
<key>ProgramArguments</key><array>${args}</array>
<key>RunAtLoad</key><true/>
<key>AbandonProcessGroup</key><true/>
<key>StandardOutPath</key><string>${xmlEscape(job.logPath)}</string>
<key>StandardErrorPath</key><string>${xmlEscape(job.logPath)}</string>
</dict></plist>
`;
}

type PersonalReloadDeps = {
  enabled: boolean;
  stageDir: string;
  /** File name of a staged build in `stageDir` (see {@link stagedArtifactName}). */
  artifactName: string;
  /** Path of the running app: the `…/Emjosh.app` bundle, or the AppImage on Linux. */
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
    const stagedApp = this.staged ? join(this.deps.stageDir, this.deps.artifactName) : '';
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
        ...(typeof raw.version === 'string' ? { version: raw.version } : {}),
      };
    } catch {
      return null;
    }
  }
}

/** The running app: the `.app` bundle on macOS, the AppImage on Linux (null when not one). */
export function runningAppPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  // …/Emjosh.app/Contents/MacOS/Emjosh → …/Emjosh.app
  if (platform === 'darwin') return dirname(dirname(dirname(process.execPath)));
  if (platform === 'linux') return env.APPIMAGE || null;
  return null;
}

function spawnMacHelper(args: string[]): void {
  const jobDir = dirname(PERSONAL_STAGE_DIR);
  const label = `com.emjosh.reload.${Date.now()}`;
  const plistPath = join(jobDir, `${label}.plist`);
  mkdirSync(jobDir, { recursive: true });
  writeFileSync(
    plistPath,
    buildLaunchdJobPlist({
      label,
      programArguments: [
        '/bin/bash',
        '-c',
        `${RELOAD_HELPER_SCRIPT}\nrm -f "${plistPath}"; launchctl remove "${label}"`,
        'reload',
        ...args,
      ],
      logPath: join(jobDir, 'reload.log'),
    })
  );
  const result = spawnSync('launchctl', ['bootstrap', `gui/${process.getuid?.()}`, plistPath], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Could not start the reload helper: ${result.stderr || result.error}`);
  }
}

function spawnLinuxHelper(args: string[]): void {
  const jobDir = dirname(PERSONAL_STAGE_DIR);
  mkdirSync(jobDir, { recursive: true });
  const logFd = openSync(join(jobDir, 'reload.log'), 'a');
  // Its own session, so it outlives the app.
  spawn('/bin/sh', ['-c', LINUX_RELOAD_HELPER_SCRIPT, 'reload', ...args], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
  }).unref();
}

export function createPersonalReloadService(electron: {
  isPackaged: boolean;
  quit(): void;
}): PersonalReloadService {
  const platform = process.platform;
  const appPath = runningAppPath(platform);
  return new PersonalReloadService({
    enabled: IS_PERSONAL && electron.isPackaged && appPath !== null,
    stageDir: PERSONAL_STAGE_DIR,
    artifactName: stagedArtifactName(platform, PRODUCT_NAME),
    bundlePath: appPath ?? '',
    pid: process.pid,
    readText: (path) => readFile(path, 'utf8'),
    spawnDetached: (args) => {
      if (platform === 'darwin') spawnMacHelper(args);
      else spawnLinuxHelper(args);
      log.info('Personal reload helper started', { staged: args[2] !== '' });
    },
    quit: () => electron.quit(),
    emitStaged: (build) => updateEvents.emit(undefined, { type: 'personal-staged', build }),
  });
}
