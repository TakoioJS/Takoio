/**
 * Error Types — AppError class.
 *
 * 从 config.ts 抽出（Phase 3）：错误类型与配置逻辑分离，避免循环依赖。
 */

export class AppError extends Error {
  constructor (
    public code: string,
    message: string,
    public statusCode = 400
  ) {
    super(message)
    this.name = 'AppError'
  }
}
