import type { PersonalUpdateResult } from './personal-update';

export type PersonalUpdateCheckDeps = {
  productName: string;
  check(options: { onDownloading(version: string): void }): Promise<PersonalUpdateResult>;
  /** Shows a dialog; resolves with the index of the clicked button. */
  showMessage(message: {
    type: 'info' | 'error';
    message: string;
    detail?: string;
    buttons: string[];
  }): Promise<number>;
  /** A passing notification that doesn't block. */
  notify(title: string, body: string): void;
  reload(): void;
};

/** "Check for Updates…": checks now and reports the outcome, offering Reload when ready. */
export async function runPersonalUpdateCheck(deps: PersonalUpdateCheckDeps): Promise<void> {
  const { productName } = deps;
  let result: PersonalUpdateResult;
  try {
    result = await deps.check({
      onDownloading: (version) =>
        deps.notify(
          `Downloading ${productName} ${version}`,
          "You'll be asked to reload once it's ready."
        ),
    });
  } catch (error) {
    await deps.showMessage({
      type: 'error',
      message: "Couldn't check for updates",
      detail: error instanceof Error ? error.message : String(error),
      buttons: ['OK'],
    });
    return;
  }

  if (result.status === 'disabled') {
    await deps.showMessage({
      type: 'info',
      message: 'Updates are not available in this build',
      detail: `Only released ${productName} apps update themselves.`,
      buttons: ['OK'],
    });
    return;
  }
  if (result.status === 'up-to-date') {
    await deps.showMessage({
      type: 'info',
      message: "You're up to date",
      detail: `${productName} ${result.current} is the latest version.`,
      buttons: ['OK'],
    });
    return;
  }
  const choice = await deps.showMessage({
    type: 'info',
    message: `${productName} ${result.version} is ready`,
    detail: `Reload now to switch to it, or later with Reload in the sidebar.`,
    buttons: ['Reload Now', 'Later'],
  });
  if (choice === 0) deps.reload();
}
