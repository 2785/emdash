import { IS_PERSONAL, PRODUCT_NAME } from '@core/primitives/app-identity/api/app-identity';

const PRODUCTION_AUTH_SERVER_URL = 'https://auth.emdash.sh';

/**
 * Emjosh has no Emdash account, so it never contacts Emdash's auth server, not even with a
 * session copied over from Emdash. Requests fail like an unreachable server.
 */
export const AUTH_SERVER_DISABLED = IS_PERSONAL;

const disabledError = () => new Error(`${PRODUCT_NAME} does not use Emdash accounts`);

/** `fetch` for the auth server; see {@link AUTH_SERVER_DISABLED}. */
export function authServerFetch(url: string, init?: RequestInit): Promise<Response> {
  if (AUTH_SERVER_DISABLED) return Promise.reject(disabledError());
  return fetch(url, init);
}

export function assertAuthServerEnabled(): void {
  if (AUTH_SERVER_DISABLED) throw disabledError();
}

export const ACCOUNT_CONFIG = {
  authServer: {
    baseUrl: resolveAuthServerBaseUrl(process.env.EMDASH_AUTH_SERVER_URL, import.meta.env.DEV),
    authTimeoutMs: Number(process.env.EMDASH_AUTH_TIMEOUT_MS || 300000),
  },
};

/**
 * Development builds may target another auth server, e.g. a local one; packaged
 * builds always use production, because the server receives session and provider
 * tokens.
 */
export function resolveAuthServerBaseUrl(override: string | undefined, isDev: boolean): string {
  const value = override?.trim();
  if (!isDev || !value) return PRODUCTION_AUTH_SERVER_URL;
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`EMDASH_AUTH_SERVER_URL must be an http(s) URL: ${value}`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
