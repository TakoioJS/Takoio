/**
 * Vercel Serverless Function — entry point.
 *
 * This file is automatically detected by Vercel from the /api directory.
 * All incoming requests are rewritten to this handler via vercel.json.
 *
 * Usage:
 *   1. Fork this repo
 *   2. Import to Vercel
 *   3. Set env vars: DB_TYPE=mongodb, MONGODB_URI=...
 *   4. Deploy
 */

import { fetch } from '../src/server/self-hosted/cloud-entry'

export const GET = fetch
export const POST = fetch
export const PUT = fetch
export const DELETE = fetch
export const PATCH = fetch
export const HEAD = fetch
export const OPTIONS = fetch
