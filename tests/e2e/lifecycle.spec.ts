import { expect, test } from '@playwright/test';
import { readWorkspace, failWrites } from './storage';

test('full match pause survives refresh and blocks the pending opponent until resumed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Practice opponent', exact: false })
    .click();
  await page.getByLabel('Throws first').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Pause match', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Match paused', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await readWorkspace(page))?.data.current?.commands.map((c) => c.type),
    )
    .toEqual(['pause']);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Match paused', exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1700);
  expect(
    (await readWorkspace(page))!.data.current!.commands.map((c) => c.type),
  ).toEqual(['pause']);
  await expect(page.getByRole('region', { name: 'Score entry' })).toBeHidden();
  await page.getByRole('button', { name: 'Resume match', exact: true }).click();
  await expect
    .poll(async () =>
      (await readWorkspace(page))?.data.current?.commands.map((c) => c.type),
    )
    .toEqual(['pause', 'resume', 'visit']);
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }),
  ).toContainText('THROWING');
});

test('pause warns about an unsubmitted draft, cancellation preserves it and resume starts empty', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('draft will be discarded');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Pause match', exact: true }).click();
  await expect(page.locator('.dart-slot.filled')).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Pause match', exact: true }).click();
  await page.getByRole('button', { name: 'Resume match', exact: true }).click();
  await expect(page.locator('.dart-slot.filled')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Unsubmitted visit recovery' }),
  ).toHaveCount(0);
});

test('concession is explicit, correctable and rematch retains the original result', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect
    .poll(async () => !!(await readWorkspace(page))?.data.current?.id)
    .toBe(true);
  const firstId = (await readWorkspace(page))!.data.current!.id;
  await page.getByText('End match', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Player 1 concedes' }).click();
  await expect(
    page.getByRole('button', { name: 'Pause match', exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Player 1 concedes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 2 wins by concession' }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  await page.getByRole('button', { name: 'View match summary' }).click();
  await expect(page.locator('.result-banner')).toContainText(
    'DECIDED BY CONCESSION',
  );
  await expect(
    page.getByRole('region', { name: 'Match action history' }),
  ).toContainText('Player 1 conceded');
  await page.getByRole('button', { name: 'Local scorer' }).click();
  await page.getByLabel('Rematch first thrower').selectOption('1');
  await page
    .getByRole('button', { name: 'Start rematch', exact: true })
    .click();
  await expect(
    page.getByRole('article', { name: 'Player 2 score' }),
  ).toContainText('THROWING');
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(0);
  const saved = (await readWorkspace(page))!;
  expect(saved.data.current!.id).not.toBe(firstId);
  expect(saved.data.archive).toHaveLength(1);
  expect(saved.data.archive[0].session.id).toBe(firstId);
});

test('abandonment remains in history with no winner and survives backup review', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByText('End match', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Abandon without a winner' }).click();
  await expect(
    page.getByRole('heading', { name: 'Match abandoned', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'View match summary' }).click();
  await expect(page.locator('.result-banner')).toContainText(
    'ABANDONED · NO WINNER',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export match' }).click();
  const { readFile } = await import('node:fs/promises');
  const content = await readFile((await (await download).path())!, 'utf8');
  expect(JSON.parse(content).result).toMatchObject({
    winner: null,
    status: 'abandoned',
  });
  await page.getByRole('button', { name: 'Data & backups' }).click();
  await page.getByLabel('Choose backup file').setInputFiles({
    name: 'abandoned.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
  await expect(
    page.getByRole('heading', { name: 'Import preview' }),
  ).toBeVisible();
  await expect(page.locator('.import-preview')).toContainText(
    '1 duplicate matches skipped',
  );
});

test('an unsaved concession cannot be replaced by a rematch or an unconfirmed new match', async ({
  page,
}) => {
  await failWrites(page, 'archive');
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect
    .poll(async () => !!(await readWorkspace(page))?.data.current)
    .toBe(true);
  await page.getByText('End match', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Player 1 concedes' }).click();
  await expect(
    page.getByText(/Some match data could not be saved/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Start rematch', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '+ New match' }).click();
  await expect(
    page.getByLabel('Continue without saving this result'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Confirm that you want to replace',
  );
});
