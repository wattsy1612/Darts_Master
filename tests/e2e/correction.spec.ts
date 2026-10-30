import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { readWorkspace } from './storage';
import type { Page } from '@playwright/test';
async function score(page: Page, total: number) {
  await page.getByLabel('Visit total').fill(String(total));
  await page.getByRole('button', { name: 'Record score' }).click();
}
async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  for (const n of [60, 60, 60]) await score(page, n);
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(3);
}
async function review(page: Page, n: number, total: number) {
  await page
    .getByRole('button', { name: `Correct visit ${n}`, exact: true })
    .click();
  await expect(page.getByLabel('Corrected visit total')).toBeFocused();
  await page.getByLabel('Corrected visit total').fill(String(total));
  await page
    .getByRole('button', { name: 'Preview correction', exact: true })
    .click();
}

test('reviews an earlier visit, atomically recalculates, refreshes and restores recovery', async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await review(page, 1, 100);
  const preview = page.getByRole('region', { name: 'Correction consequences' });
  await expect(preview).toContainText(
    '1 following visit changes score or outcome',
  );
  const before = (await readWorkspace(page))!.data.current!;
  await page
    .getByRole('button', { name: 'Apply reviewed correction', exact: true })
    .click();
  await expect
    .poll(async () => {
      const c = (await readWorkspace(page))?.data.current?.commands[0];
      return c?.type === 'visit' ? c.visit.total : null;
    })
    .toBe(100);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Undo last correction' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Undo last correction' }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.current)
    .toEqual(before);
  await expect(
    page.getByRole('button', { name: 'Undo last correction' }),
  ).toBeDisabled();
});

test('requires acknowledgement before removing later actions and protects a draft on apply', async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel('Visit total').fill('26');
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await review(page, 1, 100);
  await page.getByLabel('Following actions').selectOption('discard-following');
  await page
    .getByRole('button', { name: 'Preview correction', exact: true })
    .click();
  const apply = page.getByRole('button', {
    name: 'Apply reviewed correction',
    exact: true,
  });
  await expect(apply).toBeDisabled();
  await page
    .getByLabel(
      'Remove 2 following actions, including any later scores and match controls',
    )
    .check();
  page.once('dialog', (d) => d.dismiss());
  await apply.click();
  expect((await readWorkspace(page))!.data.current!.commands).toHaveLength(3);
  page.once('dialog', (d) => d.accept());
  await apply.click();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(1);
  await page.getByRole('button', { name: 'Local scorer', exact: true }).click();
  await expect(page.getByLabel('Visit total')).toHaveValue('');
});

test('later saves disable direct undo but retain a downloadable pre-correction backup', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByRole('button', { name: 'All visits', exact: false }).click();
  await review(page, 1, 100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: '/tmp/darts-correction-phone.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Apply reviewed correction', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Undo last correction' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Local scorer', exact: true }).click();
  await score(page, 26);
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(4);
  await page.getByRole('button', { name: 'All visits', exact: false }).click();
  await expect(
    page.getByRole('button', { name: 'Undo last correction' }),
  ).toBeDisabled();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download pre-correction backup' })
    .click();
  const recoveryFile = await download;
  expect(recoveryFile.suggestedFilename()).toBe('darts-before-correction.json');
  const recovery = JSON.parse(
    await readFile((await recoveryFile.path())!, 'utf8'),
  );
  expect(recovery.format).toBe('darts-master-backup');
  expect(recovery.workspace.current.commands).toHaveLength(3);
  expect(recovery.workspace.current.commands[0].visit.total).toBe(60);
});

test('failed saving retains the reviewed source and original workspace', async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await review(page, 1, 100);
  const before = await readWorkspace(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === 'current')
        throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await page
    .getByRole('button', { name: 'Apply reviewed correction', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(/Full|saved|quota/i);
  expect(await readWorkspace(page)).toEqual(before);
  await expect(
    page.getByRole('button', { name: 'Cancel correction' }),
  ).toBeVisible();
});

test('reopening an archived result requires replacing the current game and can restore both', async ({
  page,
}) => {
  const archived = {
    version: 1,
    id: 'old-final',
    setup: { players: ['A', 'B'], start: 301, legsToWin: 1 },
    commands: [
      { type: 'visit', visit: { total: 180, darts: 3, double: false } },
      { type: 'visit', visit: { total: 0, darts: 3, double: false } },
      { type: 'visit', visit: { total: 121, darts: 3, double: true } },
    ],
  };
  const date = '2026-10-30T12:00:00Z';
  await page.goto('/#/data');
  await page.getByLabel('Choose backup file').setInputFiles({
    name: 'archive.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'darts-master-backup',
        version: 1,
        createdAt: date,
        workspace: {
          current: null,
          archive: [{ session: archived, completedAt: date }],
          players: [],
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
  await page.getByRole('button', { name: 'Local scorer', exact: true }).click();
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.current?.id)
    .toBeTruthy();
  const before = (await readWorkspace(page))!.data;
  await page
    .getByRole('button', { name: 'Match history', exact: true })
    .click();
  await page.getByLabel('Choose a match').selectOption('old-final');
  await page
    .getByRole('button', { name: 'Correct visit 3', exact: true })
    .click();
  await page.getByLabel('Corrected visit total').fill('100');
  await page.getByLabel('Finishing dart was a double / bull').uncheck();
  await page
    .getByRole('button', { name: 'Preview correction', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Correction consequences' }),
  ).toContainText('This result reopens for play');
  const apply = page.getByRole('button', {
    name: 'Apply reviewed correction',
    exact: true,
  });
  await expect(apply).toBeDisabled();
  await page
    .getByLabel('Replace the current game with this reopened match.', {
      exact: false,
    })
    .check();
  await apply.click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.current?.id)
    .toBe('old-final');
  expect((await readWorkspace(page))!.data.archive).toHaveLength(0);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Undo last correction' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Undo last correction' }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data)
    .toEqual(before);
});
