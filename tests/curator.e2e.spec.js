import { test, expect } from '@playwright/test';

test('production e2e smoke', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedApiRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes('/webhook/')) {
      failedApiRequests.push(`${req.method()} ${url} :: ${req.failure()?.errorText}`);
    }
  });

  await page.goto('https://www.geuse.io/curator/', { waitUntil: 'networkidle', timeout: 60000 });

  await expect(page.getByText('GEUSE')).toBeVisible();

  await page.getByRole('tab', { name: 'Search' }).click();
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

  const searchInput = page.getByLabel('Search artworks');
  await expect(searchInput).toBeVisible();

  const cards = page.locator('main [role="listitem"] button[aria-label^="View details for"]');
  await searchInput.fill('masterpiece paintings');
  await searchInput.press('Enter');

  await expect(cards.first()).toBeVisible({ timeout: 60000 });
  const firstQueryLabel = await cards.first().getAttribute('aria-label');
  expect(firstQueryLabel).toBeTruthy();

  await searchInput.fill('recent art collection');
  await searchInput.press('Enter');

  await expect(cards.first()).toBeVisible({ timeout: 60000 });
  await expect.poll(async () => cards.first().getAttribute('aria-label'), { timeout: 60000 }).not.toBe(firstQueryLabel);
  const secondQueryLabel = await cards.first().getAttribute('aria-label');
  expect(secondQueryLabel).toBeTruthy();

  await cards.first().click();
  const detailDialog = page.getByRole('dialog');
  await expect(detailDialog).toBeVisible();

  const closeButton = detailDialog.getByRole('button', { name: 'Close modal' });
  await expect(closeButton).toBeVisible();

  const focusedAria = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '');
  expect(focusedAria).toBe('Close modal');

  const openCurator = detailDialog.getByRole('button', { name: /Ask the Curator/i });
  await openCurator.click();

  const curatorInput = page.getByLabel('Message to curator');
  await expect(curatorInput).toBeVisible();
  await curatorInput.fill('Find one impressionist work and explain why it matters.');
  await page.getByRole('button', { name: 'Send message' }).click();

  const chatItems = page.locator('[aria-label^="Curator chat about"] [role="listitem"]');
  await expect.poll(async () => chatItems.count(), { timeout: 60000 }).toBeGreaterThan(1);

  await page.getByRole('button', { name: 'Close curator chat' }).click();
  await closeButton.click();
  await expect(detailDialog).toBeHidden({ timeout: 10000 });

  expect(consoleErrors, `Console errors found: ${consoleErrors.join('\n')}`).toEqual([]);
  expect(pageErrors, `Page errors found: ${pageErrors.join('\n')}`).toEqual([]);
  expect(failedApiRequests, `Failed API requests: ${failedApiRequests.join('\n')}`).toEqual([]);
});
