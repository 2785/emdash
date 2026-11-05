import type { CanonicalHookEvent } from '@emdash/core/services/agent-plugins/api/plugins';
import {
  buildNestedJsonHookConfig,
  configRoots,
  defaultHookEventParser,
  envConfigRoot,
  extractProviderSessionId,
  makeStdinHookCommand,
} from '@emdash/core/services/agent-plugins/api/plugins/helpers';

export const CLAUDE_SETTINGS_PATH = 'settings.json';

/**
 * Notification events are classified by their `notification_type` field. Older Claude versions
 * omit it; those fall back to the message text:
 *   /permission|approval/i → permission_prompt
 *   everything else        → idle_prompt (agent waiting / done)
 *
 * Every Claude hook payload includes `session_id`, and it changes when the user
 * switches sessions inside the TUI (`/resume`). Status events carry it so the
 * runtime resumes the session Claude is actually in, not the one it launched with.
 */
function parseClaudeHookEvent(
  eventType: string,
  body: Record<string, unknown>
): CanonicalHookEvent {
  const event =
    eventType === 'notification'
      ? parseClaudeNotification(body)
      : defaultHookEventParser(eventType, body);
  if (event.kind !== 'status') return event;
  const providerSessionId = extractProviderSessionId(body);
  return providerSessionId ? { ...event, providerSessionId } : event;
}

function parseClaudeNotification(body: Record<string, unknown>): CanonicalHookEvent {
  const message = typeof body.message === 'string' ? body.message : '';
  const declared = defaultHookEventParser('notification', body);
  const notificationType =
    (declared.kind === 'status' ? declared.notificationType : undefined) ??
    (/permission|approval/i.test(message)
      ? ('permission_prompt' as const)
      : ('idle_prompt' as const));
  return {
    kind: 'status',
    type: 'notification',
    notificationType,
    message: message || undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
  };
}

export function buildClaudeHookConfig() {
  return {
    ...buildNestedJsonHookConfig(CLAUDE_SETTINGS_PATH, [
      { hookKey: 'SessionStart', command: makeStdinHookCommand('session-start') },
      { hookKey: 'UserPromptSubmit', command: makeStdinHookCommand('start') },
      // Any finished tool call means the agent is working: clears a stale awaiting-input once a
      // permission prompt is answered, and catches turns that start without UserPromptSubmit
      // (e.g. woken by a background task).
      { hookKey: 'PostToolUse', command: makeStdinHookCommand('start') },
      { hookKey: 'Notification', command: makeStdinHookCommand('notification') },
      { hookKey: 'Stop', command: makeStdinHookCommand('stop') },
    ]),
    resolveConfigRoots: configRoots(envConfigRoot('CLAUDE_CONFIG_DIR', '.claude')),
    parseHookEvent: parseClaudeHookEvent,
  };
}
