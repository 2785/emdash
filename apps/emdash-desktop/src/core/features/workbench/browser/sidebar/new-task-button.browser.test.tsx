import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewTaskButton } from './new-task-button';

const mocks = vi.hoisted(() => ({ openTaskModal: vi.fn() }));

const projects = vi.hoisted(() => [
  { id: 'p-web', name: 'web', data: { type: 'local' }, state: 'ready' },
  { id: 'p-api', name: 'api', data: { type: 'ssh' }, state: 'ready' },
  { id: 'p-offline', name: 'warehouse', data: { type: 'ssh' }, state: 'ready' },
  { id: 'p-new', name: 'cloning', data: null, state: 'unregistered' },
]);

vi.mock('@core/features/workbench/contributions/browser/app-stores', () => ({
  getSidebarStore: () => ({ orderedProjects: projects }),
}));

vi.mock('@core/features/projects/api/browser/stores/project', () => ({
  isUnregisteredProject: (project: { state: string }) => project.state === 'unregistered',
}));

vi.mock('@core/features/tasks/api/browser/task-state/task-selectors', () => ({
  taskHostActionAvailability: (projectId: string) => ({
    kind: projectId === 'p-offline' ? 'disabled' : 'enabled',
  }),
}));

vi.mock('@core/manifests/browser/modal-api', () => ({
  useOpenModal: () => mocks.openTaskModal,
}));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('NewTaskButton', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.openTaskModal.mockReset();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<NewTaskButton />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  async function openPicker() {
    await act(async () => {
      (host.querySelector('[aria-label="New Task"]') as HTMLButtonElement).click();
    });
    return document.querySelector('[aria-label="Project for the new task"]') as HTMLInputElement;
  }

  const options = () =>
    [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent);

  function type(input: HTMLInputElement, value: string) {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setValue.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function press(input: HTMLInputElement, key: string) {
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });
  }

  it('lists only projects a task can be created in', async () => {
    await openPicker();
    expect(options()).toEqual(['web', 'api']);
  });

  it('opens the task modal for the project picked by name and Enter', async () => {
    const input = await openPicker();
    type(input, 'AP');
    expect(options()).toEqual(['api']);
    press(input, 'Enter');
    expect(mocks.openTaskModal).toHaveBeenCalledWith({ projectId: 'p-api' });
  });

  it('moves through projects with the arrow keys', async () => {
    const input = await openPicker();
    press(input, 'ArrowDown');
    press(input, 'Enter');
    expect(mocks.openTaskModal).toHaveBeenCalledWith({ projectId: 'p-api' });
  });

  it('opens the task modal for a clicked project', async () => {
    await openPicker();
    act(() => {
      (document.querySelectorAll('[role="option"]')[0] as HTMLButtonElement).click();
    });
    expect(mocks.openTaskModal).toHaveBeenCalledWith({ projectId: 'p-web' });
  });
});
