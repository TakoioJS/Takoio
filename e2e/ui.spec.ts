/**
 * E2E UI flow — loads the client dev server, verifies comment rendering & submission.
 *
 * Requires both servers running:
 *   - Nitro API at :8080 (playwright.config.ts webServer #1)
 *   - Vite client dev at :9820 (playwright.config.ts webServer #2)
 *
 * Flow: load page → wait for mount → fill form → submit → verify comment appears.
 */
import { test, expect } from '@playwright/test'

const CLIENT_URL = 'http://127.0.0.1:9820'

test.describe('Takoio UI flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to client dev server — index.html mounts Takoio with path '/test-article'
    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })
    // Wait for the Takoio widget to mount into #takoio
    await page.waitForSelector('#takoio .tk-submit, #takoio .tk-comments', { timeout: 15_000 })
  })

  test('mounts the comment widget on the page', async ({ page }) => {
    // The submit form should be visible
    await expect(page.locator('.tk-submit')).toBeVisible()
    // Nick/mail/comment inputs exist
    await expect(page.locator('.tk-input').first()).toBeVisible()
    await expect(page.locator('.tk-textarea')).toBeVisible()
  })

  test('validates required fields (nick + comment)', async ({ page }) => {
    // Click submit with empty form
    await page.locator('.tk-btn-primary').click()
    // Should show a field error or error message
    await expect(page.locator('.tk-input-error, .tk-error-msg')).toBeVisible({ timeout: 3000 })
  })

  test('submits a comment and it appears in the list', async ({ page }) => {
    const testNick = `UI Tester ${Date.now().toString(36)}`
    const testComment = `E2E UI test comment — ${Date.now()}`

    // Fill the form
    await page.locator('.tk-input').first().fill(testNick) // nick
    await page.locator('.tk-textarea').fill(testComment)

    // Submit
    await page.locator('.tk-btn-primary').click()

    // Wait for the comment to appear in the list
    // The comment list renders .tk-comment elements
    await expect(
      page.locator('.tk-comment', { hasText: testComment }).first()
    ).toBeVisible({ timeout: 10_000 })

    // Verify the nick is displayed
    await expect(
      page.locator('.tk-comment', { hasText: testNick }).first()
    ).toBeVisible()
  })

  test('renders markdown in submitted comment', async ({ page }) => {
    const testNick = `MD Tester ${Date.now().toString(36)}`
    const markdownContent = `**bold text** and \`inline code\``
    const testComment = `MD-UI-${Date.now()} ${markdownContent}`

    await page.locator('.tk-input').first().fill(testNick)
    await page.locator('.tk-textarea').fill(testComment)
    await page.locator('.tk-btn-primary').click()

    // Wait for the comment to appear
    const commentEl = page.locator('.tk-comment', { hasText: 'MD-UI-' }).first()
    await expect(commentEl).toBeVisible({ timeout: 10_000 })

    // Markdown should be rendered: <strong> for **bold**, <code> for `inline code`
    await expect(commentEl.locator('strong')).toBeVisible()
    await expect(commentEl.locator('code')).toBeVisible()
  })

  test('does not expose MASTER email in public config', async ({ page }) => {
    // Intercept the comments API response to verify MASTER is not leaked
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/comments') && resp.status() === 200,
      { timeout: 15_000 }
    )
    await page.reload({ waitUntil: 'networkidle' })
    const response = await responsePromise
    const body = await response.json()

    // The config object returned with comments must NOT contain MASTER
    expect(body.config).toBeDefined()
    expect(body.config.MASTER).toBeUndefined()

    // MASTER_NAME is the public display name — allowed
    // MASTER (email) must be stripped by PUBLIC_EXCLUDED_KEYS
  })
})
