import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@core/primitives/app-identity/api/app-identity', () => ({
  IS_PERSONAL: true,
  PRODUCT_NAME: 'Emjosh',
}));

const { AccountAuthServerClient } = await import('./account-auth-server-client');
const { AccountOAuthClient } = await import('./account-oauth-client');

describe('Emdash auth server in Emjosh', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never contacts the auth server, even with a session copied from Emdash', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const client = new AccountAuthServerClient();

    await expect(client.validateSession('emdash-session-token')).resolves.toMatchObject({
      success: true,
      data: 'unknown',
    });
    await expect(client.checkHealth()).resolves.toBe(false);
    await expect(client.startAccountLink('emdash-session-token', 'github')).resolves.toMatchObject({
      success: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never starts an Emdash sign-in', async () => {
    const executeOAuthFlow = vi.fn();
    const result = await new AccountOAuthClient(executeOAuthFlow).signIn('github');

    expect(result).toMatchObject({ success: false });
    expect(executeOAuthFlow).not.toHaveBeenCalled();
  });
});
