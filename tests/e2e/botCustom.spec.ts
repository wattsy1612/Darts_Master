import { expect, test } from '@playwright/test';
import { readWorkspace } from './storage';

test('custom practice controls persist, produce labelled simulated darts, and survive rematch', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Practice opponent', exact: false })
    .click();
  await page.getByRole('button', { name: 'Custom', exact: false }).click();
  const treble = page.getByRole('slider', { name: 'Treble target hit rate' });
  const double = page.getByRole('slider', {
    name: 'Double / bull target hit rate',
  });
  const single = page.getByRole('slider', {
    name: 'Single / outer bull target hit rate',
  });
  await treble.fill('100');
  await double.fill('100');
  await single.fill('100');
  await expect(page.locator('.custom-opponent')).toContainText(
    'probabilities, not a promised match average',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: '/tmp/darts-custom-opponent-phone.png',
    fullPage: true,
  });
  await page.getByLabel('Throws first').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(1);
  const saved = (await readWorkspace(page))!.data.current!;
  expect(saved.setup.botSettings).toEqual({
    version: 1,
    treble: 1,
    double: 1,
    single: 1,
  });
  expect(saved.setup.botModel).toBe(1);
  expect(saved.commands[0]).toMatchObject({
    type: 'visit',
    visit: { total: 180, darts: 3, source: 'simulated' },
  });
  await page.reload();
  await expect(
    page
      .getByRole('article', { name: 'Practice Bot score' })
      .locator('.remaining'),
  ).toHaveText('321');
  await page.getByRole('button', { name: 'All visits', exact: false }).click();
  await expect(page.locator('.history')).toContainText(
    'Custom opponent targets: treble 100% · double / bull 100%',
  );
  await page.getByRole('button', { name: 'Local scorer', exact: true }).click();
  await page.getByText('End match', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Player 1 concedes' }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  await page.getByLabel('Rematch first thrower').selectOption('0');
  await page
    .getByRole('button', { name: 'Start rematch', exact: false })
    .click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.current?.id)
    .not.toBe(saved.id);
  expect((await readWorkspace(page))!.data.current!.setup.botSettings).toEqual(
    saved.setup.botSettings,
  );
});

test('switching to presets or local play clears custom configuration and slider input is keyboard accessible', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Practice opponent', exact: false })
    .click();
  await page.getByRole('button', { name: 'Custom', exact: false }).click();
  const slider = page.getByRole('slider', {
    name: 'Double / bull target hit rate',
  });
  await slider.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('1');
  await page.getByRole('button', { name: 'Sharp', exact: false }).click();
  await expect(page.locator('.custom-opponent')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.current?.setup.bot)
    .toBe('sharp');
  expect(
    (await readWorkspace(page))!.data.current!.setup.botSettings,
  ).toBeUndefined();
  await page.getByRole('button', { name: '+ New match', exact: true }).click();
  await page.getByRole('button', { name: 'Local match', exact: false }).click();
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.current?.setup.bot)
    .toBeUndefined();
  expect(
    (await readWorkspace(page))!.data.current!.setup.botModel,
  ).toBeUndefined();
});
