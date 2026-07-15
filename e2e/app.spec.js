import { expect, test } from '@playwright/test';
import { DICTIONARY } from '../src/data/dictionary';
import { toRomaji } from '../src/lib/typing';

const expectNoHorizontalOverflow = async (page) => {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
};

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('recite typing, progress, persistence, and dialogs work', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Covered by the mobile layout test');
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await expect(page.getByRole('heading', { name: '背诵' })).toBeVisible();
  await expect(page.locator('.keyboard-visual')).toBeVisible();

  const romaji = await page.locator('.romaji-form strong').innerText();
  await page.getByLabel('键盘跟打').fill(romaji);
  await expect(page.getByText('输入完成')).toBeVisible();
  await expect(page.getByRole('button', { name: '下一个' })).toBeVisible();
  await page.getByLabel('键盘跟打').press('Enter');
  await expect(page.locator('.session-progress-row strong')).toHaveText('2 / 20');

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kotobacho.progress.v1')));
  expect(Object.values(stored.words)[0].seen).toBe(1);

  await page.locator('.sidebar .nav-item').filter({ hasText: '词库' }).click();
  const dictionary = page.getByRole('dialog', { name: '日中词库' });
  await expect(dictionary).toBeVisible();
  await page.getByPlaceholder('日语、中文或 romaji').fill('gakkou');
  await expect(page.locator('.dictionary-row')).toHaveCount(1);
  await dictionary.getByRole('button', { name: '关闭词库' }).click();

  await page.locator('.sidebar .nav-item').filter({ hasText: '云端同步' }).click();
  const cloudDialog = page.getByRole('dialog', { name: '云端同步' });
  await expect(cloudDialog).toBeVisible();
  await expect(page.getByText('Overture-2021 / JapaneseWordbook')).toBeVisible();
  await cloudDialog.getByRole('button', { name: '关闭云端同步' }).click();

  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('recite-desktop.png'),
    fullPage: true,
  });
  expect(runtimeErrors).toEqual([]);
});

test('read and write tests grade valid Japanese input', async ({ page }) => {
  await page.getByRole('button', { name: /认读/ }).click();
  const readPrompt = await page.locator('.test-prompt > div').innerText();
  const readWord = DICTIONARY.find((word) => word.term === readPrompt);
  expect(readWord).toBeTruthy();
  await page.getByLabel('输入读音').fill(toRomaji(readWord.reading));
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText('正确', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '下一题' }).click();

  await page.getByRole('button', { name: /默写/ }).click();
  const meaning = await page.locator('.test-prompt > div').innerText();
  const writeWord = DICTIONARY.find((word) => word.meaning === meaning);
  expect(writeWord).toBeTruthy();
  await page.getByLabel('输入日语').fill(writeWord.reading);
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText('正确', { exact: true })).toBeVisible();
});

test('mobile layout stays usable without viewport overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('desktop'), 'Mobile-only responsive check');
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.keyboard-visual')).toBeHidden();
  await expectNoHorizontalOverflow(page);

  await page.screenshot({
    path: testInfo.outputPath('recite-mobile.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: '打开词库' }).click();
  await expect(page.getByRole('dialog', { name: '日中词库' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
