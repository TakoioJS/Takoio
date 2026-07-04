/**
 * Config Metadata — single source of truth for ALL configuration keys.
 *
 * Adding a new config key now requires changes ONLY in this file.
 * Everything else (TakoioConfig interface, DEFAULT_CONFIG, HIDDEN_KEYS,
 * MASKED_KEYS, PUBLIC_ALLOWED_KEYS, validateConfigBatch) is auto-derived.
 *
 * Categories:
 *   public  — appears in GET /api/comments? (publicConfigSubset)
 *   masked  — value is masked with **** in admin panel (maskSensitiveConfig)
 *   hidden  — completely excluded from ALL API responses
 *   (none)  — appears in admin API but not in public API
 *
 * @see docs/architecture-design.md ADR-004
 */

export interface ConfigMeta {
  key: string
  type: 'string' | 'number' | 'boolean' | 'string[]'
  default: string | number | boolean | string[]
  /** Appears in public API (GET /api/comments?) */
  public?: boolean
  /** Masked in admin API (replaced with ****) */
  masked?: boolean
  /** Completely hidden from all API responses */
  hidden?: boolean
}

// ========== Single Source of Truth ==========
// Edit HERE to add/remove/modify config keys.
// Everything below this line is auto-generated.

export const CONFIG_META: ConfigMeta[] = [
  // ---- Site ----
  { key: 'TYPE',                    type: 'string',  default: 'self-hosted',                            hidden: true },
  { key: 'SITE_NAME',               type: 'string',  default: 'My Blog',                               public: true },
  { key: 'SITE_URL',                type: 'string',  default: '',                                       public: true },
  { key: 'MASTER',                  type: 'string',  default: '',                                       hidden: true },
  { key: 'MASTER_NAME',             type: 'string',  default: '',                                       public: true },
  { key: 'MASTER_LABEL',            type: 'string',  default: '',                                       public: true },
  { key: 'MASTER_LABEL_COLOR',      type: 'string',  default: '',                                       public: true },
  { key: 'GLOBAL_COLOR',            type: 'string',  default: '#5E8C6A',                                   public: true },

  // ---- Comment Display ----
  { key: 'PAGE_SIZE',               type: 'number',  default: 10,                                       public: true },
  { key: 'COMMENT_SORT',            type: 'string',  default: 'newest',                                 public: true },
  { key: 'COMMENT_LENGTH_MAX',      type: 'number',  default: 500,                                      public: true },
  { key: 'REQUIRED_FIELDS',         type: 'string[]', default: ['nick'],                                 public: true },
  { key: 'COMMENT_NICK_REQUIRED',   type: 'boolean', default: true,                                     public: true },
  { key: 'COMMENT_PAGINATION_MODE', type: 'string',  default: 'pagination',                             public: true },
  { key: 'COMMENT_RATE_LIMIT',      type: 'number',  default: 30000,                                    public: true },
  { key: 'COMMENT_BG_IMAGE',        type: 'string',  default: '',                                       public: true },
  { key: 'COMMENT_FEATURES',        type: 'string',  default: '',                                       public: true },

  // ---- Avatar ----
  { key: 'GRAVATAR_URL',            type: 'string',  default: 'https://weavatar.com/avatar/',           public: true },
  { key: 'GRAVATAR_URL_CUSTOM',     type: 'string',  default: '',                                       public: true },
  { key: 'GRAVATAR_DEFAULT',        type: 'string',  default: 'identicon',                              public: true },

  // ---- Features ----
  { key: 'ENABLE_VISITOR_COUNTER',  type: 'boolean', default: true,                                     public: true },
  { key: 'ENABLE_ARTICLE_REACTION', type: 'boolean', default: false,                                    public: true },
  { key: 'ENABLE_COMMENT_REACTION', type: 'boolean', default: true,                                     public: true },
  { key: 'ENABLE_LINK_INPUT',       type: 'boolean', default: true,                                     public: true },
  { key: 'COMMENT_LINK_REQUIRED',   type: 'boolean', default: false,                                    public: true },
  { key: 'ENABLE_ADMIN_KEYWORD',    type: 'boolean', default: false,                                    hidden: true },
  { key: 'ADMIN_KEYWORD',           type: 'string',  default: '#admin',                                 hidden: true },

  // ---- Code Highlight ----
  { key: 'ENABLE_CODE_HIGHLIGHT',   type: 'boolean', default: true,                                     public: true },
  { key: 'CODE_HIGHLIGHT_THEME',    type: 'string',  default: 'one-dark-pro',                           public: true },
  { key: 'CODE_SHOW_LANGUAGE',      type: 'boolean', default: true,                                     public: true },
  { key: 'CODE_SHOW_COPY',          type: 'boolean', default: true,                                     public: true },

  // ---- CAPTCHA ----
  { key: 'ENABLE_CAPTCHA',          type: 'boolean', default: false,                                    public: true },
  { key: 'CAPTCHA_PROVIDER',        type: 'string',  default: 'turnstile',                              public: true },
  { key: 'CAPTCHA_TYPE',            type: 'string',  default: 'checkbox',                               public: true },
  { key: 'CAPTCHA_SITE_KEY',        type: 'string',  default: '',                                       public: true },
  { key: 'CAPTCHA_SECRET_KEY',      type: 'string',  default: '',                                       masked: true },

  // ---- Image Upload ----
  { key: 'ENABLE_IMAGE_UPLOAD',     type: 'boolean', default: false,                                    public: true },
  { key: 'IMAGE_HOSTING_PROVIDER',  type: 'string',  default: '',                                       public: true },
  { key: 'IMAGE_HOSTING_ENDPOINT',  type: 'string',  default: '',                                       hidden: true },
  { key: 'IMAGE_HOSTING_TOKEN',     type: 'string',  default: '',                                       masked: true },
  { key: 'IMAGE_HOSTING_BUCKET',    type: 'string',  default: '',                                       hidden: true },
  { key: 'IMAGE_HOSTING_REGION',    type: 'string',  default: '',                                       hidden: true },
  { key: 'IMAGE_HOSTING_ACCESS_KEY', type: 'string',  default: '',                                       masked: true },
  { key: 'IMAGE_HOSTING_SECRET_KEY', type: 'string',  default: '',                                       masked: true },
  { key: 'IMAGE_HOSTING_CDN_DOMAIN', type: 'string',  default: '',                                       hidden: true },

  // ---- NSFW ----
  { key: 'ENABLE_NSFW_DETECTION',   type: 'boolean', default: false,                                    public: true },
  { key: 'NSFW_SERVICE',            type: 'string',  default: 'self',                                   hidden: true },
  { key: 'NSFW_ENDPOINT',           type: 'string',  default: '',                                       hidden: true },
  { key: 'NSFW_API_KEY',            type: 'string',  default: '',                                       masked: true },
  { key: 'NSFW_THRESHOLD',          type: 'number',  default: 0.5,                                      hidden: true },

  // ---- Moderation ----
  { key: 'AUDIT_MODE',              type: 'boolean', default: false,                                    public: true },
  { key: 'AUTO_AUDIT_METHOD',       type: 'string',  default: '',                                       hidden: true },
  { key: 'AUTO_AUDIT_AI_PROVIDER',  type: 'string',  default: '',                                       hidden: true },
  { key: 'AUTO_AUDIT_AI_MODEL',     type: 'string',  default: '',                                       hidden: true },
  { key: 'AUTO_AUDIT_AI_PROMPT',    type: 'string',  default: '',                                       hidden: true },
  { key: 'BLOCKED_KEYWORDS',        type: 'string',  default: '赌博,博彩,外围,买分,卖分,刷分,代发,推广,SEO,裸聊,约炮,成人,刷屏,恶意攻击,小姐,招嫖', hidden: true },
  { key: 'AKISMET_KEY',             type: 'string',  default: '',                                       masked: true, hidden: true },
  { key: 'ENABLE_ANTI_SPAM',        type: 'boolean', default: false,                                    public: true },

  // ---- IP & Security ----
  { key: 'IP_REGION_ENABLED',       type: 'boolean', default: true,                                     public: true },
  { key: 'IP_PROXY_HEADER',         type: 'string',  default: '',                                       hidden: true },
  { key: 'TRUSTED_PROXIES',         type: 'string',  default: '',                                       hidden: true },
  { key: 'SHOW_IP_REGION',          type: 'string',  default: 'all',                                    public: true },
  { key: 'SHOW_UA_INFO',            type: 'boolean', default: true,                                     hidden: true },
  { key: 'CORS_ORIGINS',            type: 'string',  default: '',                                       hidden: true },

  // ---- Email Notification ----
  { key: 'ENABLE_MAIL_NOTIFICATION',  type: 'boolean', default: false,                                  public: true },
  { key: 'MAIL_NOTIFY_ENABLED',       type: 'boolean', default: false,                                  public: true },
  { key: 'SMTP_HOST',               type: 'string',  default: '',                                       hidden: true },
  { key: 'SMTP_PORT',               type: 'number',  default: 587,                                      hidden: true },
  { key: 'SMTP_USER',               type: 'string',  default: '',                                       hidden: true },
  { key: 'SMTP_PASS',               type: 'string',  default: '',                                       masked: true, hidden: true },
  { key: 'SMTP_FROM',               type: 'string',  default: '',                                       hidden: true },
  { key: 'SMTP_TO',                 type: 'string',  default: '',                                       hidden: true },
  { key: 'SMTP_TLS',                type: 'boolean', default: true,                                      hidden: true },
  { key: 'SENDER_EMAIL',            type: 'string',  default: '',                                       hidden: true },
  { key: 'SENDER_NAME',             type: 'string',  default: '',                                       public: true },
  { key: 'MAIL_SUBJECT',            type: 'string',  default: '有人在 {title} 中回复了你',              public: true },
  { key: 'MAIL_TEMPLATE',           type: 'string',  default: '<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#333"><div style="text-align:center;padding:16px 0;font-size:22px;font-weight:700;color:#10b981">{{ siteName }}</div><div style="background:#f9fafb;border-radius:10px;padding:20px;margin:12px 0"><div style="font-size:14px;color:#666;margin-bottom:8px"><strong style="color:#333">{{ nick }}</strong> 回复了你：</div><div style="font-size:15px;line-height:1.7;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;white-space:pre-wrap">{{ comment }}</div></div><div style="text-align:center;margin:20px 0"><a href="{{ url }}" style="display:inline-block;padding:10px 28px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">查看回复</a></div><div style="font-size:12px;color:#999;text-align:center;border-top:1px solid #e5e7eb;padding-top:14px">来自 {{ siteName }} 的邮件通知</div></div>', hidden: true },
  { key: 'MAIL_SUBJECT_ADMIN',      type: 'string',  default: '新的评论：{nick} 在 {title}',            public: true },
  { key: 'MAIL_TEMPLATE_ADMIN',     type: 'string',  default: '<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#333"><div style="text-align:center;padding:16px 0;font-size:22px;font-weight:700;color:#10b981">{{ siteName }}</div><div style="background:#f9fafb;border-radius:10px;padding:20px;margin:12px 0"><div style="font-size:13px;color:#666;margin-bottom:10px">访客 <strong style="color:#333">{{ nick }}</strong> 在文章 <strong>{{ title }}</strong> 中发表了新评论</div><div style="font-size:15px;line-height:1.7;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;white-space:pre-wrap;margin-bottom:10px">{{ comment }}</div><div style="font-size:12px;color:#999;border-top:1px solid #e5e7eb;padding-top:8px">IP: {{ ip }} ｜ UA: {{ ua }}</div></div><div style="text-align:center;margin:20px 0"><a href="{{ url }}" style="display:inline-block;padding:10px 28px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">管理评论</a></div><div style="font-size:12px;color:#999;text-align:center;border-top:1px solid #e5e7eb;padding-top:14px">{{ siteName }} · 管理通知</div></div>', hidden: true },

  // ---- Pushoo ----
  { key: 'PUSHOO_CHANNELS',         type: 'string',  default: '',                                       masked: true, hidden: true },

  // ---- AI / LLM ----
  { key: 'AI_PROVIDERS',            type: 'string',  default: '[]',                                     masked: true, hidden: true },
  { key: 'AI_SUMMARY_ENABLED',      type: 'boolean', default: true,                                     public: true },
  { key: 'AI_SUMMARY_PROVIDER',     type: 'string',  default: '',                                       hidden: true },
  { key: 'AI_SUMMARY_MODEL',        type: 'string',  default: '',                                       hidden: true },
  { key: 'ENABLE_SUMMARY',          type: 'boolean', default: true,                                     public: true },

  // ---- Customization ----
  { key: 'CUSTOM_CSS',              type: 'string',  default: '',                                       public: true },
  { key: 'CDN_PREFIX',              type: 'string',  default: '',                                       public: true },

  // ---- Social Auth ----
  { key: 'SOCIAL_AUTH_EMAIL_ENABLED',      type: 'boolean', default: true,                              public: true },
  { key: 'SOCIAL_AUTH_GITHUB_ENABLED',     type: 'boolean', default: false,                             public: true },
  { key: 'SOCIAL_AUTH_GITHUB_CLIENT_ID',   type: 'string',  default: '',                               hidden: true },
  { key: 'SOCIAL_AUTH_GITHUB_CLIENT_SECRET', type: 'string', default: '',                               masked: true },
  { key: 'SOCIAL_AUTH_GOOGLE_ENABLED',     type: 'boolean', default: false,                             public: true },
  { key: 'SOCIAL_AUTH_GOOGLE_CLIENT_ID',   type: 'string',  default: '',                               hidden: true },
  { key: 'SOCIAL_AUTH_GOOGLE_CLIENT_SECRET', type: 'string', default: '',                               masked: true },
]

// ========== Auto-Generated Derivatives ==========

/** Flat default config object */
export function buildDefaults (): Record<string, any> {
  const defaults: Record<string, any> = {}
  for (const m of CONFIG_META) {
    defaults[m.key] = m.default
  }
  return defaults
}

/** All allowed config keys */
export function buildAllowedKeys (): string[] {
  return CONFIG_META.map(m => m.key)
}

/** Keys that are completely hidden from all API responses */
export function buildHiddenKeys (): Set<string> {
  return new Set(CONFIG_META.filter(m => m.hidden).map(m => m.key))
}

/** Keys whose values are masked in admin API */
export function buildMaskedKeys (): Set<string> {
  return new Set(CONFIG_META.filter(m => m.masked).map(m => m.key))
}

/** Keys allowed in public API (GET /api/comments?) */
export function buildPublicKeys (): Set<string> {
  return new Set(CONFIG_META.filter(m => m.public).map(m => m.key))
}
