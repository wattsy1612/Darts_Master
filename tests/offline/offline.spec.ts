import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readWorkspace } from '../e2e/storage';
async function ready(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
}
test.beforeEach(async ({ request }) => {
  await request.post('/__test/release', { data: { release: 1 } });
});

test('the built app reopens offline with its match and recoverable unsubmitted darts', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await ready(page);
  const manifest = await (
    await page.request.get('/manifest.webmanifest')
  ).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByText('Offline · local play', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Restore visit draft' }).click();
  await expect(page.locator('.dart-slot.filled')).toHaveCount(1);
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Record 180 points' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('321');
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('321');
  await page.getByLabel('Match navigation', { exact: true }).click();
  await page.getByRole('button', { name: 'Data & backups' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ready for offline play.' }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download full backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^darts-backup-/);
});

test('a waiting update leaves every open match alone and applies after all tabs close', async ({
  page,
  context,
  request,
}) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  await ready(second);
  await request.post('/__test/release', { data: { release: 2 } });
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r!.update();
  });
  await expect(
    page.getByText(
      'Update ready. Finish your visit, then close all app tabs to apply it.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
    'content',
    '1',
  );
  await expect(page.locator('.dart-slot.filled')).toHaveCount(1);
  await page.close();
  // Another tab keeps the old worker and shell alive even through a reload.
  await second.reload();
  await expect(second.locator('meta[name="test-release"]')).toHaveAttribute(
    'content',
    '1',
  );
  await second.close();
  const fresh = await context.newPage();
  await fresh.goto('/');
  // The first navigation can race activation; a subsequent reload must use release 2.
  await expect
    .poll(() =>
      fresh.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return !!r?.waiting;
      }),
    )
    .toBe(false);
  await fresh.reload();
  await expect(fresh.locator('meta[name="test-release"]')).toHaveAttribute(
    'content',
    '2',
  );
  await expect(
    fresh
      .getByRole('article', { name: 'Player 1 score' })
      .locator('.remaining'),
  ).toHaveText('501');
});

test('an interrupted update leaves the previous shell usable offline and retries later', async ({
  page,
  context,
  request,
}) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Start match' }).click();
  await request.post('/__test/release', {
    data: { release: 3, failAsset: true },
  });
  const state = await page.evaluate(async () => {
    const r = (await navigator.serviceWorker.getRegistration())!;
    const installed = new Promise<string>((resolve) =>
      r.addEventListener(
        'updatefound',
        () => {
          const worker = r.installing!;
          worker.addEventListener('statechange', () => {
            if (['installed', 'redundant'].includes(worker.state))
              resolve(worker.state);
          });
        },
        { once: true },
      ),
    );
    await r.update();
    return installed;
  });
  expect(state).toBe('redundant');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
    'content',
    '1',
  );
  await expect(
    page.getByRole('button', { name: 'Treble 20', exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await request.post('/__test/release', { data: { release: 4 } });
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r!.update();
  });
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          !!(await navigator.serviceWorker.getRegistration())?.waiting,
      ),
    )
    .toBe(true);
});

test('only public shell assets are cached, leaving unrelated caches and API requests alone', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:5180')
      external.push(request.url());
  });
  await page.goto('/');
  await ready(page);
  await page.evaluate(async () => {
    const cache = await caches.open('unrelated-app');
    await cache.put('/unrelated', new Response('keep'));
  });
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names.filter((n) =>
      n.startsWith('darts-master-shell-'),
    )) {
      for (const r of await (await caches.open(name)).keys())
        urls.push(new URL(r.url).pathname);
    }
    return urls;
  });
  expect(cached).toContain('/index.html');
  expect(cached.filter((path) => path.endsWith('.ttf'))).toHaveLength(5);
  expect(cached).toContain('/fonts/DM-Sans-OFL.txt');
  expect(cached).toContain('/fonts/Barlow-Condensed-OFL.txt');
  expect(cached.some((p) => p.startsWith('/assets/'))).toBe(true);
  expect(cached.some((p) => /api|match|players|__test/.test(p))).toBe(false);
  const response = await page.evaluate(async () => {
    const r = await fetch('/api/private');
    return { status: r.status, text: await r.text() };
  });
  expect(response.status).toBe(404);
  expect(response.text).not.toContain('<!doctype');
  expect(await page.evaluate(() => caches.has('unrelated-app'))).toBe(true);
  await context.setOffline(true);
  const loaded = await page.evaluate(async () => {
    const faces = await Promise.all([
      document.fonts.load('400 16px "DM Sans"'),
      document.fonts.load('800 32px "Barlow Condensed"'),
    ]);
    return faces.map((group) => group.map((face) => face.status));
  });
  expect(loaded).toEqual([['loaded'], ['loaded']]);
  expect(external).toEqual([]);
});

test('a failed first installation does not advertise offline readiness', async ({
  page,
  request,
}) => {
  await request.post('/__test/release', {
    data: { release: 5, failAsset: true },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Data & backups' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Prepare this device for offline play.',
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Offline setup could not finish. Reconnect and reload before relying on offline reopen.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Ready for offline play.' }),
  ).toHaveCount(0);
  const keys = await page.evaluate(() => caches.keys());
  expect(keys.filter((k) => k.startsWith('darts-master-shell-'))).toHaveLength(
    0,
  );
});

test('reviewed corrections and their recovery copy survive an offline reload', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  for (const total of [60, 60, 60]) {
    await page.getByLabel('Visit total').fill(String(total));
    await page.getByRole('button', { name: 'Record score' }).click();
  }
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(3);
  const original = (await readWorkspace(page))!.data.current!;
  await context.setOffline(true);
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Correct visit 1', exact: true })
    .click();
  await page.getByLabel('Corrected visit total').fill('100');
  await page
    .getByRole('button', { name: 'Preview correction', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Apply reviewed correction', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Undo last correction' }),
  ).toBeEnabled();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByText('Offline · local play', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo last correction' }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.current)
    .toEqual(original);
});

test('a cached app upgrades the prior workspace and provides its original backup while offline', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await ready(page);
  const current = {
    version: 1,
    id: 'offline-upgrade',
    setup: { players: ['A', 'B'], start: 301, legsToWin: 1 },
    commands: [
      { type: 'visit', visit: { total: 60, darts: 3, double: false } },
    ],
  };
  await page.evaluate(
    (current) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('darts-master-local', 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction('workspace', 'readwrite');
          tx.objectStore('workspace').put(
            {
              version: 2,
              revision: 4,
              data: { current, archive: [], players: [], profileImports: [] },
            },
            'current',
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    current,
  );
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('article', { name: 'A score' }).locator('.remaining'),
  ).toHaveText('241');
  expect((await readWorkspace(page))!.version).toBe(3);
  expect((await readWorkspace(page))!.revision).toBe(5);
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
  await expect(
    page.getByText('Offline · local play', { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download pre-upgrade backup' })
    .click();
  expect((await download).suggestedFilename()).toBe(
    'darts-before-game-upgrade.json',
  );
});
