import { expect, test } from '@playwright/test';
import { readWorkspace } from './storage';
async function custom(page: import('@playwright/test').Page) {
  await page.getByLabel('Starting score').selectOption('custom');
  await page.getByLabel('Custom starting score').fill('101');
}

test('double-in board draft ignores earlier darts and resumes with the chosen rules', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Starting score').selectOption('301');
  await page.getByLabel('Opening rule').selectOption('double');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await expect(page.locator('.dart-slot.filled span')).toHaveText('0 pts');
  await expect(page.locator('.dart-preview strong')).toHaveText('301');
  await page.getByRole('button', { name: 'Double 20', exact: true }).click();
  await expect(page.locator('.dart-preview strong')).toHaveText('261');
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Restore visit draft' }).click();
  await expect(page.locator('.dart-preview strong')).toHaveText('261');
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Record 100 points' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('201');
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Miss / bounce-out' }).click();
  await page.getByRole('button', { name: 'Record 0 points' }).click();
  await expect(page.locator('.opening-notice')).toHaveCount(0);
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Single 20', exact: true }).click();
  await page.getByRole('button', { name: 'Record 60 points' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('141');
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(3);
  const saved = (await readWorkspace(page))!.data.current!;
  expect(saved.version).toBe(2);
  expect(saved.setup.inRule).toBe('double');
  expect(saved.commands[0]).toMatchObject({
    visit: { total: 100, opens: true },
  });
});

test('double-in keypad requires a valid combined opening and finish and preserves the declaration', async ({
  page,
}) => {
  await page.goto('/');
  await custom(page);
  await page.getByLabel('Opening rule').selectOption('double');
  await page.getByLabel('First to').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('101');
  await page.getByLabel('Darts thrown').selectOption('2');
  await page.getByLabel('Opened on a double this visit').check();
  await page.getByLabel('Last dart was a double / bull').check();
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(page.getByRole('alert')).toContainText('cannot end on a double');
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Restore visit draft' }).click();
  await expect(page.getByLabel('Opened on a double this visit')).toBeChecked();
  await expect(page.getByLabel('Darts thrown')).toHaveValue('2');
  await page.getByLabel('Darts thrown').selectOption('3');
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins the match!' }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  const visit = (await readWorkspace(page))!.data.archive[0].session
    .commands[0];
  expect(visit).toMatchObject({ visit: { total: 101, opens: true } });
  expect(visit.type === 'visit' && visit.visit.hits).toBeUndefined();
});

test('straight out allows one remaining and a one-dart single finish', async ({
  page,
}) => {
  await page.goto('/');
  await custom(page);
  await page.getByLabel('Finishing rule').selectOption('straight');
  await page.getByLabel('First to').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Double 20', exact: true }).click();
  await expect(page.locator('.dart-preview strong')).toHaveText('1');
  await page.getByRole('button', { name: 'Miss / bounce-out' }).click();
  await page.getByRole('button', { name: 'Record 100 points' }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Miss / bounce-out' }).click();
  await page.getByRole('button', { name: 'Record 0 points' }).click();
  await page.getByRole('button', { name: 'Single 1', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm game shot' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins the match!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'View match summary' }).click();
  await expect(page.locator('.result-banner')).toContainText('Straight out');
  await expect(
    page.getByRole('cell', { name: 'Game shot', exact: true }),
  ).toBeVisible();
});

test('sets advance with the selected starter policy, survive refresh and correct the final result', async ({
  page,
}) => {
  await page.goto('/');
  await custom(page);
  await page.getByLabel('Finishing rule').selectOption('straight');
  await page.getByLabel('Match format').selectOption('sets');
  await page.getByLabel('Sets to win').selectOption('2');
  await page.getByLabel('Legs per set to win').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('101');
  await expect(page.getByLabel('Last dart was a double / bull')).toHaveCount(0);
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 takes the set.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next set' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 2 score' }),
  ).toContainText('THROWING');
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(2);
  await page.reload();
  await expect(page.locator('.match-meta')).toContainText('SET 2');
  await page.getByLabel('Visit total').fill('0');
  await page.getByRole('button', { name: 'Record score' }).click();
  await page.getByLabel('Visit total').fill('101');
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins the match!' }),
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
  await expect(page.locator('.result-score')).toHaveText('2 — 0 sets');
  await expect(
    page.getByRole('columnheader', { name: 'Set', exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export match' }).click();
  const { readFile } = await import('node:fs/promises');
  const exported = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(exported.session.version).toBe(2);
  expect(exported.result.sets).toEqual([2, 0]);
  await page.getByRole('button', { name: 'Data & backups' }).click();
  await page.getByLabel('Choose backup file').setInputFiles({
    name: 'sets.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(
    page.getByRole('heading', { name: 'Import preview' }),
  ).toBeVisible();
  await expect(page.locator('.import-preview')).toContainText(
    '1 duplicate matches skipped',
  );
});
