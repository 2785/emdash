import { describe, expect, it, vi } from 'vitest';
import { resolveLinkTarget } from './open-external-link';

vi.mock('@core/manifests/browser/modal-api', () => ({ openModal: vi.fn() }));
vi.mock('@core/primitives/desktop-host/browser/host-client', () => ({
  copyTextToClipboard: vi.fn(),
  openExternal: vi.fn(),
}));
vi.mock('@core/primitives/navigation/browser/navigation-selectors', () => ({
  getNavigation: vi.fn(),
}));
vi.mock('@core/features/workbench/api/browser/task-composition-selectors', () => ({
  getTaskComposition: vi.fn(),
}));
vi.mock('@core/features/settings/api/browser/app-settings-client', () => ({
  getAppSettingValueSnapshot: vi.fn(),
  prefetchAppSettingsKey: vi.fn(),
  setAppSettingsValueInCache: vi.fn(),
  updateAppSettingsRequest: vi.fn(),
}));

describe('resolveLinkTarget', () => {
  it('asks unless a choice was remembered', () => {
    expect(resolveLinkTarget('ask', true)).toBe('ask');
    expect(resolveLinkTarget('external-browser', true)).toBe('external-browser');
    expect(resolveLinkTarget('emdash-browser', true)).toBe('emdash-browser');
  });

  it('opens a remembered in-app choice externally when no task can host the browser', () => {
    expect(resolveLinkTarget('emdash-browser', false)).toBe('external-browser');
  });
});
