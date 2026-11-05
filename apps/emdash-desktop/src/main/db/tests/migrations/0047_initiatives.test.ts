import { openFixture } from '@tooling/utils/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * 0047 adds initiatives (optional cross-project task groups) and their message feed. Additive:
 * existing tasks belong to no initiative.
 */
describe('0047 initiatives', () => {
  let fixture: Awaited<ReturnType<typeof openFixture>>;

  beforeEach(async () => {
    fixture = await openFixture('baseline');
  });

  afterEach(() => {
    fixture?.close();
  });

  it('leaves existing tasks outside any initiative', () => {
    const counts = fixture.sqlite
      .prepare(`SELECT COUNT(*) AS total, COUNT(initiative_id) AS grouped FROM tasks`)
      .get() as { total: number; grouped: number };
    expect(counts.total).toBeGreaterThan(0);
    expect(counts.grouped).toBe(0);
  });

  it('stores initiatives and messages, and drops messages with their initiative', () => {
    fixture.sqlite.prepare(`INSERT INTO initiatives (id, name) VALUES ('i1', 'Accounts v2')`).run();
    fixture.sqlite
      .prepare(
        `INSERT INTO initiative_messages (id, initiative_id, kind, body)
         VALUES ('m1', 'i1', 'message', 'API contract changed')`
      )
      .run();

    const initiative = fixture.sqlite
      .prepare(`SELECT push_messages, archived_at FROM initiatives WHERE id = 'i1'`)
      .get();
    expect(initiative).toEqual({ push_messages: 0, archived_at: null });
    const message = fixture.sqlite
      .prepare(`SELECT created_at FROM initiative_messages WHERE id = 'm1'`)
      .get() as { created_at: string };
    expect(message.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    fixture.sqlite.pragma('foreign_keys = ON');
    fixture.sqlite.prepare(`DELETE FROM initiatives WHERE id = 'i1'`).run();
    expect(fixture.sqlite.prepare(`SELECT COUNT(*) AS n FROM initiative_messages`).get()).toEqual({
      n: 0,
    });
  });
});
