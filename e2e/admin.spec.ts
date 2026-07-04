/**
 * Admin panel E2E tests — verify admin SPA loads and basic navigation works.
 * Read-only: no data modification.
 */
import { test, expect } from '@playwright/test'

test.describe('Admin panel', () => {
  test('Login page loads and shows the login form', async ({ page }) => {
    await page.goto('/admin/')
    // Should redirect to /login or show login immediately
    await expect(page.locator('text=管理员登录').or(page.locator('text=login'))).toBeVisible({ timeout: 10000 })
  })

  test('Login page has password input', async ({ page }) => {
    await page.goto('/admin/')
    // Password input should be present (n-input with type=password)
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 })
  })

  test('Dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/#/dashboard')
    await page.waitForTimeout(1000)
    // Should redirect to login
    const currentUrl = page.url()
    expect(currentUrl).toContain('login')
  })
})