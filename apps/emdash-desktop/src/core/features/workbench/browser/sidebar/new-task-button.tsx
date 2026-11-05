import { Button, Popover, SearchInput, Tooltip } from '@emdash/ui/react/primitives';
import { FolderClosed, FolderInput, Plus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { isUnregisteredProject } from '@core/features/projects/api/browser/stores/project';
import { taskHostActionAvailability } from '@core/features/tasks/api/browser/task-state/task-selectors';
import { getSidebarStore } from '@core/features/workbench/contributions/browser/app-stores';
import { useOpenModal } from '@core/manifests/browser/modal-api';
import { cn } from '@core/primitives/styling/browser/cn';

/** Projects a task can be created in, in sidebar order, filtered by name. */
function creatableProjects(query: string) {
  const needle = query.trim().toLowerCase();
  return getSidebarStore()
    .orderedProjects.filter(
      (project) =>
        !isUnregisteredProject(project) &&
        taskHostActionAvailability(project.id).kind === 'enabled' &&
        (project.name ?? '').toLowerCase().includes(needle)
    )
    .map((project) => ({
      id: project.id,
      name: project.name ?? 'project',
      remote: project.data?.type === 'ssh',
    }));
}

/**
 * "New task" for sidebar modes without project rows: pick the project first, then the usual
 * create-task modal opens for it.
 */
export const NewTaskButton = observer(function NewTaskButton() {
  const openCreateTaskModal = useOpenModal('taskModal');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const projects = open ? creatableProjects(query) : [];
  const active = Math.min(highlighted, Math.max(0, projects.length - 1));

  const pick = (projectId: string) => {
    setOpen(false);
    void openCreateTaskModal({ projectId });
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery('');
        setHighlighted(0);
      }}
    >
      <Tooltip.Root>
        <Popover.Trigger
          render={
            <Tooltip.Trigger
              render={
                <Button type="button" variant="ghost" size="xs" icon aria-label="New Task">
                  <Plus />
                </Button>
              }
            />
          }
        />
        <Tooltip.Content>New Task</Tooltip.Content>
      </Tooltip.Root>
      <Popover.Content align="end" className="flex w-64 flex-col gap-1 p-1">
        <SearchInput
          autoFocus
          size="sm"
          placeholder="New task in…"
          aria-label="Project for the new task"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setHighlighted((active + step + projects.length) % Math.max(1, projects.length));
            } else if (event.key === 'Enter' && projects[active]) {
              event.preventDefault();
              pick(projects[active].id);
            }
          }}
        />
        <div role="listbox" aria-label="Projects" className="max-h-72 overflow-y-auto">
          {projects.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-foreground-muted">No matching projects</div>
          )}
          {projects.map((project, index) => {
            const Icon = project.remote ? FolderInput : FolderClosed;
            return (
              <button
                key={project.id}
                type="button"
                role="option"
                aria-selected={index === active}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm',
                  index === active && 'bg-surface-hover'
                )}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => pick(project.id)}
              >
                <Icon className="size-4 shrink-0 text-foreground-muted" />
                <span className="truncate">{project.name}</span>
              </button>
            );
          })}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
});
