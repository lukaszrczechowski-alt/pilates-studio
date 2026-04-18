import { test, expect } from '@playwright/test';

const CLIENT = { email: 'test_client@paulapilates.pl', pass: 'TestClient2024!' };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaloguj się' }).first().click();
  await page.locator('input[type="email"]').fill(CLIENT.email);
  await page.locator('input[type="password"]').fill(CLIENT.pass);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Nadchodzące zajęcia' })).toBeVisible({ timeout: 10000 });
});

test('klient widzi kalendarz zajęć', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Kalendarz' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lista' })).toBeVisible();
});

test('klient może przełączyć na widok listy', async ({ page }) => {
  await page.getByRole('button', { name: 'Lista' }).click();
  // Widok listy pokazuje zajęcia lub komunikat
  await expect(
    page.getByText(/brak nadchodzących zajęć/i).or(page.getByText('WOLNE').first())
  ).toBeVisible({ timeout: 8000 });
});

test('klient widzi zakładkę Moje rezerwacje', async ({ page }) => {
  await page.locator('.nav-item').filter({ hasText: 'Moje rezerwacje' }).click();
  await expect(
    page.getByText('Brak nadchodzących rezerwacji.').or(page.locator('.class-card').first())
  ).toBeVisible({ timeout: 8000 });
});

test('klient widzi zakładkę Moje konto', async ({ page }) => {
  await page.locator('.nav-item').filter({ hasText: 'Moje konto' }).click();
  await expect(page.getByRole('heading', { name: 'Moje konto' })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('Moje wejścia')).toBeVisible();
});
