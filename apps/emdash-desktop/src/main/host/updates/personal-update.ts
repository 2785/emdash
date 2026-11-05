import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { IS_PERSONAL, PRODUCT_NAME } from '@core/primitives/app-identity/api/app-identity';
import { resolveAppVersion } from '@main/core/app/utils';
import { log } from '@main/lib/logger';
import { PERSONAL_STAGE_DIR } from './personal-reload';

/** Only this repository's releases are installed; only its owner can publish them. */
export const PERSONAL_RELEASES_REPO = '2785/emjosh';
/** Release asset describing the release; keep in sync with scripts/release.sh. */
export const PERSONAL_MANIFEST_ASSET = 'emjosh-update.json';

const STARTUP_DELAY_MS = 30_000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type PersonalReleaseManifest = {
  version: string;
  commit: string;
  /** Zip asset of the release holding the signed `.app`. */
  file: string;
  /** Base64 SHA-512 of the zip. */
  sha512: string;
  size: number;
  releasedAt: string;
};

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseReleaseManifest(raw: unknown): PersonalReleaseManifest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const valid =
    typeof m.version === 'string' &&
    VERSION.test(m.version) &&
    typeof m.commit === 'string' &&
    typeof m.file === 'string' &&
    /^[\w.-]+\.zip$/.test(m.file) &&
    typeof m.sha512 === 'string' &&
    typeof m.size === 'number' &&
    typeof m.releasedAt === 'string';
  return valid ? (m as PersonalReleaseManifest) : null;
}

/** `candidate > current` for `x.y.z` versions; anything else is never newer. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = VERSION.exec(candidate);
  const b = VERSION.exec(current);
  if (!a || !b) return false;
  for (let i = 1; i <= 3; i++) {
    const diff = Number(a[i]) - Number(b[i]);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export type PersonalUpdateDeps = {
  enabled: boolean;
  currentVersion(): Promise<string>;
  /** The latest release's manifest, or null when there is none. */
  fetchManifest(): Promise<unknown>;
  /** Version of the build waiting for Reload, if any. */
  stagedVersion(): Promise<string | null>;
  /** Downloads, verifies, and stages the release for the Reload button. */
  stage(manifest: PersonalReleaseManifest): Promise<void>;
};

export type PersonalUpdateResult = 'disabled' | 'up-to-date' | 'already-staged' | 'staged';

/**
 * Checks the fork's GitHub releases and stages newer builds where `install:personal` stages
 * local ones, so the sidebar's Reload button switches to them.
 */
export class PersonalUpdateService {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<PersonalUpdateResult> | null = null;

  constructor(private readonly deps: PersonalUpdateDeps) {}

  start(): void {
    if (!this.deps.enabled || this.timer) return;
    const run = () => {
      this.check().catch((error: unknown) => log.warn('Emjosh update check failed', { error }));
    };
    this.timer = setTimeout(() => {
      run();
      this.timer = setInterval(run, CHECK_INTERVAL_MS);
      this.timer.unref?.();
    }, STARTUP_DELAY_MS);
    this.timer.unref?.();
  }

  check(): Promise<PersonalUpdateResult> {
    this.running ??= this.performCheck().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  dispose(): void {
    clearTimeout(this.timer);
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async performCheck(): Promise<PersonalUpdateResult> {
    if (!this.deps.enabled) return 'disabled';
    const manifest = parseReleaseManifest(await this.deps.fetchManifest());
    if (!manifest) return 'up-to-date';
    if (!isNewerVersion(manifest.version, await this.deps.currentVersion())) return 'up-to-date';
    if ((await this.deps.stagedVersion()) === manifest.version) return 'already-staged';
    await this.deps.stage(manifest);
    log.info('Staged Emjosh release', { version: manifest.version });
    return 'staged';
  }
}

const execFileAsync = promisify(execFile);

/** The running bundle's designated requirement, which every update must also satisfy. */
async function designatedRequirement(bundlePath: string): Promise<string> {
  const { stdout } = await execFileAsync('codesign', ['-d', '-r-', bundlePath]);
  // Ad-hoc signatures list their implicit requirement as a `# designated => …` comment.
  const match = /^(?:# )?designated => (.+)$/m.exec(stdout);
  if (!match) throw new Error('The running app has no designated requirement');
  return match[1]!;
}

async function download(url: string, path: string): Promise<{ sha512: string; size: number }> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status}`);
  const hash = createHash('sha512');
  let size = 0;
  const tap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      size += chunk.length;
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    tap,
    createWriteStream(path)
  );
  return { sha512: hash.digest('base64'), size };
}

export function releaseAssetUrl(manifest: PersonalReleaseManifest): string {
  return `https://github.com/${PERSONAL_RELEASES_REPO}/releases/download/v${manifest.version}/${manifest.file}`;
}

/**
 * Downloads the release, checks it against its manifest and the running app's signing
 * identity, and moves it to `stageDir` with a `build.json` for the Reload button.
 */
export async function stageRelease(
  manifest: PersonalReleaseManifest,
  options: { bundlePath: string; stageDir: string; productName: string }
): Promise<void> {
  const { bundlePath, stageDir, productName } = options;
  const workRoot = join(dirname(stageDir), 'downloads');
  await mkdir(workRoot, { recursive: true });
  const work = await mkdtemp(join(workRoot, `v${manifest.version}-`));
  try {
    const zip = join(work, manifest.file);
    const downloaded = await download(releaseAssetUrl(manifest), zip);
    if (downloaded.sha512 !== manifest.sha512 || downloaded.size !== manifest.size) {
      throw new Error('Downloaded release does not match its manifest');
    }

    const extracted = join(work, 'app');
    await execFileAsync('ditto', ['-x', '-k', zip, extracted]);
    const app = join(extracted, `${productName}.app`);
    await stat(app);
    // Only builds signed by the same identity as the running app are accepted.
    const requirement = await designatedRequirement(bundlePath);
    await execFileAsync('codesign', ['--verify', '--deep', '--strict', `-R=${requirement}`, app]);

    // build.json goes last: the Reload button treats its presence as a complete stage.
    await rm(stageDir, { recursive: true, force: true });
    await mkdir(stageDir, { recursive: true });
    await rename(app, join(stageDir, `${productName}.app`));
    await writeFile(
      join(stageDir, 'build.json'),
      JSON.stringify({
        builtAt: manifest.releasedAt,
        commit: manifest.commit.slice(0, 9),
        version: manifest.version,
      })
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export function createPersonalUpdateService(electron: {
  isPackaged: boolean;
}): PersonalUpdateService {
  // …/Emjosh.app/Contents/MacOS/Emjosh → …/Emjosh.app
  const bundlePath = dirname(dirname(dirname(process.execPath)));
  return new PersonalUpdateService({
    enabled: IS_PERSONAL && electron.isPackaged && process.platform === 'darwin',
    currentVersion: resolveAppVersion,
    fetchManifest: async () => {
      const response = await fetch(
        `https://github.com/${PERSONAL_RELEASES_REPO}/releases/latest/download/${PERSONAL_MANIFEST_ASSET}`,
        { headers: { 'Cache-Control': 'no-cache' } }
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Release manifest request failed: ${response.status}`);
      return response.json();
    },
    stagedVersion: async () => {
      try {
        const raw = JSON.parse(await readFile(join(PERSONAL_STAGE_DIR, 'build.json'), 'utf8'));
        return typeof raw?.version === 'string' ? raw.version : null;
      } catch {
        return null;
      }
    },
    stage: (manifest) =>
      stageRelease(manifest, {
        bundlePath,
        stageDir: PERSONAL_STAGE_DIR,
        productName: PRODUCT_NAME,
      }),
  });
}
