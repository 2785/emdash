import { openFixture } from '@tooling/utils/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projects, tasks } from '@core/services/app-db/node/schema';
import { InitiativesService } from './initiatives-service';

describe('InitiativesService', () => {
  let fixture: Awaited<ReturnType<typeof openFixture>>;
  let service: InitiativesService;

  beforeEach(async () => {
    fixture = await openFixture('empty');
    fixture.db.insert(projects).values({ id: 'p1', name: 'api' }).run();
    fixture.db.insert(projects).values({ id: 'p2', name: 'web' }).run();
    for (const [id, projectId] of [
      ['t1', 'p1'],
      ['t2', 'p2'],
      ['t3', 'p2'],
    ] as const) {
      fixture.db.insert(tasks).values({ id, projectId, name: id, status: 'in_progress' }).run();
    }
    service = new InitiativesService(fixture.db as never);
  });

  afterEach(() => fixture?.close());

  it('groups tasks across projects and lets them leave again', async () => {
    const initiative = await service.create('  Accounts v2 ');
    await service.setTaskInitiative(['t1', 't2'], initiative.id);

    expect(await service.list()).toEqual([
      expect.objectContaining({ name: 'Accounts v2', pushMessages: false, taskIds: ['t1', 't2'] }),
    ]);
    expect((await service.initiativeOfTask('t2'))?.id).toBe(initiative.id);

    await service.setTaskInitiative(['t2'], null);
    expect((await service.get(initiative.id))?.taskIds).toEqual(['t1']);
    expect(await service.initiativeOfTask('t2')).toBeNull();
  });

  it('archives and configures initiatives', async () => {
    const initiative = await service.create('Accounts v2');

    await service.update(initiative.id, { pushMessages: true, name: 'Accounts v3' });
    expect(await service.get(initiative.id)).toMatchObject({
      name: 'Accounts v3',
      pushMessages: true,
    });
    await service.update(initiative.id, { archived: true });
    expect(await service.list()).toEqual([]);
    expect(await service.list({ includeArchived: true })).toHaveLength(1);
  });

  it('shows a task the messages meant for it: to it or everyone, not its own', async () => {
    const { id } = await service.create('Accounts v2');
    await service.post({ initiativeId: id, fromTaskId: 't1', body: 'from t1 to all' });
    await service.post({ initiativeId: id, fromTaskId: 't1', toTaskId: 't2', body: 'to t2' });
    await service.post({ initiativeId: id, fromTaskId: 't2', toTaskId: 't3', body: 'to t3' });
    await service.post({ initiativeId: id, fromTaskId: null, kind: 'event', body: 'user note' });

    const forT2 = await service.messages({ initiativeId: id, forTaskId: 't2' });
    expect(forT2.map((m) => m.body)).toEqual(['from t1 to all', 'to t2', 'user note']);
    expect((await service.messages({ initiativeId: id })).map((m) => m.body)).toHaveLength(4);
    const afterFirst = await service.messages({
      initiativeId: id,
      forTaskId: 't2',
      afterId: forT2[0]!.id,
    });
    expect(afterFirst.map((m) => m.body)).toEqual(['to t2', 'user note']);
  });

  it('wakes a waiting task when a message for it arrives, and times out otherwise', async () => {
    const { id } = await service.create('Accounts v2');

    const waiting = service.waitForMessages({ initiativeId: id, forTaskId: 't2' }, 2_000);
    await service.post({ initiativeId: id, fromTaskId: 't2', body: 'own message' });
    await service.post({ initiativeId: id, fromTaskId: 't1', toTaskId: 't3', body: 'for t3' });
    await service.post({ initiativeId: id, fromTaskId: 't1', toTaskId: 't2', body: 'for t2' });

    expect((await waiting).map((m) => m.body)).toEqual(['for t2']);
    expect(
      await service.waitForMessages(
        { initiativeId: id, forTaskId: 't3', afterId: (await waiting)[0]!.id },
        50
      )
    ).toEqual([]);
  });
});
