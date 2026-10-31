import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`record action stays visible at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Start match' }).click();
    await expect(
      page.getByRole('button', { name: 'Record 0 points' }),
    ).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
    await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
    await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Record 180 points' }),
    ).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Record 180 points' }).click();
    await expect(
      page
        .getByRole('article', { name: 'Player 1 score' })
        .locator('.remaining'),
    ).toHaveText('321');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test('focus mode preserves the match and Escape returns to normal navigation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Focus mode', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Focus mode', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.getByRole('button', { name: 'Single 20', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.dart-slot.filled')).toHaveCount(1);
  await page.getByRole('button', { name: 'Focus mode', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Focus mode', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Scoreboard' })).toBeVisible();
});

test('page routes survive refresh and back/forward navigation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(page).toHaveURL(/#\/players$/);
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await expect(page).toHaveURL(/#\/history$/);
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Players', exact: true, level: 1 }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Players', exact: true, level: 1 }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: 'Every visit counts.' }),
  ).toBeVisible();
});

test('phone navigation is available from an active match', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByLabel('Match navigation').click();
  await page
    .getByRole('navigation', { name: 'Match pages' })
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Every visit counts.' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Scoreboard' })).toBeVisible();
});

test('development component gallery exposes reusable action and feedback states', async ({
  page,
}) => {
  await page.goto('/#/design-system');
  await expect(
    page.getByRole('heading', { name: 'Interface components', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Saving…' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await expect(page.getByRole('alert')).toContainText('could not be saved');
});
