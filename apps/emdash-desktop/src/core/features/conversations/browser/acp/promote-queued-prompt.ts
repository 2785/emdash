import { ok, type Result } from '@emdash/shared';
import type { AcpLiveSession } from './acp-live-session';

type QueueSession = Pick<AcpLiveSession, 'changeQueuePromptOrder' | 'cancelTurn'>;

/**
 * Moves queued prompt `id` to the front of the queue. With `cancelActiveTurn`, also cancels the
 * running turn so the runtime starts that prompt next. No-op when `id` is no longer queued.
 */
export async function promoteQueuedPrompt(
  session: QueueSession,
  queuedIds: readonly string[],
  id: string,
  cancelActiveTurn: boolean
): Promise<Result<void, unknown>> {
  if (!queuedIds.includes(id)) return ok();
  const reordered = await session.changeQueuePromptOrder([
    id,
    ...queuedIds.filter((queuedId) => queuedId !== id),
  ]);
  if (!reordered.success || !cancelActiveTurn) return reordered;
  return session.cancelTurn();
}
