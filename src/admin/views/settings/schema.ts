import {
  InformationCircleOutline, ColorPaletteOutline,
  ImagesOutline, ShieldOutline, NotificationsOutline,
  BuildOutline, ChatbubblesOutline, CodeSlashOutline, MailOutline,
} from '@vicons/ionicons5'

export interface ConfigField {
  key: string
  label: string
  type: 'input' | 'switch' | 'select' | 'tag-select' | 'number' | 'textarea' | 'color' | 'slider' | 'checkbox-group' | 'sensitive'
  options?: { label: string; value: unknown }[]
  placeholder?: string
  hint?: string
  description?: string
  min?: number
  max?: number
  step?: number
  rows?: number
  clearable?: boolean
  filterable?: boolean
  tag?: boolean
  group?: string
  full?: boolean
  condition?: (c: Record<string, unknown>) => boolean
  disabled?: (c: Record<string, unknown>) => boolean
}

export interface ConfigSection {
  key: string
  label: string
  icon: unknown
  fields: ConfigField[]
}

const isS3Provider = (provider: string) => ['qcloud', 'dogecloud', 'r2', 's3'].includes(provider)
const isTokenProvider = (provider: string) => ['see', 'lskypro', 'piclist', 'easyimage', 'chevereto'].includes(provider)

export const sections: ConfigSection[] = [
  {
    key: 'basic', label: '基本', icon: InformationCircleOutline,
    fields: [
      { key: 'SITE_NAME', label: '站点名称', type: 'input', placeholder: '我的网站' },
      { key: 'SITE_URL', label: '站点地址', type: 'input', placeholder: 'https://example.com' },
      { key: 'MASTER_NAME', label: '博主昵称', type: 'input' },
      { key: 'MASTER', label: '博主邮箱', type: 'input', placeholder: 'admin@example.com' },
      { key: 'GRAVATAR_URL', label: '头像服务', type: 'select', clearable: true,
        options: [
          { label: 'WeAvatar', value: 'https://weavatar.com/avatar/' },
          { label: 'Cravatar', value: 'https://cn.cravatar.com/avatar/' },
          { label: 'GravatarCN', value: 'https://gravatar.cn/avatar/' },
          { label: 'Gravatar', value: 'https://www.gravatar.com/avatar/' },
          { label: 'geekzu', value: 'https://sdn.geekzu.org/avatar/' },
          { label: 'loli', value: 'https://gravatar.loli.net/avatar/' },
          { label: '自定义', value: '__custom__' },
        ] },
      { key: 'GRAVATAR_URL_CUSTOM', label: '自定义头像服务 URL', type: 'input', placeholder: 'https://example.com/avatar/',
        condition: (c) => c.GRAVATAR_URL === '__custom__' },
      { key: 'GRAVATAR_DEFAULT', label: '默认头像', type: 'select',
        options: [
          { label: '几何图案 (identicon)', value: 'identicon' },
          { label: '神秘人 (mp)', value: 'mp' },
          { label: '小怪物 (monsterid)', value: 'monsterid' },
          { label: '抽象人脸 (wavatar)', value: 'wavatar' },
          { label: '复古像素 (retro)', value: 'retro' },
          { label: '机器人 (robohash)', value: 'robohash' },
        ] },
      { key: 'REQUIRED_FIELDS', label: '必填字段', type: 'checkbox-group', full: true,
        options: [{ label: '昵称', value: 'nick' }, { label: '邮箱', value: 'mail' }, { label: '网站', value: 'link' }] },
    ]
  },
  {
    key: 'appearance', label: '外观', icon: ColorPaletteOutline,
    fields: [
      { key: 'GLOBAL_COLOR', label: '主题色', type: 'color', placeholder: '#5E8C6A' },
      { key: 'MASTER_LABEL_COLOR', label: '博主标签色', type: 'color', placeholder: '#ff6b6b' },
      { key: 'MASTER_LABEL', label: '博主标签文字', type: 'input', placeholder: '博主' },
      { key: 'COMMENT_BG_IMAGE', label: '评论区背景图', type: 'input', full: true, placeholder: 'https://...' },
    ]
  },
  {
    key: 'comments', label: '评论', icon: ChatbubblesOutline,
    fields: [
      { key: 'COMMENT_SORT', label: '评论排序', type: 'select',
        options: [{ label: '最新', value: 'newest' }, { label: '最早', value: 'oldest' }, { label: '最热', value: 'hottest' }] },
      { key: 'COMMENT_PAGINATION_MODE', label: '分页方式', type: 'select',
        options: [{ label: '分页', value: 'pagination' }, { label: '无限滚动', value: 'infinite' }] },
      { key: 'PAGE_SIZE', label: '每页条数', type: 'number', min: 1, max: 100 },
      { key: 'COMMENT_LENGTH_MAX', label: '最大字数', type: 'number', min: 1, max: 10000 },
      { key: 'COMMENT_FEATURES', label: '功能开关', type: 'checkbox-group', full: true,
        options: [
          { label: '点赞', value: 'like' },
          { label: '点踩', value: 'dislike' },
          { label: '文章表态', value: 'articleReaction' },
          { label: '表情功能', value: 'emotion' },
          { label: '网站输入框', value: 'linkInput' },
          { label: 'UA信息', value: 'uaInfo' },
        ] },
    ]
  },
  {
    key: 'security', label: '安全', icon: ShieldOutline,
    fields: [
      { key: 'COMMENT_RATE_LIMIT', label: '评论间隔 (ms)', type: 'number', min: 0, max: 99999 },
      { key: 'IP_PROXY_HEADER', label: 'IP 代理头', type: 'tag-select', clearable: true,
        hint: '获取客户端真实 IP',
        options: [
          { label: 'X-Forwarded-For', value: 'X-Forwarded-For' },
          { label: 'X-Real-IP', value: 'X-Real-IP' },
          { label: 'CF-Connecting-IP', value: 'CF-Connecting-IP' },
          { label: 'True-Client-IP', value: 'True-Client-IP' },
        ] },
      { key: 'IP_REGION_ENABLED', label: 'IP归属地', type: 'switch' },
      { key: 'SHOW_IP_REGION', label: '归属地精度', type: 'select',
        condition: (c) => c.IP_REGION_ENABLED,
        options: [{ label: '完整', value: 'all' }, { label: '仅省份', value: 'city' }] },
      { key: 'TRUSTED_PROXIES', label: '可信代理', type: 'input', full: true,
        condition: (c) => c.IP_REGION_ENABLED, placeholder: '127.0.0.1,::1' },
      { key: 'AUDIT_MODE', label: '先审后发', type: 'switch' },
      { key: 'AUTO_AUDIT_METHOD', label: '自动审核', type: 'select',
        options: [
          { label: '不启用', value: '' },
          { label: 'Akismet', value: 'akismet' },
          { label: 'AI 审核', value: 'ai' },
          { label: '传统关键词', value: 'traditional' },
        ] },
      { key: 'AKISMET_KEY', label: 'Akismet Key', type: 'sensitive',
        condition: (c) => c.AUTO_AUDIT_METHOD === 'akismet' },
      { key: 'AUTO_AUDIT_AI_PROVIDER', label: 'AI 审核提供商', type: 'select',
        options: [],
        condition: (c) => c.AUTO_AUDIT_METHOD === 'ai' },
      { key: 'AUTO_AUDIT_AI_MODEL', label: 'AI 审核模型', type: 'select',
        options: [],
        filterable: true,
        condition: (c) => c.AUTO_AUDIT_METHOD === 'ai' },
      { key: 'AUTO_AUDIT_AI_PROMPT', label: 'AI 审核提示词', type: 'textarea', rows: 4, full: true,
        placeholder: '你是一个评论审核助手，请判断以下评论是否包含垃圾信息、广告或不当内容...',
        condition: (c) => c.AUTO_AUDIT_METHOD === 'ai' },
      { key: 'BLOCKED_KEYWORDS', label: '屏蔽关键词', type: 'textarea', rows: 3,
        placeholder: '用逗号分隔，如：赌博,博彩,推广',
        condition: (c) => c.AUTO_AUDIT_METHOD === 'traditional' || c.AUTO_AUDIT_METHOD === '' },
      { key: 'ENABLE_CAPTCHA', label: '人机验证', type: 'switch' },
      { key: 'CAPTCHA_PROVIDER', label: '验证服务商', type: 'select',
        condition: (c) => c.ENABLE_CAPTCHA,
        options: [
          { label: 'Cloudflare Turnstile', value: 'turnstile' },
          { label: 'Google reCAPTCHA', value: 'recaptcha' },
          { label: 'hCaptcha', value: 'hcaptcha' },
          { label: '极验 GeeTest', value: 'geetest' },
        ] },
      { key: 'CAPTCHA_TYPE', label: '验证类型', type: 'select',
        condition: (c) => c.ENABLE_CAPTCHA && c.CAPTCHA_PROVIDER === 'recaptcha',
        options: [{ label: 'Checkbox', value: 'checkbox' }, { label: 'Invisible', value: 'invisible' }] },
      { key: 'CAPTCHA_SITE_KEY', label: 'Site Key', type: 'input',
        condition: (c) => c.ENABLE_CAPTCHA },
      { key: 'CAPTCHA_SECRET_KEY', label: 'Secret Key', type: 'sensitive',
        condition: (c) => c.ENABLE_CAPTCHA },
      { key: 'ENABLE_NSFW_DETECTION', label: '启用 NSFW 检测', type: 'switch' },
      { key: 'NSFW_SERVICE', label: '检测服务', type: 'select',
        condition: (c) => c.ENABLE_NSFW_DETECTION,
        options: [
          { label: '本地检测', value: 'self' },
          { label: 'ModelArk', value: 'modelark' },
        ] },
      { key: 'NSFW_ENDPOINT', label: '检测服务地址', type: 'input', placeholder: 'http://localhost:8080',
        condition: (c) => c.ENABLE_NSFW_DETECTION && c.NSFW_SERVICE === 'self' },
      { key: 'NSFW_API_KEY', label: 'API Key', type: 'sensitive',
        condition: (c) => c.ENABLE_NSFW_DETECTION && c.NSFW_SERVICE === 'modelark' },
      { key: 'NSFW_THRESHOLD', label: '检测阈值', type: 'number', min: 0, max: 1, step: 0.1,
        condition: (c) => c.ENABLE_NSFW_DETECTION },
    ]
  },
  {
    key: 'mail', label: '邮件', icon: MailOutline,
    fields: [
      { key: 'SMTP_HOST', label: 'SMTP 服务器', type: 'input', placeholder: 'smtp.gmail.com' },
      { key: 'SMTP_PORT', label: 'SMTP 端口', type: 'number', min: 1, max: 65535 },
      { key: 'SMTP_USER', label: 'SMTP 用户名', type: 'input' },
      { key: 'SMTP_PASS', label: 'SMTP 密码', type: 'sensitive' },
      { key: 'SENDER_EMAIL', label: '发件人邮箱', type: 'input', placeholder: 'noreply@example.com' },
      { key: 'SENDER_NAME', label: '发件人名称', type: 'input' },
      { key: 'SMTP_TLS', label: '启用 TLS', type: 'switch' },
      { key: 'ENABLE_MAIL_NOTIFICATION', label: '邮件通知', type: 'switch' },
      { key: 'MAIL_SUBJECT', label: '用户邮件主题', type: 'input', full: true, placeholder: '您有新回复' },
      { key: 'MAIL_TEMPLATE', label: '用户邮件模板', type: 'textarea', rows: 4, full: true, placeholder: '{nick} {content} {link}' },
      { key: 'MAIL_SUBJECT_ADMIN', label: '管理员邮件主题', type: 'input', full: true, placeholder: '站点有新评论' },
      { key: 'MAIL_TEMPLATE_ADMIN', label: '管理员邮件模板', type: 'textarea', rows: 4, full: true, placeholder: '{nick} {content} {link}' },
    ]
  },
  {
    key: 'push', label: '推送', icon: NotificationsOutline,
    fields: [
      { key: 'PUSHOO_SC_KEY', label: 'Server酱', type: 'sensitive', placeholder: 'SCT...' },
      { key: 'PUSHOO_QMSG_KEY', label: 'Qmsg酱', type: 'sensitive', placeholder: 'xxx' },
      { key: 'PUSHOO_DINGTALK_TOKEN', label: '钉钉机器人', type: 'sensitive', placeholder: 'https://oapi.dingtalk.com/...' },
      { key: 'PUSHOO_WECOMBOT_TOKEN', label: '企业微信群', type: 'sensitive', placeholder: 'https://qyapi.weixin.qq.com/...' },
      { key: 'PUSHOO_WECOM_TOKEN', label: '企业微信应用', type: 'sensitive', placeholder: 'corpId:agentId:secret' },
      { key: 'PUSHOO_FEISHU_TOKEN', label: '飞书机器人', type: 'sensitive', placeholder: 'https://open.feishu.cn/...' },
      { key: 'PUSHOO_TELEGRAM_TOKEN', label: 'Telegram', type: 'sensitive', placeholder: '123456:ABC-DEF' },
      { key: 'PUSHOO_BARK_TOKEN', label: 'Bark', type: 'sensitive', placeholder: 'https://api.day.app/xxx' },
      { key: 'PUSHOO_PUSHPLUS_TOKEN', label: 'PushPlus', type: 'sensitive', placeholder: 'xxx' },
      { key: 'PUSHOO_PUSHDEER_TOKEN', label: 'PushDeer', type: 'sensitive', placeholder: 'PDUxxx' },
      { key: 'PUSHOO_DISCORD_TOKEN', label: 'Discord', type: 'sensitive', placeholder: 'https://discord.com/api/webhooks/...' },
      { key: 'PUSHOO_WEBHOOK_TOKEN', label: 'Webhook', type: 'sensitive', placeholder: 'https://example.com/hook' },
    ]
  },
  {
    key: 'ip', label: 'IP 归属地', icon: BuildOutline,
    fields: [
      { key: 'IP_REGION_ENABLED', label: 'IP归属地', type: 'switch' },
      { key: 'SHOW_IP_REGION', label: '归属地精度', type: 'select',
        condition: (c) => c.IP_REGION_ENABLED,
        options: [{ label: '完整', value: 'all' }, { label: '仅省份', value: 'city' }] },
      { key: 'TRUSTED_PROXIES', label: '可信代理', type: 'input', full: true, placeholder: '127.0.0.1,::1',
        condition: (c) => c.IP_REGION_ENABLED },
    ]
  },
  {
    key: 'code', label: '代码高亮', icon: CodeSlashOutline,
    fields: [
      { key: 'ENABLE_CODE_HIGHLIGHT', label: '代码高亮', type: 'switch' },
      { key: 'CODE_HIGHLIGHT_THEME', label: '高亮主题', type: 'select',
        condition: (c) => c.ENABLE_CODE_HIGHLIGHT,
        options: [
          { label: 'One Dark Pro', value: 'one-dark-pro' },
          { label: 'GitHub', value: 'github' },
          { label: 'GitHub Dark', value: 'github-dark' },
          { label: 'Monokai', value: 'monokai' },
          { label: 'Dracula', value: 'dracula' },
          { label: 'Atom One Light', value: 'atom-one-light' },
          { label: 'Atom One Dark', value: 'atom-one-dark' },
          { label: 'VS2015', value: 'vs2015' },
          { label: 'Nord', value: 'nord' },
          { label: 'Solarized Light', value: 'solarized-light' },
          { label: 'Solarized Dark', value: 'solarized-dark' },
          { label: 'Tokyo Night', value: 'tokyo-night' },
          { label: 'Base16 / Atelier', value: 'base16-atelier' },
        ] },
      { key: 'CODE_SHOW_LANGUAGE', label: '语言标签', type: 'switch', condition: (c) => c.ENABLE_CODE_HIGHLIGHT },
      { key: 'CODE_SHOW_COPY', label: '复制按钮', type: 'switch', condition: (c) => c.ENABLE_CODE_HIGHLIGHT },
    ]
  },
  {
    key: 'image', label: '图片上传', icon: ImagesOutline,
    fields: [
      { key: 'ENABLE_IMAGE_UPLOAD', label: '启用图片上传', type: 'switch' },
      { key: 'IMAGE_HOSTING_PROVIDER', label: '图床服务商', type: 'select', clearable: true,
        condition: (c) => c.ENABLE_IMAGE_UPLOAD,
        options: [
          { label: 's.e.e', value: 'see' },
          { label: '兰空 Lsky Pro', value: 'lskypro' },
          { label: 'PicList', value: 'piclist' },
          { label: 'EasyImage', value: 'easyimage' },
          { label: 'Chevereto', value: 'chevereto' },
          { label: '腾讯云 COS', value: 'qcloud' },
          { label: '多吉云 OSS', value: 'dogecloud' },
          { label: 'Cloudflare R2', value: 'r2' },
          { label: 'S3 兼容', value: 's3' },
        ] },
      { key: 'IMAGE_HOSTING_TOKEN', label: 'API Token', type: 'sensitive',
        condition: (c) => c.ENABLE_IMAGE_UPLOAD && isTokenProvider(c.IMAGE_HOSTING_PROVIDER) },
      { key: 'IMAGE_HOSTING_ENDPOINT', label: 'Endpoint', type: 'input',
        placeholder: 'https://s3.example.com',
        condition: (c) => c.ENABLE_IMAGE_UPLOAD && isS3Provider(c.IMAGE_HOSTING_PROVIDER) },
      { key: 'IMAGE_HOSTING_BUCKET', label: 'Bucket', type: 'input',
        placeholder: 'my-bucket',
        condition: (c) => c.ENABLE_IMAGE_UPLOAD && isS3Provider(c.IMAGE_HOSTING_PROVIDER) },
      { key: 'IMAGE_HOSTING_REGION', label: 'Region', type: 'input',
        placeholder: 'us-east-1',
        condition: (c) => c.ENABLE_IMAGE_UPLOAD && isS3Provider(c.IMAGE_HOSTING_PROVIDER) },
      { key: 'IMAGE_HOSTING_ACCESS_KEY', label: 'Access Key', type: 'sensitive',
        condition: (c) => c.ENABLE_IMAGE_UPLOAD && isS3Provider(c.IMAGE_HOSTING_PROVIDER) },
      { key: 'IMAGE_HOSTING_SECRET_KEY', label: 'Secret Key', type: 'sensitive',
        condition: (c) => c.ENABLE_IMAGE_UPLOAD && isS3Provider(c.IMAGE_HOSTING_PROVIDER) },
      { key: 'IMAGE_HOSTING_CDN_DOMAIN', label: 'CDN域名', type: 'input', placeholder: 'cdn.example.com',
        condition: (c) => c.ENABLE_IMAGE_UPLOAD && !!c.IMAGE_HOSTING_PROVIDER },
    ]
  },
  {
    key: 'advanced', label: '高级', icon: BuildOutline,
    fields: [
      { key: 'CORS_ORIGINS', label: 'CORS 域名', type: 'input', placeholder: 'https://example.com,https://blog.com' },
      { key: 'CUSTOM_CSS', label: '自定义 CSS', type: 'textarea', rows: 4, full: true, placeholder: '.tk-comment { ... }' },
      { key: 'ENABLE_VISITOR_COUNTER', label: '访客计数器', type: 'switch' },
    ]
  },
]
