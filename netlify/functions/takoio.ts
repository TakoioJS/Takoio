/**
 * Netlify Function — entry point.
 *
 * This file is registered in netlify.toml under [functions].
 * All requests are redirected here via the [[redirects]] rule.
 *
 * The build pipeline (esbuild) traces imports from cloud-entry,
 * bundles everything, and deploys to Netlify's AWS Lambda runtime.
 *
 * Usage:
 *   1. Fork this repo
 *   2. Import to Netlify
 *   3. Set env vars: DB_TYPE=mongodb, MONGODB_URI=...
 *   4. Deploy
 */

import { fetch } from '../../src/server/self-hosted/cloud-entry.ts'

interface NetlifyEvent {
  readonly path: string
  readonly httpMethod: string
  readonly headers?: Record<string, string | undefined>
  readonly body?: string
  readonly isBase64Encoded: boolean
  readonly host: string
}

export const handler = async (event: NetlifyEvent) => {
  const url = new URL(event.path, `https://${event.host}`)
  const request = new Request(url.toString(), {
    method: event.httpMethod,
    headers: new Headers(event.headers ?? {}),
    body: event.body
      ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
      : undefined,
  })

  return fetch(request)
}
