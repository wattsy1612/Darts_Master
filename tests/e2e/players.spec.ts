import { expect, test } from '@playwright/test';

test('creates a profile, links a result and keeps it linked after a rename', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await page.getByLabel('New player name').fill('Wattsy');
  await page.getByRole('button', { name: 'Add player' }).click();
  await page.getByRole('button', { name: 'Play as Wattsy' }).click();
  await expect(page.getByLabel('Player 1', { exact: true })).toHaveValue(
    'Wattsy',
  );
  await page.getByLabel('Starting score').selectOption('301');
  await page.getByLabel('First to').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  for (const total of [180, 60, 121]) {
    await page.getByLabel('Visit total').fill(String(total));
    if (total === 121)
      await page.getByLabel('Last dart was a double / bull').check();
    await page.getByRole('button', { name: 'Record score' }).click();
  }
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  const profile = page.getByRole('article', { name: 'Wattsy profile' });
  await expect(profile.locator('.profile-record>strong').first()).toContainText(
    '1',
  );
  await expect(profile.locator('dl')).toContainText('150.5');
  await page
    .getByRole('button', { name: 'Rename Wattsy', exact: true })
    .click();
  await page.getByLabel('Rename player').fill('Chris');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(
    page
      .getByRole('article', { name: 'Chris profile' })
      .locator('.profile-record>strong')
      .first(),
  ).toContainText('1');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(
    page
      .getByRole('article', { name: 'Chris profile' })
      .locator('.profile-record>strong')
      .first(),
  ).toContainText('0');
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Wattsy wins', exact: true }),
  ).toBeVisible();
});

test('saves names from setup and prevents the same profile on both sides', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Player 1', { exact: true }).fill('Alice');
  await page
    .getByRole('button', { name: 'Save this player', exact: true })
    .first()
    .click();
  await page.getByLabel('Saved player 2').selectOption({ label: 'Alice' });
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(page.getByRole('alert')).toContainText('different player');
  await page.getByLabel('Saved player 2').selectOption('');
  await page.getByLabel('Player 2', { exact: true }).fill('Guest');
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(
    page.getByRole('article', { name: 'Alice score' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Alice profile' }),
  ).toBeVisible();
});

test('keeps unreadable profile data until the user chooses to reset it', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('darts-master.players.v1', '{invalid'),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('data is preserved');
  await page.getByLabel('New player name').fill('Alice');
  await page.getByRole('button', { name: 'Add player' }).click();
  expect(
    await page.evaluate(() => localStorage.getItem('darts-master.players.v1')),
  ).toBe('{invalid');
});

test('reports a profile storage failure without pretending a player was saved', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'darts-master.players.v1')
        throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await page.getByLabel('New player name').fill('Alice');
  await page.getByRole('button', { name: 'Add player' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expect(
    page.getByRole('article', { name: 'Alice profile' }),
  ).toHaveCount(0);
});

test('supports long player names on a phone without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  const name = 'A'.repeat(30);
  await page.getByLabel('New player name').fill(name);
  await page.getByRole('button', { name: 'Add player' }).click();
  await expect(
    page.getByRole('article', { name: `${name} profile` }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
