import { test, expect } from './fixtures/no-js-errors';

test.describe('Minicart', () => {
  test('opens and renders the remote Knockout template', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.ok(), `HTTP ${res?.status()}`).toBeTruthy();

    const minicart = page.locator('[data-block=minicart]').first();
    await expect(minicart).toBeVisible({ timeout: 30_000 });

    await minicart.locator('a.action.showcart').first().click();

    await expect(page.locator('#minicart-content-wrapper .block-content')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('#btn-minicart-close')).toBeVisible({ timeout: 30_000 });
  });
});
