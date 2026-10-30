import { useEffect, useSyncExternalStore } from 'react';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type OfflineState = {
  online: boolean;
  ready: boolean;
  update: boolean;
  problem: string;
  install: InstallPrompt | null;
  installed: boolean;
};
let state: OfflineState = {
  online: navigator.onLine,
  ready: false,
  update: false,
  problem: '',
  install: null,
  installed: matchMedia('(display-mode: standalone)').matches,
};
const listeners = new Set<() => void>();
const publish = (patch: Partial<OfflineState>) => {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
};
let started = false;
function start() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => publish({ online: true }));
  window.addEventListener('offline', () => publish({ online: false }));
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    publish({ install: event as InstallPrompt });
  });
  window.addEventListener('appinstalled', () =>
    publish({ installed: true, install: null }),
  );
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    publish({ problem: 'Offline reopen is unavailable on this address.' });
    return;
  }
  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => {
      const check = () => {
        publish({ update: !!registration.waiting });
        if (registration.active) publish({ ready: true, problem: '' });
      };
      check();
      const watch = (worker: ServiceWorker | null) => {
        worker?.addEventListener('statechange', () => {
          check();
          if (worker.state === 'redundant' && !registration.active)
            publish({
              problem:
                'Offline setup could not finish. Reconnect and reload before relying on offline reopen.',
            });
        });
      };
      watch(registration.installing);
      registration.addEventListener('updatefound', () =>
        watch(registration.installing),
      );
      navigator.serviceWorker.ready.then(() =>
        publish({ ready: true, problem: '' }),
      );
      // A connection returning may allow an interrupted update to be retried.
      window.addEventListener('online', () => {
        void registration.update().catch(() => {});
      });
    })
    .catch(() =>
      publish({
        problem:
          'Offline setup could not finish. Keep this page open or reconnect and reload.',
      }),
    );
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function useOffline() {
  useEffect(start, []);
  const current = useSyncExternalStore(subscribe, () => state);
  async function install() {
    const event = current.install;
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      publish({
        problem:
          'Installation did not finish. You can keep playing in the browser.',
      });
    }
    publish({ install: null });
  }
  return { ...current, installApp: install };
}
