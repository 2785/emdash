import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { decryptChromiumV10, migrateSecrets } from './emjosh-secrets-migration';

vi.mock('electron', () => ({ app: {}, safeStorage: {} }));
vi.mock('@main/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn() } }));

/** Chromium macOS os_crypt "v10" ciphertext, produced with the openssl CLI as an independent reference. */
function opensslV10(plaintext: string, password: string): Buffer {
  const key = execFileSync('openssl', [
    'kdf',
    '-keylen',
    '16',
    '-kdfopt',
    'digest:SHA1',
    '-kdfopt',
    `pass:${password}`,
    '-kdfopt',
    'salt:saltysalt',
    '-kdfopt',
    'iter:1003',
    '-binary',
    'PBKDF2',
  ]).toString('hex');
  const body = execFileSync('openssl', ['enc', '-aes-128-cbc', '-K', key, '-iv', '20'.repeat(16)], {
    input: plaintext,
  });
  return Buffer.concat([Buffer.from('v10'), body]);
}

describe('decryptChromiumV10', () => {
  it('decrypts what Chromium (os_crypt on macOS) produces', () => {
    const token = '{"token":"gho_example","scopes":["repo"]}';
    expect(decryptChromiumV10(opensslV10(token, 'emdash-keychain-pw'), 'emdash-keychain-pw')).toBe(
      token
    );
  });

  it('rejects other formats and wrong keys', () => {
    expect(() => decryptChromiumV10(Buffer.from('plain'), 'pw')).toThrow();
    expect(() => decryptChromiumV10(opensslV10('secret', 'right'), 'wrong')).toThrow();
  });
});

describe('migrateSecrets', () => {
  const emdashPassword = 'emdash-keychain-pw';
  const current = (plaintext: string) => Buffer.from(`emjosh:${plaintext}`);
  const decryptCurrent = (ciphertext: Buffer) => {
    const text = ciphertext.toString();
    if (!text.startsWith('emjosh:')) throw new Error('wrong key');
    return text.slice('emjosh:'.length);
  };

  function setup(rows: { key: string; secret: string }[], password: string | null) {
    const update = vi.fn(async () => {});
    const readEmdashPassword = vi.fn(async () => password);
    const run = () =>
      migrateSecrets({
        rows,
        decryptCurrent,
        encryptCurrent: current,
        readEmdashPassword,
        update,
      });
    return { run, update, readEmdashPassword };
  }

  it('re-encrypts Emdash secrets under the current key and leaves current ones alone', async () => {
    const { run, update } = setup(
      [
        { key: 'github', secret: opensslV10('gh-token', emdashPassword).toString('base64') },
        { key: 'already', secret: current('fine').toString('base64') },
      ],
      emdashPassword
    );

    const result = await run();

    expect(result).toEqual({ migrated: ['github'], failed: [] });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('github', current('gh-token').toString('base64'));
  });

  it('migrates a secret the current key decrypts to garbage', async () => {
    const { run } = setup(
      [{ key: 'github', secret: opensslV10('gh-token', emdashPassword).toString('base64') }],
      emdashPassword
    );
    const garbled = migrateSecrets({
      rows: [{ key: 'github', secret: opensslV10('gh-token', emdashPassword).toString('base64') }],
      decryptCurrent: () => 'x\uFFFDy',
      encryptCurrent: current,
      readEmdashPassword: async () => emdashPassword,
      update: async () => {},
    });

    expect(await garbled).toEqual({ migrated: ['github'], failed: [] });
    expect(await run()).toEqual({ migrated: ['github'], failed: [] });
  });

  it('does not read the Emdash key when nothing needs migrating', async () => {
    const { run, readEmdashPassword } = setup(
      [{ key: 'already', secret: current('fine').toString('base64') }],
      emdashPassword
    );

    expect(await run()).toEqual({ migrated: [], failed: [] });
    expect(readEmdashPassword).not.toHaveBeenCalled();
  });

  it('reports secrets as failed when the Emdash key is unavailable', async () => {
    const { run, update } = setup(
      [{ key: 'github', secret: opensslV10('gh-token', emdashPassword).toString('base64') }],
      null
    );

    expect(await run()).toEqual({ migrated: [], failed: ['github'] });
    expect(update).not.toHaveBeenCalled();
  });
});
