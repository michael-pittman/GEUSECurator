import { test, expect } from '@playwright/test';

const SUGGESTIONS = [
  { label: 'Impressionism', query: 'Claude Monet water lilies' },
  { label: 'Japanese Prints', query: 'Japanese woodblock prints' },
  { label: 'B&W Photography', query: 'Black and white photography' },
  { label: 'Bronze Sculpture', query: 'Bronze sculpture' },
  { label: 'Still Life', query: 'Still life with fruit' },
  { label: 'Dutch Masters', query: 'Dutch Golden Age paintings' },
];

test('search suggestions dispatch distinct queries and avoid identical top result set', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle', timeout: 60000 });

  await page.getByRole('tab', { name: 'Search' }).click();
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

  const searchInput = page.getByLabel('Search artworks');
  const cards = page.locator('main [role="listitem"] button[aria-label^="View details for"]');
  const firstResultLabels = [];

  for (const suggestion of SUGGESTIONS) {
    await searchInput.fill('');
    await expect(page.getByRole('button', { name: suggestion.label })).toBeVisible();

    const response = await Promise.all([
      page.waitForResponse((res) => {
        if (!res.url().includes('/webhook/art-search-chat/chat')) return false;
        if (res.request().method() !== 'POST') return false;
        try {
          const payload = JSON.parse(res.request().postData() || '{}');
          return payload.chatInput === suggestion.query;
        } catch {
          return false;
        }
      }, { timeout: 60000 }),
      page.getByRole('button', { name: suggestion.label }).click(),
    ]).then(([res]) => res);

    expect(response.ok()).toBeTruthy();
    const payload = JSON.parse(response.request().postData() || '{}');
    expect(payload.chatInput).toBe(suggestion.query);

    await expect(page.locator('[aria-label="Searching"]')).toHaveCount(0, { timeout: 60000 });
    await expect(cards.first()).toBeVisible({ timeout: 60000 });

    const firstLabel = await cards.first().getAttribute('aria-label');
    expect(firstLabel).toBeTruthy();
    firstResultLabels.push(firstLabel);
  }

  const uniqueFirstLabels = new Set(firstResultLabels.filter(Boolean));
  expect(uniqueFirstLabels.size).toBeGreaterThan(1);
});
