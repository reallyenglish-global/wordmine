import { test, expect } from '@playwright/test';

test('installable web manifest and precached app resume after a real offline reload', async ({ page, context }) => {
  await page.goto('/');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest = await (await page.request.get(manifestHref!)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '192x192')).toBe(true);
  expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '512x512')).toBe(true);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole('button', { name: 'Start practice' }).click();
  await page.getByRole('button', { name: 'Choose glimmer' }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Resume practice' }).click();
  await expect(page.getByText('Correct.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.getByText('Card 2 of 6', { exact: true })).toBeVisible();
});
