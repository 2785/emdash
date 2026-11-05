import { Button, DropdownMenu } from '@emdash/ui/react/primitives';
import { MessagesSquare, MoreHorizontal } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { getInitiativesClient } from '@core/features/initiatives/api/browser/client';
import { getInitiativesStore } from '@core/features/initiatives/api/browser/initiatives-store';
import { useOpenModal } from '@core/manifests/browser/modal-api';

/** Header of an initiative group in the sidebar; "Other" (null) has no actions. */
export const SidebarInitiativeHeader = observer(function SidebarInitiativeHeader({
  initiativeId,
  label,
  count,
}: {
  initiativeId: string | null;
  label: string;
  count: number;
}) {
  const openFeed = useOpenModal('initiativeFeedModal');
  const initiative = initiativeId ? getInitiativesStore().byId.get(initiativeId) : undefined;

  return (
    <div className="group/initiative flex h-8 items-center justify-between gap-1 pt-1 pr-2 pl-3">
      <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground-secondary">
        <span className="truncate">{label}</span>
        <span className="text-xs font-normal text-foreground-tertiary-passive">{count}</span>
      </div>
      {initiativeId && (
        <div className="flex items-center opacity-0 group-hover/initiative:opacity-100">
          <Button
            variant="ghost"
            size="xs"
            icon
            aria-label={`Open ${label} feed`}
            onClick={() => void openFeed({ initiativeId })}
          >
            <MessagesSquare />
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              render={
                <Button variant="ghost" size="xs" icon aria-label={`${label} options`}>
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenu.Content className="min-w-48">
              <DropdownMenu.Item onClick={() => void openFeed({ initiativeId })}>
                Open feed
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  void getInitiativesClient().then((client) =>
                    client.update({ id: initiativeId, pushMessages: !initiative?.pushMessages })
                  )
                }
              >
                {initiative?.pushMessages
                  ? 'Stop delivering messages'
                  : 'Deliver messages to chats'}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => {
                  const name = window.prompt('Rename initiative', label);
                  if (name?.trim()) {
                    void getInitiativesClient().then((client) =>
                      client.update({ id: initiativeId, name })
                    );
                  }
                }}
              >
                Rename
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  void getInitiativesClient().then((client) =>
                    client.update({ id: initiativeId, archived: true })
                  )
                }
              >
                Archive initiative
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      )}
    </div>
  );
});
