import { expect, test } from '@playwright/test';
import { readWorkspace } from './storage';
async function bullMatch(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('Choose the starter').selectOption('bull-off');
  await page.getByRole('button', { name: 'Start match' }).click();
}
test('bull-off ties reverse order, survive refresh, and give the match to the decided starter', async ({
  page,
}) => {
  await bullMatch(page);
  const bull = page.getByRole('region', { name: 'Bull-off', exact: true });
  await expect(bull.getByRole('heading')).toHaveText(
    'Player 1 throws for the bull',
  );
  await expect(page.getByRole('region', { name: 'Score entry' })).toBeHidden();
  await bull.getByRole('button', { name: 'Inner bull', exact: true }).click();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(1);
  await bull.getByRole('button', { name: 'Undo bull-off action' }).click();
  await expect(bull.getByRole('heading')).toHaveText(
    'Player 1 throws for the bull',
  );
  await bull.getByRole('button', { name: 'Inner bull', exact: true }).click();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(1);
  await page.reload();
  await expect(bull.getByRole('heading')).toHaveText(
    'Player 2 throws for the bull',
  );
  await bull.getByRole('button', { name: 'Inner bull', exact: true }).click();
  await expect(bull.getByRole('heading')).toHaveText(
    'Player 2 throws for the bull',
  );
  await expect(bull).toContainText('Tie · reverse order');
  await bull.getByRole('button', { name: 'Outer bull', exact: true }).click();
  await bull.getByRole('button', { name: 'Outside bull', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Player 2 score' }),
  ).toContainText('THROWING');
  await expect(
    page.getByRole('button', { name: 'Treble 20', exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(4);
  const saved = (await readWorkspace(page))!.data.current!;
  expect(saved.version).toBe(5);
  expect(saved.commands.every((c) => c.type === 'bull-throw')).toBe(true);
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await expect(bull.getByRole('heading')).toHaveText(
    'Player 1 throws for the bull',
  );
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Match history' }).click();
  await expect(
    page.getByRole('region', { name: 'Bull-off', exact: true }),
  ).toContainText('Player 2 won the bull-off');
  await expect(
    page.getByRole('heading', { name: 'Visit by visit' }),
  ).toBeVisible();
  await expect(
    page.getByText('No visits yet. Start a match and step up to the board.'),
  ).toBeVisible();
});

test('outside darts need a declared closer dart and bull-off progress can pause and rethrow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bullMatch(page);
  const bull = page.getByRole('region', { name: 'Bull-off', exact: true });
  await bull.getByRole('button', { name: 'Outside bull', exact: true }).click();
  await page.getByRole('button', { name: 'Pause match', exact: true }).click();
  await expect(
    bull.getByRole('button', { name: 'Outside bull', exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(2);
  await page.reload();
  await page.getByRole('button', { name: 'Resume match', exact: true }).click();
  await expect(bull.getByRole('heading')).toHaveText(
    'Player 2 throws for the bull',
  );
  await bull.getByRole('button', { name: 'Outside bull', exact: true }).click();
  await expect(bull.getByRole('heading')).toHaveText('Compare the darts');
  await bull
    .getByRole('button', { name: 'Too close to call · rethrow' })
    .click();
  await expect(bull.getByRole('heading')).toHaveText(
    'Player 2 throws for the bull',
  );
  await bull.getByRole('button', { name: 'Outer bull', exact: true }).click();
  await bull
    .getByRole('button', { name: 'Dart dislodged · both rethrow' })
    .click();
  await expect(bull.getByRole('heading')).toHaveText(
    'Player 1 throws for the bull',
  );
  await bull.getByRole('button', { name: 'Outside bull', exact: true }).click();
  await bull.getByRole('button', { name: 'Outside bull', exact: true }).click();
  await bull
    .getByRole('button', { name: 'Confirm Player 2 is closer' })
    .click();
  await expect(
    page.getByRole('article', { name: 'Player 2 score' }),
  ).toContainText('THROWING');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test('a saved unfinished bull-off is protected when replacing the match and restored through backup review', async ({
  page,
}) => {
  await bullMatch(page);
  await page
    .getByRole('region', { name: 'Bull-off', exact: true })
    .getByRole('button', { name: 'Outer bull', exact: true })
    .click();
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(1);
  await page.getByRole('button', { name: '+ New match' }).click();
  await expect(page.getByLabel('Replace my unfinished match')).toBeVisible();
  await page.getByRole('button', { name: 'Back to match' }).click();
  await page.getByRole('button', { name: 'Match history' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export match' }).click();
  const { readFile } = await import('node:fs/promises');
  const content = await readFile((await (await download).path())!, 'utf8');
  await page.getByRole('button', { name: 'Data & backups' }).click();
  await page.getByLabel('Choose backup file').setInputFiles({
    name: 'bull.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
  await expect(
    page.getByRole('heading', { name: 'Import preview' }),
  ).toBeVisible();
  await expect(page.getByLabel('Restore the in-progress match')).toBeVisible();
});

test('practice shows its bull-off capability boundary instead of inventing a physical opponent dart', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Practice opponent', exact: false })
    .click();
  await expect(
    page.getByRole('option', {
      name: 'Throw for the bull (two local players)',
      exact: true,
    }),
  ).toHaveJSProperty('disabled', true);
  await expect(
    page.getByText(
      'Practice uses a chosen starter. Bull-off requires two physical players.',
    ),
  ).toBeVisible();
  await page.getByLabel('Throws first').selectOption('0');
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(
    page.getByRole('region', { name: 'Bull-off', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Treble 20', exact: true }),
  ).toBeVisible();
});
