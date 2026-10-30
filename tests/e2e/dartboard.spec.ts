import { expect, test } from '@playwright/test';

test('the scoring front has an interactive board and records three darts', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  const treble = page.getByRole('button', { name: 'Treble 20', exact: true });
  await expect(treble).toBeVisible();
  await treble.click();
  await treble.click();
  await treble.click();
  await expect(page.locator('.dart-slot.filled')).toHaveCount(3);
  await expect(page.locator('.dart-preview strong')).toHaveText('321');
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('501');
  await expect(treble).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Record 180 points' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('321');
  await expect(page.locator('.dart-slot.filled')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Match history' }).click();
  await expect(page.locator('.history-hit-labels')).toHaveText(
    'T20 · T20 · T20',
  );
});

test('recognises a real checkout without a manual double checkbox', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'darts-master.match.v1',
      JSON.stringify({
        version: 1,
        id: 'checkout-test',
        setup: { players: ['Alice', 'Bob'], start: 301, legsToWin: 1 },
        commands: [
          { type: 'visit', visit: { total: 180, darts: 3, double: false } },
          { type: 'visit', visit: { total: 0, darts: 3, double: false } },
        ],
      }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Treble 11', exact: true }).click();
  await expect(page.locator('.draft-checkout strong')).toHaveText('D14');
  await page.getByRole('button', { name: 'Double 14', exact: true }).click();
  await expect(page.locator('.dart-preview strong')).toHaveText('0');
  await page.getByRole('button', { name: 'Confirm game shot' }).click();
  await expect(
    page.getByRole('heading', { name: 'Alice wins the match!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await expect(
    page.getByRole('article', { name: 'Alice score' }).locator('.remaining'),
  ).toHaveText('121');
  await expect(page.locator('.dart-slot.filled')).toHaveCount(0);
});

test('supports larger phone targets, early busts and correcting a draft dart', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'darts-master.match.v1',
      JSON.stringify({
        version: 1,
        id: 'bust-test',
        setup: { players: ['Alice', 'Bob'], start: 301, legsToWin: 1 },
        commands: [
          { type: 'visit', visit: { total: 180, darts: 3, double: false } },
          { type: 'visit', visit: { total: 0, darts: 3, double: false } },
          { type: 'visit', visit: { total: 100, darts: 3, double: false } },
          { type: 'visit', visit: { total: 0, darts: 3, double: false } },
        ],
      }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Need larger targets?' }).click();
  await page
    .locator('.number-targets')
    .getByRole('button', { name: '20', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Record bust' })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Miss / bounce-out' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Remove last dart' }).click();
  await page
    .locator('.number-targets')
    .getByRole('button', { name: '1', exact: true })
    .click();
  await page.getByRole('button', { name: 'Double', exact: true }).click();
  await page
    .locator('.number-targets')
    .getByRole('button', { name: '10', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm game shot' }).click();
  await expect(
    page.getByRole('heading', { name: 'Alice wins the match!' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('retains keypad entry as an alternative and remembers the choice', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('60');
  await page.getByRole('button', { name: 'Record score' }).click();
  await page.reload();
  await expect(page.getByLabel('Visit total')).toBeVisible();
  await page.getByRole('button', { name: 'Dartboard', exact: false }).click();
  await page
    .getByRole('button', { name: 'Inner bull 50', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  const outerBull = page.getByRole('button', {
    name: 'Outer bull 25',
    exact: true,
  });
  const ring = await outerBull.boundingBox();
  await outerBull.click({
    position: { x: ring!.width * 0.85, y: ring!.height * 0.5 },
  });
  await page.getByRole('button', { name: 'Miss / bounce-out' }).click();
  await page.getByRole('button', { name: 'Record 75 points' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 2 score' }).locator('.remaining'),
  ).toHaveText('426');
});

test('records an early bust with one actual dart and updates averages correctly', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'darts-master.match.v1',
      JSON.stringify({
        version: 1,
        id: 'early-bust',
        setup: { players: ['Alice', 'Bob'], start: 301, legsToWin: 1 },
        commands: [
          { type: 'visit', visit: { total: 180, darts: 3, double: false } },
          { type: 'visit', visit: { total: 0, darts: 3, double: false } },
          { type: 'visit', visit: { total: 100, darts: 3, double: false } },
          { type: 'visit', visit: { total: 0, darts: 3, double: false } },
        ],
      }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Single 20', exact: true }).click();
  await page.getByRole('button', { name: 'Record bust' }).click();
  await expect(
    page.getByRole('article', { name: 'Alice score' }).locator('.remaining'),
  ).toHaveText('21');
  await expect(
    page
      .getByRole('article', { name: 'Alice score' })
      .locator('.stats strong')
      .first(),
  ).toHaveText('120.0');
  const last = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('darts-master.match.v1')!).commands.at(-1)
        .visit,
  );
  expect(last).toMatchObject({
    total: 20,
    darts: 1,
    double: false,
    hits: [{ number: 20, multiplier: 1 }],
  });
});
