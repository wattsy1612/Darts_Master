import type { IncomingBackup } from './backup';
export function inspectFileText(
  text: string,
  signal?: AbortSignal,
): Promise<IncomingBackup> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./import.worker.ts', import.meta.url), {
      type: 'module',
    });
    const finish = () => {
      worker.terminate();
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      finish();
      reject(new Error('File review cancelled.'));
    };
    const timeout = setTimeout(() => {
      finish();
      reject(
        new Error('This file took too long to validate. Try a smaller backup.'),
      );
    }, 20000);
    worker.onmessage = (event) => {
      finish();
      event.data.ok
        ? resolve(event.data.incoming)
        : reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      finish();
      reject(
        new Error('The backup reviewer could not start. Reload and try again.'),
      );
    };
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) {
      cancel();
      return;
    }
    worker.postMessage(text);
  });
}
