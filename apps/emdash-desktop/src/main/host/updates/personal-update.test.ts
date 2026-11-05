import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isNewerVersion,
  parseReleaseManifest,
  PersonalUpdateService,
  releaseAssetUrl,
  stageRelease,
  type PersonalUpdateDeps,
} from './personal-update';

vi.mock('@main/lib/logger', () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@main/core/app/utils', () => ({ resolveAppVersion: vi.fn() }));

const manifest = {
  version: '0.2.0',
  commit: '0123456789abcdef',
  file: 'Emjosh-mac-arm64.zip',
  sha512: 'abc==',
  size: 123,
  releasedAt: '2026-11-05T00:00:00Z',
};

function makeService(overrides: Partial<PersonalUpdateDeps> = {}) {
  const deps: PersonalUpdateDeps = {
    enabled: true,
    currentVersion: async () => '0.1.0',
    fetchManifest: async () => manifest,
    stagedVersion: async () => null,
    stage: vi.fn(async () => {}),
    ...overrides,
  };
  return { service: new PersonalUpdateService(deps), deps };
}

describe('isNewerVersion', () => {
  it('compares x.y.z numerically', () => {
    expect(isNewerVersion('0.10.0', '0.9.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '0.99.99')).toBe(true);
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
    expect(isNewerVersion('0.1.0', '0.2.0')).toBe(false);
  });

  it('never treats unparseable versions as newer', () => {
    expect(isNewerVersion('0.2.0-beta', '0.1.0')).toBe(false);
    expect(isNewerVersion('0.2.0', 'unknown')).toBe(false);
  });
});

describe('parseReleaseManifest', () => {
  it('accepts a complete manifest', () => {
    expect(parseReleaseManifest(manifest)).toEqual(manifest);
  });

  it('rejects asset names that could leave the release', () => {
    expect(parseReleaseManifest({ ...manifest, file: '../evil.zip' })).toBeNull();
    expect(parseReleaseManifest({ ...manifest, file: 'Emjosh.dmg' })).toBeNull();
  });

  it('rejects missing fields and odd versions', () => {
    expect(parseReleaseManifest({ ...manifest, sha512: undefined })).toBeNull();
    expect(parseReleaseManifest({ ...manifest, version: 'v0.2.0' })).toBeNull();
    expect(parseReleaseManifest(null)).toBeNull();
  });
});

describe('PersonalUpdateService', () => {
  it('stages a newer release', async () => {
    const { service, deps } = makeService();
    await expect(service.check()).resolves.toBe('staged');
    expect(deps.stage).toHaveBeenCalledWith(manifest);
  });

  it('leaves the app alone when the release is not newer', async () => {
    const { service, deps } = makeService({ currentVersion: async () => '0.2.0' });
    await expect(service.check()).resolves.toBe('up-to-date');
    expect(deps.stage).not.toHaveBeenCalled();
  });

  it('does not download a release that is already waiting for Reload', async () => {
    const { service, deps } = makeService({ stagedVersion: async () => '0.2.0' });
    await expect(service.check()).resolves.toBe('already-staged');
    expect(deps.stage).not.toHaveBeenCalled();
  });

  it('treats no release or an invalid manifest as up to date', async () => {
    for (const fetched of [null, { version: '9.9.9' }]) {
      const { service, deps } = makeService({ fetchManifest: async () => fetched });
      await expect(service.check()).resolves.toBe('up-to-date');
      expect(deps.stage).not.toHaveBeenCalled();
    }
  });

  it('does nothing when disabled', async () => {
    const { service, deps } = makeService({ enabled: false });
    await expect(service.check()).resolves.toBe('disabled');
    expect(deps.stage).not.toHaveBeenCalled();
  });

  it('shares one check between concurrent callers', async () => {
    const { service, deps } = makeService();
    await Promise.all([service.check(), service.check()]);
    expect(deps.stage).toHaveBeenCalledTimes(1);
  });
});

describe.runIf(process.platform === 'darwin')('stageRelease', () => {
  const roots: string[] = [];
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  /** An ad-hoc signed `Emjosh.app`; `marker` makes each one a different signed program. */
  function makeApp(dir: string, marker: string): string {
    const app = join(dir, 'Emjosh.app');
    mkdirSync(join(app, 'Contents', 'MacOS'), { recursive: true });
    cpSync('/usr/bin/true', join(app, 'Contents', 'MacOS', 'Emjosh'));
    execFileSync('plutil', ['-create', 'xml1', join(app, 'Contents', 'Info.plist')]);
    for (const [key, value] of [
      ['CFBundleIdentifier', `com.emjosh.test.${marker}`],
      ['CFBundleExecutable', 'Emjosh'],
    ]) {
      execFileSync('plutil', [
        '-insert',
        key!,
        '-string',
        value!,
        join(app, 'Contents', 'Info.plist'),
      ]);
    }
    execFileSync('codesign', ['--force', '--sign', '-', app]);
    return app;
  }

  function setup(releaseMarker: string) {
    const root = mkdtempSync(join(tmpdir(), 'emjosh-update-'));
    roots.push(root);
    const running = makeApp(join(root, 'running'), 'same');
    const release = join(root, 'release');
    mkdirSync(release);
    if (releaseMarker === 'same') cpSync(running, join(release, 'Emjosh.app'), { recursive: true });
    else makeApp(release, releaseMarker);
    const zip = join(root, 'Emjosh-mac-arm64.zip');
    execFileSync('ditto', ['-c', '-k', '--keepParent', join(release, 'Emjosh.app'), zip]);
    const bytes = readFileSync(zip);
    const manifest = {
      version: '0.2.0',
      commit: '0123456789abcdef',
      file: 'Emjosh-mac-arm64.zip',
      sha512: createHash('sha512').update(bytes).digest('base64'),
      size: bytes.length,
      releasedAt: '2026-11-05T00:00:00Z',
    };
    const fetched: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url);
      return new Response(bytes);
    });
    const stageDir = join(root, 'cache', 'staged');
    const options = { bundlePath: running, stageDir, productName: 'Emjosh' };
    return { manifest, options, stageDir, fetched };
  }

  it('stages a release signed like the running app, from its tagged asset', async () => {
    const { manifest, options, stageDir, fetched } = setup('same');
    await stageRelease(manifest, options);
    expect(fetched).toEqual([releaseAssetUrl(manifest)]);
    expect(existsSync(join(stageDir, 'Emjosh.app', 'Contents', 'MacOS', 'Emjosh'))).toBe(true);
    expect(JSON.parse(readFileSync(join(stageDir, 'build.json'), 'utf8'))).toEqual({
      builtAt: '2026-11-05T00:00:00Z',
      commit: '012345678',
      version: '0.2.0',
    });
  });

  it('rejects a release signed by anyone else', async () => {
    const { manifest, options, stageDir } = setup('other');
    await expect(stageRelease(manifest, options)).rejects.toThrow();
    expect(existsSync(stageDir)).toBe(false);
  });

  it('rejects a download that does not match the manifest', async () => {
    const { manifest, options, stageDir } = setup('same');
    await expect(stageRelease({ ...manifest, sha512: 'bogus' }, options)).rejects.toThrow(
      'does not match its manifest'
    );
    expect(existsSync(stageDir)).toBe(false);
  });
});
