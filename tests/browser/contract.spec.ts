import { test, expect } from '@playwright/test';

test('contract preview grades only on submit and leaves local study available', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore contract demo' }).click();
  const submit = page.getByRole('button', { name: 'Check answer', exact: true });
  await expect(submit).toBeDisabled();
  await page.getByRole('radio', { name: 'lumen', exact: true }).click();
  await expect(page.getByText('✓ Correct', { exact: true })).toHaveCount(0);
  await submit.click();
  await expect(page.getByText('✓ Correct', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'lumen', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(submit).toBeDisabled();
  await page.getByRole('button', { name: 'Back to study' }).click();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.getByText('Card 1 of 6', { exact: true })).toBeVisible();
});
