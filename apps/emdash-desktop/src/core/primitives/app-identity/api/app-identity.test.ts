import { describe, expect, it } from 'vitest';
import { resolveAppIdentity } from './app-identity';
import * as personalBuilderIdentity from './app-identity.personal';

describe('resolveAppIdentity', () => {
  it('keeps the stable identity by default', () => {
    expect(resolveAppIdentity({ dev: false, build: undefined })).toMatchObject({
      APP_ID: 'com.emdash.stable',
      PRODUCT_NAME: 'Emdash',
      RUNTIME_APP_NAME: 'Emdash',
      USER_DATA_DIR_NAME: 'emdash',
      IS_PERSONAL: false,
    });
  });

  it('installs Emjosh separately with its own data, reading the stable keychain entry', () => {
    expect(resolveAppIdentity({ dev: false, build: 'personal' })).toMatchObject({
      APP_ID: 'com.emjosh.app',
      PRODUCT_NAME: 'Emjosh',
      RUNTIME_APP_NAME: 'Emdash',
      USER_DATA_DIR_NAME: 'emjosh',
      IS_PERSONAL: true,
      IS_CANARY: false,
    });
  });

  it('keeps upstream dev runs on the existing dev data dir', () => {
    expect(resolveAppIdentity({ dev: true, build: undefined })).toMatchObject({
      PRODUCT_NAME: 'Emdash',
      USER_DATA_DIR_NAME: 'emdash-dev',
    });
  });

  it('keeps canary isolated', () => {
    expect(resolveAppIdentity({ dev: false, build: 'canary' })).toMatchObject({
      RUNTIME_APP_NAME: 'Emdash Canary',
      USER_DATA_DIR_NAME: 'emdash-canary',
    });
  });

  it('matches the builder-side personal identity', () => {
    const identity = resolveAppIdentity({ dev: false, build: 'personal' });
    expect(personalBuilderIdentity).toMatchObject({
      APP_ID: identity.APP_ID,
      PRODUCT_NAME: identity.PRODUCT_NAME,
      APP_NAME_LOWER: identity.APP_NAME_LOWER,
      LINUX_DESKTOP_ID: identity.LINUX_DESKTOP_ID,
    });
  });
});
