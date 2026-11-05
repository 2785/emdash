import { Button, DropdownMenu, MicroLabel, Tooltip } from '@emdash/ui/react/primitives';
import { FolderPlus, ListFilter } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { getSidebarStore } from '@core/features/workbench/contributions/browser/app-stores';
import { useOpenModal } from '@core/manifests/browser/modal-api';
import { BoundShortcut } from '@core/primitives/keybindings/browser/shortcut';
import { NewTaskButton } from './new-task-button';

export const ProjectsGroupLabel = observer(function ProjectsGroupLabel() {
  const openAddProjectModal = useOpenModal('addProjectModal');

  return (
    <div className="flex h-[40px] items-center justify-between pr-2.5 pl-5">
      <MicroLabel className="font-medium text-foreground-tertiary-passive">
        {getSidebarStore().groupBy === 'project' ? 'Projects' : 'Tasks'}
      </MicroLabel>
      <div className="flex items-center gap-1">
        {/* Without project rows there is no per-project "+", so offer one here. */}
        {getSidebarStore().groupBy !== 'project' && <NewTaskButton />}
        <DropdownMenu.Root>
          <Tooltip.Root>
            <DropdownMenu.Trigger
              render={
                <Tooltip.Trigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      icon
                      aria-label="Sort and group tasks"
                    >
                      <ListFilter />
                    </Button>
                  }
                />
              }
            />
            <Tooltip.Content>Sort and group</Tooltip.Content>
          </Tooltip.Root>
          <DropdownMenu.Content className="min-w-48">
            <DropdownMenu.Group>
              <DropdownMenu.Label>Sort by</DropdownMenu.Label>
              <DropdownMenu.RadioGroup value={getSidebarStore().taskSortBy}>
                <DropdownMenu.RadioItem
                  value="created-at"
                  onClick={() => getSidebarStore().applySort('created-at')}
                >
                  Created at
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem
                  value="updated-at"
                  onClick={() => getSidebarStore().applySort('updated-at')}
                >
                  Last used
                </DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.Label>Group by</DropdownMenu.Label>
              <DropdownMenu.RadioGroup value={getSidebarStore().groupBy}>
                <DropdownMenu.RadioItem
                  value="project"
                  onClick={() => getSidebarStore().setGroupBy('project')}
                >
                  Project
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem
                  value="initiative"
                  onClick={() => getSidebarStore().setGroupBy('initiative')}
                >
                  Initiative
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem
                  value="none"
                  onClick={() => getSidebarStore().setGroupBy('none')}
                >
                  None
                </DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                icon
                onClick={() => void openAddProjectModal({})}
                aria-label="Add Project"
              >
                <FolderPlus />
              </Button>
            }
          />
          <Tooltip.Content>
            Add Project
            <BoundShortcut command="app.newProject" variant="keycaps" />
          </Tooltip.Content>
        </Tooltip.Root>
      </div>
    </div>
  );
});
