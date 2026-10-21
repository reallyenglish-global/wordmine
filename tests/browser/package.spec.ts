import {test,expect} from '@playwright/test';

test('package cards, alternative spelling, rejection, resume and completion preserve old practice', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Start practice',exact:true}).click();
  await page.getByRole('button',{name:'Choose glimmer',exact:true}).click();
  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
  const previous = await page.evaluate(() => localStorage.getItem('wm-next:study:synthetic-en:1'));
  await page.getByRole('button',{name:'Back to packs',exact:true}).click();
  await page.getByRole('button',{name:'Explore package demo',exact:true}).click();
  await expect(page.getByText('Package card 1 of 6',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Check rejection example',exact:true}).click();
  await expect(page.getByText('Invalid package rejected. Current practice unchanged.',{exact:true})).toBeVisible();
  await expect(page.getByText('Package card 1 of 6',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Choose harbor',exact:true}).click();
  await expect(page.getByText('Correct.',{exact:true})).toBeVisible();
  await expect(page.getByText('Package saved on this device',{exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Explore package demo',exact:true}).click();
  await expect(page.getByText('Correct.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Next package card',exact:true}).click();
  await page.getByRole('textbox',{name:'Package spelling',exact:true}).fill(' HARBOUR ');
  await page.getByRole('button',{name:'Check package spelling',exact:true}).click();
  await expect(page.getByText('Correct.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Next package card',exact:true}).click();
  for (const word of ['lantern','meadow']) {
    await page.getByRole('button',{name:`Choose ${word}`,exact:true}).click();
    await page.getByRole('button',{name:'Next package card',exact:true}).click();
    await page.getByRole('textbox',{name:'Package spelling',exact:true}).fill(word);
    await page.getByRole('button',{name:'Check package spelling',exact:true}).click();
    await page.getByRole('button',{name:word === 'meadow'?'Finish package practice':'Next package card',exact:true}).click();
  }
  await expect(page.getByText('Package practice complete',{exact:true})).toBeVisible();
  await expect(page.getByText('6 of 6 correct',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/wm-package-complete.png',fullPage:true});
  expect(await page.evaluate(() => localStorage.getItem('wm-next:study:synthetic-en:1'))).toBe(previous);
  await page.getByRole('button',{name:'Back to study',exact:true}).click();
  await page.getByRole('button',{name:'Resume practice',exact:true}).click();
  await expect(page.getByText('Card 1 of 6',{exact:true})).toBeVisible();
  await expect(page.getByText('Correct.',{exact:true})).toBeVisible();
});

test('bundled package validates and resumes after offline reload', async ({page,context}) => {
  await page.goto('/');
  await page.evaluate(async () => {await navigator.serviceWorker.ready;});
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole('button',{name:'Explore package demo',exact:true}).click();
  await page.getByRole('button',{name:'Choose harbor',exact:true}).click();
  await expect(page.getByText('Package saved on this device',{exact:true})).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button',{name:'Explore package demo',exact:true}).click();
  await expect(page.getByText('Correct.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Next package card',exact:true}).click();
  await expect(page.getByText('Package card 2 of 6',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/wm-package-offline.png',fullPage:true});
});

test('package storage denial permits visibly temporary practice', async ({page}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function(){throw Error('denied');};
    Storage.prototype.setItem = function(){throw Error('denied');};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Explore package demo',exact:true}).click();
  await expect(page.getByText('Package storage unavailable. Practice is temporary.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Choose harbor',exact:true}).click();
  await expect(page.getByText('Correct.',{exact:true})).toBeVisible();
});

test('corrupt package progress resets only its own session', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Explore package demo',exact:true}).click();
  await page.getByRole('button',{name:'Choose harbor',exact:true}).click();
  await expect(page.getByText('Package saved on this device',{exact:true})).toBeVisible();
  await page.evaluate(() => {for(const key of Object.keys(localStorage)) if(key.startsWith('wm-next:package-practice:')) localStorage.setItem(key,'{broken');});
  await page.reload();
  await page.getByRole('button',{name:'Explore package demo',exact:true}).click();
  await expect(page.getByText('Package card 1 of 6',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Choose harbor',exact:true})).toBeEnabled();
});
