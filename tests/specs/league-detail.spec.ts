import { test, expect } from '@playwright/test';

test.describe('League detail page', () => {
  // We need at least one league in the DB; if none exist, these tests skip gracefully.

  test('not found league shows error', async ({ page }) => {
    await page.goto('/leagues/00000000-0000-0000-0000-000000000000');
    // Should show some kind of not-found indicator
    await expect(
      page.getByText(/not found|league not found|does not exist/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('valid league shows standings section', async ({ page }) => {
    // Navigate to leagues list first to get a real ID
    await page.goto('/leagues');
    const firstLeagueLink = page.getByRole('link').filter({ hasText: /league|fall|spring/i }).first();
    const hasLeague = await firstLeagueLink.isVisible().catch(() => false);
    if (!hasLeague) {
      test.skip();
      return;
    }
    await firstLeagueLink.click();
    await expect(page).toHaveURL(/\/leagues\//);
    // Standings section should exist
    await expect(
      page.getByText(/standings/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('valid league shows schedule section', async ({ page }) => {
    await page.goto('/leagues');
    const firstLeagueLink = page.getByRole('link').filter({ hasText: /league|fall|spring/i }).first();
    const hasLeague = await firstLeagueLink.isVisible().catch(() => false);
    if (!hasLeague) {
      test.skip();
      return;
    }
    await firstLeagueLink.click();
    await expect(
      page.getByText(/schedule/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
