import { describe, expect, it, vi } from 'vitest';
import {
  type ControlWorkspace,
  type WorkspaceControlDeps,
  WorkspaceControlService,
} from './workspace-control-service';

function workspace(overrides: Partial<ControlWorkspace>): Omit<ControlWorkspace, 'pullRequest'> {
  return {
    id: 'w1',
    name: 'w1',
    projectId: 'p1',
    projectName: 'api',
    branch: 'w1',
    archived: false,
    agentStatus: null,
    lastActivityAt: null,
    ...overrides,
  };
}

function setup(rows: Omit<ControlWorkspace, 'pullRequest'>[]) {
  const deps = {
    listProjects: vi.fn(async () => []),
    listWorkspaces: vi.fn(async ({ includeArchived }: { includeArchived: boolean }) =>
      includeArchived ? rows : rows.filter((row) => !row.archived)
    ),
    pullRequestForBranch: vi.fn(async (_projectId: string, branch: string) =>
      branch === 'merged-branch'
        ? { url: 'https://example.com/pr/1', title: 'Done', state: 'merged' as const }
        : null
    ),
    callerContext: vi.fn(async (conversationId: string) =>
      conversationId === 'conv-self' ? { taskId: 'self', provider: 'claude' } : null
    ),
    archiveWorkspace: vi.fn(async () => {}),
    createWorkspace: vi.fn(async () => ({ id: 'new', name: 'new', branch: 'new' })),
    onArchived: vi.fn(),
  } satisfies WorkspaceControlDeps;
  return { service: new WorkspaceControlService(deps), deps };
}

describe('WorkspaceControlService', () => {
  it('lists workspaces with their pull request state', async () => {
    const { service } = setup([
      workspace({ id: 'a', branch: 'merged-branch' }),
      workspace({ id: 'b', branch: null }),
    ]);

    const result = await service.listWorkspaces({});

    expect(result.map((w) => [w.id, w.pullRequest?.state ?? null])).toEqual([
      ['a', 'merged'],
      ['b', null],
    ]);
  });

  it('archives requested workspaces but never the caller, missing, or already archived ones', async () => {
    const { service, deps } = setup([
      workspace({ id: 'self', name: 'me' }),
      workspace({ id: 'old', name: 'old', projectId: 'p2' }),
      workspace({ id: 'gone', archived: true }),
    ]);
    const caller = { conversationId: 'conv-self' };

    const result = await service.archiveWorkspaces(caller, ['old', 'self', 'gone', 'nope', 'old']);

    expect(result.archived).toEqual(['old']);
    expect(result.skipped).toEqual([
      { id: 'self', reason: 'is the calling workspace' },
      { id: 'gone', reason: 'already archived' },
      { id: 'nope', reason: 'not found' },
    ]);
    expect(deps.archiveWorkspace).toHaveBeenCalledTimes(1);
    expect(deps.archiveWorkspace).toHaveBeenCalledWith('p2', 'old');
    expect(deps.onArchived).toHaveBeenCalledWith(caller, [{ id: 'old', name: 'old' }]);
  });

  it("creates workspaces with the caller's agent unless one is given", async () => {
    const { service, deps } = setup([]);

    await service.createWorkspace({ conversationId: 'conv-self' }, { projectId: 'p1' });
    await service.createWorkspace(
      { conversationId: null },
      { projectId: 'p1', provider: 'codex', prompt: 'go' }
    );

    expect(deps.createWorkspace).toHaveBeenNthCalledWith(1, {
      projectId: 'p1',
      provider: 'claude',
    });
    expect(deps.createWorkspace).toHaveBeenNthCalledWith(2, {
      projectId: 'p1',
      provider: 'codex',
      prompt: 'go',
    });
  });

  it('describes the calling workspace', async () => {
    const { service } = setup([workspace({ id: 'self', name: 'me' })]);

    expect((await service.currentWorkspace({ conversationId: 'conv-self' }))?.name).toBe('me');
    expect(await service.currentWorkspace({ conversationId: null })).toBeNull();
  });
});
