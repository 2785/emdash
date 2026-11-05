import { peek } from '@emdash/wire/state';
import type { TuiAgentState } from '#runtimes/tui-agents/api';
import {
  produceCell,
  type TuiAgentStatesListModel,
  type TuiSessionsListModel,
} from '#runtimes/tui-agents/node/state/live-models';
import type { ResolvedTuiProvider } from '#services/agent-plugins/api/plugins';
import type { CanonicalHookEvent } from '#services/agent-plugins/api/plugins';
import { defaultHookEventParser } from '#services/agent-plugins/api/plugins/helpers';

const ATTENTION_NOTIFICATION_TYPES = new Set(['permission_prompt', 'elicitation_dialog']);

export type ProviderSessionIdChangedHandler = (
  conversationId: string,
  providerSessionId: string
) => void;

export type AgentStateChangedHandler = (conversationId: string, state: TuiAgentState) => void;

export class TuiAgentStates {
  constructor(
    private readonly sessions: TuiSessionsListModel,
    private readonly agentStates: TuiAgentStatesListModel,
    private readonly now: () => number,
    private readonly onProviderSessionIdChanged?: ProviderSessionIdChangedHandler,
    private readonly onAgentStateChanged?: AgentStateChangedHandler
  ) {}

  applyRawHookEvent(
    conversationId: string,
    provider: Pick<ResolvedTuiProvider, 'parseHookEvent'> | null,
    eventType: string,
    body: Record<string, unknown>
  ): void {
    const event =
      provider?.parseHookEvent?.(eventType, body) ?? defaultHookEventParser(eventType, body);
    this.applyCanonicalEvent(conversationId, undefined, event);
  }

  applyCanonicalEvent(
    conversationId: string,
    providerId: string | undefined,
    event: CanonicalHookEvent
  ): void {
    if (event.kind === 'ignore') return;
    if (event.kind === 'session') {
      this.setProviderSessionId(conversationId, event.providerSessionId);
      return;
    }

    if (event.providerSessionId) {
      this.setProviderSessionId(conversationId, event.providerSessionId);
    }

    if (event.type === 'start') {
      this.setStatus(conversationId, {
        providerId,
        source: 'hook',
        status: 'working',
        title: event.title,
        message: event.message,
        lastAssistantMessage: event.lastAssistantMessage,
      });
      return;
    }

    if (event.type === 'stop') {
      this.setStatus(conversationId, {
        providerId,
        source: 'hook',
        status: 'completed',
        title: event.title,
        message: event.message,
        lastAssistantMessage: event.lastAssistantMessage,
      });
      return;
    }

    if (event.type === 'error') {
      this.setStatus(conversationId, {
        providerId,
        source: 'hook',
        status: 'error',
        title: event.title,
        message: event.message,
        lastAssistantMessage: event.lastAssistantMessage,
      });
      return;
    }

    if (event.notificationType === 'idle_prompt') {
      // "Ready for input": the agent is idle. That ends a turn whose stop hook never fired
      // (e.g. interrupted with Esc), but must not turn a finished turn into a request for
      // attention, nor clear a permission prompt that is still pending.
      if (this.current(conversationId)?.status !== 'working') return;
      this.setStatus(conversationId, {
        providerId,
        source: 'hook',
        status: 'completed',
        notificationType: event.notificationType,
        title: event.title,
        message: event.message,
        lastAssistantMessage: event.lastAssistantMessage,
      });
      return;
    }

    const status =
      event.notificationType && ATTENTION_NOTIFICATION_TYPES.has(event.notificationType)
        ? 'awaiting-input'
        : 'idle';
    this.setStatus(conversationId, {
      providerId,
      source: 'hook',
      status,
      notificationType: event.notificationType,
      title: event.title,
      message: event.message,
      lastAssistantMessage: event.lastAssistantMessage,
    });
  }

  markInputSubmitted(
    conversationId: string,
    provider: Pick<ResolvedTuiProvider, 'hooks'> | null,
    data: string,
    /** When false, keep Enter→working even if the provider declares a start hook. */
    startHooksActive = true
  ): void {
    if (!data.includes('\r')) return;
    if (
      startHooksActive &&
      provider?.hooks.kind !== 'none' &&
      provider?.hooks.supportedEvents.includes('start')
    )
      return;
    this.setStatus(conversationId, { status: 'working', source: 'input' });
  }

  markInitialPromptSubmitted(
    conversationId: string,
    providerId: string,
    provider: Pick<ResolvedTuiProvider, 'hooks'> | null,
    initialPrompt: string | undefined,
    /** When false, keep initial-prompt→working even if the provider declares a start hook. */
    startHooksActive = true
  ): void {
    if (!initialPrompt?.trim()) return;
    if (
      startHooksActive &&
      provider?.hooks.kind !== 'none' &&
      provider?.hooks.supportedEvents.includes('start')
    )
      return;
    this.setStatus(conversationId, { providerId, status: 'working', source: 'input' });
  }

  setProviderSessionId(conversationId: string, providerSessionId: string): void {
    let changed = false;
    produceCell(this.sessions.states.list, (draft) => {
      const session = draft[conversationId];
      if (!session || session.sessionId === providerSessionId) return;
      session.sessionId = providerSessionId;
      changed = true;
    });
    if (changed) this.onProviderSessionIdChanged?.(conversationId, providerSessionId);
  }

  resetToIdle(conversationId: string): void {
    this.setStatus(conversationId, { status: 'idle' });
  }

  clear(conversationId: string): void {
    produceCell(this.agentStates.states.list, (draft) => {
      delete draft[conversationId];
    });
  }

  current(conversationId: string): TuiAgentState | undefined {
    return peek(this.agentStates.states.list)[conversationId];
  }

  restore(state: TuiAgentState): void {
    // A persisted "working" can't be trusted: hookless providers mark working on Enter and only
    // clear it on exit, and hook events (including the stop hook) are lost while the app is
    // closed even though the session keeps running. Restore it as idle; the next hook (or a
    // fresh Enter on a hookless provider) re-asserts working.
    const restored = state.status === 'working' ? { ...state, status: 'idle' as const } : state;
    produceCell(this.agentStates.states.list, (draft) => {
      draft[restored.conversationId] = restored;
    });
  }

  private setStatus(
    conversationId: string,
    patch: Omit<Partial<TuiAgentState>, 'conversationId' | 'updatedAt'>
  ): void {
    let changedState: TuiAgentState | undefined;
    produceCell(this.agentStates.states.list, (draft) => {
      const previous = draft[conversationId];
      const next: TuiAgentState = {
        conversationId,
        providerId: patch.providerId ?? previous?.providerId,
        status: patch.status ?? previous?.status ?? 'idle',
        source: patch.source ?? previous?.source,
        notificationType: patch.notificationType,
        title: patch.title,
        message: patch.message,
        lastAssistantMessage: patch.lastAssistantMessage,
        updatedAt: this.now(),
      };

      if (
        previous &&
        previous.providerId === next.providerId &&
        previous.status === next.status &&
        previous.source === next.source &&
        previous.notificationType === next.notificationType &&
        previous.title === next.title &&
        previous.message === next.message &&
        previous.lastAssistantMessage === next.lastAssistantMessage
      ) {
        return;
      }

      draft[conversationId] = next;
      changedState = next;
    });
    if (changedState) this.onAgentStateChanged?.(conversationId, changedState);
  }
}
