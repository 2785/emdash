import { PageLayout, SettingsSection } from '@emdash/ui/react/patterns';
import { IS_PERSONAL } from '@core/primitives/app-identity/api/app-identity';
import { AccountTab } from '../components/AccountTab';
import { FollowUpModeRow } from '../components/FollowUpModeRow';
import NotificationSettingsCard from '../components/NotificationSettingsCard';
import {
  AutoGenerateTaskNamesRow,
  AutoTrustWorktreesRow,
  CreateBranchAndWorktreeRow,
  DeleteBranchByDefaultRow,
  EnableTmuxRow,
  IncludeIssueContextByDefaultRow,
  PreserveTaskNameCapitalizationRow,
} from '../components/TaskSettingsRows';
import TelemetryCard from '../components/TelemetryCard';
import { UpdateCard } from '../components/UpdateCard';

export function GeneralSettingsPage() {
  return (
    <div className="space-y-8 pb-10">
      <PageLayout.Header
        sticky
        draggable
        title="General"
        description={
          IS_PERSONAL
            ? 'Manage notifications and task preferences.'
            : 'Manage your account, app updates, and task preferences.'
        }
      />
      {/* Emjosh has no Emdash account, telemetry, or official updates. */}
      {!IS_PERSONAL && (
        <>
          <SettingsSection>
            <AccountTab />
          </SettingsSection>
          <SettingsSection title="App">
            <UpdateCard />
            <TelemetryCard />
          </SettingsSection>
        </>
      )}
      <SettingsSection title="Notifications" bare>
        <NotificationSettingsCard />
      </SettingsSection>
      <SettingsSection title="Preferences">
        <AutoGenerateTaskNamesRow />
        <AutoTrustWorktreesRow />
        <CreateBranchAndWorktreeRow />
        <DeleteBranchByDefaultRow />
        <PreserveTaskNameCapitalizationRow />
        <IncludeIssueContextByDefaultRow />
        <EnableTmuxRow />
        <FollowUpModeRow />
      </SettingsSection>
    </div>
  );
}
