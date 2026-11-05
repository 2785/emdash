type ImportMetaWithEnv = ImportMeta & { env?: { DEV?: boolean; VITE_BUILD?: string } };

export type AppIdentity = ReturnType<typeof resolveAppIdentity>;

export function resolveAppIdentity({ dev, build }: { dev: boolean; build: string | undefined }) {
  const isCanary = build === 'canary';
  // Emjosh, the locally built fork: installs next to the official app with its own data and
  // never auto-updates.
  const isPersonal = build === 'personal';
  const pick = <T>(values: { stable: T; canary: T; personal: T }): T =>
    isPersonal ? values.personal : isCanary ? values.canary : values.stable;

  const productName = pick({
    stable: 'Emdash',
    canary: 'Emdash Canary',
    personal: 'Emjosh',
  });
  const appNameLower = pick({
    stable: 'emdash',
    canary: 'emdash-canary',
    personal: 'emjosh',
  });
  return {
    APP_ID: pick({
      stable: 'com.emdash.stable',
      canary: 'com.emdash.canary',
      personal: 'com.emjosh.app',
    }),
    PRODUCT_NAME: productName,
    APP_NAME_LOWER: appNameLower,
    LINUX_DESKTOP_ID: pick({
      stable: 'Emdash',
      canary: 'emdash-canary',
      personal: 'emjosh',
    }),
    USER_DATA_DIR_NAME: dev
      ? 'emdash-dev'
      : pick({ stable: 'emdash', canary: 'emdash-canary', personal: 'emjosh' }),
    /**
     * Name passed to `app.setName`. Electron derives the safeStorage keychain entry
     * ("<name> Safe Storage") from it, so Emjosh uses the stable name to decrypt secrets in data
     * seeded from the official app (scripts/seed-emjosh-data.sh).
     */
    RUNTIME_APP_NAME: isPersonal ? 'Emdash' : productName,
    UPDATE_CHANNEL: isCanary ? 'v1-canary' : 'v1-stable',
    ARTIFACT_PREFIX: appNameLower,
    IS_CANARY: isCanary,
    IS_PERSONAL: isPersonal,
  };
}

const env = (import.meta as ImportMetaWithEnv).env;
const identity = resolveAppIdentity({ dev: env?.DEV === true, build: env?.VITE_BUILD });

export const {
  APP_ID,
  PRODUCT_NAME,
  APP_NAME_LOWER,
  LINUX_DESKTOP_ID,
  USER_DATA_DIR_NAME,
  RUNTIME_APP_NAME,
  UPDATE_CHANNEL,
  ARTIFACT_PREFIX,
  IS_CANARY,
  IS_PERSONAL,
} = identity;
export const R2_BASE_URL = 'https://releases.emdash.sh';
