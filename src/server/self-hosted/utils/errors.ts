/**
 * Application error types — structured errors with codes and HTTP status
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

export const ERR = {
  NEED_LOGIN: new AppError('NEED_LOGIN', '请先登录', 401),
  INVALID_CAPTCHA: new AppError('INVALID_CAPTCHA', '验证码验证失败', 400),
  RATE_LIMITED: new AppError('RATE_LIMITED', '请求过于频繁', 429),
  INVALID_INPUT: new AppError('INVALID_INPUT', '输入验证失败', 400),
  NOT_FOUND: new AppError('NOT_FOUND', '资源不存在', 404),
  INTERNAL: new AppError('INTERNAL', '服务器内部错误', 500),
}
