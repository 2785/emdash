import { describe, expect, it, vi } from 'vitest';
import { primaryConversationTitle } from './task-auto-namer';

vi.mock('@core/primitives/mementos/browser', () => ({ getMementoClient: vi.fn() }));
vi.mock('@core/features/settings/api/browser/app-settings-client', () => ({
  getAppSettingValueSnapshot: vi.fn(),
}));
vi.mock('@core/features/tasks/api/browser/task-state/task-selectors', () => ({
  getTaskStore: vi.fn(),
  getTaskManagerStore: vi.fn(),
}));

type Row = {
  title: string;
  providerId: string;
  isInitialConversation?: boolean;
};

function manager(rows: Row[]) {
  return {
    conversations: new Map(rows.map((data, i) => [`c${i}`, { data }])),
  } as never;
}

describe('primaryConversationTitle', () => {
  it("uses the initial conversation's agent-given title", () => {
    expect(
      primaryConversationTitle(
        manager([
          { title: 'Later chat', providerId: 'claude' },
          {
            title: 'Emdash personal port exploration',
            providerId: 'claude',
            isInitialConversation: true,
          },
        ])
      )
    ).toBe('Emdash personal port exploration');
  });

  it('falls back to the first conversation when none is marked initial', () => {
    expect(
      primaryConversationTitle(
        manager([
          { title: 'First', providerId: 'claude' },
          { title: 'Second', providerId: 'claude' },
        ])
      )
    ).toBe('First');
  });

  it('ignores the default title a conversation starts with', () => {
    expect(
      primaryConversationTitle(
        manager([
          {
            title: 'Claude (1)',
            providerId: 'claude',
            isInitialConversation: true,
          },
        ])
      )
    ).toBeNull();
    expect(primaryConversationTitle(manager([]))).toBeNull();
  });
});
