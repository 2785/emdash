import { app } from 'electron';
import { createPersonalReloadService } from './personal-reload';

export const personalReloadService = createPersonalReloadService({
  get isPackaged() {
    return app.isPackaged;
  },
  quit: () => app.quit(),
});
