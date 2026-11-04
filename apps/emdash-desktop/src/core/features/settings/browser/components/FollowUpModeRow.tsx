import { Select } from '@emdash/ui/react/primitives';
import React from 'react';
import { useAppSettingsKey } from '@core/features/settings/api/browser/use-app-settings-key';
import { ResetToDefaultButton } from './ResetToDefaultButton';
import { SettingRow } from './SettingRow';

type FollowUpMode = 'queue' | 'interrupt';

export const FollowUpModeRow: React.FC = () => {
  const { value, defaults, isOverridden, isLoading, isSaving, update, reset } =
    useAppSettingsKey('followUpMode');
  const mode = value ?? defaults ?? 'queue';

  return (
    <SettingRow
      title="Messages sent while agent is working"
      description="Queue them until the current turn ends, or interrupt the turn and send immediately. Applies to chat conversations."
      control={
        <>
          <ResetToDefaultButton
            visible={isOverridden}
            defaultLabel="queue"
            onReset={() => reset()}
            disabled={isLoading || isSaving}
          />
          <Select.Root
            value={mode}
            disabled={isLoading}
            onValueChange={(next) => update(next as FollowUpMode)}
          >
            <Select.Trigger className="w-auto shrink-0 gap-2 [&>span]:line-clamp-none">
              <Select.Value />
            </Select.Trigger>
            <Select.Content className="min-w-max">
              <Select.Item value="queue">Queue</Select.Item>
              <Select.Item value="interrupt">Interrupt</Select.Item>
            </Select.Content>
          </Select.Root>
        </>
      }
    />
  );
};
