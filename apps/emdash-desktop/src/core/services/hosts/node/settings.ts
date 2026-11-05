import { IS_PERSONAL } from '@core/primitives/app-identity/api/app-identity';
import type { HostSettings } from '@core/primitives/app-settings/api';
import { defineSettingsContribution } from '@core/primitives/settings/api';
import { hostSettingsSchemaContribution } from '../contributions/settings';

// The schema is contributed from the shared contributions surface; the
// defaults read process.env, so the full contribution is assembled here and
// aggregated by the node settings manifest.
export const hostSettingsContribution = defineSettingsContribution<'remoteMachine', HostSettings>({
  ...hostSettingsSchemaContribution,
  defaults: () => ({
    // Emdash publishes the workspace server; Emjosh doesn't yet, so it has no default.
    installBaseUrl:
      process.env['EMDASH_WORKSPACE_SERVER_ARTIFACTS_URL'] ??
      (IS_PERSONAL ? '' : 'https://releases.emdash.sh/workspace-server'),
  }),
});
