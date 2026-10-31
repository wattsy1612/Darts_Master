import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readWorkspace } from './storage';
async function names(page: Page, values: string[]) {
  for (let i = 0; i < values.length; i++)
    await page.getByLabel(`Player ${i + 1}`, { exact: true }).fill(values[i]);
}
async function keypad(page: Page) {
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
}
async function score(page: Page, total: number) {
  await page.getByLabel('Visit total').fill(String(total));
  await page.getByRole('button', { name: 'Record score' }).click();
}

test('pairs share a score while the actual members rotate, refresh and correct independently', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Player format').selectOption('pairs');
  await names(page, ['A1', 'A2', 'B1', 'B2']);
  await page.getByRole('button', { name: 'Start match' }).click();
  await keypad(page);
  for (const name of ['A1', 'B1', 'A2', 'B2']) {
    await expect(page.locator('.turn-label strong')).toHaveText(name);
    await score(page, 60);
  }
  await expect(
    page.getByRole('article', { name: 'Side 1 score' }).locator('.remaining'),
  ).toHaveText('381');
  await expect(
    page.getByRole('article', { name: 'Side 2 score' }).locator('.remaining'),
  ).toHaveText('381');
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(4);
  const saved = (await readWorkspace(page))!.data.current!,
    members = saved.setup.sides!;
  expect(saved.version).toBe(5);
  expect(
    saved.commands.map((c) =>
      c.type === 'visit' ? c.visit.participantId : null,
    ),
  ).toEqual([
    members[0].members[0].id,
    members[1].members[0].id,
    members[0].members[1].id,
    members[1].members[1].id,
  ]);
  await page.reload();
  await expect(page.locator('.turn-label strong')).toHaveText('A1');
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await expect(page.locator('.turn-label strong')).toHaveText('B2');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.turn-label strong')).toHaveText('A1');
  await page.getByRole('button', { name: 'Match history' }).click();
  await expect(
    page.getByRole('columnheader', { name: 'Thrower', exact: true }),
  ).toBeVisible();
  const rows = page.locator('.history table tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(2)).toContainText('A2');
});

test('team outcomes stay shared while saved profiles receive only their own darts and checkout', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Player format').selectOption('pairs');
  await names(page, ['Alice', 'Andy', 'Bob', 'Beth']);
  for (let i = 0; i < 4; i++) {
    await page
      .locator('.roster-member')
      .nth(i)
      .getByRole('button', { name: 'Save this player', exact: true })
      .click();
    await expect(page.getByLabel(`Saved player ${i + 1}`)).not.toHaveValue('');
  }
  await page
    .getByLabel('Starting score', { exact: false })
    .selectOption('custom');
  await page.getByLabel('Custom starting score').fill('101');
  await page.getByLabel('Finishing rule').selectOption('straight');
  await page.getByLabel('First to').selectOption('1');
  await page.getByRole('button', { name: 'Start match' }).click();
  await keypad(page);
  await score(page, 60);
  await score(page, 0);
  await score(page, 41);
  await expect(
    page.getByRole('heading', { name: 'Side 1 wins the match!' }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await page.getByLabel('Record format').selectOption('team');
  const alice = page.getByRole('article', { name: 'Alice profile' }),
    andy = page.getByRole('article', { name: 'Andy profile' });
  await expect(alice.locator('.profile-record>strong').first()).toContainText(
    '1',
  );
  await expect(andy.locator('.profile-record>strong').first()).toContainText(
    '1',
  );
  await expect(
    alice
      .locator('dl div')
      .filter({ has: page.getByText('3-dart average', { exact: true }) })
      .locator('dd'),
  ).toHaveText('60.0');
  await expect(
    andy
      .locator('dl div')
      .filter({ has: page.getByText('3-dart average', { exact: true }) })
      .locator('dd'),
  ).toHaveText('41.0');
  await expect(
    alice
      .locator('dl div')
      .filter({ has: page.getByText('Highest checkout', { exact: true }) })
      .locator('dd'),
  ).toHaveText('—');
  await expect(
    andy
      .locator('dl div')
      .filter({ has: page.getByText('Highest checkout', { exact: true }) })
      .locator('dd'),
  ).toHaveText('41');
  await page.getByRole('button', { name: 'Match history' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export match' }).click();
  const { readFile } = await import('node:fs/promises');
  const content = await readFile((await (await download).path())!, 'utf8');
  await page.getByRole('button', { name: 'Data & backups' }).click();
  await page.getByLabel('Choose backup file').setInputFiles({
    name: 'pairs.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
  await expect(page.locator('.import-preview')).toContainText(
    '1 duplicate matches skipped',
  );
});

test('multiplayer rotates three sides, skips withdrawals and retains an honest final outcome', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Player format').selectOption('multiplayer');
  await names(page, ['Alice', 'Bob', 'Chris']);
  await page.getByLabel('Throws first').selectOption('2');
  await page.getByRole('button', { name: 'Start match' }).click();
  await keypad(page);
  await expect(page.locator('.turn-label strong')).toHaveText('Chris');
  await score(page, 60);
  await expect(page.locator('.turn-label strong')).toHaveText('Alice');
  await page.getByText('End match', { exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Alice withdraws' }).click();
  await expect(page.locator('.turn-label strong')).toHaveText('Bob');
  await expect(
    page.getByRole('article', { name: 'Alice score' }),
  ).toContainText('WITHDRAWN');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Bob withdraws' }).click();
  await expect(
    page.getByRole('heading', { name: 'Chris wins by concession' }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readWorkspace(page))?.data.archive.length)
    .toBe(1);
  const stored = (await readWorkspace(page))!.data.current!;
  expect(
    stored.commands
      .filter((c) => c.type === 'concede')
      .every((c) => c.type === 'concede' && !!c.sideId),
  ).toBe(true);
  await page.getByRole('button', { name: 'View match summary' }).click();
  await expect(page.locator('.result-score')).toHaveText('0 — 0 — 0');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test('team setup permits unequal sizes and explicit order without changing the selected identities', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Player format').selectOption('teams');
  await names(page, ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
  await page
    .getByRole('button', { name: 'Remove player 6', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Move player 1 down', exact: true })
    .click();
  await page.getByLabel('Member order between legs').selectOption('continue');
  await page.getByRole('button', { name: 'Start match' }).click();
  await keypad(page);
  for (const member of ['A2', 'B1', 'A1', 'B2', 'A3']) {
    await expect(page.locator('.turn-label strong')).toHaveText(member);
    await score(page, 0);
  }
  await expect
    .poll(
      async () => (await readWorkspace(page))?.data.current?.commands.length,
    )
    .toBe(5);
  const setup = (await readWorkspace(page))!.data.current!.setup;
  expect(setup.sides!.map((s) => s.members.length)).toEqual([3, 2]);
  expect(setup.memberRotation).toBe('continue');
});

test('multiplayer reordering retains stable member IDs and additional player controls respect the limit', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Player format').selectOption('multiplayer');
  await names(page, ['Alice', 'Bob', 'Chris']);
  for (let i = 0; i < 5; i++)
    await page
      .getByRole('button', { name: 'Add local player', exact: true })
      .click();
  await expect(
    page.getByRole('button', { name: 'Add local player', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Move side 3 up', exact: true })
    .click();
  await page.getByRole('button', { name: 'Start match' }).click();
  await keypad(page);
  await expect(page.locator('.turn-label strong')).toHaveText('Alice');
  await score(page, 0);
  await expect(page.locator('.turn-label strong')).toHaveText('Chris');
  await expect(page.getByRole('article')).toHaveCount(8);
});

test('a rematch preserves unavailable legacy profile references without guessing an identity from names', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'darts-master.match.v1',
      JSON.stringify({
        version: 4,
        id: 'missing-profile-match',
        setup: {
          players: ['Alice', 'Bob'],
          playerIds: ['missing-profile', null],
          start: 301,
          legsToWin: 1,
        },
        commands: [{ type: 'concede', player: 1 }],
      }),
    ),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Alice wins by concession' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Start rematch', exact: true })
    .click();
  await expect(page.getByRole('article', { name: 'Bob score' })).toContainText(
    'THROWING',
  );
  await expect
    .poll(async () => (await readWorkspace(page))?.data.current?.version)
    .toBe(5);
  const saved = (await readWorkspace(page))!;
  expect(saved.data.current!.setup.sides![0].members[0]).toMatchObject({
    name: 'Alice',
    profileId: 'missing-profile',
  });
  expect(saved.data.players).toEqual([]);
  expect(saved.data.archive[0].session.id).toBe('missing-profile-match');
});
