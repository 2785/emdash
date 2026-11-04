import { z } from 'zod';
import { defineSettingsContribution } from '@core/primitives/settings/api';

export const preferredConversationTypeSettingsContribution = defineSettingsContribution({
  key: 'preferredConversationType',
  schema: z.enum(['acp', 'pty']),
  defaults: 'pty' as const,
});

/**
 * What sending a chat message does while the agent is mid-turn:
 * - `queue`: run it after the current turn finishes.
 * - `interrupt`: cancel the current turn and run it next.
 */
export const followUpModeSettingsContribution = defineSettingsContribution({
  key: 'followUpMode',
  schema: z.enum(['queue', 'interrupt']),
  defaults: 'queue' as const,
});
