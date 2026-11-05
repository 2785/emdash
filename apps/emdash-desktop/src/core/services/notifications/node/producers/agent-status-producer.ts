import { eq } from 'drizzle-orm';
import type { AgentEvent } from '@core/primitives/agents/api';
import type { AppDb } from '@core/services/app-db/node/db';
import { tasks } from '@core/services/app-db/node/schema';
import type { NotificationService } from '../notification-service';
import { agentNotificationInputFromEvent, notificationMapping } from './agent-status-mapping';

/** A finished turn is only announced once the agent has stayed idle this long. */
export const COMPLETION_SETTLE_MS = 5_000;
/** Further completions from the same conversation within this long are recorded silently. */
export const COMPLETION_SOUND_COOLDOWN_MS = 60_000;

type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Publishes agent notifications. Agents often finish several short turns in a row (each
 * background task that completes starts one), so a completion waits until the agent has stayed
 * idle for {@link COMPLETION_SETTLE_MS}, and repeats within the cooldown don't play a sound.
 */
export function installAgentStatusNotificationProducer(
  service: NotificationService,
  deps: {
    db: AppDb;
    onAgentEvent(handler: (event: AgentEvent) => void): () => void;
    resolveProviderName(providerId: string): string;
    clock?: Clock;
  }
): () => void {
  const clock = deps.clock ?? systemClock;
  const pendingCompletions = new Map<string, unknown>();
  const lastSoundAt = new Map<string, number>();

  const cancelPending = (conversationId: string) => {
    const handle = pendingCompletions.get(conversationId);
    if (handle === undefined) return;
    clock.clearTimeout(handle);
    pendingCompletions.delete(conversationId);
  };

  const unsubscribe = deps.onAgentEvent((event) => {
    const { conversationId } = event;
    // Working again, or now waiting on the user: the earlier finish is no longer news.
    if (event.type !== 'stop') cancelPending(conversationId);
    const mapping = notificationMapping(event);
    if (!mapping) return;

    if (mapping.kind !== 'agent-complete') {
      void publishAgentNotification(service, event, deps.db, deps.resolveProviderName);
      return;
    }

    cancelPending(conversationId);
    pendingCompletions.set(
      conversationId,
      clock.setTimeout(() => {
        pendingCompletions.delete(conversationId);
        const now = clock.now();
        const silent =
          now - (lastSoundAt.get(conversationId) ?? -Infinity) < COMPLETION_SOUND_COOLDOWN_MS;
        if (!silent) lastSoundAt.set(conversationId, now);
        void publishAgentNotification(service, event, deps.db, deps.resolveProviderName, {
          silent,
        });
      }, COMPLETION_SETTLE_MS)
    );
  });

  return () => {
    unsubscribe();
    for (const handle of pendingCompletions.values()) clock.clearTimeout(handle);
    pendingCompletions.clear();
  };
}

export async function publishAgentNotification(
  service: Pick<NotificationService, 'publish'>,
  event: AgentEvent,
  db: AppDb,
  resolveProviderName: (providerId: string) => string,
  options: { silent?: boolean } = {}
): Promise<string | null> {
  const mapping = notificationMapping(event);
  if (!mapping) return null;

  const providerName = event.providerId ? resolveProviderName(event.providerId) : 'Agent';
  const taskName = await getTaskName(db, event.taskId);
  const input = agentNotificationInputFromEvent(event, providerName, taskName, mapping);
  return service.publish(options.silent ? { ...input, sound: null } : input);
}

async function getTaskName(db: AppDb, taskId: string | undefined): Promise<string | null> {
  if (!taskId) return null;
  const [row] = await db
    .select({ name: tasks.name })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  return row?.name ?? null;
}
