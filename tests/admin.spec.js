import { test, expect } from '@playwright/test';

const ADMIN = { email: 'test_admin@paulapilates.pl', pass: 'TestAdmin2024!' };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaloguj się' }).first().click();
  await page.locator('input[type="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.pass);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Zarządzanie zajęciami' })).toBeVisible({ timeout: 10000 });
});

test('admin widzi grafik z zajęciami', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Nadchodzące zajęcia' })).toBeVisible({ timeout: 8000 });
});

test('admin widzi zakładkę Klienci', async ({ page }) => {
  await page.locator('.nav-item').filter({ hasText: 'Klienci' }).click();
  await expect(
    page.getByText(/brak klientów|dodaj klienta/i).or(page.locator('table tbody tr').first())
  ).toBeVisible({ timeout: 8000 });
});

test('admin widzi zakładkę Do rozliczenia', async ({ page }) => {
  await page.locator('.nav-item').filter({ hasText: 'Do rozliczenia' }).click();
  await expect(page.getByRole('heading', { name: 'Do rozliczenia' })).toBeVisible({ timeout: 8000 });
});

test('admin może otworzyć formularz dodawania zajęć', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nowe zajęcia' }).click();
  await expect(page.locator('.modal')).toBeVisible({ timeout: 5000 });
  await expect(page.getByPlaceholder('np. Pilates Flow')).toBeVisible();
});
