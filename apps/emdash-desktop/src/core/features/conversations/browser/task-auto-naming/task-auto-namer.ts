import { reaction } from 'mobx';
import type { ConversationManagerStore } from '@core/features/conversations/api/browser/conversation-manager';
import { isDefaultConversationTitle } from '@core/features/conversations/api/browser/conversation-title-utils';
import { getAppSettingValueSnapshot } from '@core/features/settings/api/browser/app-settings-client';
import { autoTaskName } from '@core/features/tasks/api/browser/task-naming';
import {
  getTaskManagerStore,
  getTaskStore,
} from '@core/features/tasks/api/browser/task-state/task-selectors';
import { log } from '@core/primitives/logging/browser/logger';

/** The agent-given title of the task's first conversation, once it has one. */
export function primaryConversationTitle(conversations: ConversationManagerStore): string | null {
  const all = [...conversations.conversations.values()].map((store) => store.data);
  const primary = all.find((conversation) => conversation.isInitialConversation) ?? all[0];
  if (!primary?.title.trim()) return null;
  return isDefaultConversationTitle(primary.providerId, primary.title) ? null : primary.title;
}

/**
 * Renames a task after its first conversation's title (set by the agent once it knows what the
 * work is about) while the task still has an automatic name. Follows the "Auto-generate task
 * names" setting.
 */
export class TaskAutoNamer {
  private readonly dispose: () => void;

  constructor(
    private readonly projectId: string,
    private readonly taskId: string,
    conversations: ConversationManagerStore
  ) {
    this.dispose = reaction(
      () => primaryConversationTitle(conversations),
      (title) => {
        if (title) void this.apply(title);
      },
      { fireImmediately: true }
    );
  }

  private async apply(title: string): Promise<void> {
    const settings = getAppSettingValueSnapshot('tasks');
    if (settings && !settings.autoGenerateName) return;
    const task = getTaskStore(this.projectId, this.taskId);
    if (!task || task.state === 'unregistered') return;
    const currentName = task.data.name;
    // Later titles follow the conversation's latest messages, usually follow-ups, so autoTaskName
    // only replaces a placeholder (or this title's old branch-style form).

    const siblingNames = [...(getTaskManagerStore(this.projectId)?.tasks.values() ?? [])]
      .filter((sibling) => sibling.data.id !== this.taskId)
      .map((sibling) => sibling.data.name);
    const name = autoTaskName({
      title,
      currentName,
      siblingNames,
    });
    if (!name) return;

    const result = await task.rename(name);
    if (!result.success) log.warn('Automatic task rename failed', { taskId: this.taskId });
  }

  stop(): void {
    this.dispose();
  }
}
