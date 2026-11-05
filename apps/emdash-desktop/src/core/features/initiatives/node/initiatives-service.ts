import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type {
  Initiative,
  InitiativeChange,
  InitiativeMessage,
} from '@core/features/initiatives/api/contract';
import type { AppDb } from '@core/services/app-db/node/db';
import { appDbPokes } from '@core/services/app-db/node/pokes';
import { initiativeMessages, initiatives, tasks } from '@core/services/app-db/node/schema';

type Listener = (change: InitiativeChange) => void;

/**
 * Initiatives: optional groups of tasks across projects, each with a message feed that its
 * tasks' agents (and the user) post to, plus app events about its tasks.
 */
export class InitiativesService {
  private readonly listeners = new Set<Listener>();

  constructor(private readonly db: AppDb) {}

  /** Subscribes to changes; returns the unsubscribe function. */
  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async list(options: { includeArchived?: boolean } = {}): Promise<Initiative[]> {
    const rows = await this.db
      .select()
      .from(initiatives)
      .where(options.includeArchived ? undefined : isNull(initiatives.archivedAt))
      .orderBy(asc(initiatives.createdAt));
    if (rows.length === 0) return [];
    const members = await this.db
      .select({ id: tasks.id, initiativeId: tasks.initiativeId })
      .from(tasks)
      .where(
        and(
          inArray(
            tasks.initiativeId,
            rows.map((row) => row.id)
          ),
          isNull(tasks.deletedAt)
        )
      );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      pushMessages: row.pushMessages === 1,
      archived: row.archivedAt !== null,
      createdAt: row.createdAt,
      taskIds: members.filter((m) => m.initiativeId === row.id).map((m) => m.id),
    }));
  }

  async get(id: string): Promise<Initiative | null> {
    return (await this.list({ includeArchived: true })).find((i) => i.id === id) ?? null;
  }

  async create(name: string): Promise<Initiative> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('An initiative needs a name.');
    const id = crypto.randomUUID();
    await this.db.insert(initiatives).values({ id, name: trimmed });
    this.emit({ type: 'initiatives-changed' });
    return (await this.get(id))!;
  }

  async update(
    id: string,
    changes: { name?: string; pushMessages?: boolean; archived?: boolean }
  ): Promise<void> {
    await this.db
      .update(initiatives)
      .set({
        ...(changes.name?.trim() ? { name: changes.name.trim() } : {}),
        ...(changes.pushMessages !== undefined
          ? { pushMessages: changes.pushMessages ? 1 : 0 }
          : {}),
        ...(changes.archived !== undefined
          ? { archivedAt: changes.archived ? sql`CURRENT_TIMESTAMP` : null }
          : {}),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(initiatives.id, id));
    this.emit({ type: 'initiatives-changed' });
  }

  /** Moves tasks into an initiative, or out of any with `initiativeId: null`. */
  async setTaskInitiative(taskIds: string[], initiativeId: string | null): Promise<void> {
    if (taskIds.length === 0) return;
    if (initiativeId && !(await this.get(initiativeId))) {
      throw new Error(`Initiative '${initiativeId}' was not found.`);
    }
    const rows = await this.db
      .update(tasks)
      .set({ initiativeId })
      .where(inArray(tasks.id, taskIds))
      .returning({ id: tasks.id, projectId: tasks.projectId });
    for (const row of rows) appDbPokes.tasks.poke({ projectId: row.projectId, taskId: row.id });
    this.emit({ type: 'initiatives-changed' });
  }

  async initiativeOfTask(taskId: string): Promise<Initiative | null> {
    const [row] = await this.db
      .select({ initiativeId: tasks.initiativeId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    return row?.initiativeId ? this.get(row.initiativeId) : null;
  }

  async post(input: {
    initiativeId: string;
    fromTaskId: string | null;
    toTaskId?: string | null;
    kind?: 'message' | 'event';
    body: string;
  }): Promise<InitiativeMessage> {
    const body = input.body.trim();
    if (!body) throw new Error('A message needs text.');
    const [row] = await this.db
      .insert(initiativeMessages)
      .values({
        id: crypto.randomUUID(),
        initiativeId: input.initiativeId,
        fromTaskId: input.fromTaskId,
        toTaskId: input.toTaskId ?? null,
        kind: input.kind ?? 'message',
        body,
      })
      .returning();
    const message = toMessage(row!);
    this.emit({ type: 'message-posted', message });
    return message;
  }

  /**
   * Messages of an initiative in posting order, optionally only those a task should see
   * (addressed to it or to everyone, and not sent by it) and only after a given message.
   */
  async messages(input: {
    initiativeId: string;
    forTaskId?: string;
    afterId?: string;
    limit?: number;
  }): Promise<InitiativeMessage[]> {
    // rowid orders by insertion; timestamps can tie within a millisecond.
    const rows = await this.db
      .select()
      .from(initiativeMessages)
      .where(
        and(
          eq(initiativeMessages.initiativeId, input.initiativeId),
          input.afterId
            ? sql`rowid > (SELECT rowid FROM initiative_messages WHERE id = ${input.afterId})`
            : undefined,
          input.forTaskId
            ? and(
                or(
                  isNull(initiativeMessages.toTaskId),
                  eq(initiativeMessages.toTaskId, input.forTaskId)
                ),
                or(
                  isNull(initiativeMessages.fromTaskId),
                  sql`${initiativeMessages.fromTaskId} != ${input.forTaskId}`
                )
              )
            : undefined
        )
      )
      .orderBy(sql`rowid`)
      .limit(input.limit ?? 200);
    return rows.map(toMessage);
  }

  /** Resolves with the first new message for the task, or an empty list after the timeout. */
  waitForMessages(
    input: { initiativeId: string; forTaskId?: string; afterId?: string },
    timeoutMs: number
  ): Promise<InitiativeMessage[]> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (messages: InitiativeMessage[]) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(messages);
      };
      const unsubscribe = this.onChange((change) => {
        if (change.type !== 'message-posted') return;
        const { message } = change;
        if (message.initiativeId !== input.initiativeId) return;
        if (input.forTaskId) {
          if (message.fromTaskId === input.forTaskId) return;
          if (message.toTaskId && message.toTaskId !== input.forTaskId) return;
        }
        void this.messages(input).then(finish);
      });
      const timer = setTimeout(() => finish([]), timeoutMs);
      // Messages posted between the caller's last read and subscribing.
      void this.messages(input).then((existing) => {
        if (existing.length > 0) finish(existing);
      });
    });
  }

  private emit(change: InitiativeChange): void {
    for (const listener of this.listeners) listener(change);
  }
}

function toMessage(row: typeof initiativeMessages.$inferSelect): InitiativeMessage {
  return {
    id: row.id,
    initiativeId: row.initiativeId,
    fromTaskId: row.fromTaskId,
    toTaskId: row.toTaskId,
    kind: row.kind,
    body: row.body,
    createdAt: row.createdAt,
  };
}
