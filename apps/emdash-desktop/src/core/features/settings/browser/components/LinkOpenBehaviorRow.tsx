import { Select } from '@emdash/ui/react/primitives';
import React from 'react';
import { useAppSettingsKey } from '@core/features/settings/api/browser/use-app-settings-key';
import { PRODUCT_NAME } from '@core/primitives/app-identity/api/app-identity';
import { ResetToDefaultButton } from './ResetToDefaultButton';
import { SettingRow } from './SettingRow';

type LinkOpenBehavior = 'ask' | 'emdash-browser' | 'external-browser';

export const LinkOpenBehaviorRow: React.FC = () => {
  const { value, defaults, isOverridden, isLoading, isSaving, update, reset } =
    useAppSettingsKey('linkOpenBehavior');
  const behavior = value ?? defaults ?? 'ask';

  return (
    <SettingRow
      title="Open links in"
      description={`Where clicked links open. ${PRODUCT_NAME}'s browser opens beside the task; outside a task, links open in your default browser.`}
      control={
        <>
          <ResetToDefaultButton
            visible={isOverridden}
            defaultLabel="ask"
            onReset={() => reset()}
            disabled={isLoading || isSaving}
          />
          <Select.Root
            value={behavior}
            disabled={isLoading}
            onValueChange={(next) => update(next as LinkOpenBehavior)}
          >
            <Select.Trigger className="w-auto shrink-0 gap-2 [&>span]:line-clamp-none">
              <Select.Value />
            </Select.Trigger>
            <Select.Content className="min-w-max">
              <Select.Item value="ask">Ask each time</Select.Item>
              <Select.Item value="emdash-browser">{PRODUCT_NAME} browser</Select.Item>
              <Select.Item value="external-browser">Default browser</Select.Item>
            </Select.Content>
          </Select.Root>
        </>
      }
    />
  );
};
