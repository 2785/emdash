import { describe, expect, it, vi } from 'vitest';
import type { PersonalUpdateResult } from './personal-update';
import { runPersonalUpdateCheck, type PersonalUpdateCheckDeps } from './personal-update-check';

function setup(outcome: PersonalUpdateResult | Error, clicked = 1) {
  const deps = {
    productName: 'Emjosh',
    check: vi.fn(async ({ onDownloading }: { onDownloading(version: string): void }) => {
      if (outcome instanceof Error) throw outcome;
      if (outcome.status === 'staged') onDownloading(outcome.version);
      return outcome;
    }),
    showMessage: vi.fn(async () => clicked),
    notify: vi.fn(),
    reload: vi.fn(),
  } satisfies PersonalUpdateCheckDeps;
  return deps;
}

describe('runPersonalUpdateCheck', () => {
  it('says when the app is up to date', async () => {
    const deps = setup({ status: 'up-to-date', current: '0.1.1' });
    await runPersonalUpdateCheck(deps);
    expect(deps.showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "You're up to date",
        detail: 'Emjosh 0.1.1 is the latest version.',
      })
    );
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('notifies while downloading, then offers to reload', async () => {
    const deps = setup({ status: 'staged', version: '0.1.2' }, 0);
    await runPersonalUpdateCheck(deps);
    expect(deps.notify).toHaveBeenCalledWith(
      'Downloading Emjosh 0.1.2',
      expect.stringContaining('reload')
    );
    expect(deps.showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Emjosh 0.1.2 is ready',
        buttons: ['Reload Now', 'Later'],
      })
    );
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('leaves an already downloaded release for later when asked', async () => {
    const deps = setup({ status: 'already-staged', version: '0.1.2' }, 1);
    await runPersonalUpdateCheck(deps);
    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('reports failures and builds that cannot update', async () => {
    const failed = setup(new Error('Release manifest request failed: 503'));
    await runPersonalUpdateCheck(failed);
    expect(failed.showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        detail: 'Release manifest request failed: 503',
      })
    );

    const disabled = setup({ status: 'disabled' });
    await runPersonalUpdateCheck(disabled);
    expect(disabled.showMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Updates are not available in this build' })
    );
  });
});
