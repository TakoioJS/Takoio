/**
 * useApi — 通用 API 调用 + 错误处理 + loading 状态封装
 *
 * 消除 admin view 中重复的 loading=true/try/catch/finally 模式。
 * 整合 Naive UI 的 useMessage 提供一致的 toast 反馈。
 *
 * 用法：
 * ```ts
 * const { call, loading } = useApi()
 *
 * // 基础：自定义成功/错误处理
 * const result = await call(
 *   () => commentsApi.list(params),
 *   {
 *     onSuccess: (data) => { comments.value = data.data },
 *     onError: (e) => message.error(e.message),
 *   }
 * )
 *
 * // 简化：自动 toast（默认行为）
 * const result = await call(
 *   () => configApi.save(payload),
 *   { successMsg: '保存成功', errorMsg: '保存失败' }
 * )
 * ```
 */

import { ref } from 'vue'
import { useMessage } from 'naive-ui'

export type ApiCallOptions<T> = {
  /** 成功回调（可选） */
  onSuccess?: (data: T) => void
  /** 错误回调（可选，不传则用 useMessage.error） */
  onError?: (e: Error) => void
  /** 成功后自动 toast 的消息（可选） */
  successMsg?: string
  /** 失败后自动 toast 的消息（可选，不传则用 e.message） */
  errorMsg?: string
}

export function useApi () {
  const loading = ref(false)
  const message = useMessage()

  const call = async <T> (
    fn: () => Promise<T>,
    options?: ApiCallOptions<T>
  ): Promise<T | undefined> => {
    loading.value = true
    try {
      const data = await fn()
      if (options?.onSuccess) {
        options.onSuccess(data)
      }
      if (options?.successMsg) {
        message.success(options.successMsg)
      }
      return data
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(String(e))
      if (options?.onError) {
        options.onError(err)
      } else if (options?.errorMsg) {
        message.error(options.errorMsg)
      } else {
        message.error(err.message || '操作失败')
      }
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { call, loading }
}

/** useApi 的挂起版本（调用时自动重置 loading） */
export function useApiWithReset () {
  const api = useApi()
  const reset = () => { api.loading.value = false }
  return { ...api, reset }
}