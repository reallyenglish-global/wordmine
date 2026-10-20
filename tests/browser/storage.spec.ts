import { test, expect } from '@playwright/test';

test('storage denial is visible and does not stop temporary practice', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () { throw new Error('Storage denied by browser'); };
    Storage.prototype.setItem = function () { throw new Error('Storage denied by browser'); };
  });
  await page.goto('/');
  await expect(page.getByText('Storage unavailable. Practice is temporary until a save succeeds.')).toBeVisible();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await page.getByRole('button', { name: 'Choose glimmer' }).click();
  await expect(page.getByText('Correct.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.getByText('Card 2 of 6', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start practice' })).toBeVisible();
});

test('corrupt local JSON falls back to a usable new session', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wm-next:study:synthetic-en:1', '{broken'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.getByText('Card 1 of 6', { exact: true })).toBeVisible();
});
