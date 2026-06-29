/**
 * Vector store — Redis-based vector storage for knowledge base
 *
 * Uses Redis JSON + RediSearch with vector similarity (FLAT index)
 * for storing and querying document embeddings.
 *
 * Prerequisites: Redis with RediSearch module (Redis Stack / Redis Cloud)
 * Index: idx:takoio_vectors — stores text chunks with their vector embeddings
 */

import { getRedisClient } from './redis'

const INDEX_NAME = 'idx:takoio_vectors'
const KEY_PREFIX = 'takoio:vec:'
const VECTOR_DIM = 1536 // text-embedding-3-small dimension

interface VectorDocument {
  url: string
  title: string
  chunkIndex: number
  text: string
  vector: number[]
  createdAt: number
}

/**
 * Ensure the vector search index exists. Creates it if missing.
 */
async function ensureIndex (): Promise<boolean> {
  const client = await getRedisClient()
  if (!client) return false

  try {
    // Check if index exists
    await client.sendCommand(['FT.INFO', INDEX_NAME])
    return true
  } catch {
    // Index doesn't exist — create it
  }

  try {
    await client.sendCommand([
      'FT.CREATE', INDEX_NAME,
      'ON', 'JSON',
      'PREFIX', KEY_PREFIX,
      'SCHEMA',
      '$.url', 'AS', 'url', 'TAG',
      '$.title', 'AS', 'title', 'TEXT',
      '$.chunkIndex', 'AS', 'chunkIndex', 'NUMERIC',
      '$.text', 'AS', 'text', 'TEXT',
      '$.vector', 'AS', 'vector', 'VECTOR', 'FLAT', '6',
      'TYPE', 'FLOAT32', 'DIM', String(VECTOR_DIM), 'DISTANCE_METRIC', 'COSINE',
    ])
    console.info('[vector] Created index:', INDEX_NAME)
    return true
  } catch (e: any) {
    console.warn('[vector] Failed to create index:', e.message)
    return false
  }
}

/**
 * Store a document chunk with its embedding vector.
 */
export async function storeEmbedding (
  url: string,
  title: string,
  chunkIndex: number,
  text: string,
  vector: number[],
): Promise<boolean> {
  const client = await getRedisClient()
  if (!client) return false

  await ensureIndex()

  const key = `${KEY_PREFIX}${url}::${chunkIndex}`
  const doc: VectorDocument = {
    url,
    title,
    chunkIndex,
    text,
    vector,
    createdAt: Date.now(),
  }

  try {
    await client.sendCommand(['JSON.SET', key, '$', JSON.stringify(doc)])
    return true
  } catch (e: any) {
    console.warn('[vector] Failed to store embedding:', e.message)
    return false
  }
}

/**
 * Search for similar documents using vector similarity.
 */
export async function searchSimilar (
  queryVector: number[],
  limit: number = 5,
  urlFilter?: string,
): Promise<Array<{ url: string; title: string; text: string; score: number }>> {
  const client = await getRedisClient()
  if (!client) return []

  await ensureIndex()

  // Convert vector to Buffer (FLOAT32 binary format)
  const vectorBuffer = Buffer.alloc(queryVector.length * 4)
  for (let i = 0; i < queryVector.length; i++) {
    vectorBuffer.writeFloatLE(queryVector[i], i * 4)
  }

  const vectorBlob = vectorBuffer.toString('base64')

  try {
    let query = `(*)=>[KNN ${limit} @vector $blob AS score]`
    if (urlFilter) {
      query = `(@url:{${urlFilter.replace(/'/g, "\\'")}})=>[KNN ${limit} @vector $blob AS score]`
    }

    const results = await client.sendCommand(
      ['FT.SEARCH', INDEX_NAME, query,
        'PARAMS', '2', 'blob', vectorBuffer,
        'RETURN', '3', '$.url', '$.title', '$.text',
        'SORTBY', 'score',
        'DIALECT', '2',
      ] as any[],
    ) as any[]

    if (!results || results.length < 2) return []

    // Results format: [total_count, key1, [field1, val1, ...], key2, ...]
    const total = results[0]
    const items: Array<{ url: string; title: string; text: string; score: number }> = []

    for (let i = 1; i < results.length; i += 2) {
      const fields = results[i + 1]
      if (!fields) continue
      const fieldMap: Record<string, string> = {}
      for (let j = 0; j < fields.length; j += 2) {
        fieldMap[fields[j]] = fields[j + 1]
      }
      items.push({
        url: fieldMap['$.url'] || '',
        title: fieldMap['$.title'] || '',
        text: fieldMap['$.text'] || '',
        score: parseFloat(fieldMap['score'] || '0'),
      })
    }

    return items
  } catch (e: any) {
    console.warn('[vector] Search failed:', e.message)
    return []
  }
}

/**
 * Delete all embeddings for a given URL.
 */
export async function deleteEmbeddings (url: string): Promise<number> {
  const client = await getRedisClient()
  if (!client) return 0

  try {
    // Find keys for this URL
    const keys = await client.keys(`${KEY_PREFIX}${url}::*`)
    if (keys.length === 0) return 0
    await client.del(...keys)
    return keys.length
  } catch (e: any) {
    console.warn('[vector] Delete failed:', e.message)
    return 0
  }
}

/**
 * Get knowledge base statistics.
 */
export async function getVectorStats (): Promise<{
  totalDocs: number
  totalChunks: number
  indexedUrls: string[]
}> {
  const client = await getRedisClient()
  if (!client) return { totalDocs: 0, totalChunks: 0, indexedUrls: [] }

  try {
    // Use FT.SEARCH to get document count
    const results = await client.sendCommand(
      ['FT.SEARCH', INDEX_NAME, '*', 'LIMIT', '0', '0', 'DIALECT', '2'],
    ) as any[]

    const totalChunks = results?.[0] || 0

    // Get unique URLs
    const urlResults = await client.sendCommand(
      ['FT.AGGREGATE', INDEX_NAME, '*',
        'GROUPBY', '1', '@url',
        'REDUCE', 'COUNT', '0', 'AS', 'chunk_count',
        'DIALECT', '2',
      ],
    ) as any[]

    const indexedUrls: string[] = []
    let totalDocs = 0
    if (Array.isArray(urlResults)) {
      for (const row of urlResults) {
        if (Array.isArray(row)) {
          // Each row is [field1, value1, field2, value2, ...]
          const map: Record<string, string> = {}
          for (let i = 0; i < row.length; i += 2) {
            map[row[i]] = row[i + 1]
          }
          if (map.url) {
            indexedUrls.push(map.url)
            totalDocs++
          }
        }
      }
    }

    return { totalDocs, totalChunks, indexedUrls }
  } catch {
    return { totalDocs: 0, totalChunks: 0, indexedUrls: [] }
  }
}
