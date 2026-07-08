/**
 * Shared AI model factory — used by AI moderation and article summary.
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export type AiFormat = 'openai' | 'anthropic' | 'gemini'

export function createModelInstance (format: AiFormat, endpoint: string, key: string, model: string) {
  switch (format) {
    case 'anthropic': {
      // Anthropic SDK baseURL 默认含 /v1，请求会追加 /messages，故 baseURL 需保留 /v1
      let baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      if (!/\/v\d/.test(baseUrl)) baseUrl += '/v1'
      return createAnthropic({ baseURL: baseUrl, apiKey: key })(model)
    }
    case 'gemini': {
      // Gemini SDK baseURL 默认含 /v1beta，请求会追加 /models/...，故 baseURL 需保留 /v1beta
      let baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      if (!/\/v1beta/.test(baseUrl)) baseUrl += '/v1beta'
      return createGoogleGenerativeAI({ baseURL: baseUrl, apiKey: key })(model)
    }
    case 'openai': {
      // OpenAI SDK baseURL 默认含 /v1，url = `${baseURL}${path}`，SDK 不会自动补 /v1，故 baseURL 须保留版本段。
      // 注意：@ai-sdk/openai v4 直接调用 provider（如 createOpenAI({...})(model)）默认走 Responses API（/responses），
      // 多数第三方 OpenAI 兼容端点（阶跃、DeepSeek 等）未实现 /responses，需显式用 .chat(model) 走 Chat Completions。
      const baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      return createOpenAI({ baseURL: baseUrl, apiKey: key }).chat(model)
    }
    default: {
      // Exhaustiveness check: if a new AiFormat is added, TypeScript will error here.
      const _exhaustive: never = format
      throw new Error(`Unsupported AI format: ${_exhaustive}`)
    }
  }
}
