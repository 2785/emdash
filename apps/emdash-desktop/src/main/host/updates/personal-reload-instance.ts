import { app, dialog, Notification } from 'electron';
import { PRODUCT_NAME } from '@core/primitives/app-identity/api/app-identity';
import { createPersonalReloadService } from './personal-reload';
import { createPersonalUpdateService } from './personal-update';
import { runPersonalUpdateCheck } from './personal-update-check';

export const personalReloadService = createPersonalReloadService({
  get isPackaged() {
    return app.isPackaged;
  },
  quit: () => app.quit(),
});

export const personalUpdateService = createPersonalUpdateService({
  get isPackaged() {
    return app.isPackaged;
  },
});

/** The "Check for Updates…" menu item. */
export function checkForPersonalUpdates(): Promise<void> {
  return runPersonalUpdateCheck({
    productName: PRODUCT_NAME,
    check: (options) => personalUpdateService.check(options),
    showMessage: async (message) => (await dialog.showMessageBox(message)).response,
    notify: (title, body) => new Notification({ title, body }).show(),
    reload: () => personalReloadService.reload(),
  });
}
