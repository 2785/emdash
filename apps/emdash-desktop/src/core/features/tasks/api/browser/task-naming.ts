import {
  ensureUniqueTaskDisplayName,
  isRandomTaskName,
  taskNameCollisionKey,
} from '@core/features/tasks/api/task-names';

/**
 * The name a task should take from its conversation's title, or null to leave it alone. Only
 * replaces the generated placeholder, or the branch-style form of this same title
 * ("synctera-tenant-11-arap" for "Synctera tenant 1_1 AR/AP"), which earlier versions gave.
 * Collisions with sibling tasks get a suffix rather than blocking the rename.
 */
export function autoTaskName(params: {
  title: string;
  currentName: string;
  siblingNames: Iterable<string>;
}): string | null {
  const { title, currentName } = params;
  const replaceable =
    isRandomTaskName(currentName) ||
    taskNameCollisionKey(currentName) === taskNameCollisionKey(title);
  if (!replaceable) return null;
  const name = ensureUniqueTaskDisplayName(title, params.siblingNames);
  return name && name !== currentName ? name : null;
}
