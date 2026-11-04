import { describe, expect, it, vi } from 'vitest';
import { promoteQueuedPrompt } from './promote-queued-prompt';

function fakeSession(overrides: { reorder?: { success: boolean; error?: unknown } } = {}) {
  return {
    changeQueuePromptOrder: vi.fn(
      async () => overrides.reorder ?? { success: true, data: undefined }
    ),
    cancelTurn: vi.fn(async () => ({ success: true as const, data: undefined })),
  } as never as {
    changeQueuePromptOrder: ReturnType<typeof vi.fn>;
    cancelTurn: ReturnType<typeof vi.fn>;
  };
}

describe('promoteQueuedPrompt', () => {
  it('moves the prompt to the front and cancels the active turn', async () => {
    const session = fakeSession();

    const result = await promoteQueuedPrompt(session as never, ['a', 'b', 'c'], 'c', true);

    expect(result.success).toBe(true);
    expect(session.changeQueuePromptOrder).toHaveBeenCalledWith(['c', 'a', 'b']);
    expect(session.cancelTurn).toHaveBeenCalledTimes(1);
  });

  it('only reorders when there is no turn to cancel', async () => {
    const session = fakeSession();

    await promoteQueuedPrompt(session as never, ['a', 'b'], 'b', false);

    expect(session.changeQueuePromptOrder).toHaveBeenCalledWith(['b', 'a']);
    expect(session.cancelTurn).not.toHaveBeenCalled();
  });

  it('does nothing when the prompt already left the queue', async () => {
    const session = fakeSession();

    const result = await promoteQueuedPrompt(session as never, ['a'], 'gone', true);

    expect(result.success).toBe(true);
    expect(session.changeQueuePromptOrder).not.toHaveBeenCalled();
    expect(session.cancelTurn).not.toHaveBeenCalled();
  });

  it('does not cancel the turn when reordering fails', async () => {
    const error = { type: 'invalid_state' };
    const session = fakeSession({ reorder: { success: false, error } });

    const result = await promoteQueuedPrompt(session as never, ['a', 'b'], 'b', true);

    expect(result).toEqual({ success: false, error });
    expect(session.cancelTurn).not.toHaveBeenCalled();
  });
});
