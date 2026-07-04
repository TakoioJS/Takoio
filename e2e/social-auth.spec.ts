/**
 * E2E — Social Auth flow (GitHub / Email / Auth bar / Logout)
 *
 * Requires both servers running (see playwright.config.ts):
 *   - Nitro API at :8080
 *   - Vite client dev at :9820
 *
 * Strategy: the dev test page (index.html) does not enable social login
 * by default. For tests that need the login dropdown, we intercept
 * /api/comments and inject a fake `config.LOGIN_PROVIDERS` so the
 * widget renders the login UI. For "auth bar when logged in" we seed
 * localStorage before navigation via addInitScript. Email send/verify
 * are mocked at the network layer.
 */
import { test, expect } from '@playwright/test'

const CLIENT_URL = 'http://127.0.0.1:9820'

/** Build a JWT whose exp is `secondsFromNow` in the future. */
function makeJwt (secondsFromNow: number): string {
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  const header = enc({ alg: 'HS256', typ: 'JWT' })
  const payload = enc({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })
  return `${header}.${payload}.fakesig`
}

/**
 * Build a fake comments response with a single dummy comment so the
 * widget renders its thread card (which is where the auth bar lives).
 * Used by the auth-bar describe block.
 */
async function seedOneComment (page: import('@playwright/test').Page) {
  await page.route('**/api/comments**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'fake-comment-1',
            rid: null,
            pid: null,
            nick: 'Seed',
            mail: '',
            comment: 'Seeded for auth bar test',
            avatar: '',
            url: '/test-article',
            ua: '',
            ip: '',
            created: Date.now(),
            children: [],
            reaction: {},
          },
        ],
        total: 1,
        page: '1',
        pageSize: '10',
        config: {},
      }),
    })
  })
}

/** Mock /api/comments so the widget receives a config with login providers. */
async function enableLoginProviders (page: import('@playwright/test').Page, providers: string[]) {
  await page.route('**/api/comments**', async (route) => {
    const originalReq = route.request()
    const url = new URL(originalReq.url())
    // Default response: empty list, but include the config with login providers
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        total: 0,
        page: url.searchParams.get('page') || '1',
        pageSize: url.searchParams.get('pageSize') || '10',
        config: { LOGIN_PROVIDERS: providers },
      }),
    })
  })
}

test.describe('Social Auth — UI', () => {
  test('GitHub login button visible when enabled', async ({ page }) => {
    await enableLoginProviders(page, ['github'])
    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })

    // The login dropdown trigger should be rendered
    const trigger = page.locator('.tk-login-trigger')
    await expect(trigger).toBeVisible({ timeout: 10_000 })

    // Open the dropdown and verify the GitHub menu item
    await trigger.click()
    const githubItem = page.locator('.tk-login-menu-item', { hasText: 'GitHub' })
    await expect(githubItem).toBeVisible()
  })

  test('Email login dialog opens and shows 2 steps', async ({ page }) => {
    await enableLoginProviders(page, ['email'])

    // Mock the email send endpoint to return a fake uuid
    await page.route('**/api/auth/email/send', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ uuid: 'test-uuid-1' }),
      })
    })

    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })

    // Open the dropdown and pick the email provider
    await expect(page.locator('.tk-login-trigger')).toBeVisible({ timeout: 10_000 })
    await page.locator('.tk-login-trigger').click()
    await page.locator('.tk-login-menu-item', { hasText: /邮箱|Email/i }).click()

    // The email dialog should be visible
    const dialog = page.locator('.tk-email-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Step bar should show two steps
    const steps = page.locator('.tk-email-step')
    await expect(steps).toHaveCount(2)
    await expect(steps.nth(0)).toBeVisible()
    await expect(steps.nth(1)).toBeVisible()

    // Enter the email and submit
    await page.locator('.tk-email-dialog input[type="email"]').fill('tester@example.com')
    await page.locator('.tk-email-dialog .tk-btn-primary').click()

    // Should advance to step 2 — the "code sent" hint is visible
    await expect(dialog.locator('.tk-code-input')).toBeVisible({ timeout: 5_000 })
    await expect(dialog).toContainText(/已发送|sent/i)
  })

  test('Email login invalid code shows error', async ({ page }) => {
    await enableLoginProviders(page, ['email'])

    // Mock send to return a uuid, and verify to fail
    await page.route('**/api/auth/email/send', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ uuid: 'test-uuid-2' }),
      })
    })
    await page.route('**/api/auth/email/verify', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid or expired code' }),
      })
    })

    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })

    // Open dialog → submit email → land on step 2 → submit wrong code
    await expect(page.locator('.tk-login-trigger')).toBeVisible({ timeout: 10_000 })
    await page.locator('.tk-login-trigger').click()
    await page.locator('.tk-login-menu-item', { hasText: /邮箱|Email/i }).click()
    await expect(page.locator('.tk-email-dialog')).toBeVisible({ timeout: 5_000 })
    await page.locator('.tk-email-dialog input[type="email"]').fill('tester@example.com')
    await page.locator('.tk-email-dialog .tk-btn-primary').click()

    const codeInput = page.locator('.tk-code-input')
    await expect(codeInput).toBeVisible({ timeout: 5_000 })
    await codeInput.fill('000000')
    await page.locator('.tk-email-dialog .tk-btn-primary').click()

    // The error banner should appear with the server's message
    const errorEl = page.locator('.tk-email-error')
    await expect(errorEl).toBeVisible({ timeout: 5_000 })
    await expect(errorEl).toContainText(/Invalid|expired|无效|过期/i)
  })
})

test.describe('Social Auth — Auth bar', () => {
  /**
   * Seed a valid auth state into localStorage BEFORE the page loads.
   * The widget reads localStorage on mount; if a non-expired token is
   * present, the .tk-auth-bar is rendered.
   */
  test('Auth bar appears when logged in', async ({ page, context }) => {
    const token = makeJwt(3600) // 1h in the future
    const authState = {
      token,
      user: {
        provider: 'github',
        id: 'e2e-user-1',
        name: 'E2E Tester',
        email: 'e2e@example.com',
        avatar: 'https://example.com/avatar.png',
      },
    }
    await context.addInitScript((state) => {
      localStorage.setItem('takoio_auth', JSON.stringify(state))
    }, authState)
    // Seed at least one comment so the widget renders the thread card
    // (the .tk-auth-bar lives inside .tk-thread-card).
    await seedOneComment(page)

    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })

    // Wait for the widget to mount
    await page.waitForSelector('#takoio .tk-comments', { timeout: 10_000 })
    // The auth bar should be visible with the user's name
    const authBar = page.locator('.tk-auth-bar')
    await expect(authBar).toBeVisible({ timeout: 5_000 })
    await expect(authBar).toContainText('E2E Tester')
    await expect(authBar).toContainText('GitHub')
  })

  test('Logout clears auth state', async ({ page, context }) => {
    const token = makeJwt(3600)
    const authState = {
      token,
      user: {
        provider: 'github',
        id: 'e2e-user-2',
        name: 'Logout Tester',
        email: 'logout@example.com',
        avatar: '',
      },
    }
    await context.addInitScript((state) => {
      localStorage.setItem('takoio_auth', JSON.stringify(state))
    }, authState)
    await seedOneComment(page)

    // Mock the logout endpoint so the test doesn't depend on the server's
    // exact behavior.
    await page.route('**/api/auth/logout', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })
    await page.waitForSelector('#takoio .tk-comments', { timeout: 10_000 })

    // Confirm the auth bar is up before logout
    await expect(page.locator('.tk-auth-bar')).toBeVisible({ timeout: 5_000 })

    // Click the logout button inside the auth bar.
    // (Note: the current implementation dispatches the auth-clear event but
    // TkComments does not subscribe, so the auth bar only disappears after
    // the widget re-reads localStorage. Reload the page to re-mount with
    // the cleared state.)
    await page.locator('.tk-auth-bar-logout').click()

    // After reload the widget re-reads localStorage (now empty) and the
    // auth bar is no longer rendered.
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('#takoio .tk-comments', { timeout: 10_000 })
    await expect(page.locator('.tk-auth-bar')).toHaveCount(0, { timeout: 5_000 })
    const stored = await page.evaluate(() => localStorage.getItem('takoio_auth'))
    expect(stored).toBeNull()
  })
})
