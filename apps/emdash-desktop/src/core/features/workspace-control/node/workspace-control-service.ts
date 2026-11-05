/**
 * Workspace control: what an agent (inside Emjosh today, any MCP client later) can do with
 * Emjosh's projects and workspaces. Transport-agnostic; the MCP endpoint is one adapter.
 * "Workspace" here is a task: a branch/worktree plus its conversations.
 */

export type ControlProject = { id: string; name: string; path: string };

export type ControlPullRequest = {
  url: string;
  number?: number;
  title: string;
  state: 'open' | 'merged' | 'closed' | 'draft';
};

export type ControlWorkspace = {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  branch: string | null;
  archived: boolean;
  agentStatus: string | null;
  lastActivityAt: string | null;
  pullRequest: ControlPullRequest | null;
};

export type CreateWorkspaceInput = {
  projectId: string;
  name?: string;
  baseBranch?: string;
  prompt?: string;
  /** Agent for the first conversation; defaults to the calling workspace's agent. */
  provider?: string;
};

/** Who is calling: the conversation an Emjosh agent runs in, or an external client. */
export type ControlCaller = { conversationId: string | null };

export type WorkspaceControlDeps = {
  listProjects(): Promise<ControlProject[]>;
  listWorkspaces(filter: {
    projectId?: string;
    includeArchived: boolean;
  }): Promise<Omit<ControlWorkspace, 'pullRequest'>[]>;
  pullRequestForBranch(projectId: string, branch: string): Promise<ControlPullRequest | null>;
  callerContext(conversationId: string): Promise<{ taskId: string; provider: string } | null>;
  archiveWorkspace(projectId: string, taskId: string): Promise<void>;
  createWorkspace(
    input: CreateWorkspaceInput & { provider: string | undefined }
  ): Promise<{ id: string; name: string; branch: string | null }>;
  onArchived?(caller: ControlCaller, workspaces: { id: string; name: string }[]): void;
};

export class WorkspaceControlService {
  constructor(private readonly deps: WorkspaceControlDeps) {}

  listProjects(): Promise<ControlProject[]> {
    return this.deps.listProjects();
  }

  async listWorkspaces(filter: {
    projectId?: string;
    includeArchived?: boolean;
  }): Promise<ControlWorkspace[]> {
    const rows = await this.deps.listWorkspaces({
      projectId: filter.projectId,
      includeArchived: filter.includeArchived ?? false,
    });
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        pullRequest: row.branch
          ? await this.deps.pullRequestForBranch(row.projectId, row.branch).catch(() => null)
          : null,
      }))
    );
  }

  async currentWorkspace(caller: ControlCaller): Promise<ControlWorkspace | null> {
    const context = caller.conversationId
      ? await this.deps.callerContext(caller.conversationId)
      : null;
    if (!context) return null;
    const all = await this.listWorkspaces({ includeArchived: true });
    return all.find((workspace) => workspace.id === context.taskId) ?? null;
  }

  /** Archives workspaces (reversible); never the caller's own. */
  async archiveWorkspaces(
    caller: ControlCaller,
    workspaceIds: string[]
  ): Promise<{ archived: string[]; skipped: { id: string; reason: string }[] }> {
    const context = caller.conversationId
      ? await this.deps.callerContext(caller.conversationId)
      : null;
    const byId = new Map(
      (await this.deps.listWorkspaces({ includeArchived: true })).map((w) => [w.id, w])
    );
    const archived: { id: string; name: string }[] = [];
    const skipped: { id: string; reason: string }[] = [];
    for (const id of new Set(workspaceIds)) {
      const workspace = byId.get(id);
      if (!workspace) skipped.push({ id, reason: 'not found' });
      else if (id === context?.taskId) skipped.push({ id, reason: 'is the calling workspace' });
      else if (workspace.archived) skipped.push({ id, reason: 'already archived' });
      else {
        await this.deps.archiveWorkspace(workspace.projectId, id);
        archived.push({ id, name: workspace.name });
      }
    }
    if (archived.length > 0) this.deps.onArchived?.(caller, archived);
    return { archived: archived.map((workspace) => workspace.id), skipped };
  }

  async createWorkspace(caller: ControlCaller, input: CreateWorkspaceInput) {
    const context = caller.conversationId
      ? await this.deps.callerContext(caller.conversationId)
      : null;
    return this.deps.createWorkspace({ ...input, provider: input.provider ?? context?.provider });
  }
}
