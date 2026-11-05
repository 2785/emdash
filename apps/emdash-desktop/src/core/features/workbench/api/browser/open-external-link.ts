import { toast } from '@emdash/ui/react/primitives';
import {
  getAppSettingValueSnapshot,
  prefetchAppSettingsKey,
  setAppSettingsValueInCache,
  updateAppSettingsRequest,
} from '@core/features/settings/api/browser/app-settings-client';
import { getTaskComposition } from '@core/features/workbench/api/browser/task-composition-selectors';
import { openModal } from '@core/manifests/browser/modal-api';
import {
  copyTextToClipboard,
  openExternal,
} from '@core/primitives/desktop-host/browser/host-client';
import { getNavigation } from '@core/primitives/navigation/browser/navigation-selectors';
import { normalizeExternalHttpUrl } from './external-url';

const HTTP_URL_PATTERN = /^https?:\/\//i;

type LinkOpenBehavior = 'ask' | 'emdash-browser' | 'external-browser';
type LinkTarget = 'emdash-browser' | 'external-browser';

/**
 * Where a link opens without asking, or 'ask'. The in-app browser lives in a task pane, so a
 * remembered in-app choice falls back to the external browser outside a task.
 */
export function resolveLinkTarget(
  behavior: LinkOpenBehavior,
  canOpenInEmdashBrowser: boolean
): LinkTarget | 'ask' {
  if (behavior === 'emdash-browser') {
    return canOpenInEmdashBrowser ? 'emdash-browser' : 'external-browser';
  }
  return behavior;
}

export function confirmOpenExternalLink(url: string, onError?: (error: unknown) => void): void {
  void openLink(url, onError);
}

async function openLink(url: string, onError?: (error: unknown) => void): Promise<void> {
  const normalizedUrl = normalizeExternalHttpUrl(url);

  if (!HTTP_URL_PATTERN.test(normalizedUrl)) {
    return;
  }

  const taskView = getActiveTaskView();
  const open = (target: LinkTarget) => {
    if (target === 'emdash-browser') {
      taskView?.paneLayout.open('browser', { initialUrl: normalizedUrl });
      taskView?.setFocusedRegion('main');
      return;
    }
    void openExternal(normalizedUrl).catch((error) => {
      onError?.(error);
    });
  };

  if (getAppSettingValueSnapshot('linkOpenBehavior') === undefined) {
    await prefetchAppSettingsKey('linkOpenBehavior').catch(() => undefined);
  }
  const target = resolveLinkTarget(
    getAppSettingValueSnapshot('linkOpenBehavior') ?? 'ask',
    taskView !== undefined
  );
  if (target !== 'ask') {
    open(target);
    return;
  }

  void openModal('confirmExternalLinkModal', {
    url: normalizedUrl,
    canOpenInEmdashBrowser: taskView !== undefined,
    onCopy: () => copyExternalLink(normalizedUrl),
  }).then((outcome) => {
    if (!outcome.success) return;
    if (outcome.data.remember) rememberLinkTarget(outcome.data.choice);
    open(outcome.data.choice);
  });
}

function rememberLinkTarget(target: LinkTarget): void {
  setAppSettingsValueInCache('linkOpenBehavior', target);
  void updateAppSettingsRequest('linkOpenBehavior', target).catch(() => {
    toast.error('Could not save link preference');
  });
}

async function copyExternalLink(url: string): Promise<boolean> {
  try {
    const result = await copyTextToClipboard(url);
    if (!result.success) {
      showCopyFailure();
      return false;
    }
    toast('Link copied');
    return true;
  } catch {
    showCopyFailure();
    return false;
  }
}

function showCopyFailure(): void {
  toast.error('Copy failed', { description: 'The link could not be copied to the clipboard.' });
}

function getActiveTaskView() {
  const ref = getNavigation().currentRef;
  if (ref.viewId !== 'task') return undefined;
  const { projectId, taskId } = ref.params as {
    projectId?: string;
    taskId?: string;
  };
  if (!projectId || !taskId) return undefined;
  return getTaskComposition(projectId, taskId);
}
