import { Button, Dialog, Input, toast } from '@emdash/ui/react/primitives';
import { Check, Plus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { getInitiativesClient } from '@core/features/initiatives/api/browser/client';
import { getInitiativesStore } from '@core/features/initiatives/api/browser/initiatives-store';
import { useModalController } from '@core/manifests/browser/modal-api';
import { defineModal } from '@core/primitives/modals/react';

export type InitiativePickerModalArgs = {
  taskIds: string[];
  currentInitiativeId?: string;
};

/** Moves tasks into an existing or new initiative, or out of theirs. */
export const InitiativePickerModal = observer(function InitiativePickerModal({
  taskIds,
  currentInitiativeId,
}: InitiativePickerModalArgs) {
  const controller = useModalController('initiativePickerModal');
  const { initiatives } = getInitiativesStore();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      controller.complete(undefined);
    } catch (error) {
      toast.error('Could not update the initiative', {
        description: error instanceof Error ? error.message : String(error),
      });
      setBusy(false);
    }
  };
  const moveTo = (initiativeId: string | null) =>
    run(async () => {
      await (await getInitiativesClient()).setTaskInitiative({ taskIds, initiativeId });
    });
  const createAndMove = () =>
    run(async () => {
      const client = await getInitiativesClient();
      const created = await client.create({ name });
      await client.setTaskInitiative({ taskIds, initiativeId: created.id });
    });

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Initiative</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body className="flex flex-col gap-3 pt-0 text-sm">
        <p className="text-foreground-muted">
          Group work spanning projects, e.g. one change needing pull requests in several
          repositories. Workspaces in an initiative can message each other.
        </p>
        {initiatives.length > 0 && (
          <div className="flex flex-col gap-1">
            {initiatives.map((initiative) => (
              <Button
                key={initiative.id}
                variant="ghost"
                className="justify-between"
                disabled={busy || initiative.id === currentInitiativeId}
                onClick={() => void moveTo(initiative.id)}
              >
                <span className="truncate">{initiative.name}</span>
                {initiative.id === currentInitiativeId ? (
                  <Check className="size-4" />
                ) : (
                  <span className="text-xs text-foreground-passive">
                    {initiative.taskIds.length}
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) void createAndMove();
          }}
        >
          <Input
            value={name}
            placeholder="New initiative name"
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
          />
          <Button type="submit" variant="secondary" disabled={busy || !name.trim()}>
            <Plus className="size-4" />
            Create
          </Button>
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        {currentInitiativeId && (
          <Button variant="secondary" disabled={busy} onClick={() => void moveTo(null)}>
            Remove from initiative
          </Button>
        )}
        <Button variant="ghost" onClick={controller.dismiss}>
          Close
        </Button>
      </Dialog.Footer>
    </>
  );
});

export const initiativePickerModal = defineModal<void>()({
  id: 'initiativePickerModal',
  component: InitiativePickerModal,
  size: 'sm',
});
