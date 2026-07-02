/**
 * Takoio 客户端类型定义
 *
 * 共享类型（Comment, ApiResponse 等）从 @takoio/common 导入。
 * 本文件仅定义客户端特有的类型（TakoioConfig）。
 */

// Re-export shared types
export type {
  Comment,
  CommentSubmit,
  CommentCount,
  RecentComments,
  VisitorsCount,
  ApiResponse,
  PaginatedResponse,
} from '@takoio/common'

export type { Lang } from '@takoio/common'

export type TexRenderer = (blockMode: boolean, tex: string) => string | Promise<string>

/** Takoio 配置 */
export interface TakoioConfig {
  /** 必填：私有部署的 URL */
  envId: string
  /** 评论框元素 */
  el?: string | HTMLElement
  /** 当前页面路径 */
  path?: string
  /** 当前页面 URL */
  href?: string
  /** 当前页面标题 */
  title?: string
  /** 语言 */
  lang?: 'zh-CN' | 'zh-TW' | 'en' | string
  /** 评论框占位符 */
  placeholder?: string
  /** 无头像时跳转链接 */
  noCommentImg?: string
  /** Gravatar 镜像 */
  gravatarUrl?: string
  /** 排序方式 */
  sort?: 'newest' | 'oldest' | 'hottest'
  /** 每页评论数 */
  pageSize?: number
  /** 搜索关键字 */
  search?: string
  /** 代码高亮主题 */
  codeHighlightTheme?: string
  /** 是否启用文章表态 */
  enableArticleReaction?: boolean
  /** 是否启用评论反应 */
  enableCommentReaction?: boolean
  /** 是否显示浏览量 */
  visitorCounter?: boolean
  /** 评论分页模式 */
  paginationMode?: 'pagination' | 'readmore'
  /** 是否显示网址输入框 */
  enableLinkInput?: boolean
  /** 网址是否必填 */
  commentLinkRequired?: boolean
  /** 管理员入口暗语（逗号分隔） */
  adminKeyword?: string
  /** 是否启用代码高亮 */
  enableCodeHighlight?: boolean
  /** 显示代码语言标签 */
  codeShowLanguage?: boolean
  /** 显示代码复制按钮 */
  codeShowCopy?: boolean
  /** 是否启用人机验证 */
  enableCaptcha?: boolean
  /** 验证提供商 */
  captchaProvider?: string
  /** reCAPTCHA 类型 */
  captchaType?: string
  /** 前台 Site Key */
  captchaSiteKey?: string
  /** 评论发布回调 */
  onCommentPosted?: (comment: any) => void
  /** 评论加载完成回调 */
  onCommentsLoaded?: (comments: any[]) => void
  /** 评论列表为空回调 */
  onCommentsEmpty?: () => void
  /** 错误回调 */
  onError?: (err: Error) => void
  /** 登录回调 */
  onLoginSuccess?: () => void
  /** 登出回调 */
  onLogoutSuccess?: () => void
  _showUaInfo?: boolean
  _showIpRegion?: boolean | string
  GRAVATAR_URL?: string
  MASTER_LABEL?: string
  MASTER_LABEL_COLOR?: string
  /** 管理员密码 */
  adminPassword?: string
  /** 自定义 CSS */
  customCSS?: string
  /** 品牌色（如 '#10b981'），覆盖默认的蓝色主题 */
  brandColor?: string
  /** 外部 TeX renderer；默认不内置数学公式渲染能力 */
  texRenderer?: TexRenderer
  /** 嵌套深度上限，超过后评论平铺显示（默认 2） */
  maxNestDepth?: number
  /** 折叠阈值，子评论超过此数量时显示"展开全部"按钮（默认 3） */
  collapseThreshold?: number
  /** 文章正文内容（启用 AI 摘要时必传） */
  articleContent?: string
  /** 是否启用 AI 摘要展示（与后台 ENABLE_SUMMARY 双控，任一为 false 则不显示） */
  enableSummary?: boolean
  /** 自定义摘要渲染回调。传入后内置摘要卡片不渲染，由宿主自行渲染 */
  renderSummary?: (ctx: {
    summary: string
    keywords: string[]
    loading: boolean
    error: string | null
    retry: () => void
  }) => void
}
