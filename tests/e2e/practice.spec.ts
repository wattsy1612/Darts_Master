import { expect, test } from '@playwright/test';

test('plays a practice opponent and undo/redo restores the pair of visits', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Practice opponent', exact: false })
    .click();
  await page.getByRole('button', { name: 'Rookie', exact: false }).click();
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('60');
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('441');
  await expect(page.getByLabel('Visit total')).toBeDisabled();
  await expect(
    page
      .getByRole('article', { name: 'Practice Bot score' })
      .locator('.stats strong')
      .last(),
  ).not.toHaveText('0');
  const botScore = await page
    .getByRole('article', { name: 'Practice Bot score' })
    .locator('.remaining')
    .textContent();
  const before = await page.evaluate(() =>
    localStorage.getItem('darts-master.match.v1'),
  );
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('501');
  await expect(
    page
      .getByRole('article', { name: 'Practice Bot score' })
      .locator('.remaining'),
  ).toHaveText('501');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('441');
  await expect(
    page
      .getByRole('article', { name: 'Practice Bot score' })
      .locator('.remaining'),
  ).toHaveText(botScore!);
  expect(
    await page.evaluate(() => localStorage.getItem('darts-master.match.v1')),
  ).toBe(before);
  await page.reload();
  await expect(
    page.getByText('PRACTICE · ROOKIE', { exact: true }),
  ).toBeVisible();
});

test('lets the opponent start and can pause and resume its turn', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Practice opponent', exact: false })
    .click();
  await page.getByLabel('Throws first').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page
    .getByRole('button', { name: 'Pause opponent', exact: true })
    .click();
  await expect(
    page.getByText('Opponent paused', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Treble 20', exact: true }),
  ).toHaveAttribute('aria-disabled', 'true');
  await page.waitForTimeout(1800);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('darts-master.match.v1')!).commands
          .length,
    ),
  ).toBe(0);
  await page
    .getByRole('button', { name: 'Resume opponent', exact: true })
    .click();
  await expect(
    page
      .getByRole('article', { name: 'Practice Bot score' })
      .locator('.stats strong')
      .last(),
  ).not.toHaveText('0');
  await expect(
    page.getByRole('button', { name: 'Treble 20', exact: true }),
  ).toHaveAttribute('aria-disabled', 'false');
  await page.getByRole('button', { name: 'Match history' }).click();
  await expect(
    page.getByRole('cell', { name: 'Practice Bot', exact: true }),
  ).toBeVisible();
});

test('resumes exactly one pending opponent turn after a refresh', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Practice opponent', exact: false })
    .click();
  await page.getByRole('button', { name: 'Start match' }).click();
  await page
    .getByRole('button', { name: 'Pause opponent', exact: true })
    .click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('100');
  await page.getByRole('button', { name: 'Record score' }).click();
  await page.reload();
  await expect(
    page.getByText('Opponent paused', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Resume opponent', exact: true })
    .click();
  await expect(page.getByLabel('Visit total')).toBeEnabled();
  await page
    .getByRole('button', { name: 'Pause opponent', exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('darts-master.match.v1')!).commands
          .length,
    ),
  ).toBe(2);
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('401');
});
