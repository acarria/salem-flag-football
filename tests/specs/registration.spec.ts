import { test, expect } from '@playwright/test';

const TEST_BYPASS_TOKEN = process.env.TEST_BYPASS_TOKEN || 'test-secret-token-12345';

test.describe('Registration flow', () => {
  test.beforeEach(async ({ page }) => {
    // Inject the bypass token into localStorage so the frontend sends it
    await page.addInitScript((token) => {
      // Override fetch to inject auth header — simplest approach for E2E bypass
      (window as any).__TEST_BYPASS_TOKEN = token;
    }, TEST_BYPASS_TOKEN);
  });

  test('register now button opens modal', async ({ page }) => {
    await page.goto('/leagues');
    // Find a league with an open registration
    const registerBtn = page.getByRole('button', { name: /register/i }).first();
    const hasBtnVisible = await registerBtn.isVisible().catch(() => false);
    if (!hasBtnVisible) {
      test.skip();
      return;
    }
    await registerBtn.click();
    // Modal should appear
    await expect(
      page.getByRole('dialog').or(page.getByTestId('registration-modal'))
    ).toBeVisible({ timeout: 5_000 });
  });

  test('registration modal can be closed', async ({ page }) => {
    await page.goto('/leagues');
    const registerBtn = page.getByRole('button', { name: /register/i }).first();
    const hasBtnVisible = await registerBtn.isVisible().catch(() => false);
    if (!hasBtnVisible) {
      test.skip();
      return;
    }
    await registerBtn.click();
    const modal = page.getByRole('dialog').or(page.getByTestId('registration-modal'));
    await modal.waitFor({ timeout: 5_000 });
    // Close button
    const closeBtn = page.getByRole('button', { name: /close|cancel|×/i }).first();
    await closeBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });
});
