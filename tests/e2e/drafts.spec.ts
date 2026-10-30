import { expect, test } from '@playwright/test';
import { readWorkspace } from './storage';

test('refresh offers an exact-turn board draft and records it only after confirmation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Single 5', exact: true }).click();
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  expect((await readWorkspace(page))!.data.current!.commands).toHaveLength(0);
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Unsubmitted visit recovery' }),
  ).toContainText('Player 1');
  await expect(
    page.getByRole('button', { name: 'Treble 20', exact: true }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Restore visit draft' }).click();
  await expect(page.locator('.dart-slot.filled')).toHaveCount(2);
  await expect(page.locator('.dart-slot.filled strong')).toHaveText([
    'T20',
    'S5',
  ]);
  await page.getByRole('button', { name: 'Single 20', exact: true }).click();
  await page.getByRole('button', { name: 'Record 85 points' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('416');
  await expect
    .poll(
      async () => (await readWorkspace(page))!.data.current!.commands.length,
    )
    .toBe(1);
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Unsubmitted visit recovery' }),
  ).toHaveCount(0);
  await expect(page.locator('.dart-slot.filled')).toHaveCount(0);
});

test('keypad draft retains total, dart count and finishing double, or can be discarded', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Starting score').selectOption('301');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Keypad', exact: false }).click();
  await page.getByLabel('Visit total').fill('180');
  await page.getByRole('button', { name: 'Record score' }).click();
  await page.getByLabel('Visit total').fill('0');
  await page.getByRole('button', { name: 'Record score' }).click();
  await page.getByLabel('Visit total').fill('121');
  await page.getByLabel('Last dart was a double / bull').check();
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Restore visit draft' }).click();
  await expect(page.getByLabel('Visit total')).toHaveValue('121');
  await expect(page.getByLabel('Last dart was a double / bull')).toBeChecked();
  await page.getByLabel('Darts thrown').selectOption('2');
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Restore visit draft' }).click();
  await expect(page.getByLabel('Darts thrown')).toHaveValue('2');
  await expect(page.getByLabel('Last dart was a double / bull')).toBeChecked();
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Discard visit draft' }).click();
  await expect(page.getByLabel('Visit total')).toHaveValue('');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const request = indexedDB.open('darts-master-local');
        return new Promise((resolve) => {
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('workspace', 'readonly');
            const r = tx.objectStore('workspace').getAllKeys();
            r.onsuccess = () =>
              resolve(
                r.result.filter((k) => String(k).startsWith('draft:')).length,
              );
            tx.oncomplete = () => db.close();
          };
        });
      }),
    )
    .toBe(0);
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Unsubmitted visit recovery' }),
  ).toHaveCount(0);
});

test('navigation retains unsubmitted darts, while recording and undo start with an empty draft', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Match history' }).click();
  await page.getByRole('button', { name: 'Local scorer' }).click();
  await expect(page.locator('.dart-slot.filled')).toHaveCount(1);
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await expect(
    page.getByText('Draft saved in this tab', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Record 180 points' }).click();
  await page.getByRole('button', { name: 'Undo last action' }).click();
  await expect(page.locator('.dart-slot.filled')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Unsubmitted visit recovery' }),
  ).toHaveCount(0);
});

test('a draft storage failure is visible and leaves scoring usable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (typeof key === 'string' && key.startsWith('draft:'))
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, value, key!);
    };
  });
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await expect(page.getByText(/Draft not saved/)).toBeVisible();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Treble 20', exact: true }).click();
  await page.getByRole('button', { name: 'Record 180 points' }).click();
  await expect(
    page.getByRole('article', { name: 'Player 1 score' }).locator('.remaining'),
  ).toHaveText('321');
});
