import type { Page } from '@playwright/test';
import type { WorkspaceDocument } from '../../src/data/workspace';
export async function readWorkspace(
  page: Page,
): Promise<WorkspaceDocument | null> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('darts-master-local', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('workspace')) {
            db.close();
            resolve(null);
            return;
          }
          const tx = db.transaction('workspace', 'readonly');
          const request = tx.objectStore('workspace').get('current');
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => reject(request.error);
          tx.oncomplete = () => db.close();
        };
      }),
  );
}
export async function failWrites(
  page: Page,
  part: 'players' | 'archive' | 'all',
) {
  await page.addInitScript(
    ({ part }) => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, key) {
        if (
          this.name === 'workspace' &&
          key === 'current' &&
          value?.version === 2 &&
          (part === 'all' ||
            (part === 'players' && value.data.players.length > 0) ||
            (part === 'archive' && value.data.archive.length > 0))
        )
          throw new DOMException('Full', 'QuotaExceededError');
        return original.call(this, value, key);
      };
    },
    { part },
  );
}
