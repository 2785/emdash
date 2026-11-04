type ImportMetaWithEnv = ImportMeta & { env?: { DEV?: boolean; VITE_BUILD?: string } };

export type AppIdentity = ReturnType<typeof resolveAppIdentity>;

export function resolveAppIdentity({ dev, build }: { dev: boolean; build: string | undefined }) {
  const isCanary = build === 'canary';
  // Locally built fork: installs next to the official app, shares its data, never auto-updates.
  const isPersonal = build === 'personal';
  const pick = <T>(values: { stable: T; canary: T; personal: T }): T =>
    isPersonal ? values.personal : isCanary ? values.canary : values.stable;

  // Personal dev runs (`pnpm run dev`) get their own name and data so they can run next to the
  // installed personal app.
  const isPersonalDev = isPersonal && dev;
  const productName = isPersonalDev
    ? 'Emdash Josh Dev'
    : pick({ stable: 'Emdash', canary: 'Emdash Canary', personal: 'Emdash Josh' });
  const appNameLower = pick({
    stable: 'emdash',
    canary: 'emdash-canary',
    personal: 'emdash-josh',
  });
  return {
    APP_ID: pick({
      stable: 'com.emdash.stable',
      canary: 'com.emdash.canary',
      personal: 'com.emdash.personal',
    }),
    PRODUCT_NAME: productName,
    APP_NAME_LOWER: appNameLower,
    LINUX_DESKTOP_ID: pick({
      stable: 'Emdash',
      canary: 'emdash-canary',
      personal: 'emdash-josh',
    }),
    USER_DATA_DIR_NAME: isPersonalDev
      ? 'emdash-josh-dev'
      : dev
        ? 'emdash-dev'
        : pick({ stable: 'emdash', canary: 'emdash-canary', personal: 'emdash' }),
    /**
     * Name passed to `app.setName`. Electron derives the safeStorage keychain entry
     * ("<name> Safe Storage") from it, so the personal build uses the stable name to decrypt
     * secrets written by the official app, both in the shared data dir and in dev data seeded
     * from it (`pnpm run seed:dev`).
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
