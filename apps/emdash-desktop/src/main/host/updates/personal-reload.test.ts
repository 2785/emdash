import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLaunchdJobPlist,
  PersonalReloadService,
  RELOAD_HELPER_SCRIPT,
} from './personal-reload';

vi.mock('@main/lib/logger', () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeService(overrides: Partial<ConstructorParameters<typeof PersonalReloadService>[0]>) {
  const mocks = { spawnDetached: vi.fn(), quit: vi.fn(), emitStaged: vi.fn() };
  const deps = {
    enabled: true,
    stageDir: '/stage',
    productName: 'Emdash Josh',
    bundlePath: '/Applications/Emdash Josh.app',
    pid: 4242,
    readText: vi.fn(async (): Promise<string> => {
      throw new Error('ENOENT');
    }),
    ...mocks,
    ...overrides,
  };
  return { service: new PersonalReloadService(deps), deps: mocks };
}

describe('PersonalReloadService', () => {
  it('reports a staged build from build.json and emits only when it changes', async () => {
    const readText = vi.fn(async () => '{"builtAt":"2026-11-05T00:00:00Z","commit":"abc123"}');
    const { service, deps } = makeService({ readText });

    await service.refresh();
    await service.refresh();

    expect(readText).toHaveBeenCalledWith('/stage/build.json');
    expect(service.getState()).toEqual({
      enabled: true,
      staged: { builtAt: '2026-11-05T00:00:00Z', commit: 'abc123' },
    });
    expect(deps.emitStaged).toHaveBeenCalledTimes(1);
  });

  it('treats missing or malformed build.json as nothing staged', async () => {
    const { service, deps } = makeService({ readText: vi.fn(async () => '{"commit":1}') });

    await service.refresh();

    expect(service.getState().staged).toBeNull();
    expect(deps.emitStaged).not.toHaveBeenCalled();
  });

  it('hands the staged bundle to the helper and quits', async () => {
    const readText = vi.fn(async () => '{"builtAt":"2026-11-05T00:00:00Z"}');
    const { service, deps } = makeService({ readText });
    await service.refresh();

    service.reload();

    expect(deps.spawnDetached).toHaveBeenCalledWith([
      '4242',
      '/Applications/Emdash Josh.app',
      '/stage/Emdash Josh.app',
      '120',
    ]);
    expect(deps.quit).toHaveBeenCalledTimes(1);
    expect(deps.spawnDetached.mock.invocationCallOrder[0]).toBeLessThan(
      deps.quit.mock.invocationCallOrder[0]
    );
  });

  it('relaunches without a swap when nothing is staged', () => {
    const { service, deps } = makeService({});

    service.reload();

    expect(deps.spawnDetached).toHaveBeenCalledWith([
      '4242',
      '/Applications/Emdash Josh.app',
      '',
      '120',
    ]);
    expect(deps.quit).toHaveBeenCalledTimes(1);
  });

  it('refuses to reload outside personal builds', () => {
    const { service, deps } = makeService({ enabled: false });

    expect(() => service.reload()).toThrow();
    expect(deps.spawnDetached).not.toHaveBeenCalled();
    expect(deps.quit).not.toHaveBeenCalled();
  });
});

describe.runIf(process.platform === 'darwin')('reload helper script', () => {
  let root: string;

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** A minimal ad-hoc signed bundle whose executable prints `label`. */
  function makeApp(path: string, label: string, sign = true): void {
    mkdirSync(join(path, 'Contents', 'MacOS'), { recursive: true });
    writeFileSync(
      join(path, 'Contents', 'Info.plist'),
      `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>app</string>
<key>CFBundleIdentifier</key><string>test.reload.${label}</string></dict></plist>`
    );
    cpSync('/usr/bin/true', join(path, 'Contents', 'MacOS', 'app'));
    mkdirSync(join(path, 'Contents', 'Resources'), { recursive: true });
    writeFileSync(join(path, 'Contents', 'Resources', 'label'), label);
    if (sign) execFileSync('codesign', ['--force', '--sign', '-', path]);
  }

  function runHelper(args: { pid: number; target: string; staged: string; wait?: number }) {
    const bin = join(root, 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'open'), `#!/bin/bash\necho "$1" >> "${join(root, 'opened')}"\n`);
    chmodSync(join(bin, 'open'), 0o755);
    const result = spawnSync(
      '/bin/bash',
      [
        '-c',
        RELOAD_HELPER_SCRIPT,
        'reload',
        String(args.pid),
        args.target,
        args.staged,
        String(args.wait ?? 2),
      ],
      { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8' }
    );
    const opened = existsSync(join(root, 'opened'))
      ? readFileSync(join(root, 'opened'), 'utf8').trim()
      : '';
    return { ...result, opened };
  }

  function deadPid(): number {
    const child = spawnSync('/bin/bash', ['-c', 'echo $$']);
    return Number(child.stdout.toString().trim());
  }

  function setup(stagedSigned = true) {
    root = mkdtempSync(join(tmpdir(), 'personal-reload-'));
    const target = join(root, 'Applications', 'Emdash Josh.app');
    const staged = join(root, 'stage', 'staged', 'Emdash Josh.app');
    makeApp(target, 'old');
    makeApp(staged, 'new', stagedSigned);
    return { target, staged };
  }

  it('swaps in the staged build after the app exits and reopens it', () => {
    const { target, staged } = setup();

    const result = runHelper({ pid: deadPid(), target, staged });

    expect(result.stdout).toContain('installed staged build');
    expect(readFileSync(join(target, 'Contents', 'Resources', 'label'), 'utf8')).toBe('new');
    expect(existsSync(join(root, 'stage', 'staged'))).toBe(false);
    expect(existsSync(`${target}.next`)).toBe(false);
    expect(result.opened).toBe(target);
  }, 30_000);

  it('keeps the installed app when the staged build fails verification', () => {
    const { target, staged } = setup(false);

    const result = runHelper({ pid: deadPid(), target, staged });

    expect(result.stdout).toContain('keeping installed app');
    expect(readFileSync(join(target, 'Contents', 'Resources', 'label'), 'utf8')).toBe('old');
    expect(existsSync(`${target}.next`)).toBe(false);
    expect(result.opened).toBe(target);
  }, 30_000);

  it('just reopens when nothing is staged', () => {
    const { target } = setup();

    const result = runHelper({ pid: deadPid(), target, staged: '' });

    expect(readFileSync(join(target, 'Contents', 'Resources', 'label'), 'utf8')).toBe('old');
    expect(result.opened).toBe(target);
  }, 30_000);

  it('does nothing when the app is still running after the wait (quit cancelled)', () => {
    const { target, staged } = setup();

    const result = runHelper({ pid: process.pid, target, staged, wait: 1 });

    expect(result.stdout).toContain('reload cancelled');
    expect(readFileSync(join(target, 'Contents', 'Resources', 'label'), 'utf8')).toBe('old');
    expect(existsSync(staged)).toBe(true);
    expect(result.opened).toBe('');
  }, 30_000);
});

describe.runIf(process.platform === 'darwin')('reload launchd job', () => {
  it('builds a valid plist that carries the helper script byte for byte', () => {
    const dir = mkdtempSync(join(tmpdir(), 'personal-reload-plist-'));
    try {
      const plist = join(dir, 'job.plist');
      const script = `${RELOAD_HELPER_SCRIPT}\nrm -f "a & b.plist"; launchctl remove "x"`;
      writeFileSync(
        plist,
        buildLaunchdJobPlist({
          label: 'com.emdash.personal.reload.test',
          programArguments: ['/bin/bash', '-c', script, 'reload', '1', '/A & B.app', '', '120'],
          logPath: join(dir, 'reload.log'),
        })
      );

      execFileSync('plutil', ['-lint', plist]);
      const extract = (key: string) =>
        execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plist], {
          encoding: 'utf8',
        }).replace(/\n$/, '');
      expect(extract('ProgramArguments.2')).toBe(script);
      expect(extract('ProgramArguments.5')).toBe('/A & B.app');
      expect(extract('RunAtLoad')).toBe('true');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
