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

import { fetch } from '../dist/server/cloud-entry.js'

// Vercel auto-discovers this file; rewrite rules route all requests here.
export { fetch as GET, fetch as POST, fetch as PUT, fetch as DELETE, fetch as PATCH, fetch as HEAD, fetch as OPTIONS }
