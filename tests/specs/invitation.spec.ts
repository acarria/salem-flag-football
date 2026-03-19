import { test, expect } from '@playwright/test';

test.describe('Invitation page', () => {
  test('invalid token shows error', async ({ page }) => {
    await page.goto('/invite/definitely-invalid-token-xyz');
    await expect(
      page.getByText(/not found|invalid|expired|error/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('invitation page loads with unknown token shows not found', async ({ page }) => {
    await page.goto('/invite/00000000notarealtoken');
    // Should show some error state
    const errorText = page.getByText(/not found|invitation not found|invalid/i).first();
    await expect(errorText).toBeVisible({ timeout: 10_000 });
  });
});
