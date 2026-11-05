import { app } from 'electron';
import { createPersonalReloadService } from './personal-reload';
import { createPersonalUpdateService } from './personal-update';

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
