import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readWorkspace, failWrites } from './storage';
import type { CricketSession } from '../../src/domain/games/cricket';
async function start(page: Page, bull = false) {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Set up Cricket', exact: true })
    .click();
  if (bull)
    await page
      .getByRole('checkbox', { name: 'Decide starter with a bull-off' })
      .check();
  await page
    .getByRole('button', { name: 'Start Cricket', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: bull ? 'Player 1 throws for the bull' : 'Player 1 to throw',
      exact: true,
    }),
  ).toBeVisible();
}
async function record(page: Page, labels: string[]) {
  for (const name of labels)
    await page.getByRole('button', { name, exact: true }).click();
  await page
    .getByRole('button', { name: 'Record Cricket visit', exact: true })
    .click();
  await expect
    .poll(async () => {
      const button = page.getByRole('button', {
        name: 'Record Cricket visit',
        exact: true,
      });
      return !(await button.count()) || (await button.isDisabled());
    })
    .toBe(true);
}
test('plays Cricket to a real finish, reloads, undoes and redoes its result, then rematches and returns to X01', async ({
  page,
}) => {
  await start(page);
  for (const n of [20, 19, 18, 17, 16, 15]) {
    await record(page, [`T${n}`]);
    await page
      .getByRole('button', { name: 'Pass without throwing', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Player 1 to throw', exact: true }),
    ).toBeVisible();
  }
  for (const name of ['Bull', '25', 'Miss'])
    await page.getByRole('button', { name, exact: true }).click();
  await page
    .getByRole('button', { name: 'Record Cricket visit', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Remove the extra dart');
  expect(
    (await readWorkspace<CricketSession>(page))?.data.current?.commands,
  ).toHaveLength(12);
  await page
    .getByRole('button', { name: 'Remove last dart', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Record Cricket visit', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins', exact: true }),
  ).toBeVisible();
  let saved = await readWorkspace<CricketSession>(page);
  expect(saved?.data.archive).toHaveLength(1);
  expect(saved?.data.current?.commands).toHaveLength(13);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Undo last action', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 to throw', exact: true }),
  ).toBeVisible();
  expect(
    (await readWorkspace<CricketSession>(page))?.data.archive,
  ).toHaveLength(0);
  await page.getByRole('button', { name: 'Redo action', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cricket rematch', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Player 2 to throw', exact: true }),
  ).toBeVisible();
  saved = await readWorkspace<CricketSession>(page);
  expect(saved?.data.archive).toHaveLength(1);
  expect(saved?.data.current?.commands).toHaveLength(0);
  await page.getByRole('button', { name: 'Abandon…', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm abandon', exact: true })
    .click();
  await page.getByRole('button', { name: 'Set up X01', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Who’s at the board?' }),
  ).toBeVisible();
  expect(
    (await readWorkspace<CricketSession>(page))?.data.archive,
  ).toHaveLength(2);
});
test('bull-off, exact non-target darts, explicit pass, pause, redo and mobile layout work together', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, true);
  await page.getByRole('button', { name: 'Inner bull', exact: true }).click();
  await page.getByRole('button', { name: 'Outside bull', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 to throw', exact: true }),
  ).toBeVisible();
  await page.getByText('Other segments (1–14)', { exact: true }).click();
  await page.getByLabel('Other target').selectOption('14');
  await record(page, ['Other double', 'Miss', 'T20']);
  await page
    .getByRole('button', { name: 'Pause Cricket', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Cricket paused', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Cricket paused', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Resume Cricket', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Pass without throwing', exact: true })
    .click();
  const saved = await readWorkspace<CricketSession>(page);
  expect(saved?.data.current?.commands[2]).toMatchObject({
    type: 'visit',
    visit: {
      hits: [
        { number: 14, multiplier: 2 },
        { number: 0, multiplier: 1 },
        { number: 20, multiplier: 3 },
      ],
    },
  });
  expect(saved?.data.current?.commands.at(-1)?.type).toBe('pass');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: '/tmp/darts-cricket-phone.png',
    fullPage: true,
  });
});
test('a failed Cricket save retains the screen version and exports independently of the last saved copy', async ({
  page,
}) => {
  await start(page);
  const before = await readWorkspace<CricketSession>(page);
  await failWrites(page, 'all');
  await page.reload();
  await record(page, ['T20']);
  await expect(
    page.getByRole('heading', { name: 'Protect your Cricket game' }),
  ).toBeVisible();
  expect(await readWorkspace<CricketSession>(page)).toEqual(before);
  await expect(
    page.getByRole('button', { name: 'Pause Cricket', exact: true }),
  ).toBeDisabled();
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
  expect(backup.workspace.current.commands).toHaveLength(1);
  expect(backup.workspace.current.game).toBe('cricket');
  await expect(
    page.getByRole('button', {
      name: 'Download last saved readable backup',
      exact: false,
    }),
  ).toBeVisible();
});

test('unrecorded Cricket darts restore only after an explicit choice and never become a visit on reload', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'T20', exact: true }).click();
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Restore unrecorded Cricket darts?' }),
  ).toBeVisible();
  expect(
    (await readWorkspace<CricketSession>(page))?.data.current?.commands,
  ).toEqual([]);
  await expect(
    page.getByRole('button', { name: 'Record Cricket visit', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Restore Cricket draft', exact: true })
    .click();
  await expect(
    page.getByText('Current darts: T20 · 1/3', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Record Cricket visit', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Player 2 to throw', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Player 2 to throw', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Restore unrecorded Cricket darts?' }),
  ).toHaveCount(0);
  expect(
    (await readWorkspace<CricketSession>(page))?.data.current?.commands,
  ).toHaveLength(1);
});

test('excess marks score only while the opponent target is open and dead darts remain recorded', async ({
  page,
}) => {
  await start(page);
  await record(page, ['T20', 'T20']);
  await expect(
    page.getByRole('columnheader', { name: 'Player 1 60 points', exact: true }),
  ).toBeVisible();
  await record(page, ['T20']);
  await record(page, ['T20']);
  const session = (await readWorkspace<CricketSession>(page))!.data.current!;
  expect(session.commands).toHaveLength(3);
  await expect(
    page.getByRole('columnheader', { name: 'Player 1 60 points', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await expect(
    page.getByText('Player 1 · Leg 1 · T20 · 0 useful marks · 0 points', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('columnheader', { name: 'Player 1 60 points', exact: true }),
  ).toBeVisible();
});
