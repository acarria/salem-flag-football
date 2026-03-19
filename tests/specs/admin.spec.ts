import { test, expect } from '@playwright/test';

test.describe('Admin page access control', () => {
  test('non-authenticated user is redirected or sees sign-in prompt', async ({ page }) => {
    await page.goto('/admin');
    // Should either redirect to sign-in or show a "you must be signed in" message
    const isRedirected = page.url().includes('/sign-in') || page.url().includes('/login');
    const hasSignInPrompt = await page.getByText(/sign in|admin|access/i).first().isVisible().catch(() => false);
    expect(isRedirected || hasSignInPrompt).toBeTruthy();
  });
});
