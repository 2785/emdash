import { formatHostRef, hostRef, LOCAL_HOST_REF } from '@emdash/core/primitives/host/api';
import type { ConversationManagerStore } from '@core/features/conversations/api/browser/conversation-manager';
import { conversationRegistry } from '@core/features/conversations/api/browser/stores/conversation-registry';
import { TaskAutoNamer } from '@core/features/conversations/browser/task-auto-naming/task-auto-namer';
import type { TaskScopedStoreContext } from '@core/features/tasks/contributions/browser/task-stores';
import {
  contributeScopedStore,
  scopedStoreToken,
  type ScopedStoreContribution,
} from '@core/primitives/scoped-stores/browser';

export const conversationManagerStoreToken =
  scopedStoreToken<ConversationManagerStore>('conversations.manager');

const taskAutoNamerToken = scopedStoreToken<TaskAutoNamer>('conversations.task-auto-namer');

export const conversationTaskStoreContributions: readonly ScopedStoreContribution<TaskScopedStoreContext>[] =
  [
    contributeScopedStore({
      token: conversationManagerStoreToken,
      create: ({ projectId, taskId, task }) =>
        conversationRegistry.acquire(taskId, projectId, () =>
          formatHostRef(
            task.workspaceSshConnectionId
              ? hostRef('remote', task.workspaceSshConnectionId)
              : LOCAL_HOST_REF
          )
        ),
      dispose: (_, { taskId }) => conversationRegistry.release(taskId),
    }),
    contributeScopedStore({
      token: taskAutoNamerToken,
      create: ({ projectId, taskId, task }) =>
        new TaskAutoNamer(
          projectId,
          taskId,
          conversationRegistry.acquire(taskId, projectId, () =>
            formatHostRef(
              task.workspaceSshConnectionId
                ? hostRef('remote', task.workspaceSshConnectionId)
                : LOCAL_HOST_REF
            )
          )
        ),
      dispose: (namer) => namer.stop(),
    }),
  ];
