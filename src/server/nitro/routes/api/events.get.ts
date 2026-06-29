/**
 * SSE endpoint mount — GET /api/events
 */

import { handleSSEConnect } from '#core/events'

export default defineHandler((event) => handleSSEConnect(event))
