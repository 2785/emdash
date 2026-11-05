import {
  ensureUniqueTaskName,
  isRandomTaskName,
  normalizeTaskName,
} from '@core/features/tasks/api/task-names';
import { taskNamingMemento } from '@core/features/tasks/contributions/mementos';
import { taskSubject } from '@core/features/tasks/contributions/subject';
import { getMementoClient } from '@core/primitives/mementos/browser';

function namingHandle(taskId: string) {
  return getMementoClient().subject(taskSubject({ taskId })).handle(taskNamingMemento);
}

/** Records a name Emdash assigned, so the task may keep following its conversation title. */
export function recordAutoTaskName(taskId: string, name: string): void {
  namingHandle(taskId).update((current) => ({ ...current, autoName: name }));
}

/**
 * Whether the task's current name was assigned automatically. Without a record, only random
 * placeholder names qualify, so a name the user chose is never replaced.
 */
export async function hasAutoTaskName(taskId: string, currentName: string): Promise<boolean> {
  const handle = namingHandle(taskId);
  await handle.ready;
  const recorded = handle.value.autoName;
  return recorded !== undefined ? recorded === currentName : isRandomTaskName(currentName);
}

/**
 * The name a task should take from its conversation's title, or null to leave it alone.
 * Collisions with sibling tasks get a suffix rather than blocking the rename.
 */
export function autoTaskName(params: {
  title: string;
  currentName: string;
  siblingNames: Iterable<string>;
  preserveCapitalization?: boolean;
}): string | null {
  const options = { preserveCapitalization: params.preserveCapitalization };
  if (!normalizeTaskName(params.title, options)) return null;
  const name = ensureUniqueTaskName(params.title, params.siblingNames, 6, options);
  return name && name !== params.currentName ? name : null;
}
