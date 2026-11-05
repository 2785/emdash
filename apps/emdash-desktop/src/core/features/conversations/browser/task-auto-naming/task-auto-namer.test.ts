import { describe, expect, it, vi } from 'vitest';
import { primaryConversationTitle, TaskAutoNamer } from './task-auto-namer';

const state = vi.hoisted(() => ({
  task: { state: 'ready', data: { id: 't1', name: '' }, rename: vi.fn() },
}));

vi.mock('@core/features/settings/api/browser/app-settings-client', () => ({
  getAppSettingValueSnapshot: () => ({ autoGenerateName: true }),
}));
vi.mock('@core/features/tasks/api/browser/task-state/task-selectors', () => ({
  getTaskStore: () => state.task,
  getTaskManagerStore: () => ({ tasks: new Map([['t1', state.task]]) }),
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

describe('TaskAutoNamer', () => {
  async function nameAfterTitle(currentName: string, title: string) {
    state.task.data.name = currentName;
    state.task.rename = vi.fn(async () => ({ success: true }));
    const namer = new TaskAutoNamer(
      'p1',
      't1',
      manager([{ title, providerId: 'claude', isInitialConversation: true }])
    );
    await vi.waitFor(() => Promise.resolve());
    namer.stop();
    return state.task.rename;
  }

  it("replaces the generated placeholder name with the conversation's title", async () => {
    const rename = await nameAfterTitle('dull-geese-try', 'Remove sandbox access expiry');
    await vi.waitFor(() => expect(rename).toHaveBeenCalledWith('Remove sandbox access expiry'));
  });

  it('keeps any other name, including one it gave earlier, when the title changes', async () => {
    const rename = await nameAfterTitle(
      'Remove sandbox access expiry',
      'Column drop migration ordering'
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(rename).not.toHaveBeenCalled();
  });
});
