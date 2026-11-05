import { describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '@core/primitives/agents/api';
import { agentNotificationInputFromEvent, notificationMapping } from './agent-status-mapping';
import {
  COMPLETION_SETTLE_MS,
  COMPLETION_SOUND_COOLDOWN_MS,
  installAgentStatusNotificationProducer,
} from './agent-status-producer';

function event(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    type: 'notification',
    providerId: 'codex',
    projectId: 'project-1',
    taskId: 'task-1',
    conversationId: 'conv-1',
    timestamp: 123,
    payload: { notificationType: 'permission_prompt' },
    ...overrides,
  };
}

describe('agent status notification producer', () => {
  it('maps attention events to agent-attention notifications', () => {
    const input = agentNotificationInputFromEvent(event(), 'Codex', 'Fix tests');

    expect(input).toEqual({
      kind: 'agent-attention',
      groupKey: 'conversation:conv-1',
      dedupeKey: 'conv-1:notification:123',
      title: 'Codex - Fix tests',
      body: 'Your agent is waiting for input',
      sound: 'needs_attention',
      target: {
        kind: 'task',
        projectId: 'project-1',
        taskId: 'task-1',
        conversationId: 'conv-1',
      },
      source: {
        kind: 'conversation',
        projectId: 'project-1',
        taskId: 'task-1',
        conversationId: 'conv-1',
      },
    });
  });

  it('maps stop events to completion notifications', () => {
    const input = agentNotificationInputFromEvent(
      event({ type: 'stop', payload: {} }),
      'Claude',
      null
    );

    expect(input).toMatchObject({
      kind: 'agent-complete',
      title: 'Claude',
      body: 'Your agent has finished working',
      sound: 'task_complete',
      source: {
        kind: 'conversation',
        projectId: 'project-1',
        taskId: 'task-1',
        conversationId: 'conv-1',
      },
    });
  });

  it('ignores non-attention notification events', () => {
    expect(
      notificationMapping(event({ payload: { notificationType: 'auth_success' } }))
    ).toBeNull();
  });
});

describe('completion notifications', () => {
  function setup() {
    let now = 0;
    const timers: { at: number; fn: () => void; id: number }[] = [];
    let nextId = 0;
    const clock = {
      now: () => now,
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextId++;
        timers.push({ at: now + ms, fn, id });
        return id;
      },
      clearTimeout: (handle: unknown) => {
        const index = timers.findIndex((timer) => timer.id === handle);
        if (index >= 0) timers.splice(index, 1);
      },
    };
    const advance = async (ms: number) => {
      now += ms;
      for (const timer of timers.filter((t) => t.at <= now)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.fn();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
    let handler: (event: AgentEvent) => void = () => {};
    const publish = vi.fn(async () => 'id');
    // Task names come from the DB; any row works here.
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [{ name: 'AR/AP' }] }) }),
      }),
    };
    const dispose = installAgentStatusNotificationProducer({ publish } as never, {
      db: db as never,
      onAgentEvent: (next) => {
        handler = next;
        return () => {};
      },
      resolveProviderName: () => 'Claude',
      clock,
    });
    const emit = (type: AgentEvent['type'], payload: AgentEvent['payload'] = {}) =>
      handler(event({ type, payload, timestamp: now }));
    return { emit, advance, publish, dispose };
  }

  it('announces one finish for a burst of short turns', async () => {
    const { emit, advance, publish } = setup();
    for (let i = 0; i < 4; i++) {
      emit('start');
      await advance(1_000);
      emit('stop');
      await advance(2_000);
    }
    expect(publish).not.toHaveBeenCalled();

    await advance(COMPLETION_SETTLE_MS);
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ sound: 'task_complete' }));
  });

  it('records repeats within the cooldown without a sound', async () => {
    const { emit, advance, publish } = setup();
    emit('stop');
    await advance(COMPLETION_SETTLE_MS);
    emit('start');
    await advance(20_000);
    emit('stop');
    await advance(COMPLETION_SETTLE_MS);
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ sound: null }));

    await advance(COMPLETION_SOUND_COOLDOWN_MS);
    emit('stop');
    await advance(COMPLETION_SETTLE_MS);
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ sound: 'task_complete' }));
  });

  it('announces waiting for input right away and drops the pending finish', async () => {
    const { emit, advance, publish } = setup();
    emit('stop');
    emit('notification', { notificationType: 'permission_prompt' });
    await advance(0);
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'agent-attention' }));

    await advance(COMPLETION_SETTLE_MS);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('cancels pending finishes when disposed', async () => {
    const { emit, advance, publish, dispose } = setup();
    emit('stop');
    dispose();
    await advance(COMPLETION_SETTLE_MS);
    expect(publish).not.toHaveBeenCalled();
  });
});
