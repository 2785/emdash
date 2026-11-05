import { useCallback, useEffect, type ReactNode } from 'react';
import { useAppSettingsKey } from '@core/features/settings/api/browser/use-app-settings-key';
import { applyThemeToAll } from '@core/features/terminals/api/browser/pty/pty';
import { FRAME_TINT_ATTRIBUTE, frameTintCss } from '@core/primitives/theme/api/frame-tint';
import { ThemeProvider as CoreThemeProvider } from '@core/primitives/theme/browser';

const FRAME_TINT_CSS = frameTintCss();

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const { value, isLoading, update } = useAppSettingsKey('theme');
  const frameTint = useAppSettingsKey('frameTint').value ?? 'none';
  const handleThemeApplied = useCallback(() => applyThemeToAll(), []);

  useEffect(() => {
    const root = document.documentElement;
    if (frameTint === 'none') root.removeAttribute(FRAME_TINT_ATTRIBUTE);
    else root.setAttribute(FRAME_TINT_ATTRIBUTE, frameTint);
  }, [frameTint]);

  return (
    <CoreThemeProvider
      theme={value ?? null}
      isLoading={isLoading}
      onThemeChange={update}
      onThemeApplied={handleThemeApplied}
    >
      <style>{FRAME_TINT_CSS}</style>
      {children}
    </CoreThemeProvider>
  );
}
