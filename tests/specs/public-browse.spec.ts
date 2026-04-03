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
    // Wait for league cards to load — these are <Link> elements with href="/leagues/{uuid}"
    const leagueCard = page.locator('a[href*="/leagues/"]').first();
    // Skip test if no leagues exist in the database (CI may not have seed data)
    const hasLeagues = await leagueCard.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasLeagues) {
      test.skip(true, 'No leagues in database — skipping navigation test');
      return;
    }
    await leagueCard.click();
    await expect(page).toHaveURL(/\/leagues\/.+/);
  });
});
