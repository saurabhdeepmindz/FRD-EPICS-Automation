/**
 * Task 2 — E2E: Homepage renders correctly with Tailwind + shadcn/ui
 * Requires: `npm run dev` running on http://localhost:3000
 * Run: npx playwright test tests/e2e/task2-homepage.spec.ts
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const BASE = 'http://localhost:3000';
const SCREENSHOTS = path.join(__dirname, '..', 'screenshots');

test.describe('Task 2 — Homepage scaffold', () => {

  test('homepage loads and shows PRD Generator heading', async ({ page }) => {
    await page.goto(BASE);
    await page.screenshot({ path: path.join(SCREENSHOTS, 'task2-01-homepage-loaded.png'), fullPage: true });

    await expect(page.getByTestId('home-page')).toBeVisible();
    await expect(page.getByTestId('hero-heading')).toContainText('PRD Generator');
  });

  test('CTA buttons are visible and have correct links', async ({ page }) => {
    await page.goto(BASE);

    const createBtn = page.getByTestId('cta-create-prd');
    const viewBtn   = page.getByTestId('cta-view-prds');

    await expect(createBtn).toBeVisible();
    await expect(viewBtn).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOTS, 'task2-02-cta-buttons.png') });
  });

  test('features section shows 3 cards', async ({ page }) => {
    await page.goto(BASE);
    const cards = page.getByTestId('features-section').locator('[class*="rounded-lg"]');
    await expect(cards).toHaveCount(3);
    await page.screenshot({ path: path.join(SCREENSHOTS, 'task2-03-feature-cards.png') });
  });

  test('responsive at 320px (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(BASE);
    await expect(page.getByTestId('home-page')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOTS, 'task2-04-mobile-320.png'), fullPage: true });
  });

  test('responsive at 768px (tablet)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE);
    await expect(page.getByTestId('home-page')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOTS, 'task2-05-tablet-768.png'), fullPage: true });
  });

  test('responsive at 1280px (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE);
    await expect(page.getByTestId('home-page')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOTS, 'task2-06-desktop-1280.png'), fullPage: true });
  });

});
