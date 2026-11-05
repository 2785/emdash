import { Toaster } from '@emdash/ui/react/primitives';
import { LeftSidebar } from '@core/features/workbench/browser/sidebar/left-sidebar';
import { WindowScope } from '@core/features/workbench/browser/window-scope';
import { Titlebar } from '@core/features/workbench/contributions/browser/Titlebar';
import { detectPlatformContext } from '@core/primitives/keybindings/api';
import {
  useWorkspaceSlots,
  useWorkspaceViewParams,
} from '@core/primitives/navigation/browser/navigation-hooks';
import { useTheme } from '@core/primitives/theme/browser';
import { BrowserShortcutForwarding, KeybindingDispatcherMount } from '@renderer/lib/keybindings';
import { WorkspaceContentLayout, WorkspaceLayout } from '@renderer/lib/layout/workspace-layout';

const isLinux = detectPlatformContext().os === 'linux';

export function Workspace() {
  useTheme();
  const { WrapView, TitlebarSlot, hasTitlebar, MainPanel } = useWorkspaceSlots();
  // Linux's frameless window gets its minimize/maximize/close buttons from the titlebar, so a
  // view without one (such as home) still gets a plain titlebar there.
  const titlebar = hasTitlebar || !isLinux ? <TitlebarSlot /> : <Titlebar />;
  const { params } = useWorkspaceViewParams();

  return (
    <WindowScope>
      <BrowserShortcutForwarding />
      <KeybindingDispatcherMount />
      <WorkspaceLayout
        leftSidebar={<LeftSidebar />}
        mainContent={
          <WrapView {...params}>
            <WorkspaceContentLayout titlebarSlot={titlebar} mainPanel={<MainPanel />} />
          </WrapView>
        }
      />
      <Toaster />
    </WindowScope>
  );
}
