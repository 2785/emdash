import { Check } from 'lucide-react';
import React from 'react';
import { useAppSettingsKey } from '@core/features/settings/api/browser/use-app-settings-key';
import { cn } from '@core/primitives/styling/browser/cn';
import {
  FRAME_TINTS,
  frameTintSwatch,
  type FrameTint,
} from '@core/primitives/theme/api/frame-tint';
import { useTheme } from '@core/primitives/theme/browser';

const FrameTintCard: React.FC = () => {
  const { value, update, isLoading } = useAppSettingsKey('frameTint');
  const { effectiveTheme } = useTheme();
  const mode = effectiveTheme === 'emdark' ? 'dark' : 'light';
  const selected: FrameTint = value ?? 'none';
  const options: { id: FrameTint; label: string; color?: string }[] = [
    { id: 'none', label: 'None' },
    ...FRAME_TINTS.map((tint) => ({
      id: tint.id,
      label: tint.label,
      color: frameTintSwatch(tint.id, mode),
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Window frame color">
      {options.map(({ id, label, color }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={selected === id}
          aria-label={label}
          title={label}
          disabled={isLoading}
          onClick={() => update(id)}
          className={cn(
            'relative flex size-9 items-center justify-center rounded-full border border-border transition-shadow',
            selected === id && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
            !color && 'bg-background-secondary'
          )}
          style={color ? { backgroundColor: color } : undefined}
        >
          {selected === id ? (
            <Check className="size-4 text-foreground" aria-hidden="true" />
          ) : (
            !color && <span className="h-px w-5 rotate-45 bg-foreground-muted" />
          )}
        </button>
      ))}
    </div>
  );
};

export default FrameTintCard;
