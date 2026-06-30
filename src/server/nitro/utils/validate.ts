/**
 * Zod validation helpers — replaces @hono/zod-validator
 */

import { z } from 'zod'
import { createError, getQuery, readBody } from 'h3'
import type { H3Event } from 'h3'
import type { ZodType } from 'zod'

/** Flatten ZodError into { field: string[] } structure (Zod v4 API) */
function flattenFieldErrors (error: z.ZodError): Record<string, string[]> {
  const flat = z.flattenError(error)
  const out: Record<string, string[]> = {}
  for (const [key, msgs] of Object.entries(flat.fieldErrors)) {
    if (msgs) out[key] = msgs
  }
  if (flat.formErrors.length) out._form = flat.formErrors
  return out
}

/** Validate query params with Zod schema, throw 400 on failure */
export function validateQuery<T> (event: H3Event, schema: ZodType<T>): T {
  const query = getQuery(event)
  const result = schema.safeParse(query)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: flattenFieldErrors(result.error),
    })
  }
  return result.data
}

/** Validate request body with Zod schema, throw 400 on failure */
export async function validateBody<T> (
  event: H3Event,
  schema: ZodType<T>
): Promise<T> {
  const body = await readBody(event)
  const result = schema.safeParse(body ?? {})
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: flattenFieldErrors(result.error),
    })
  }
  return result.data
}
