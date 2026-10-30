import { expect, test } from '@playwright/test';
import { readWorkspace } from './storage';

test('records manual sources and preserves mixed coverage through refresh and undo/redo', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Record 180 points' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('60');
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(2);
  const saved = (await readWorkspace(page))!.data.current!;
  expect(
    saved.commands.map((c) => (c.type === 'visit' ? c.visit.source : null)),
  ).toEqual(['manual-segments', 'manual-total']);
  await page.reload();
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await page.getByRole('button', { name: 'Match history' }).click();
  await page.getByText('Score data and definitions', { exact: true }).click();
  await expect(page.locator('.score-evidence')).toContainText(
    'Individual segments: 3 of 3 darts across 1 visit.',
  );
  await page.getByRole('button', { name: 'Local scorer', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Match history' }).click();
  await expect(page.locator('.score-evidence')).toContainText(
    'Individual segments: 3 of 6 darts across 1 visit.',
  );
  await expect(page.locator('.score-evidence')).toContainText(
    'Totals only: 1 visit.',
  );
  await expect(page.locator('.score-evidence')).toContainText(
    'Unavailable — intended targets and attempts are not recorded.',
  );
  await expect(page.locator('.history table tbody tr').nth(0)).toContainText(
    'Manual segments',
  );
  await expect(page.locator('.history table tbody tr').nth(1)).toContainText(
    'Manual total',
  );
});

test('shows imported legacy samples and weighted profile definitions without claiming verification', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = {
    version: 1,
    id: 'legacy-metrics',
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
  const createdAt = '2026-10-30T12:00:00Z';
  await page.goto('/#/data');
  await page.getByLabel('Choose backup file').setInputFiles({
    name: 'old-records.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'darts-master-backup',
        version: 1,
        createdAt,
        workspace: {
          current: null,
          archive: [{ session, completedAt: createdAt }],
          players: [
            { id: 'a', name: 'Alice', createdAt },
            { id: 'b', name: 'Bob', createdAt },
          ],
        },
      }),
    ),
  });
  await expect(
    page.getByRole('heading', { name: 'Import preview' }),
  ).toBeVisible();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Confirm import', exact: true }).click(),
  ]);
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  const alice = page.getByRole('article', { name: 'Alice profile' });
  const summary = alice.getByText('Score data and definitions', {
    exact: true,
  });
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(alice.locator('.score-evidence')).toContainText(
    '2 recorded visits · 6 darts.',
  );
  await expect(alice.locator('.score-evidence')).toContainText(
    'Origin not recorded: 2 visits',
  );
  await expect(alice.locator('.score-evidence')).toContainText(
    '1 match is marked as imported.',
  );
  await expect(alice.locator('.score-evidence')).toContainText(
    'Unverified local record.',
  );
  await expect(alice.locator('.score-evidence')).toContainText(
    'x01-recorded-v1',
  );
  await expect(alice.locator('.profile-stat-grid')).toContainText('150.5');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: '/tmp/darts-v013-metrics-phone.png',
    fullPage: true,
  });
});

test('separates simulated bot visits from human input in practice history', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Practice opponent', exact: false })
    .click();
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('60');
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(2);
  const saved = (await readWorkspace(page))!.data.current!;
  expect(
    saved.commands.map((c) => (c.type === 'visit' ? c.visit.source : null)),
  ).toEqual(['manual-total', 'simulated']);
  await page.getByRole('button', { name: 'Match history' }).click();
  await page.getByText('Score data and definitions', { exact: true }).click();
  await expect(page.locator('.score-evidence')).toContainText(
    'Simulated: 1 visit',
  );
  await expect(page.locator('.history table tbody tr').nth(1)).toContainText(
    'Simulated',
  );
});
