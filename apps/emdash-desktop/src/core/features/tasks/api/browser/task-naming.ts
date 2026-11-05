import { ensureUniqueTaskName, normalizeTaskName } from '@core/features/tasks/api/task-names';

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
