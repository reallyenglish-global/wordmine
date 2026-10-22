import { test, expect, type Page } from '@playwright/test';

// Exercise the exported app through accessible controls, not session/grading internals.
// Each test gets a fresh browser context; reloads must restore real persisted state.
const practices = [
  {
    name: 'local study', entry: 'Start practice', resume: 'Resume practice',
    card: (index: number) => `Card ${index} of 6`, words: ['glimmer', 'shelter', 'wander'],
    spelling: 'Your spelling', check: 'Check spelling', next: 'Next card',
    finish: 'Finish practice', complete: 'Practice complete', restart: 'Practice again',
    back: 'Back to packs', saved: 'Saved on this device',
  },
  {
    name: 'bundled package', entry: 'Explore package demo', resume: 'Explore package demo',
    card: (index: number) => `Package card ${index} of 6`, words: ['harbor', 'lantern', 'meadow'],
    spelling: 'Package spelling', check: 'Check package spelling', next: 'Next package card',
    finish: 'Finish package practice', complete: 'Package practice complete', restart: 'Restart package practice',
    back: 'Back to study', saved: 'Package saved on this device',
  },
];

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const text = (page: Page, value: string) => page.getByText(value, { exact: true });

for (const practice of practices) {
  test.describe(practice.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await button(page, practice.entry).click();
      await expect(text(page, practice.card(1))).toBeVisible();
    });

    test('cannot skip unanswered cards or submit blank spelling', async ({ page }) => {
      await expect(button(page, practice.next)).toHaveCount(0);
      await expect(button(page, practice.finish)).toHaveCount(0);
      await button(page, `Choose ${practice.words[0]}`).click();
      await button(page, practice.next).click();
      await expect(text(page, practice.card(2))).toBeVisible();
      const input = page.getByRole('textbox', { name: practice.spelling, exact: true });
      await expect(input).toHaveValue('');
      await expect(button(page, practice.check)).toBeDisabled();
      await input.fill('   ');
      await expect(button(page, practice.check)).toBeDisabled();
      await expect(button(page, practice.next)).toHaveCount(0);
      await button(page, practice.back).click();
      await button(page, practice.resume).click();
      await expect(text(page, practice.card(2))).toBeVisible();
      // Navigation cannot create an answer or bypass the blank-input guard.
      await expect(button(page, practice.check)).toBeDisabled();
    });

    test('incorrect meaning choice is locked and survives a cold page reload', async ({ page }) => {
      await button(page, `Choose ${practice.words[1]}`).click();
      const feedback = `Not quite. Answer: ${practice.words[0]}`;
      await expect(text(page, feedback)).toBeVisible();
      for (const word of practice.words) await expect(button(page, `Choose ${word}`)).toBeDisabled();
      await expect(text(page, practice.saved)).toBeVisible();
      await page.reload();
      await button(page, practice.resume).click();
      await expect(text(page, practice.card(1))).toBeVisible();
      await expect(text(page, feedback)).toBeVisible();
      for (const word of practice.words) await expect(button(page, `Choose ${word}`)).toBeDisabled();
      await button(page, practice.next).click();
      await expect(text(page, practice.card(2))).toBeVisible();
      await expect(page.getByRole('textbox', { name: practice.spelling, exact: true })).toHaveValue('');
    });

    test('incorrect spelling is final, persists, and does not leak into the next recall', async ({ page }) => {
      await button(page, `Choose ${practice.words[0]}`).click();
      await button(page, practice.next).click();
      const input = page.getByRole('textbox', { name: practice.spelling, exact: true });
      await input.fill('not-the-answer');
      await button(page, practice.check).click();
      const feedback = `Not quite. Answer: ${practice.words[0]}`;
      await expect(text(page, feedback)).toBeVisible();
      await expect(input).not.toBeEditable();
      await expect(button(page, practice.check)).toHaveCount(0);
      await expect(text(page, practice.saved)).toBeVisible();
      await page.reload();
      await button(page, practice.resume).click();
      await expect(text(page, practice.card(2))).toBeVisible();
      await expect(text(page, feedback)).toBeVisible();
      await expect(input).not.toBeEditable();
      await expect(button(page, practice.check)).toHaveCount(0);
      await button(page, practice.next).click();
      await expect(text(page, practice.card(3))).toBeVisible();
      await button(page, `Choose ${practice.words[1]}`).click();
      await button(page, practice.next).click();
      await expect(text(page, practice.card(4))).toBeVisible();
      await expect(input).toBeEditable();
      await expect(input).toHaveValue('');
      await expect(button(page, practice.check)).toBeDisabled();
    });

    test('all six cards complete offline and completion and fresh restart persist', async ({ page, context }, testInfo) => {
      // Warm the real PWA shell before disconnecting; grading and persistence must work offline.
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await context.setOffline(true);
      try {
        for (const [index, word] of practice.words.entries()) {
          await expect(text(page, practice.card(index * 2 + 1))).toBeVisible();
          await button(page, `Choose ${word}`).click();
          await expect(text(page, 'Correct.')).toBeVisible();
          await button(page, practice.next).click();
          await expect(text(page, practice.card(index * 2 + 2))).toBeVisible();
          await page.getByRole('textbox', { name: practice.spelling, exact: true }).fill(` ${word.toUpperCase()} `);
          await button(page, practice.check).click();
          await expect(text(page, 'Correct.')).toBeVisible();
          await button(page, index === 2 ? practice.finish : practice.next).click();
        }
        await expect(page.getByRole('heading', { name: practice.complete, exact: true })).toBeVisible();
        await expect(text(page, '6 of 6 correct')).toBeVisible();
        await expect(text(page, practice.saved)).toBeVisible();
        await page.reload();
        await button(page, practice.resume).click();
        await expect(page.getByRole('heading', { name: practice.complete, exact: true })).toBeVisible();
        await expect(text(page, '6 of 6 correct')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('offline-complete.png'), fullPage: true });
        await button(page, practice.restart).click();
        await expect(text(page, practice.card(1))).toBeVisible();
        await expect(text(page, 'Correct.')).toHaveCount(0);
        await expect(button(page, `Choose ${practice.words[0]}`)).toBeEnabled();
        await expect(text(page, practice.saved)).toBeVisible();
        await page.reload();
        // A fresh local session has no answers, so home calls it Start, not Resume.
        await button(page, practice.entry).click();
        await expect(text(page, practice.card(1))).toBeVisible();
        await expect(button(page, `Choose ${practice.words[0]}`)).toBeEnabled();
        await expect(button(page, practice.next)).toHaveCount(0);
      } finally {
        await context.setOffline(false);
      }
    });
  });
}

test('contract meaning activity supports incorrect feedback, locked submission and a clean retry', async ({ page }) => {
  await page.goto('/');
  await button(page, 'Explore contract demo').click();
  const choices = page.getByRole('radio');
  const correct = page.getByRole('radio', { name: 'lumen', exact: true });
  const wrong = choices.filter({ hasNotText: 'lumen' }).first();
  await wrong.click();
  await expect(wrong).toBeChecked();
  await expect(page.getByRole('alert')).toHaveCount(0);
  // Changing a selection before submission must grade the final selection.
  await correct.click();
  await expect(correct).toBeChecked();
  await wrong.click();
  await button(page, 'Check answer').click();
  await expect(text(page, '✗ Not quite')).toBeVisible();
  for (const choice of await choices.all()) await expect(choice).toBeDisabled();
  await button(page, 'Try again').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(button(page, 'Check answer')).toBeDisabled();
  for (const choice of await choices.all()) {
    await expect(choice).toBeEnabled();
    await expect(choice).not.toBeChecked();
  }
  await correct.click();
  await button(page, 'Check answer').click();
  await expect(text(page, '✓ Correct')).toBeVisible();
  await button(page, 'Back to study').click();
  await button(page, 'Start practice').click();
  await expect(text(page, 'Card 1 of 6')).toBeVisible();
});
