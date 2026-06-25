/**
 * Takoio Self-Hosted Server — entry point
 *
 * All logic lives in:
 *   - app.ts       — Hono app definition (middleware + routes)
 *   - startup.ts   — initialization + HTTP server
 *   - handlers/    — event handlers (comment, admin, counter, image, import-export)
 *   - middleware/   — CORS, rate-limit, admin-auth
 *   - config.ts    — config management + masking
 *   - auth.ts      — password hashing + brute-force + CAPTCHA + admin auth
 *   - ip-region.ts — IP region lookup
 */

import { main } from './startup'
import { logger } from './utils/logger'

main().catch((e: any) => {
  logger.fatal(e, 'Failed to start server')
  process.exit(1)
})
