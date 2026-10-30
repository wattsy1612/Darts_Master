import { expect, test } from '@playwright/test';

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
