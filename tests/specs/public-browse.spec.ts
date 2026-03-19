import { test, expect } from '@playwright/test';

test.describe('Public browsing', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Salem|Flag Football/i);
  });

  test('leagues page shows leagues', async ({ page }) => {
    await page.goto('/leagues');
    // Wait for the leagues list to render (heading or list item)
    await expect(page.getByRole('heading', { name: /league/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('league card navigates to detail', async ({ page }) => {
    await page.goto('/leagues');
    // Click the first league card/link
    const firstLeagueLink = page.getByRole('link').filter({ hasText: /league|fall|spring/i }).first();
    await firstLeagueLink.waitFor({ timeout: 10_000 });
    await firstLeagueLink.click();
    // Should be on a detail page
    await expect(page).toHaveURL(/\/leagues\//);
  });
});
