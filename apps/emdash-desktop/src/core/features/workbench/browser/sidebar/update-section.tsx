import { Button, MicroLabel } from '@emdash/ui/react/primitives';
import { RotateCw } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { settingsViewDef } from '@core/features/settings/contributions/views';
import { getUpdateStore } from '@core/features/updates/contributions/app-stores';
import { useNavigate } from '@core/primitives/navigation/browser/navigation-hooks';

export const UpdateSection = observer(function UpdateSection() {
  const update = getUpdateStore();
  const { navigate } = useNavigate();

  if (update.personalBuild.enabled) return <PersonalReloadButton update={update} />;

  if (update.hasUpdate) {
    return (
      <Button
        variant="secondary"
        size="xs"
        onClick={() => {
          navigate(settingsViewDef({ tab: 'general' }));
          if (update.state.status === 'available') {
            void update.download();
          }
        }}
      >
        Update
      </Button>
    );
  }

  return (
    <MicroLabel className="inline-flex h-6 items-center text-foreground-passive lowercase">
      v{update.currentVersion}
    </MicroLabel>
  );
});

const PersonalReloadButton = observer(function PersonalReloadButton({
  update,
}: {
  update: ReturnType<typeof getUpdateStore>;
}) {
  const { staged } = update.personalBuild;
  const title = staged
    ? `Quit and reopen on the new build (${[
        staged.commit,
        `built ${new Date(staged.builtAt).toLocaleTimeString()}`,
      ]
        .filter(Boolean)
        .join(', ')})`
    : 'Quit and reopen';

  return (
    <Button
      variant={staged ? 'primary' : 'ghost'}
      size="xs"
      title={title}
      disabled={update.reloading}
      onClick={() => void update.reloadPersonalBuild()}
    >
      <RotateCw className="size-3" />
      {staged ? 'Reload · new build' : 'Reload'}
    </Button>
  );
});
