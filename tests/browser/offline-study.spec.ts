import { test, expect, type Page } from '@playwright/test';

const practices = [
  {
    name: 'local study', entry: 'Start practice', resume: 'Resume practice',
    choice: 'Choose glimmer', spelling: 'Your spelling', check: 'Check spelling',
    next: 'Next card', card: 'Card 2 of 6', saved: 'Saved on this device',
    error: 'Storage unavailable. Practice is temporary until a save succeeds.',
    keyPrefix: 'wm-next:study:',
  },
  {
    name: 'bundled package', entry: 'Explore package demo', resume: 'Explore package demo',
    choice: 'Choose harbor', spelling: 'Package spelling', check: 'Check package spelling',
    next: 'Next package card', card: 'Package card 2 of 6', saved: 'Package saved on this device',
    error: 'Package storage unavailable. Practice is temporary.',
    keyPrefix: 'wm-next:package-practice:',
  },
];
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const text = (page: Page, value: string) => page.getByText(value, { exact: true });
async function prepareOfflineShell(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

for (const practice of practices) {
  test.describe(`${practice.name} offline lifecycle`, () => {
    for (const correct of [true, false]) {
      test(`${correct ? 'correct' : 'incorrect'} submitted spelling remains visible and locked in a fresh offline page`, async ({ page, context }, testInfo) => {
        await prepareOfflineShell(page);
        await button(page, practice.entry).click();
        await button(page, practice.choice).click();
        await button(page, practice.next).click();
        const answer = correct ? (practice.name === 'local study' ? 'glimmer' : 'harbour') : 'my-wrong-answer';
        await page.getByRole('textbox', { name: practice.spelling, exact: true }).fill(answer);
        await button(page, practice.check).click();
        // Wait for the actual persisted answer, not a footer that can precede a write.
        await expect.poll(() => page.evaluate(({ prefix, answer }) => {
          const key = Object.keys(localStorage).find(key => key.startsWith(prefix));
          return key ? localStorage.getItem(key)!.includes(JSON.stringify(answer)) : false;
        }, { prefix: practice.keyPrefix, answer })).toBe(true);
        await expect(text(page, practice.saved)).toBeVisible();
        await context.setOffline(true);
        // New page, not just an in-memory React remount or a page reload.
        const resumed = await context.newPage();
        const response = await resumed.goto('/');
        expect(response?.fromServiceWorker()).toBe(true);
        await page.close();
        await button(resumed, practice.resume).click();
        await expect(text(resumed, practice.card)).toBeVisible();
        await expect(resumed.getByRole('alert')).toContainText(correct ? 'Correct.' : 'Not quite. Answer:');
        const input = resumed.getByRole('textbox', { name: practice.spelling, exact: true });
        await expect(input).toHaveValue(answer);
        await expect(input).not.toBeEditable();
        await expect(button(resumed, practice.check)).toHaveCount(0);
        await resumed.screenshot({ path: testInfo.outputPath('offline-restored-spelling.png'), fullPage: true });
        await button(resumed, practice.next).click();
        const remainingWords = practice.name === 'local study' ? ['shelter', 'wander'] : ['lantern', 'meadow'];
        for (const [index, word] of remainingWords.entries()) {
          await button(resumed, `Choose ${word}`).click();
          await button(resumed, practice.next).click();
          await resumed.getByRole('textbox', { name: practice.spelling, exact: true }).fill(word);
          await button(resumed, practice.check).click();
          await button(resumed, index === 1
            ? (practice.name === 'local study' ? 'Finish practice' : 'Finish package practice')
            : practice.next).click();
        }
        const score = `${correct ? 6 : 5} of 6 correct`;
        await expect(text(resumed, score)).toBeVisible();
        await expect(text(resumed, practice.saved)).toBeVisible();
        await resumed.reload();
        await button(resumed, practice.resume).click();
        await expect(text(resumed, score)).toBeVisible();
      });
    }

    test('unanswered recall survives a fresh offline page and reconnect without losing progress', async ({ page, context }) => {
      await prepareOfflineShell(page);
      await context.setOffline(true);
      await button(page, practice.entry).click();
      await button(page, practice.choice).click();
      await button(page, practice.next).click();
      await expect(text(page, practice.saved)).toBeVisible();
      const resumed = await context.newPage();
      expect((await resumed.goto('/'))?.fromServiceWorker()).toBe(true);
      await page.close();
      await button(resumed, practice.resume).click();
      await expect(text(resumed, practice.card)).toBeVisible();
      await expect(resumed.getByRole('textbox', { name: practice.spelling, exact: true })).toHaveValue('');
      await expect(button(resumed, practice.check)).toBeDisabled();
      await expect(button(resumed, practice.next)).toHaveCount(0);
      await context.setOffline(false);
      await resumed.reload();
      await button(resumed, practice.resume).click();
      await expect(text(resumed, practice.card)).toBeVisible();
      const word = practice.name === 'local study' ? 'glimmer' : 'harbour';
      await resumed.getByRole('textbox', { name: practice.spelling, exact: true }).fill(word);
      await button(resumed, practice.check).click();
      await expect(text(resumed, 'Correct.')).toBeVisible();
      await expect(text(resumed, practice.saved)).toBeVisible();
      await context.setOffline(true);
      await resumed.reload();
      await button(resumed, practice.resume).click();
      await expect(text(resumed, 'Correct.')).toBeVisible();
      await expect(resumed.getByRole('textbox', { name: practice.spelling, exact: true })).toHaveValue(word);
    });

    test('temporary write failure recovers on the next offline save and persists earlier answers', async ({ page, context }) => {
      await prepareOfflineShell(page);
      await context.setOffline(true);
      await button(page, practice.entry).click();
      // Inject only a storage failure; shell caching and grading remain real.
      await page.evaluate(prefix => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key.startsWith(prefix)) {
            Storage.prototype.setItem = original;
            throw new DOMException('Test storage quota exhausted', 'QuotaExceededError');
          }
          return original.call(this, key, value);
        };
      }, practice.keyPrefix);
      await button(page, practice.choice).click();
      await expect(text(page, 'Correct.')).toBeVisible();
      await expect(text(page, practice.error)).toBeVisible();
      await expect(text(page, practice.saved)).toHaveCount(0);
      await button(page, practice.next).click();
      await expect(text(page, practice.card)).toBeVisible();
      await expect(text(page, practice.saved)).toBeVisible();
      await page.reload();
      await button(page, practice.resume).click();
      await expect(text(page, practice.card)).toBeVisible();
      const stored = await page.evaluate(prefix => {
        const key = Object.keys(localStorage).find(key => key.startsWith(prefix));
        return key ? JSON.parse(localStorage.getItem(key)!) : null;
      }, practice.keyPrefix);
      expect(stored.index).toBe(1);
      // Both session formats must contain the meaning answer saved before recovery.
      expect(Object.keys(stored.results ?? stored.answers)).toHaveLength(1);
    });
  });
}

test('offline package restart does not overwrite local study progress', async ({ page, context }) => {
  await prepareOfflineShell(page);
  await context.setOffline(true);
  await button(page, 'Start practice').click();
  await button(page, 'Choose glimmer').click();
  await expect(text(page, 'Saved on this device')).toBeVisible();
  const localBefore = await page.evaluate(() => localStorage.getItem('wm-next:study:synthetic-en:1'));
  await button(page, 'Back to packs').click();
  await button(page, 'Explore package demo').click();
  for (const [index, word] of ['harbor', 'lantern', 'meadow'].entries()) {
    await button(page, `Choose ${word}`).click();
    await button(page, 'Next package card').click();
    await page.getByRole('textbox', { name: 'Package spelling', exact: true }).fill(word);
    await button(page, 'Check package spelling').click();
    await button(page, index === 2 ? 'Finish package practice' : 'Next package card').click();
  }
  await expect(text(page, '6 of 6 correct')).toBeVisible();
  await button(page, 'Restart package practice').click();
  await expect(text(page, 'Package saved on this device')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('wm-next:study:synthetic-en:1'))).toBe(localBefore);
  await page.reload();
  await button(page, 'Resume practice').click();
  await expect(text(page, 'Card 1 of 6')).toBeVisible();
  await expect(text(page, 'Correct.')).toBeVisible();
  await button(page, 'Back to packs').click();
  await button(page, 'Explore package demo').click();
  await expect(text(page, 'Package card 1 of 6')).toBeVisible();
  await expect(button(page, 'Choose harbor')).toBeEnabled();
  await expect(button(page, 'Next package card')).toHaveCount(0);
});

test('offline app shell includes icons and manifest but does not cache arbitrary requests', async ({ page, context }) => {
  await prepareOfflineShell(page);
  await context.setOffline(true);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  const results = await page.evaluate(async () => {
    const assets = await Promise.all(['/manifest.webmanifest', '/icon-192.png', '/icon-512.png'].map(async url => {
      const response = await fetch(url);
      return { url, ok: response.ok, type: response.headers.get('content-type'), size: (await response.blob()).size };
    }));
    let unlistedFailed = false;
    try { await fetch('/not-a-shell-asset.json'); } catch { unlistedFailed = true; }
    return { assets, unlistedFailed };
  });
  for (const asset of results.assets) {
    expect(asset.ok, asset.url).toBe(true);
    expect(asset.size, asset.url).toBeGreaterThan(0);
    expect(asset.type).toContain(asset.url.endsWith('.png') ? 'image/png' : 'manifest');
  }
  expect(results.unlistedFailed).toBe(true);
  await expect(button(page, 'Start practice')).toBeVisible();
});
