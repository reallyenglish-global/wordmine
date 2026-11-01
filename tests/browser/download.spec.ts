import { test, expect, type Page } from '@playwright/test';

async function openPackLibrary(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore online and offline packs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Online & offline packages', exact: true })).toBeVisible();
}

test('online sample learning works without storing a downloaded pack', async ({ page }) => {
  await openPackLibrary(page);
  await page.getByRole('button', { name: 'Study sample online', exact: true }).click();
  await expect(page.getByText('Package card 1 of 6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to study', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download sample for offline use', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open downloaded sample', exact: true })).toHaveCount(0);
});

test('a downloaded sample stays out of the shell cache and can be studied after an offline reload', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await openPackLibrary(page);
  await page.getByRole('button', { name: 'Download sample for offline use', exact: true }).click();
  await expect(page.getByText('Sample pack downloaded for offline use.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open downloaded sample', exact: true })).toBeVisible();

  const storedCount = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('wordmine-offline-packs-v0', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const count = await new Promise<number>((resolve, reject) => {
      const request = db.transaction('packs', 'readonly').objectStore('packs').count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return count;
  });
  expect(storedCount).toBe(1);

  const sampleInShellCache = await page.evaluate(async () => {
    const sampleUrl = new URL('./sample-pack/manifest.json', document.baseURI).href;
    const cacheNames = await caches.keys();
    for (const name of cacheNames) if (await (await caches.open(name)).match(sampleUrl)) return true;
    return false;
  });
  expect(sampleInShellCache).toBe(false);

  await context.setOffline(true);
  await page.reload();
  await openPackLibrary(page);
  await page.getByRole('button', { name: 'Open downloaded sample', exact: true }).click();
  await expect(page.getByText('Package card 1 of 6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose harbor', exact: true }).click();
  await expect(page.getByText('Correct.', { exact: true })).toBeVisible();
  await expect(page.getByText('Package saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await openPackLibrary(page);
  await page.getByRole('button', { name: 'Open downloaded sample', exact: true }).click();
  await expect(page.getByText('Correct.', { exact: true })).toBeVisible();
});

test('a corrupt online sample is not saved as a downloadable pack', async ({ page }) => {
  await page.route('**/sample-pack/words.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));
  await openPackLibrary(page);
  await page.getByRole('button', { name: 'Download sample for offline use', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Download failed. No pack was saved.');
  await expect(page.getByRole('button', { name: 'Open downloaded sample', exact: true })).toHaveCount(0);
});

test('removing a package leaves its content-pinned local practice for re-download', async ({ page }) => {
  await openPackLibrary(page);
  await page.getByRole('button', { name: 'Download sample for offline use', exact: true }).click();
  await expect(page.getByText('Sample pack downloaded for offline use.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open downloaded sample', exact: true }).click();
  await page.getByRole('button', { name: 'Choose harbor', exact: true }).click();
  await expect(page.getByText('Correct.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to study', exact: true }).click();
  await page.getByRole('button', { name: 'Remove downloaded sample', exact: true }).click();
  await expect(page.getByText('Downloaded sample removed.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Download sample for offline use', exact: true }).click();
  await page.getByRole('button', { name: 'Open downloaded sample', exact: true }).click();
  await expect(page.getByText('Correct.', { exact: true })).toBeVisible();
});

test('tampered offline package bytes are revalidated and the pack can be removed', async ({ page }) => {
  await openPackLibrary(page);
  await page.getByRole('button', { name: 'Download sample for offline use', exact: true }).click();
  await expect(page.getByText('Sample pack downloaded for offline use.', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('wordmine-offline-packs-v0', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('packs', 'readwrite');
      const store = transaction.objectStore('packs');
      const read = store.getAll();
      read.onsuccess = () => {
        const record = read.result[0] as { files: Record<string, Uint8Array> };
        record.files['words.json'][0] ^= 1;
        store.put(record);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.getByRole('button', { name: 'Open downloaded sample', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Downloaded sample could not be opened.');
  await expect(page.getByText('Package card 1 of 6', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove downloaded sample', exact: true }).click();
  await expect(page.getByText('Downloaded sample removed.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open downloaded sample', exact: true })).toHaveCount(0);
});
