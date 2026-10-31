import { inspectBackup } from './backup';
self.onmessage = (event: MessageEvent<string>) => {
  try {
    self.postMessage({ ok: true, incoming: inspectBackup(event.data) });
  } catch (error) {
    self.postMessage({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'This backup could not be read.',
    });
  }
};
