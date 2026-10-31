import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readWorkspace } from './storage';
import { turnIdentity, emptyDraft } from '../../src/data/draft';
import {
  createCricket,
  cricketRulesVersion,
} from '../../src/domain/games/cricket';
import type { Session } from '../../src/domain/match';
const date = '2026-10-30T12:00:00Z';
const active: Session = {
  version: 1,
  id: 'upgrade-game',
  setup: { players: ['A', 'B'], start: 301, legsToWin: 1 },
  commands: [{ type: 'visit', visit: { total: 60, darts: 3, double: false } }],
};
function oldWorkspace() {
  return {
    version: 2,
    revision: 7,
    data: { current: active, archive: [], players: [], profileImports: [] },
  };
}
async function seed(page: Page, values: Record<string, unknown>) {
  await page.evaluate(
    (values) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('darts-master-local', 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction('workspace', 'readwrite');
          for (const [key, value] of Object.entries(values))
            tx.objectStore('workspace').put(value, key);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    values,
  );
}
async function stored(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (key) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('darts-master-local', 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction('workspace', 'readonly'),
            r = tx.objectStore('workspace').get(key);
          r.onsuccess = () => resolve(r.result ?? null);
          r.onerror = () => reject(r.error);
          tx.oncomplete = () => db.close();
        };
        open.onerror = () => reject(open.error);
      }),
    key,
  );
}

test('upgrades an existing workspace without losing its current score, exact draft or downloadable original', async ({
  page,
}) => {
  await page.goto('/');
  const old = oldWorkspace(),
    value = { ...emptyDraft(), mode: 'keypad', score: '26' };
  await page.evaluate(() => {
    sessionStorage.setItem('darts-master.tab.v1', 'upgrade-tab');
    localStorage.setItem('darts-master.input-mode', 'keypad');
  });
  await seed(page, {
    current: old,
    'draft:upgrade-tab': {
      version: 1,
      token: 'original-token',
      revision: 7,
      turn: turnIdentity(active),
      savedAt: Date.now(),
      value,
    },
  });
  await page.reload();
  await expect(
    page.getByRole('article', { name: 'A score' }).locator('.remaining'),
  ).toHaveText('241');
  await expect(
    page.getByRole('button', { name: 'Restore visit draft' }),
  ).toBeVisible();
  expect((await readWorkspace(page))!.version).toBe(3);
  expect((await readWorkspace(page))!.revision).toBe(8);
  await page.getByRole('button', { name: 'Restore visit draft' }).click();
  await expect(page.getByLabel('Visit total')).toHaveValue('26');
  expect((await readWorkspace(page))!.data.current).toEqual(active);
  expect(await stored(page, 'before-game-workspace-migration')).toEqual({
    previous: old,
    appliedRevision: 8,
  });
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download pre-upgrade backup' })
    .click();
  const file = await download,
    backup = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(file.suggestedFilename()).toBe('darts-before-game-upgrade.json');
  expect(backup.version).toBe(1);
  expect(backup.workspace.current).toEqual(active);
});

test('a failed upgrade leaves the old database untouched and exposes readable recovery rather than resetting it', async ({
  page,
}) => {
  await page.goto('/');
  const old = oldWorkspace();
  await seed(page, { current: old });
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === 'current' && value?.version === 3)
        throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await page.reload();
  await expect(
    page.getByRole('article', { name: 'A score' }).locator('.remaining'),
  ).toHaveText('241');
  expect(await stored(page, 'current')).toEqual(old);
  expect(await stored(page, 'before-game-workspace-migration')).toBeNull();
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Saved data needs attention' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download readable data', exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Download raw recovery copy',
      exact: false,
    }),
  ).toBeVisible();
});

test('a stored Cricket current game resumes without rewriting its saved record', async ({
  page,
}) => {
  await page.goto('/');
  const current = {
    game: 'cricket',
    version: 1,
    rulesVersion: cricketRulesVersion,
    id: 'stored-cricket',
    setup: createCricket({
      players: ['C', 'D'],
      variant: 'standard',
      bull: 'split',
      legsToWin: 1,
    }).setup,
    commands: [],
  };
  const workspace = {
    version: 3,
    revision: 4,
    data: { current, archive: [], players: [], profileImports: [] },
  };
  await seed(page, { current: workspace });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Standard Cricket' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start match' })).toHaveCount(
    0,
  );
  expect(await stored(page, 'current')).toEqual(workspace);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download full backup', exact: false })
    .click();
  const backup = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(backup.version).toBe(2);
  expect(backup.workspace.current).toEqual(current);
});

test('normal X01 play and full backups retain Cricket records in the shared archive', async ({
  page,
}) => {
  await page.goto('/');
  const cricket = {
    game: 'cricket',
    version: 1,
    rulesVersion: cricketRulesVersion,
    id: 'retained-cricket',
    setup: createCricket({
      players: ['C', 'D'],
      variant: 'standard',
      bull: 'split',
      legsToWin: 1,
    }).setup,
    commands: [{ type: 'concede', player: 0, sideId: 'side-1' }],
  };
  await seed(page, {
    current: {
      version: 3,
      revision: 4,
      data: {
        current: { ...active, commands: [] },
        archive: [{ session: cricket, completedAt: date }],
        players: [],
        profileImports: [],
      },
    },
  });
  await page.reload();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  for (const total of [180, 0, 121]) {
    await page.getByLabel('Visit total').fill(String(total));
    if (total === 121)
      await page.getByLabel('Last dart was a double / bull').check();
    await page.getByRole('button', { name: 'Record score' }).click();
  }
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(2);
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download full backup', exact: false })
    .click();
  const backup = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(backup.version).toBe(2);
  expect(
    backup.workspace.archive.map(
      (entry: { session: { id: string } }) => entry.session.id,
    ),
  ).toEqual(expect.arrayContaining(['retained-cricket', 'upgrade-game']));
});

test('failed score persistence can export both a coherent in-memory game and the last saved workspace', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Starting score', { exact: false }).selectOption('301');
  await page.getByLabel('First to').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  for (const total of [180, 0, 121]) {
    await page.getByLabel('Visit total').fill(String(total));
    if (total === 121)
      await page.getByLabel('Last dart was a double / bull').check();
    await page.getByRole('button', { name: 'Record score' }).click();
  }
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  const before = await readWorkspace(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === 'current')
        throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await expect(
    page.getByText('Some match data could not be saved.', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: '/tmp/darts-game-backup-phone.png',
    fullPage: true,
  });
  const memoryDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download full backup', exact: false })
    .click();
  const memoryText = await readFile(
      (await (await memoryDownload).path())!,
      'utf8',
    ),
    memory = JSON.parse(memoryText);
  expect(memory.workspace.current.commands).toHaveLength(2);
  expect(memory.workspace.archive).toHaveLength(0);
  const savedDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download last saved readable backup' })
    .click();
  const saved = JSON.parse(
    await readFile((await (await savedDownload).path())!, 'utf8'),
  );
  expect(saved.workspace.current.commands).toHaveLength(3);
  expect(saved.workspace.archive).toHaveLength(1);
  expect(await readWorkspace(page)).toEqual(before);
});
