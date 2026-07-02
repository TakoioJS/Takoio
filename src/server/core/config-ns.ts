/**
 * Namespaced Config — v2.0 grouped configuration views.
 *
 * Provides a structured, plugin-friendly config interface while maintaining
 * backward compatibility with the flat TakoioConfig used internally.
 *
 * @see docs/architecture-design.md ADR-004
 */

import type { TakoioConfig } from './config'

// ========== Grouped Config Interfaces ==========

export interface SiteConfig {
  name: string
  url: string
  masterName: string
  masterLabel: string
  masterLabelColor: string
  globalColor: string
}

export interface CommentConfig {
  pageSize: number
  sort: 'newest' | 'oldest' | 'hottest'
  lengthMax: number
  nickRequired: boolean
  requiredFields: string[]
  paginationMode: 'pagination' | 'readmore'
  rateLimit: number
  bgImage: string
}

export interface ModerationConfig {
  auditMode: boolean
  blockedKeywords: string
  autoAuditMethod: string
  autoAuditAiProvider: string
  autoAuditAiModel: string
  autoAuditAiPrompt: string
  enableAntiSpam: boolean
  enableNsfwDetection: boolean
}

export interface NotificationConfig {
  email: {
    enabled: boolean
    host: string
    port: number
    user: string
    pass: string
    from: string
    to: string
    tls: boolean
    senderName: string
    subject: string
    template: string
    subjectAdmin: string
    templateAdmin: string
  }
  pushoo: {
    channels: string
  }
}

export interface AppearanceConfig {
  gravatarUrl: string
  gravatarDefault: string
  customCSS: string
  codeHighlightTheme: string
  codeShowLanguage: boolean
  codeShowCopy: boolean
  enableCodeHighlight: boolean
  showUaInfo: boolean
  showIpRegion: boolean | string
  enableLike: boolean
  enableDislike: boolean
  enableEmotion: boolean
  enableLinkInput: boolean
  commentLinkRequired: boolean
  enableVisitorCounter: boolean
  enableArticleReaction: boolean
}

export interface CaptchaConfig {
  enabled: boolean
  provider: string
  type: string
  siteKey: string
  secretKey: string
}

export interface ImageHostingConfig {
  enabled: boolean
  provider: string
  endpoint: string
  token: string
  bucket: string
  region: string
  accessKey: string
  secretKey: string
  cdnDomain: string
}

export interface SecurityConfig {
  corsOrigins: string
  ipProxyHeader: string
  trustedProxies: string
  ipRegionEnabled: boolean
  adminKeyword: string
  enableAdminKeyword: boolean
}

export interface SocialAuthConfig {
  github: { enabled: boolean; clientId: string; clientSecret: string }
  google: { enabled: boolean; clientId: string; clientSecret: string }
  email: { enabled: boolean }
}

export interface AIConfig {
  providers: string
  summary: {
    enabled: boolean
    provider: string
    model: string
  }
}

/** v2.0 Namespaced config — the canonical plugin-facing config */
export interface NamespacedConfig {
  site: SiteConfig
  comment: CommentConfig
  moderation: ModerationConfig
  notification: NotificationConfig
  appearance: AppearanceConfig
  captcha: CaptchaConfig
  imageHosting: ImageHostingConfig
  security: SecurityConfig
  socialAuth: SocialAuthConfig
  ai: AIConfig
}

// ========== Flat → Namespaced Converter ==========

/**
 * Convert legacy flat TakoioConfig to namespaced v2.0 config.
 * Zero-overhead: pure field mapping, no DB changes.
 */
export function toNamespaced (cfg: TakoioConfig): NamespacedConfig {
  return {
    site: {
      name: cfg.SITE_NAME,
      url: cfg.SITE_URL || '',
      masterName: cfg.MASTER_NAME,
      masterLabel: cfg.MASTER_LABEL || '',
      masterLabelColor: cfg.MASTER_LABEL_COLOR || '',
      globalColor: cfg.GLOBAL_COLOR || '',
    },
    comment: {
      pageSize: cfg.PAGE_SIZE,
      sort: cfg.COMMENT_SORT,
      lengthMax: cfg.COMMENT_LENGTH_MAX,
      nickRequired: cfg.COMMENT_NICK_REQUIRED,
      requiredFields: cfg.REQUIRED_FIELDS,
      paginationMode: cfg.COMMENT_PAGINATION_MODE,
      rateLimit: cfg.COMMENT_RATE_LIMIT,
      bgImage: cfg.COMMENT_BG_IMAGE || '',
    },
    moderation: {
      auditMode: cfg.AUDIT_MODE,
      blockedKeywords: cfg.BLOCKED_KEYWORDS,
      autoAuditMethod: cfg.AUTO_AUDIT_METHOD,
      autoAuditAiProvider: cfg.AUTO_AUDIT_AI_PROVIDER,
      autoAuditAiModel: cfg.AUTO_AUDIT_AI_MODEL,
      autoAuditAiPrompt: cfg.AUTO_AUDIT_AI_PROMPT,
      enableAntiSpam: cfg.ENABLE_ANTI_SPAM ?? false,
      enableNsfwDetection: cfg.ENABLE_NSFW_DETECTION,
    },
    notification: {
      email: {
        enabled: cfg.ENABLE_MAIL_NOTIFICATION,
        host: cfg.SMTP_HOST,
        port: cfg.SMTP_PORT,
        user: cfg.SMTP_USER,
        pass: cfg.SMTP_PASS,
        from: cfg.SMTP_FROM,
        to: cfg.SMTP_TO,
        tls: cfg.SMTP_TLS,
        senderName: cfg.SENDER_NAME,
        subject: cfg.MAIL_SUBJECT,
        template: cfg.MAIL_TEMPLATE,
        subjectAdmin: cfg.MAIL_SUBJECT_ADMIN,
        templateAdmin: cfg.MAIL_TEMPLATE_ADMIN,
      },
      pushoo: {
        channels: cfg.PUSHOO_CHANNELS,
      },
    },
    appearance: {
      gravatarUrl: cfg.GRAVATAR_URL,
      gravatarDefault: cfg.GRAVATAR_DEFAULT,
      customCSS: cfg.CUSTOM_CSS || '',
      codeHighlightTheme: cfg.CODE_HIGHLIGHT_THEME,
      codeShowLanguage: cfg.CODE_SHOW_LANGUAGE,
      codeShowCopy: cfg.CODE_SHOW_COPY,
      enableCodeHighlight: cfg.ENABLE_CODE_HIGHLIGHT,
      showUaInfo: cfg.SHOW_UA_INFO,
      showIpRegion: cfg.SHOW_IP_REGION,
      enableLike: cfg.ENABLE_LIKE,
      enableDislike: cfg.ENABLE_DISLIKE,
      enableEmotion: cfg.ENABLE_EMOTION,
      enableLinkInput: cfg.ENABLE_LINK_INPUT,
      commentLinkRequired: cfg.COMMENT_LINK_REQUIRED,
      enableVisitorCounter: cfg.ENABLE_VISITOR_COUNTER,
      enableArticleReaction: cfg.ENABLE_ARTICLE_REACTION ?? false,
    },
    captcha: {
      enabled: cfg.ENABLE_CAPTCHA,
      provider: cfg.CAPTCHA_PROVIDER || 'turnstile',
      type: cfg.CAPTCHA_TYPE || '',
      siteKey: cfg.CAPTCHA_SITE_KEY || '',
      secretKey: cfg.CAPTCHA_SECRET_KEY || '',
    },
    imageHosting: {
      enabled: cfg.ENABLE_IMAGE_UPLOAD,
      provider: cfg.IMAGE_HOSTING_PROVIDER || '',
      endpoint: cfg.IMAGE_HOSTING_ENDPOINT || '',
      token: cfg.IMAGE_HOSTING_TOKEN || '',
      bucket: cfg.IMAGE_HOSTING_BUCKET || '',
      region: cfg.IMAGE_HOSTING_REGION || '',
      accessKey: cfg.IMAGE_HOSTING_ACCESS_KEY || '',
      secretKey: cfg.IMAGE_HOSTING_SECRET_KEY || '',
      cdnDomain: cfg.IMAGE_HOSTING_CDN_DOMAIN || '',
    },
    security: {
      corsOrigins: cfg.CORS_ORIGINS || '',
      ipProxyHeader: cfg.IP_PROXY_HEADER || '',
      trustedProxies: cfg.TRUSTED_PROXIES || '',
      ipRegionEnabled: cfg.IP_REGION_ENABLED,
      adminKeyword: cfg.ADMIN_KEYWORD || '',
      enableAdminKeyword: cfg.ENABLE_ADMIN_KEYWORD,
    },
    socialAuth: {
      github: {
        enabled: cfg.SOCIAL_AUTH_GITHUB_ENABLED,
        clientId: cfg.SOCIAL_AUTH_GITHUB_CLIENT_ID || '',
        clientSecret: cfg.SOCIAL_AUTH_GITHUB_CLIENT_SECRET || '',
      },
      google: {
        enabled: cfg.SOCIAL_AUTH_GOOGLE_ENABLED,
        clientId: cfg.SOCIAL_AUTH_GOOGLE_CLIENT_ID || '',
        clientSecret: cfg.SOCIAL_AUTH_GOOGLE_CLIENT_SECRET || '',
      },
      email: {
        enabled: cfg.SOCIAL_AUTH_EMAIL_ENABLED,
      },
    },
    ai: {
      providers: cfg.AI_PROVIDERS || '[]',
      summary: {
        enabled: cfg.ENABLE_SUMMARY ?? cfg.AI_SUMMARY_ENABLED,
        provider: cfg.AI_SUMMARY_PROVIDER || '',
        model: cfg.AI_SUMMARY_MODEL || '',
      },
    },
  }
}

/**
 * Create a backward-compatible config proxy that supports both
 * flat (cfg.PAGE_SIZE) and namespaced (cfg.comment.pageSize) access.
 *
 * This allows gradual migration — existing code continues to work,
 * while plugins and new code use the namespaced interface.
 */
export function createConfigProxy (cfg: TakoioConfig): TakoioConfig & NamespacedConfig {
  const ns = toNamespaced(cfg)

  return new Proxy(cfg, {
    get (target, prop) {
      // Namespaced access: cfg.comment → ns.comment
      if (prop in ns) {
        return (ns as any)[prop]
      }
      // Flat access: fallback to original
      return (target as any)[prop]
    },
  }) as unknown as TakoioConfig & NamespacedConfig
}
