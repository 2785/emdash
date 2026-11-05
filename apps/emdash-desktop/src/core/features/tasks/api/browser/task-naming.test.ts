import { describe, expect, it, vi } from 'vitest';
import { autoTaskName, isRandomTaskName } from './task-naming';

vi.mock('@core/primitives/mementos/browser', () => ({ getMementoClient: vi.fn() }));

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
  it('turns a conversation title into a task name', () => {
    expect(
      autoTaskName({
        title: 'Emdash personal port exploration',
        currentName: 'wicked-items-smile',
        siblingNames: [],
      })
    ).toBe('emdash-personal-port-exploration');
  });

  it('keeps capitalisation when the setting asks for it', () => {
    expect(
      autoTaskName({
        title: 'Xero Client ID',
        currentName: 'wicked-items-smile',
        siblingNames: [],
        preserveCapitalization: true,
      })
    ).toBe('Xero-Client-ID');
  });

  it('suffixes a name another task already uses', () => {
    const name = autoTaskName({
      title: 'Model identification',
      currentName: 'tired-seals-bake',
      siblingNames: ['model-identification'],
    });
    expect(name).not.toBe('model-identification');
    expect(name?.startsWith('model-identification')).toBe(true);
  });

  it('leaves the task alone when nothing would change or the title has no usable text', () => {
    expect(
      autoTaskName({
        title: 'Model identification',
        currentName: 'model-identification',
        siblingNames: [],
      })
    ).toBeNull();
    expect(
      autoTaskName({ title: '???', currentName: 'wicked-items-smile', siblingNames: [] })
    ).toBeNull();
  });
});
