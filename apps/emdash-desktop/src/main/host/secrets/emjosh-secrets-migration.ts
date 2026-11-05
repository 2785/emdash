import { execFile } from 'node:child_process';
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { app, safeStorage } from 'electron';
import type { AppDb } from '@core/services/app-db/node/db';
import { appSecrets } from '@core/services/app-db/node/schema';
import { log } from '@main/lib/logger';

/**
 * Emjosh's data is seeded from Emdash, whose secrets are encrypted with Emdash's keychain key
 * ("Emdash Safe Storage"). Emjosh uses its own key, so on first boot every secret that doesn't
 * decrypt with it is decrypted with Emdash's key and re-encrypted. After that Emjosh never reads
 * Emdash's keychain item again.
 */

const MARKER_FILE = 'secrets-migrated-from-emdash';
const EMDASH_KEYCHAIN_SERVICE = 'Emdash Safe Storage';
const EMDASH_KEYCHAIN_ACCOUNT = 'Emdash Key';

/** Decrypts a Chromium os_crypt (macOS "v10") ciphertext given the keychain password. */
export function decryptChromiumV10(ciphertext: Buffer, keychainPassword: string): string {
  if (ciphertext.subarray(0, 3).toString('latin1') !== 'v10') {
    throw new Error('Not a v10 ciphertext');
  }
  const key = pbkdf2Sync(keychainPassword, 'saltysalt', 1003, 16, 'sha1');
  const decipher = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '));
  return Buffer.concat([decipher.update(ciphertext.subarray(3)), decipher.final()]).toString(
    'utf8'
  );
}

type SecretRow = { key: string; secret: string };

export type SecretsMigrationDeps = {
  rows: SecretRow[];
  /** Decrypts with the current (Emjosh) key; throws when the secret uses another key. */
  decryptCurrent(ciphertext: Buffer): string;
  encryptCurrent(plaintext: string): Buffer;
  /** Emdash's keychain password, or null when it can't be read (e.g. access denied). */
  readEmdashPassword(): Promise<string | null>;
  update(key: string, secret: string): Promise<void>;
};

export type SecretsMigrationResult = {
  migrated: string[];
  failed: string[];
};

export async function migrateSecrets(deps: SecretsMigrationDeps): Promise<SecretsMigrationResult> {
  const pending = deps.rows.filter((row) => {
    try {
      // A wrong key usually fails the padding check, but can occasionally decrypt to garbage;
      // that garbage isn't valid UTF-8, so it decodes with replacement characters.
      return deps.decryptCurrent(Buffer.from(row.secret, 'base64')).includes('\uFFFD');
    } catch {
      return true;
    }
  });
  const result: SecretsMigrationResult = { migrated: [], failed: [] };
  if (pending.length === 0) return result;

  const password = await deps.readEmdashPassword();
  for (const row of pending) {
    try {
      if (password === null) throw new Error('Emdash keychain key unavailable');
      const plaintext = decryptChromiumV10(Buffer.from(row.secret, 'base64'), password);
      await deps.update(row.key, deps.encryptCurrent(plaintext).toString('base64'));
      result.migrated.push(row.key);
    } catch {
      result.failed.push(row.key);
    }
  }
  return result;
}

function readEmdashKeychainPassword(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      '/usr/bin/security',
      ['find-generic-password', '-w', '-s', EMDASH_KEYCHAIN_SERVICE, '-a', EMDASH_KEYCHAIN_ACCOUNT],
      (error, stdout) => resolve(error ? null : stdout.replace(/\n$/, ''))
    );
  });
}

/** Runs the migration once per data dir; later boots skip it via a marker file. */
export async function migrateEmjoshSecretsOnce(db: AppDb): Promise<void> {
  const marker = join(app.getPath('userData'), MARKER_FILE);
  if (existsSync(marker) || !safeStorage.isEncryptionAvailable()) return;

  const result = await migrateSecrets({
    rows: await db.select({ key: appSecrets.key, secret: appSecrets.secret }).from(appSecrets),
    decryptCurrent: (ciphertext) => safeStorage.decryptString(ciphertext),
    encryptCurrent: (plaintext) => safeStorage.encryptString(plaintext),
    readEmdashPassword: readEmdashKeychainPassword,
    update: async (key, secret) => {
      await db.update(appSecrets).set({ secret }).where(eq(appSecrets.key, key));
    },
  });
  // Secrets that couldn't be migrated stay unreadable (sign in again); retrying every boot would
  // only repeat the keychain prompt.
  writeFileSync(marker, JSON.stringify({ at: new Date().toISOString(), ...result }));
  if (result.failed.length > 0) {
    log.warn('Some secrets could not be migrated from Emdash', { failed: result.failed });
  } else if (result.migrated.length > 0) {
    log.info('Migrated secrets from Emdash', { count: result.migrated.length });
  }
}
