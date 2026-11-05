import { getProjectManagerStore } from '@core/features/projects/api/browser/stores/project-selectors';
import { getTaskManagerStore } from '@core/features/tasks/api/browser/task-state/task-selectors';

/** A task's display name and project by id, searching every open project. */
export function findTask(taskId: string): { name: string; projectId: string } | undefined {
  for (const projectId of getProjectManagerStore().projects.keys()) {
    const task = getTaskManagerStore(projectId)?.tasks.get(taskId);
    if (task) return { name: task.data.name, projectId };
  }
  return undefined;
}
