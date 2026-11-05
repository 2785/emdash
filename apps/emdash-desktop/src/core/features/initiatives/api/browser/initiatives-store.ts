import { makeAutoObservable, runInAction } from 'mobx';
import type { Initiative } from '../contract';
import { getInitiativesClient } from './client';

/** Live list of active initiatives, refreshed whenever the backend reports a change. */
export class InitiativesStore {
  initiatives: Initiative[] = [];
  private started = false;

  constructor() {
    makeAutoObservable<InitiativesStore, 'started'>(this, { started: false });
  }

  get byId(): ReadonlyMap<string, Initiative> {
    return new Map(this.initiatives.map((initiative) => [initiative.id, initiative]));
  }

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    void (async () => {
      const client = await getInitiativesClient();
      await client.events.subscribe(undefined, {
        onEvent: (change) => {
          if (change.type === 'initiatives-changed') void this.refresh();
        },
        onGap: () => void this.refresh(),
      });
      await this.refresh();
    })();
  }

  async refresh(): Promise<void> {
    const client = await getInitiativesClient();
    const initiatives = await client.list({});
    runInAction(() => {
      this.initiatives = initiatives;
    });
  }
}

let store: InitiativesStore | undefined;

export function getInitiativesStore(): InitiativesStore {
  store ??= new InitiativesStore();
  store.start();
  return store;
}
