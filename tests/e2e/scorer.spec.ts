import { expect, test } from '@playwright/test';
import { readWorkspace, failWrites } from './storage';

// Retain explicit coverage for the visit-total input alongside board tests.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('darts-master.input-mode', 'keypad'),
  );
});

test('score, recover a match, undo, finish and start the next leg', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Player 1', { exact: true }).fill('Alice');
  await page.getByLabel('Player 2', { exact: true }).fill('Bob');
  await page.getByLabel('Starting score').selectOption('301');
  await page.getByRole('button', { name: 'Start match' }).click();
  const alice = page.getByRole('article', { name: 'Alice score' });
  await expect(alice.locator('.remaining')).toHaveText('301');
  await page.getByRole('button', { name: '180', exact: true }).click();
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(alice.locator('.remaining')).toHaveText('121');
  await page.reload();
  await expect(alice.locator('.remaining')).toHaveText('121');
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await expect(alice.locator('.remaining')).toHaveText('301');
  await page.getByLabel('Visit total').fill('179');
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(page.getByRole('alert')).toContainText('not possible');
  await page.getByLabel('Visit total').fill('180');
  await page.getByRole('button', { name: 'Record score' }).click();
  await page.getByLabel('Visit total').fill('0');
  await page.getByRole('button', { name: 'Record score' }).click();
  await page.getByLabel('Visit total').fill('121');
  await page.getByLabel('Last dart was a double / bull').check();
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(
    page.getByRole('heading', { name: 'Alice takes the leg.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next leg' }).click();
  await expect(alice.locator('.remaining')).toHaveText('301');
  await expect(page.getByRole('article', { name: 'Bob score' })).toContainText(
    'THROWING',
  );
  await page.getByRole('button', { name: 'Match history' }).click();
  await expect(
    page.getByRole('cell', { name: 'Game shot', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'What’s next' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tournaments & streams' }),
  ).toBeVisible();
});

test('works on a phone without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('441');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('recovers from invalid saved data', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('darts-master.match.v1', '{invalid'),
  );
  await page.reload();
  await expect(page.getByRole('status')).toContainText('could not be loaded');
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(page.getByRole('region', { name: 'Scoreboard' })).toBeVisible();
});

test('archives a completed match, supports corrections and exports the result', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Starting score').selectOption('301');
  await page.getByLabel('First to').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  for (const total of [180, 0, 121]) {
    await page.getByLabel('Visit total').fill(String(total));
    if (total === 121)
      await page.getByLabel('Last dart was a double / bull').check();
    await page.getByRole('button', { name: 'Record score' }).click();
  }
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins the match!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('121');
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins the match!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New match' }).click();
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Match history' }).click();
  const saved = await page
    .getByLabel('Choose a match')
    .locator('option')
    .last()
    .getAttribute('value');
  await page.getByLabel('Choose a match').selectOption(saved!);
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.result-score')).toHaveText('1 — 0');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export match' }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^darts-match-.*\.json$/,
  );
  await page.getByRole('button', { name: 'New match' }).click();
  await expect(
    page.getByRole('heading', { name: 'Who’s at the board?' }),
  ).toBeVisible();
});

test('protects unfinished games and clears redo after a replacement score', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: 'Record score' }).click();
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await page.getByRole('button', { name: '100', exact: true }).click();
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'New match' }).click();
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(page.getByRole('alert')).toContainText('Confirm');
  await page.getByRole('button', { name: 'Back to match' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('401');
  await page.getByRole('button', { name: 'New match' }).click();
  await page.getByLabel('Replace my unfinished match').check();
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('501');
});

test('upgrades an older saved match without losing its scores', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'darts-master.match.v1',
      JSON.stringify({
        version: 1,
        setup: {
          players: ['Returning player', 'Guest'],
          start: 501,
          legsToWin: 3,
        },
        commands: [
          { type: 'visit', visit: { total: 140, darts: 3, double: false } },
        ],
      }),
    ),
  );
  await page.reload();
  await expect(
    page
      .getByRole('article', { name: 'Returning player score' })
      .locator('.remaining'),
  ).toHaveText('361');
  await page.getByLabel('Visit total').fill('60');
  await page.getByRole('button', { name: 'Record score' }).click();
  await page.reload();
  await expect(
    page.getByRole('article', { name: 'Guest score' }).locator('.remaining'),
  ).toHaveText('441');
  expect((await readWorkspace(page))?.data.current?.id).toBeTruthy();
});

test('preserves an unreadable archive while allowing local play', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('darts-master.archive.v1', '{unreadable'),
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(
    'archive could not be loaded',
  );
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: 'Record score' }).click();
  expect(
    await page.evaluate(() => localStorage.getItem('darts-master.archive.v1')),
  ).toBe('{unreadable');
});

test('protects an unsaved completed result if archive storage is full', async ({
  page,
}) => {
  await failWrites(page, 'archive');
  await page.goto('/');
  await page.getByLabel('Starting score').selectOption('301');
  await page.getByLabel('First to').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  for (const total of [180, 0, 121]) {
    await page.getByLabel('Visit total').fill(String(total));
    if (total === 121)
      await page.getByLabel('Last dart was a double / bull').check();
    await page.getByRole('button', { name: 'Record score' }).click();
  }
  await expect(
    page.getByText('Some match data could not be saved.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New match' }).click();
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(page.getByRole('alert')).toContainText('Confirm');
  await expect(
    page.getByLabel('Continue without saving this result'),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Back to match' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins the match!' }),
  ).toBeVisible();
});
