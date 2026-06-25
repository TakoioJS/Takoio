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

import { fetch as serverFetch } from '../../src/server/self-hosted/cloud-entry'

export const handler = async (event: any) => {
  const request = new Request(event.rawUrl, {
    method: event.httpMethod,
    headers: new Headers(event.headers || {}),
    body: event.body
      ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
      : undefined,
  })

  return serverFetch(request)
}
