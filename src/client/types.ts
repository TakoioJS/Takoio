/**
 * Takoio 类型定义
 */

/** 评论对象 */
export interface Comment {
  id: string
  url: string
  href?: string
  nick: string
  mail?: string
  mailMd5?: string
  link?: string
  comment: string
  ua: string
  ip?: string
  state?: string
  created: number
  updated?: number
  pid?: string
  rid?: string
  isSpam?: boolean
  isTop?: boolean
  isPinned?: boolean
  isCollapsed?: boolean
  relativeTime?: string
  children?: Comment[]
  avatar?: string
  replyCount?: number
  isAdmin?: boolean
  isMaster?: boolean
  image?: string
  tags?: string[]
  ipRegion?: string
  replyToNick?: string
  renderedComment?: string
}

/** 评论提交参数 */
export interface CommentSubmit {
  url: string
  href?: string
  nick: string
  mail?: string
  link?: string
  comment: string
  pid?: string
  rid?: string
  ua?: string
  ip?: string
  image?: string
  sticker?: string
  at?: string
  isAdmin?: boolean
  password?: string
  token?: string
}

/** Takoio 配置 */
export interface TakoioConfig {
  /** 必填：私有部署的 URL */
  envId: string
  /** 区域 */
  region?: string
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
  highlightTheme?: string
  /** 是否自动展开所有评论 */
  autoExpand?: boolean
  /** 是否启用文章表态 */
  enableArticleReaction?: boolean
  /** 是否启用评论反应 */
  enableCommentReaction?: boolean
  /** 是否显示浏览量 */
  visitorCounter?: boolean
  /** 评论分页模式 */
  paginationMode?: 'pagination' | 'infinite'
  /** 是否显示网址输入框 */
  enableLinkInput?: boolean
  /** 网址是否必填 */
  commentLinkRequired?: boolean
  /** 管理员入口暗语（逗号分隔） */
  adminKeyword?: string
  /** 是否启用代码高亮 */
  enableCodeHighlight?: boolean
  /** 代码高亮主题 */
  codeHighlightTheme?: string
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
  /** 云函数名称 */
  funcName?: string
  /** 评论发布回调 */
  onCommentPosted?: (comment: Comment) => void
  /** 评论加载完成回调 */
  onCommentsLoaded?: (comments: Comment[]) => void
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
  /** 隐身模式 */
  phantom?: {
    master?: string[]
    label?: string
    backgroundImage?: string
  }
  /** 管理员密码 */
  adminPassword?: string
  /** 自定义 CSS */
  customCSS?: string
  /** 品牌色（如 '#10b981'），覆盖默认的蓝色主题 */
  brandColor?: string
  /** KaTeX 选项 */
  katex?: {
    delimiters?: Array<{ left: string; right: string; display: boolean }>
    throwOnError?: boolean
  }
  /** 嵌套深度上限，超过后评论平铺显示（默认 2） */
  maxNestDepth?: number
  /** 折叠阈值，子评论超过此数量时显示"展开全部"按钮（默认 3） */
  collapseThreshold?: number
  /** 文章正文内容（启用 AI 摘要时必传） */
  articleContent?: string
  /** 是否启用 AI 摘要展示（与后台 ENABLE_SUMMARY 双控，任一为 false 则不显示） */
  enableSummary?: boolean
  /** 自定义摘要渲染回调。传入后内置摘要卡片不渲染，由宿主自行渲染。
   *  回调参数：{ summary, keywords, loading, error, retry } */
  renderSummary?: (ctx: {
    summary: string
    keywords: string[]
    loading: boolean
    error: string | null
    retry: () => void
  }) => void
}

/** 评论计数响应 */
export interface CommentCount {
  url: string
  count: number
}

/** 最近评论 */
export type RecentComments = Comment[]

/** 访客计数 */
export interface VisitorsCount {
  time: number
  url: string
  title?: string
}

/** API 响应 */
export interface ApiResponse<T = any> {
  result: T
}

/** 事件类型 */
export interface PaginatedResponse<T> {
  total: number
  data: T[]
}
