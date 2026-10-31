import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { backupText } from '../../src/data/backup';
import { emptyData } from '../../src/data/workspace';
import {
  createCricket,
  cricketRulesVersion,
} from '../../src/domain/games/cricket';
import type { CricketSession } from '../../src/domain/games/cricket';
import { exportGameMatch } from '../../src/domain/archive';
import type { Session } from '../../src/domain/match';
import type { GameRecord } from '../../src/domain/games/registry';
import { readWorkspace, failWrites } from './storage';
const date = '2026-10-31T12:00:00Z';
const setup = createCricket({
  players: ['Alice', 'Bob'],
  playerIds: ['source-alice', 'source-bob'],
  variant: 'standard',
  bull: 'split',
  legsToWin: 1,
}).setup;
const current: CricketSession = {
  game: 'cricket',
  version: 1,
  rulesVersion: cricketRulesVersion,
  id: 'resume-cricket',
  setup,
  commands: [
    {
      type: 'visit',
      visit: {
        participantId: setup.sides![0].members[0].id,
        source: 'manual-segments',
        hits: [{ number: 20, multiplier: 3 }],
      },
    },
  ],
};
const result: CricketSession = {
  ...current,
  id: 'finished-cricket',
  commands: [{ type: 'concede', player: 1, sideId: setup.sides![1].id }],
};
const x01: Session = {
  version: 2,
  id: 'finished-x01',
  setup: { players: ['X', 'Y'], start: 101, legsToWin: 1 },
  commands: [{ type: 'visit', visit: { total: 101, darts: 2, double: true } }],
};
const mixed = {
  ...emptyData<GameRecord>(),
  current,
  archive: [
    { session: result, completedAt: date },
    { session: x01, completedAt: date },
  ],
  players: [
    { id: 'source-alice', name: 'Alice', createdAt: date },
    { id: 'source-bob', name: 'Bob', createdAt: date },
  ],
};
async function file(page: Page, text: string) {
  await page.getByLabel('Choose backup file').setInputFiles({
    name: 'cricket.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(
    page.getByRole('heading', { name: 'Import preview', exact: true }),
  ).toBeVisible();
}
async function data(page: Page) {
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
}

test('reviews a mixed backup, explicitly replaces X01 with Cricket, browses both games, exports, deduplicates and undoes the import', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page
    .getByRole('button', { name: 'Record 180 points', exact: false })
    .click();
  await expect
    .poll(
      async () =>
        (await readWorkspace<GameRecord>(page))?.data.current?.commands.length,
    )
    .toBe(1);
  const before = await readWorkspace<GameRecord>(page);
  await data(page);
  await file(page, backupText(mixed));
  expect(await readWorkspace<GameRecord>(page)).toEqual(before);
  await page
    .getByLabel('Restore the in-progress match from this backup')
    .check();
  await expect(
    page.getByRole('button', { name: 'Confirm import', exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel('Replace the game currently open on this device')
    .check();
  await page
    .getByRole('button', { name: 'Confirm import', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Standard Cricket', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Bob to throw', exact: true }),
  ).toBeVisible();
  let saved = await readWorkspace<GameRecord>(page);
  expect(saved?.data.current?.game).toBe('cricket');
  expect(saved?.data.archive).toHaveLength(2);
  expect(saved?.data.players).toHaveLength(2);
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Cricket match centre', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Choose a Cricket match')
    .selectOption('finished-cricket');
  await expect(
    page.getByRole('heading', { name: 'Alice vs Bob · conceded', exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export Cricket match', exact: false })
    .click();
  const exported = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(exported).toMatchObject({
    version: 2,
    session: { game: 'cricket' },
    result: { winner: 'Alice', status: 'conceded' },
  });
  await page.getByLabel('Game in match centre').selectOption('x01');
  await page
    .getByRole('combobox', { name: 'Choose a match', exact: true })
    .selectOption('finished-x01');
  await expect(
    page.getByRole('heading', { name: 'X wins', exact: true }),
  ).toBeVisible();
  await data(page);
  await file(page, backupText(mixed));
  await expect(
    page.getByText('2 duplicate matches skipped', { exact: false }),
  ).toBeVisible();
  saved = await readWorkspace<GameRecord>(page);
  expect(saved?.data.archive).toHaveLength(2);
  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([
    page.waitForEvent('load'),
    page
      .getByRole('button', { name: 'Undo last import', exact: false })
      .click(),
  ]);
  await page
    .getByRole('button', { name: 'Local scorer', exact: false })
    .click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }),
  ).toBeVisible();
  expect((await readWorkspace<GameRecord>(page))?.data).toEqual(before?.data);
});

test('standalone Cricket imports as guests and failed mixed import leaves every saved part untouched', async ({
  page,
}) => {
  await page.goto('/');
  await data(page);
  await file(page, exportGameMatch(result));
  await page
    .getByRole('button', { name: 'Confirm import', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Last import recovery', exact: true }),
  ).toBeVisible();
  let saved = await readWorkspace<GameRecord>(page);
  expect(
    saved?.data.archive[0].session.setup.sides?.flatMap((s) =>
      s.members.map((m) => m.profileId),
    ),
  ).toEqual([null, null]);
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await page.getByLabel('Game in match centre').selectOption('cricket');
  await expect(
    page.getByRole('heading', { name: 'Alice vs Bob · conceded', exact: true }),
  ).toBeVisible();
  await data(page);
  await failWrites(page, 'all');
  await page.reload();
  const before = await readWorkspace<GameRecord>(page);
  await file(page, backupText(mixed));
  await page
    .getByLabel('Restore the in-progress match from this backup')
    .check();
  await page
    .getByRole('button', { name: 'Confirm import', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Existing data was preserved',
  );
  saved = await readWorkspace<GameRecord>(page);
  expect(saved).toEqual(before);
});

test('navigating Cricket pages retains the exact draft and keeps primary controls visible on a landscape tablet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Set up Cricket', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Start Cricket', exact: true })
    .click();
  await page.getByRole('button', { name: 'T20', exact: true }).click();
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  const before = await readWorkspace<GameRecord>(page);
  const rect = await page
    .getByRole('button', { name: 'Record Cricket visit', exact: true })
    .boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(768);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({ path: '/tmp/darts-v019-cricket-tablet.png' });
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Cricket match centre', exact: true }),
  ).toBeVisible();
  await data(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(
    page.getByText('Current darts: T20 · 1/3', { exact: true }),
  ).toBeVisible();
  expect(await readWorkspace<GameRecord>(page)).toEqual(before);
  await page
    .getByRole('button', { name: 'Record Cricket visit', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Player 2 to throw', exact: true }),
  ).toBeVisible();
});

test('Cricket shows the saved next turn only after its transaction commits', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Set up Cricket', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Start Cricket', exact: true })
    .click();
  await page.getByRole('button', { name: 'T20', exact: true }).click();
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const control = window as unknown as { holdCricketCommit: boolean };
    control.holdCricketCommit = true;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = original.call(this, value, key);
      if (
        this.name === 'workspace' &&
        key === 'current' &&
        value?.data?.current?.game === 'cricket' &&
        value.data.current.commands.some(
          (c: { type: string }) => c.type === 'visit',
        )
      ) {
        const store = this;
        const keepActive = () => {
          const pending = store.get('__cricket_commit_test__');
          pending.onsuccess = () => {
            if (control.holdCricketCommit) keepActive();
          };
        };
        keepActive();
      }
      return request;
    };
  });
  await page
    .getByRole('button', { name: 'Record Cricket visit', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Saving…' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Player 1 to throw', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Player 2 to throw', exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { holdCricketCommit: boolean }).holdCricketCommit =
      false;
  });
  await expect(
    page.getByRole('heading', { name: 'Player 2 to throw', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Player 2 to throw', exact: true }),
  ).toBeVisible();
  expect(
    (await readWorkspace<GameRecord>(page))?.data.current?.commands,
  ).toHaveLength(1);
});
