import { describe, expect, it } from 'vitest';
import {
  ensureUniqueTaskDisplayName,
  ensureUniqueTaskName,
  formatTaskDisplayName,
  MAX_TASK_NAME_LENGTH,
  liveTransformTaskName,
  normalizeTaskName,
  taskNameCollisionKey,
} from './task-names';

describe('taskNames', () => {
  it('lowercases task names by default when transforming task names', () => {
    expect(liveTransformTaskName('feature PROJ-123')).toBe('feature-proj-123');
  });

  it('lowercases task names by default when normalizing task names', () => {
    expect(normalizeTaskName('  feature PROJ-123  ')).toBe('feature-proj-123');
  });

  it('preserves capital letters when configured', () => {
    expect(liveTransformTaskName('feature PROJ-123', { preserveCapitalization: true })).toBe(
      'feature-PROJ-123'
    );
    expect(normalizeTaskName('  feature PROJ-123  ', { preserveCapitalization: true })).toBe(
      'feature-PROJ-123'
    );
  });

  it('normalizes task names to a case-insensitive collision key', () => {
    expect(taskNameCollisionKey('  feature PROJ-123  ')).toBe('feature-proj-123');
  });

  it('keeps generated unique task names distinct case-insensitively', () => {
    expect(ensureUniqueTaskName('Feature-PROJ-123', ['feature-proj-123'])).toBe(
      'feature-proj-123-2'
    );
  });

  it('keeps generated unique task names capitalized when configured', () => {
    expect(
      ensureUniqueTaskName('Feature-PROJ-123', ['feature-proj-123'], 6, {
        preserveCapitalization: true,
      })
    ).toBe('Feature-PROJ-123-2');
  });
});

describe('task display names', () => {
  it('keeps the name as written, tidying whitespace and length', () => {
    expect(formatTaskDisplayName('  Synctera tenant 1_1\tAR/AP  ')).toBe(
      'Synctera tenant 1_1 AR/AP'
    );
    expect(formatTaskDisplayName('x'.repeat(100))).toHaveLength(MAX_TASK_NAME_LENGTH);
  });

  it('suffixes collisions, compared like branch names', () => {
    expect(ensureUniqueTaskDisplayName('Fix login', ['fix-login', 'Fix login 2'])).toBe(
      'Fix login 3'
    );
    expect(ensureUniqueTaskDisplayName('Fix login', ['other'])).toBe('Fix login');
    expect(ensureUniqueTaskDisplayName('???', [])).toBe('');
  });
});
