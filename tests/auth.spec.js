import { test, expect } from '@playwright/test';

const ADMIN = { email: 'test_admin@paulapilates.pl', pass: 'TestAdmin2024!' };
const CLIENT = { email: 'test_client@paulapilates.pl', pass: 'TestClient2024!' };

async function login(page, email, pass) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaloguj się' }).first().click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).last().click();
}

test('admin może się zalogować i widzi panel admina', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.pass);
  await expect(page.getByRole('heading', { name: 'Zarządzanie zajęciami' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.nav-item').filter({ hasText: 'Klienci' })).toBeVisible();
});

test('klient może się zalogować i widzi panel klienta', async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.pass);
  await expect(page.getByRole('heading', { name: 'Nadchodzące zajęcia' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.nav-item').filter({ hasText: 'Moje rezerwacje' })).toBeVisible();
});

test('błędne hasło pokazuje komunikat błędu', async ({ page }) => {
  await login(page, CLIENT.email, 'wrongpassword');
  await expect(page.locator('.alert-error, .error').first()).toBeVisible({ timeout: 8000 });
});

test('wylogowanie przekierowuje na stronę główną', async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.pass);
  await expect(page.getByRole('heading', { name: 'Nadchodzące zajęcia' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await expect(page.getByRole('button', { name: 'Zaloguj się' })).toBeVisible({ timeout: 8000 });
});
