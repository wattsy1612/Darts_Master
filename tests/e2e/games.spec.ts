import { expect, test } from '@playwright/test';
import { readWorkspace } from './storage';

test('new local games identify their game and rules without changing score entry', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('60');
  await page.getByRole('button', { name: 'Record score' }).click();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(1);
  expect((await readWorkspace(page))!.data.current).toMatchObject({
    game: 'x01',
    rulesVersion: 'x01-configured-v1',
    version: 5,
  });
  await page.reload();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('441');
});

test('explicit other games and future rules cannot be imported as X01 even with valid X01 fields', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.current?.id)
    .toBeTruthy();
  const before = await readWorkspace(page);
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click();
  for (const patch of [
    { game: 'cricket' },
    { game: 'x01', rulesVersion: 'future-x01' },
  ]) {
    await page
      .getByLabel('Choose backup file')
      .setInputFiles({
        name: `unsupported-${patch.game}.json`,
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            format: 'darts-master-match',
            version: 1,
            session: { ...before!.data.current, ...patch },
          }),
        ),
      });
    await expect(page.getByRole('alert')).toContainText(
      patch.game === 'cricket' ? 'Cricket is not available' : 'rules version',
    );
    await expect(
      page.getByRole('button', { name: 'Confirm import', exact: true }),
    ).toHaveCount(0);
    expect(await readWorkspace(page)).toEqual(before);
  }
});
