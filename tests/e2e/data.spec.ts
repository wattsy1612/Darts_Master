import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readWorkspace } from './storage';

const date = '2026-10-30T00:00:00Z';
const game = {
  version: 1,
  id: 'backup-game',
  setup: {
    players: ['Alice', 'Bob'],
    playerIds: ['a', 'b'],
    start: 301,
    legsToWin: 1,
  },
  commands: [
    { type: 'visit', visit: { total: 180, darts: 3, double: false } },
    { type: 'visit', visit: { total: 0, darts: 3, double: false } },
    { type: 'visit', visit: { total: 121, darts: 3, double: true } },
  ],
};
const backup = {
  format: 'darts-master-backup',
  version: 1,
  createdAt: date,
  workspace: {
    current: null,
    archive: [{ session: game, completedAt: date }],
    players: [
      { id: 'a', name: 'Alice', createdAt: date },
      { id: 'b', name: 'Bob', createdAt: date },
    ],
  },
};
const file = (data: unknown) => ({
  name: 'darts-backup.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(data)),
});

test('imports a reviewed backup once, exports it, and can undo the import', async ({
  page,
}) => {
  await page.goto('/#/data');
  await page.getByLabel('Choose backup file').setInputFiles(file(backup));
  await expect(
    page.getByRole('heading', { name: 'Import preview' }),
  ).toBeVisible();
  expect(await readWorkspace(page)).toBeNull();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Confirm import', exact: true }).click(),
  ]);
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  await expect(
    page.getByRole('button', { name: 'Undo last import' }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download full backup' }).click();
  const exported = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(exported.workspace.archive).toHaveLength(1);
  expect(exported.workspace.players).toHaveLength(2);
  await page.getByLabel('Choose backup file').setInputFiles(file(backup));
  await expect(page.locator('.import-preview .data-counts')).toContainText(
    '1 duplicate matches skipped',
  );
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Confirm import', exact: true }).click(),
  ]);
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Undo last import' }).click(),
  ]);
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(0);
  expect((await readWorkspace(page))?.data.players).toHaveLength(0);
});

test('restores an in-progress game only after acknowledging replacement', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('60');
  await page.getByRole('button', { name: 'Record score' }).click();
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
  const incoming = {
    ...backup,
    workspace: {
      ...backup.workspace,
      current: {
        ...game,
        id: 'open-backup',
        commands: game.commands.slice(0, 1),
      },
      archive: [],
    },
  };
  await page.getByLabel('Choose backup file').setInputFiles(file(incoming));
  await expect(
    page.getByRole('heading', { name: 'Import preview' }),
  ).toBeVisible();
  await page
    .getByLabel('Restore the in-progress match from this backup')
    .check();
  await expect(
    page.getByRole('button', { name: 'Confirm import', exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel('Replace the game currently open on this device')
    .check();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Confirm import', exact: true }).click(),
  ]);
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.setup.players[0],
    )
    .toBe('Alice');
  await page.getByRole('button', { name: 'Local scorer', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Alice score' }).locator('.remaining'),
  ).toHaveText('121');
});

test('rejects malformed files and does not alter saved data during review', async ({
  page,
}) => {
  await page.goto('/#/data');
  await page
    .getByLabel('Choose backup file')
    .setInputFiles(file({ format: 'darts-master-backup', version: 99 }));
  await expect(page.getByRole('alert')).toContainText(
    'unsupported backup version',
  );
  await expect(
    page.getByRole('button', { name: 'Confirm import', exact: true }),
  ).toHaveCount(0);
  expect(await readWorkspace(page)).toBeNull();
});

test('rolls back the whole import transaction if saving fails', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(0);
  const before = await readWorkspace(page);
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
  await page.getByLabel('Choose backup file').setInputFiles(file(backup));
  await expect(
    page.getByRole('heading', { name: 'Import preview' }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (
        this.name === 'workspace' &&
        key === 'current' &&
        value?.data?.archive.length
      )
        throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await page
    .getByRole('button', { name: 'Confirm import', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Existing data was preserved',
  );
  expect(await readWorkspace(page)).toEqual(before);
  await expect(
    page.getByRole('button', { name: 'Undo last import' }),
  ).toHaveCount(0);
});

test('a stale second tab cannot overwrite newer saved players', async ({
  page,
  context,
}) => {
  await page.goto('/#/players');
  await page.getByLabel('New player name').fill('Alice');
  await page.getByRole('button', { name: 'Add player' }).click();
  await expect(
    page.getByRole('article', { name: 'Alice profile' }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto('/#/players');
  await expect(
    other.getByRole('article', { name: 'Alice profile' }),
  ).toBeVisible();
  await page.getByLabel('New player name').fill('Bob');
  await page.getByRole('button', { name: 'Add player' }).click();
  await expect(
    page.getByRole('article', { name: 'Bob profile' }),
  ).toBeVisible();
  await other.getByLabel('New player name').fill('Eve');
  await other.getByRole('button', { name: 'Add player' }).click();
  await expect(other.getByRole('alert')).toContainText('Another tab');
  expect((await readWorkspace(page))?.data.players.map((p) => p.name)).toEqual([
    'Alice',
    'Bob',
  ]);
  await other.close();
});

test('local play and a readable backup remain available when IndexedDB is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException('Unavailable', 'SecurityError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('60');
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('441');
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download readable data' }).click();
  const result = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(result.workspace.current.commands).toHaveLength(1);
  expect(result.notes.join(' ')).toContain('Partial recovery');
  await expect(page.getByLabel('Choose backup file')).toBeDisabled();
});
