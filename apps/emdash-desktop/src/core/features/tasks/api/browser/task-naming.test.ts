import { describe, expect, it } from 'vitest';
import { isRandomTaskName } from '@core/features/tasks/api/task-names';
import { autoTaskName } from './task-naming';

describe('isRandomTaskName', () => {
  it("recognises Emdash's random placeholder names", () => {
    expect(isRandomTaskName('wicked-items-smile')).toBe(true);
    expect(isRandomTaskName('gentle-sloths-punch')).toBe(true);
  });

  it('rejects names a user or issue would produce', () => {
    expect(isRandomTaskName('fix-login-bug')).toBe(false);
    expect(isRandomTaskName('KRAK-1029-sftp-directory-filtering')).toBe(false);
    expect(isRandomTaskName('wicked-items-smile-again')).toBe(false);
    expect(isRandomTaskName('wicked-items')).toBe(false);
  });
});

describe('autoTaskName', () => {
  const name = (title: string, currentName: string, siblingNames: string[] = []) =>
    autoTaskName({ title, currentName, siblingNames });

  it('replaces the placeholder with the title as written', () => {
    expect(
      name('Synctera tenant 1_1 AR/AP internal accounts and bank assignment', 'gentle-sloths-punch')
    ).toBe('Synctera tenant 1_1 AR/AP internal accounts and bank assignment');
  });

  it('upgrades the branch-style form of the same title that earlier versions gave', () => {
    expect(name('Xero Client ID', 'xero-client-id')).toBe('Xero Client ID');
    expect(name('Synctera tenant 1_1 AR/AP', 'synctera-tenant-11-arap')).toBe(
      'Synctera tenant 1_1 AR/AP'
    );
  });

  it('keeps any other name', () => {
    expect(name('Column drop migration ordering', 'remove-sandbox-access-expiry')).toBeNull();
    expect(name('Column drop migration ordering', 'My own name')).toBeNull();
  });

  it('suffixes a name another task already uses', () => {
    expect(name('Model identification', 'tired-seals-bake', ['model-identification'])).toBe(
      'Model identification 2'
    );
  });

  it('leaves the task alone when nothing would change or the title has no usable text', () => {
    expect(name('Model identification', 'Model identification')).toBeNull();
    expect(name('???', 'wicked-items-smile')).toBeNull();
  });
});
