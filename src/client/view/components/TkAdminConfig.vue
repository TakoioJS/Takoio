<template>
  <div class="tk-admin-config">
    <!-- 搜索 -->
    <el-input
      v-model="configSearch"
      :placeholder="t('searchConfig')"
      clearable
      class="tk-config-search"
      :prefix-icon="Search"
    />

    <div class="tk-admin-config-header">
      <!-- 内部 Tab 栏 -->
      <el-tabs v-model="activeTab" v-loading="loading" class="tk-capsule-tabs">
        <!-- ======== 基本 ======== -->
        <el-tab-pane :label="t('basic')" name="basic">
          <!-- 信息 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('siteInfo') }">
            <div class="tk-card-header" @click="toggle('siteInfo')">
              <span>信息</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('siteInfo') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('siteInfo')" class="tk-card-body">
              <el-form-item :label="t('siteName')"><el-input v-model="config.SITE_NAME" /></el-form-item>
              <el-form-item :label="t('siteUrl')"><el-input v-model="config.SITE_URL" /></el-form-item>
              <el-form-item :label="t('masterName')"><el-input v-model="config.MASTER_NAME" /></el-form-item>
              <el-form-item :label="t('masterMail')"><el-input v-model="config.MASTER" /></el-form-item>
              <el-form-item :label="t('requiredFields')">
                <el-checkbox-group v-model="requiredFieldsList">
                  <el-checkbox value="nick">{{ t('nickname') }}</el-checkbox>
                  <el-checkbox value="mail">{{ t('email') }}</el-checkbox>
                  <el-checkbox v-if="config.ENABLE_LINK_INPUT" value="link">{{ t('link') }}</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </div>
          </div>

          <!-- 头像 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('avatarInfo') }">
            <div class="tk-card-header" @click="toggle('avatarInfo')">
              <span>头像</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('avatarInfo') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('avatarInfo')" class="tk-card-body">
              <el-form-item :label="t('gravatarUrl')">
                <div class="tk-mirror-row">
                  <el-select v-model="gravatarMirror" :placeholder="t('gravatarUrl')" style="width:100%" @change="onMirrorChange">
                    <el-option value="weavatar" label="WeAvatar (weavatar.com)" />
                    <el-option value="cravatar" label="Cravatar (cn.cravatar.com)" />
                    <el-option value="gravatar" label="Gravatar (cn.gravatar.com)" />
                    <el-option value="geekzu" label="极族 (sdn.geekzu.org)" />
                    <el-option value="loli" label="Loli (gravatar.loli.net)" />
                    <el-option value="custom" :label="t('custom')" />
                  </el-select>
                  <el-input v-if="gravatarMirror === 'custom'" v-model="config.GRAVATAR_URL" placeholder="https://your-mirror.com/avatar/" />
                </div>
              </el-form-item>
              <el-form-item :label="t('gravatarDefault')">
                <el-select v-model="config.GRAVATAR_DEFAULT">
                  <el-option value="mp" :label="t('avatarMp')" />
                  <el-option value="identicon" :label="t('avatarIdenticon')" />
                  <el-option value="monsterid" :label="t('avatarMonsterid')" />
                  <el-option value="wavatar" :label="t('avatarWavatar')" />
                  <el-option value="retro" :label="t('avatarRetro')" />
                  <el-option value="robohash" :label="t('avatarRobohash')" />
                </el-select>
              </el-form-item>
            </div>
          </div>

          <!-- 显示 -->

          <!-- 排版 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('layoutDisplay') }">
            <div class="tk-card-header" @click="toggle('layoutDisplay')">
              <span>排版</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('layoutDisplay') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('layoutDisplay')" class="tk-card-body">
              <el-form-item :label="t('commentSort')">
                <el-select v-model="config.COMMENT_SORT">
                  <el-option value="newest" :label="t('sortNewest')" />
                  <el-option value="oldest" :label="t('sortOldest')" />
                  <el-option value="hottest" :label="t('sortHottest')" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('commentPaginationMode')">
                <el-select v-model="config.COMMENT_PAGINATION_MODE">
                  <el-option value="pagination" :label="t('pagination')" />
                  <el-option value="infinite" :label="t('infinite')" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('pageSize')">
                <el-input-number v-model="config.PAGE_SIZE" :min="1" :max="100" />
              </el-form-item>
            </div>
          </div>

          <!-- 配色 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('colorCustomization') }">
            <div class="tk-card-header" @click="toggle('colorCustomization')">
              <span>配色</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('colorCustomization') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('colorCustomization')" class="tk-card-body">
              <el-form-item :label="t('globalColor')">
                <div class="tk-color-row">
                  <el-input v-model="config.GLOBAL_COLOR" placeholder="#10b981" />
                  <el-color-picker v-model="globalColor" />
                </div>
              </el-form-item>
              <el-form-item label="博主标识配色">
                <div class="tk-color-row">
                  <el-input v-model="config.MASTER_LABEL_COLOR" placeholder="#e6a23c" />
                  <el-color-picker v-model="masterLabelColor" />
                </div>
              </el-form-item>
            </div>
          </div>

          <!-- 自定义 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('customize') }">
            <div class="tk-card-header" @click="toggle('customize')">
              <span>自定义</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('customize') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('customize')" class="tk-card-body">
              <el-form-item :label="t('masterLabel')"><el-input v-model="config.MASTER_LABEL" :placeholder="t('master')" /></el-form-item>
              <el-form-item :label="t('commentBgImage')"><el-input v-model="config.COMMENT_BG_IMAGE" /></el-form-item>

              <el-form-item :label="t('customCSS')"><el-input v-model="config.CUSTOM_CSS" type="textarea" :rows="6" /></el-form-item>
            </div>
          </div>
        </el-tab-pane>

        <!-- ======== 功能 ======== -->
        <el-tab-pane :label="t('features')" name="features">


          <!-- 代码高亮 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('codeHighlight') }">
            <div class="tk-card-header" @click="toggle('codeHighlight')">
              <span>{{ t('enableCodeHighlight') }}</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('codeHighlight') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('codeHighlight')" class="tk-card-body">
              <el-form-item class="tk-switch-item" label="功能开关"><el-switch v-model="config.ENABLE_CODE_HIGHLIGHT" /></el-form-item>
              <el-form-item :label="t('codeHighlightTheme')">
                <el-select v-model="config.CODE_HIGHLIGHT_THEME" placeholder="one-dark-pro">
                  <el-option value="one-dark-pro" label="One Dark Pro" /><el-option value="one-light" label="One Light" />
                  <el-option value="github-dark" label="GitHub Dark" /><el-option value="github-light" label="GitHub Light" />
                  <el-option value="dracula" label="Dracula" /><el-option value="monokai" label="Monokai" />
                  <el-option value="nord" label="Nord" /><el-option value="min-dark" label="Min Dark" />
                  <el-option value="min-light" label="Min Light" /><el-option value="catppuccin-mocha" label="Catppuccin Mocha" />
                  <el-option value="catppuccin-latte" label="Catppuccin Latte" /><el-option value="vitesse-dark" label="Vitesse Dark" />
                  <el-option value="vitesse-light" label="Vitesse Light" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('features')">
                <el-checkbox-group v-model="codeOptions">
                  <el-checkbox value="language">{{ t('codeShowLanguage') }}</el-checkbox>
                  <el-checkbox value="copy">{{ t('codeShowCopy') }}</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </div>
          </div>

          <!-- 图片上传 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('imageUpload') }">
            <div class="tk-card-header" @click="toggle('imageUpload')">
              <span>{{ t('enableImageUpload') }}</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('imageUpload') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('imageUpload')" class="tk-card-body">
              <el-form-item class="tk-switch-item" label="功能开关"><el-switch v-model="config.ENABLE_IMAGE_UPLOAD" /></el-form-item>
              <el-form-item :label="t('imageHostingProvider')">
                <el-select v-model="config.IMAGE_HOSTING_PROVIDER" :placeholder="t('imageHostingProviderHint')">
                  <el-option value="" :label="t('imageHostingNone')" /><el-option value="qcloud" label="腾讯云 COS" />
                  <el-option value="dogecloud" label="多吉云 OSS" />
                  <el-option value="r2" label="Cloudflare R2" />
                  <el-option value="see" label="see (https://s.ee)" />
                  <el-option value="lskypro" label="兰空 Lsky Pro" /><el-option value="piclist" label="PicList" />
                  <el-option value="easyimage" label="EasyImage" /><el-option value="chevereto" label="Chevereto" />
                  <el-option value="s3" label="通用 AWS S3" />
                </el-select>
              </el-form-item>
              <template v-if="config.IMAGE_HOSTING_PROVIDER">
                <el-form-item :label="t('imageHostingEndpoint')">
                  <el-input v-model="config.IMAGE_HOSTING_ENDPOINT" :placeholder="getHostingEndpointPlaceholder()" />
                  <span class="tk-form-hint">{{ getHostingEndpointHint() }}</span>
                </el-form-item>
                <el-form-item v-if="isTokenProvider" :label="t('imageHostingToken')">
                  <tk-sensitive-input v-model="config.IMAGE_HOSTING_TOKEN" :masked="maskedFields.IMAGE_HOSTING_TOKEN" :placeholder="getHostingTokenPlaceholder()" @clear-mask="clearMask('IMAGE_HOSTING_TOKEN')" />
                </el-form-item>
                <template v-if="isS3Provider">
                  <el-form-item :label="t('imageHostingBucket')"><el-input v-model="config.IMAGE_HOSTING_BUCKET" placeholder="my-bucket" /></el-form-item>
                  <el-form-item :label="t('imageHostingRegion')"><el-input v-model="config.IMAGE_HOSTING_REGION" :placeholder="getHostingRegionPlaceholder()" /></el-form-item>
                  <el-form-item :label="t('imageHostingAccessKey')">
                    <tk-sensitive-input v-model="config.IMAGE_HOSTING_ACCESS_KEY" :masked="maskedFields.IMAGE_HOSTING_ACCESS_KEY" placeholder="AccessKeyId" @clear-mask="clearMask('IMAGE_HOSTING_ACCESS_KEY')" />
                  </el-form-item>
                  <el-form-item :label="t('imageHostingSecretKey')">
                    <tk-sensitive-input v-model="config.IMAGE_HOSTING_SECRET_KEY" :masked="maskedFields.IMAGE_HOSTING_SECRET_KEY" placeholder="SecretAccessKey" @clear-mask="clearMask('IMAGE_HOSTING_SECRET_KEY')" />
                  </el-form-item>
                </template>
                <el-form-item :label="t('imageHostingCdnDomain')">
                  <el-input v-model="config.IMAGE_HOSTING_CDN_DOMAIN" placeholder="https://cdn.example.com" />
                  <span class="tk-form-hint">{{ t('imageHostingCdnDomainHint') }}</span>
                </el-form-item>
              </template>
            </div>
          </div>

          <!-- 投票反应 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('voting') }">
            <div class="tk-card-header" @click="toggle('voting')">
              <span>投票反应</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('voting') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('voting')" class="tk-card-body">
              <el-form-item class="tk-switch-item" label="文章反应控制开关"><el-switch v-model="config.ENABLE_ARTICLE_REACTION" /></el-form-item>
              <el-form-item class="tk-switch-item" label="评论内容点赞"><el-switch v-model="config.ENABLE_LIKE" /></el-form-item>
              <el-form-item class="tk-switch-item" label="评论内容反对"><el-switch v-model="config.ENABLE_DISLIKE" /></el-form-item>
            </div>
          </div>

          <!-- NSFW 检测 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('nsfw') }">
            <div class="tk-card-header" @click="toggle('nsfw')">
              <span>{{ t('enableNsfw') }}</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('nsfw') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('nsfw')" class="tk-card-body">
              <el-form-item class="tk-switch-item" label="功能开关"><el-switch v-model="config.ENABLE_NSFW_DETECTION" /></el-form-item>
              <el-form-item :label="t('nsfwService')">
                <el-select v-model="config.NSFW_SERVICE">
                  <el-option value="self" :label="t('nsfwSelfHosted')" />
                  <el-option value="modelark" label="模力方舟 (ai.gitee.com)" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="config.NSFW_SERVICE === 'self'" :label="t('nsfwEndpoint')">
                <el-input v-model="config.NSFW_ENDPOINT" placeholder="http://127.0.0.1:5000" /><span class="tk-form-hint">github.com/HG-ha/nsfwpy</span>
              </el-form-item>
              <el-form-item v-if="config.NSFW_SERVICE === 'modelark'" :label="t('nsfwApiKey')">
                <tk-sensitive-input v-model="config.NSFW_API_KEY" :masked="maskedFields.NSFW_API_KEY" placeholder="输入模力方舟 API Key" @clear-mask="clearMask('NSFW_API_KEY')" /><span class="tk-form-hint">ai.gitee.com/docs/openapi/v1</span>
              </el-form-item>
              <el-form-item :label="t('nsfwThreshold')">
                <el-slider v-model="config.NSFW_THRESHOLD" :min="0" :max="1" :step="0.05" show-input /><span class="tk-form-hint">{{ t('nsfwThresholdHint') }}</span>
              </el-form-item>
            </div>
          </div>
        </el-tab-pane>

        <!-- ======== 安全 ======== -->
        <el-tab-pane :label="t('security')" name="security">


          <!-- CAPTCHA -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('captcha') }">
            <div class="tk-card-header" @click="toggle('captcha')">
              <span>{{ t('enableCaptcha') }}</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('captcha') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('captcha')" class="tk-card-body">
              <el-form-item class="tk-switch-item" label="功能开关"><el-switch v-model="config.ENABLE_CAPTCHA" /></el-form-item>
              <el-form-item :label="t('captchaProvider')">
                <el-select v-model="config.CAPTCHA_PROVIDER" :placeholder="t('captchaProviderHint')">
                  <el-option value="turnstile" label="Cloudflare Turnstile" /><el-option value="recaptcha" label="Google reCAPTCHA" />
                  <el-option value="hcaptcha" label="hCaptcha" /><el-option value="geetest" label="极验 (Geetest)" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="config.CAPTCHA_PROVIDER === 'recaptcha'" :label="t('captchaType')">
                <el-select v-model="config.CAPTCHA_TYPE">
                  <el-option value="checkbox" label="reCAPTCHA v2 复选框" /><el-option value="invisible" label="reCAPTCHA v2 无感" />
                  <el-option value="v3" label="reCAPTCHA v3 评分" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('captchaSiteKey')"><el-input v-model="config.CAPTCHA_SITE_KEY" :placeholder="t('captchaSiteKeyHint')" /></el-form-item>
              <el-form-item :label="t('captchaSecretKey')">
                <tk-sensitive-input v-model="config.CAPTCHA_SECRET_KEY" :masked="maskedFields.CAPTCHA_SECRET_KEY" :placeholder="t('captchaSecretKeyHint')" @clear-mask="clearMask('CAPTCHA_SECRET_KEY')" />
              </el-form-item>
            </div>
          </div>

          <!-- 管理员入口 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('adminKeyword') }">
            <div class="tk-card-header" @click="toggle('adminKeyword')">
              <span>{{ t('adminKeywordEntry') }}</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('adminKeyword') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('adminKeyword')" class="tk-card-body">
              <el-form-item class="tk-switch-item" label="功能开关"><el-switch v-model="config.ENABLE_ADMIN_KEYWORD" /></el-form-item>
              <el-form-item :label="t('adminKeyword')">
                <el-input v-model="config.ADMIN_KEYWORD" :placeholder="'#admin'" /><span class="tk-form-hint">{{ t('adminKeywordDesc') }}</span>
              </el-form-item>
            </div>
          </div>

          <!-- 数据安全 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('dataSecurity') }">
            <div class="tk-card-header" @click="toggle('dataSecurity')">
              <span>数据安全</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('dataSecurity') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('dataSecurity')" class="tk-card-body">
              <el-form-item :label="t('corsOrigins')">
                <el-input v-model="config.CORS_ORIGINS" :placeholder="t('corsOriginsHint')" />
              </el-form-item>
              <el-form-item class="tk-switch-item" label="表单显示网址输入框"><el-switch v-model="config.ENABLE_LINK_INPUT" /></el-form-item>
              <el-form-item class="tk-switch-item" label="显示评论者系统 UA"><el-switch v-model="config.SHOW_UA_INFO" /></el-form-item>
              <el-form-item class="tk-switch-item" label="显示评论者 IP 归属地"><el-switch v-model="config.IP_REGION_ENABLED" /></el-form-item>
              <el-form-item label="代理标头">
                <el-select v-model="config.IP_PROXY_HEADER" placeholder="留空自动获取" filterable allow-create>
                  <el-option value="" label="自动获取 (默认)" />
                  <el-option value="x-forwarded-for" label="X-Forwarded-For" />
                  <el-option value="x-real-ip" label="X-Real-IP" />
                  <el-option value="cf-connecting-ip" label="CF-Connecting-IP" />
                  <el-option value="true-client-ip" label="True-Client-IP" />
                </el-select>
              </el-form-item>
              <el-form-item label="IP 归属地显示格式">
                <el-select v-model="config.SHOW_IP_REGION" placeholder="显示全部">
                  <el-option value="all" label="显示全部" />
                  <el-option value="city" label="只显示城市" />
                </el-select>
              </el-form-item>
            </div>
          </div>

          <!-- 评论审核 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('commentModeration') }">
            <div class="tk-card-header" @click="toggle('commentModeration')">
              <span>评论审核</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('commentModeration') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('commentModeration')" class="tk-card-body">
              <el-form-item :label="t('commentLengthMax')">
                <div class="tk-input-group">
                  <el-input-number v-model="config.COMMENT_LENGTH_MAX" :min="1" :max="10000" />
                  <span class="tk-form-hint">{{ t('characters') }}</span>
                </div>
              </el-form-item>
              <el-form-item :label="t('commentRateLimit')">
                <div class="tk-input-group">
                  <el-input-number v-model="config.COMMENT_RATE_LIMIT" :min="0" :max="99999" />
                  <span class="tk-form-hint">ms</span>
                </div>
              </el-form-item>
              <el-form-item class="tk-switch-item" label="人工审核"><el-switch v-model="config.AUDIT_MODE" /></el-form-item>

              <el-form-item label="自动审核">
                <el-select v-model="activeModerationView" @change="onModerationModeChange">
                  <el-option value="none" label="关闭自动审核" />
                  <el-option value="akismet" label="Akismet 反垃圾" />
                  <el-option value="ai" label="AI LLM 审核" />
                  <el-option value="traditional" label="词过滤" />
                </el-select>
              </el-form-item>

              <div v-show="activeModerationView === 'traditional'">
                <el-form-item :label="t('blockedKeywords')">
                  <el-input v-model="config.BLOCKED_KEYWORDS" type="textarea" :rows="3" :placeholder="t('blockedKeywordsHint')" />
                  <span class="tk-form-hint">{{ t('blockedKeywordsDesc') }}</span>
                </el-form-item>
              </div>

              <div v-show="activeModerationView === 'akismet'">
                <el-form-item :label="t('akismetKey')">
                  <tk-sensitive-input v-model="config.AKISMET_KEY" :masked="maskedFields.AKISMET_KEY" @clear-mask="clearMask('AKISMET_KEY')" />
                </el-form-item>
              </div>

              <div v-show="activeModerationView === 'ai'">
                <el-form-item label="AI 提供商">
                  <el-select v-model="config.AUTO_AUDIT_AI_PROVIDER" placeholder="请选择提供商">
                    <el-option v-for="p in aiProviders" :key="p.id" :value="p.id" :label="p.name || '未命名提供商'" />
                  </el-select>
                </el-form-item>
                <el-form-item label="AI 模型" v-if="config.AUTO_AUDIT_AI_PROVIDER">
                  <el-select v-model="config.AUTO_AUDIT_AI_MODEL" placeholder="请选择模型" filterable allow-create>
                    <el-option v-for="m in getAiProviderModels(config.AUTO_AUDIT_AI_PROVIDER)" :key="m" :value="m" :label="m" />
                  </el-select>
                </el-form-item>
                <el-form-item label="自定义 Prompt">
                  <el-input v-model="config.AUTO_AUDIT_AI_PROMPT" type="textarea" :rows="3" placeholder="可选，留空使用默认提示词" />
                </el-form-item>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- ======== AI ======== -->
        <el-tab-pane label="AI" name="ai">
          <div class="tk-card">
            <div class="tk-card-header" style="padding-bottom: 12px;">
              <span>AI 提供商管理</span>
              <el-button size="small" type="primary" @click="addAiProvider">添加提供商</el-button>
            </div>
            <div class="tk-card-body" style="padding: 0 0 12px 0;">
              <template v-if="aiProviders.length > 0">
                <div v-for="(p, idx) in aiProviders" :key="p.id" class="tk-ai-provider-card">
                  <div class="tk-ai-provider-header">
                    <div class="tk-ai-provider-title">
                      <el-input v-model="p.name" placeholder="例如：我的 DeepSeek" size="small" class="tk-ai-name-input" />
                      <el-tag size="small" :type="p.format === 'openai' ? 'success' : (p.format === 'gemini' ? 'warning' : 'primary')" class="tk-ai-format-tag" style="margin-left: 8px;">
                        {{ p.format === 'openai' ? 'OpenAI' : (p.format === 'gemini' ? 'Gemini' : 'Anthropic') }}
                      </el-tag>
                    </div>
                    <el-button type="danger" plain :icon="Delete" circle size="small" @click="removeAiProvider(idx)" />
                  </div>
                  <div class="tk-ai-provider-body">
                    <div class="tk-ai-provider-row" style="display: flex; gap: 16px; margin-bottom: 12px;">
                      <el-form-item label="接口协议" class="tk-ai-format-item" style="flex: 0 0 140px; margin-bottom: 0;">
                        <el-select v-model="p.format" size="small" style="width: 100%">
                          <el-option value="openai" label="OpenAI 兼容" />
                          <el-option value="anthropic" label="Anthropic 兼容" />
                          <el-option value="gemini" label="Gemini 兼容" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="请求地址 (Endpoint)" class="tk-ai-endpoint-item" style="flex: 1; margin-bottom: 0;">
                        <el-input v-model="p.endpoint" placeholder="例如: https://api.openai.com/v1" size="small" clearable />
                      </el-form-item>
                    </div>
                    
                    <el-form-item label="密钥 (API Key)" style="margin-bottom: 12px;">
                      <el-input v-model="p.key" type="password" show-password placeholder="sk-..." size="small" clearable />
                    </el-form-item>

                    <el-form-item label="支持的模型" style="margin-bottom: 0;">
                      <div style="display: flex; gap: 8px; width: 100%;">
                        <el-select v-model="p.models" multiple filterable allow-create default-first-option placeholder="输入模型名并回车" size="small" style="flex: 1;">
                          <el-option v-for="m in p.models" :key="m" :value="m" :label="m" />
                        </el-select>
                        <el-button size="small" type="primary" plain :loading="fetchingModels[p.id]" @click="onFetchModels(p)">自动获取</el-button>
                      </div>
                    </el-form-item>
                  </div>
                </div>
              </template>
              <template v-else>
                <div style="text-align: center; color: var(--tk-admin-text-secondary); padding: 40px 0; background: color-mix(in srgb, var(--tk-admin-border) 10%, transparent); border-radius: 8px; margin-top: 8px;">
                  <div style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;">🤖</div>
                  <div style="font-size: 13px;">暂无 AI 提供商，请点击右上角添加</div>
                </div>
              </template>
            </div>
          </div>


        </el-tab-pane>

        <!-- ======== 通知 ======== -->
        <el-tab-pane :label="t('notification')" name="notification">
          <!-- 邮件通知 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('mailNotify') }">
            <div class="tk-card-header" @click="toggle('mailNotify')">
              <span>邮件通知</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('mailNotify') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('mailNotify')" class="tk-card-body">
              <el-form-item :label="t('smtpHost')"><el-input v-model="config.SMTP_HOST" /></el-form-item>
              <el-form-item :label="t('smtpPort')"><el-input-number v-model="config.SMTP_PORT" :min="1" :max="65535" /></el-form-item>
              <el-form-item class="tk-switch-item" label="SSL/TLS"><el-switch v-model="config.SMTP_TLS" /></el-form-item>
              <el-form-item :label="t('smtpUser')"><el-input v-model="config.SMTP_USER" /></el-form-item>
              <el-form-item :label="t('smtpPass')">
                <tk-sensitive-input v-model="config.SMTP_PASS" :masked="maskedFields.SMTP_PASS" @clear-mask="clearMask('SMTP_PASS')" />
              </el-form-item>
              <el-form-item :label="t('senderMail')"><el-input v-model="config.SENDER_EMAIL" /></el-form-item>
              <el-form-item :label="t('senderName')"><el-input v-model="config.SENDER_NAME" /></el-form-item>
              <el-form-item :label="t('mailSubject')"><el-input v-model="config.MAIL_SUBJECT" /></el-form-item>
              <el-form-item :label="t('mailTemplate')"><el-input v-model="config.MAIL_TEMPLATE" type="textarea" :rows="8" /></el-form-item>
              <el-form-item :label="t('mailSubjectAdmin')"><el-input v-model="config.MAIL_SUBJECT_ADMIN" /></el-form-item>
              <el-form-item :label="t('mailTemplateAdmin')"><el-input v-model="config.MAIL_TEMPLATE_ADMIN" type="textarea" :rows="8" /></el-form-item>
            </div>
          </div>

          <!-- Push 通知 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('pushNotify') }">
            <div class="tk-card-header" @click="toggle('pushNotify')">
              <span>{{ t('pushNotify') }}</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('pushNotify') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('pushNotify')" class="tk-card-body">
              <template v-if="enabledChannels.length > 0">
                <div class="tk-channel-group-label">{{ t('configuredChannels') || '已配置' }}</div>
                <div v-for="(ch, idx) in enabledChannels" :key="ch.platform" class="tk-channel-item">
                  <div class="tk-channel-info">
                    <span class="tk-channel-name">{{ ch.label }}</span>
                  </div>
                  <tk-sensitive-input v-model="config[ch.key]" :masked="maskedFields[ch.key]" :placeholder="ch.hint" @clear-mask="clearMask(ch.key)" />
                  <el-button :icon="Delete" circle size="small" @click="removeChannel(idx)" />
                </div>
              </template>
              <div class="tk-channel-group-label" style="margin-top: 16px;">{{ t('addChannel') }}</div>
              <el-select v-model="addingChannel" :placeholder="t('addChannelHint')" filterable @change="addChannel">
                <el-option v-for="ch in availableChannels" :key="ch.platform" :value="ch.platform" :label="ch.label">
                  <div class="tk-channel-opt"><span>{{ ch.label }}</span><el-tag size="small" type="info">{{ ch.platform }}</el-tag></div>
                </el-option>
              </el-select>
            </div>
          </div>

          <!-- 测试设置 -->
          <div class="tk-card" :class="{ collapsed: isCollapsed('testNotify') }">
            <div class="tk-card-header" @click="toggle('testNotify')">
              <span>测试设置</span>
              <span class="tk-card-arrow" :class="{ open: !isCollapsed('testNotify') }">&#9656;</span>
            </div>
            <div v-show="!isCollapsed('testNotify')" class="tk-card-body">
              <el-form-item label="测试邮箱地址"><el-input v-model="testEmailAddress" placeholder="留空发送至发件人邮箱" /></el-form-item>
              <el-form-item label="测试模板">
                <el-select v-model="testEmailTemplate">
                  <el-option value="user" label="用户回复通知" />
                  <el-option value="admin" label="管理员新评论通知" />
                </el-select>
              </el-form-item>
              <el-form-item><el-button @click="onTestEmail" :loading="testing">{{ t('sendTestEmail') }}</el-button></el-form-item>
              <div v-if="testEmailLog" class="tk-test-log" style="white-space: pre-wrap; font-family: monospace; background: var(--tk-admin-bg-secondary, #f5f5f5); padding: 10px; border-radius: 4px; color: var(--tk-admin-text, #333); margin-top: 10px; font-size: 12px; max-height: 200px; overflow-y: auto;">{{ testEmailLog }}</div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 底部操作栏 -->
    <div class="tk-actions">
      <span v-if="isDirty" class="tk-dirty-hint">{{ t('unsavedChanges') || '有未保存的更改' }}</span>
      <el-button @click="onReset" :icon="RefreshLeft">{{ t('reset') }}</el-button>
      <el-button type="primary" @click="onSave" :loading="saving" :icon="Check">{{ t('save') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, defineComponent, h } from 'vue'
import {
  ElForm, ElFormItem, ElInput, ElInputNumber,
  ElSelect, ElOption, ElSwitch, ElButton, ElTag,
  ElCheckbox, ElCheckboxGroup, ElTabs, ElTabPane,
  ElSlider, ElColorPicker, ElMessage, ElMessageBox
} from 'element-plus'
import { Search, Check, RefreshLeft, Delete } from '@element-plus/icons-vue'
import { t, adminRequest } from '../../utils'
import type { TakoioConfig } from '../../types'

// ========== 敏感字段内联组件 ==========
const TkSensitiveInput = defineComponent({
  name: 'TkSensitiveInput',
  props: {
    modelValue: { type: String, default: '' },
    masked: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'clear-mask'],
  setup(props, { emit }) {
    const editing = ref(false)

    const onFocus = () => {
      if (props.masked) {
        emit('clear-mask')
        editing.value = true
      }
    }

    return () => {
      if (props.masked && !editing.value) {
        return h('div', { class: 'tk-sensitive-set' }, [
          h(ElTag, { type: 'success', size: 'small', effect: 'plain' }, () => '✓ ' + (t('configured') || '已设置')),
          h(ElInput, {
            modelValue: '',
            placeholder: t('enterToReplace') || '输入新值以替换',
            showPassword: true,
            'onUpdate:modelValue': (v: string) => emit('update:modelValue', v),
            onFocus,
          }),
        ])
      }
      return h(ElInput, {
        modelValue: props.modelValue,
        'onUpdate:modelValue': (v: string) => emit('update:modelValue', v),
        showPassword: true,
        placeholder: props.placeholder,
      })
    }
  }
})

const masterLabelColor = computed({
  get: () => config.MASTER_LABEL_COLOR || '#e6a23c',
  set: (val) => { config.MASTER_LABEL_COLOR = (!val || val === '#e6a23c') ? '' : val }
})

const globalColor = computed({
  get: () => config.GLOBAL_COLOR || '#10b981',
  set: (val) => { config.GLOBAL_COLOR = (!val || val === '#10b981') ? '' : val }
})

// ========== 折叠卡片 ==========
const collapsedCards = reactive(new Set<string>([
  'siteInfo', 'avatarInfo', 'layoutDisplay', 'colorCustomization', 'customize', 'interaction',
  'codeHighlight', 'imageUpload', 'voting', 'nsfw',
  'antiSpam', 'captcha', 'aiModeration', 'adminKeyword', 'dataSecurity', 'commentModeration',
  'mailNotify', 'pushNotify', 'testNotify',
]))
const isCollapsed = (name: string): boolean => collapsedCards.has(name)
const toggle = (name: string): void => {
  if (collapsedCards.has(name)) collapsedCards.delete(name)
  else collapsedCards.add(name)
}

// ========== 搜索 ==========
const configSearch = ref('')
const activeTab = ref('basic')
const activeModerationView = ref('none')

const onModerationModeChange = (val: string) => {
  config.AUTO_AUDIT_METHOD = val
}

const SECTION_LABELS: Record<string, string[]> = {
  basic: ['siteName','siteUrl','masterName','masterMail','commentSort','pageSize','enableLinkInput','commentPaginationMode','gravatarUrl','gravatarDefault','masterLabel','commentBgImage','enableEmotion','enableVisitorCounter','customCSS','globalColor'],
  features: ['auditMode','commentLengthMax','commentRateLimit','blockedKeywords','aiModerationEnabled','aiFormat','aiProvider','aiModerationEndpoint','aiModerationKey','aiModerationModel','enableCodeHighlight','codeHighlightTheme','codeShowLanguage','codeShowCopy','enableImageUpload','imageHostingProvider','imageHostingEndpoint','imageHostingToken','enableLike','enableDislike','enableNsfw','nsfwService','nsfwEndpoint','nsfwApiKey','nsfwThreshold'],
  security: ['enableAntiSpam','akismetKey','enableCaptcha','captchaProvider','captchaSiteKey','captchaSecretKey','adminKeyword','ipRegionEnabled','corsOrigins'],
  notification: ['mailNotifyEnabled','smtpHost','smtpPort','smtpUser','smtpPass','senderMail','senderName','mailSubject','mailTemplate','addChannel']
}

// 搜索时自动跳转到匹配的 Tab
watch(configSearch, (q) => {
  if (!q) return
  const query = q.toLowerCase()
  for (const [tab, keys] of Object.entries(SECTION_LABELS)) {
    const titleMatch = t(tab as any).toLowerCase().includes(query)
    const keyMatch = keys.some(k => {
      const tk = t(k as any)
      return typeof tk === 'string' && tk.toLowerCase().includes(query)
    })
    if (titleMatch || keyMatch) {
      activeTab.value = tab
      return
    }
  }
})

// ========== 图床 ==========
const TOKEN_PROVIDERS = new Set(['see', 'lskypro', 'piclist', 'easyimage', 'chevereto'])
const S3_PROVIDERS = new Set(['qcloud', 'dogecloud', 'r2', 's3'])

const HOSTING_PRESETS: Record<string, { endpoint: string; region: string; desc: string }> = {
  see: { endpoint: 'https://s.ee/api/v1/file/upload', region: '', desc: 'https://s.ee — 图床，Bearer token 认证' },
  lskypro: { endpoint: 'http://127.0.0.1:8000', region: '', desc: '兰空 Lsky Pro — 自部署，Bearer token，上传路径 /api/v1/upload' },
  piclist: { endpoint: 'http://127.0.0.1:36677', region: '', desc: 'PicList — API 地址 /upload，认证传递 key 参数' },
  easyimage: { endpoint: 'http://127.0.0.1', region: '', desc: 'EasyImage — 自部署简单图床，上传路径 /api/index.php，token 表单认证' },
  chevereto: { endpoint: '', region: '', desc: 'Chevereto — 专业图床，上传路径 /api/1/upload，X-API-Key 认证' },
  qcloud: { endpoint: '', region: 'ap-guangzhou', desc: '腾讯云 COS — Endpoint 填存储桶自定义域名或默认域名' },
  dogecloud: { endpoint: '', region: 'oss-cn-hangzhou', desc: '多吉云 OSS — S3 兼容，Endpoint 填存储桶地域节点' },
  r2: { endpoint: '', region: 'auto', desc: 'Cloudflare R2 — S3 兼容，Endpoint 填存储桶 S3 API 地址' },
  s3: { endpoint: '', region: 'us-east-1', desc: 'S3 兼容 — R2 / MinIO 等，Endpoint 填服务地址' }
}

interface Props {
  options: TakoioConfig
  token?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'expired'): void; (e: 'change-password'): void }>()

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const addingChannel = ref('')
const gravatarMirror = ref('weavatar')

const MIRRORS: Record<string, string> = {
  weavatar: 'https://weavatar.com/avatar/',
  cravatar: 'https://cn.cravatar.com/avatar/',
  gravatar: 'https://cn.gravatar.com/avatar/',
  geekzu: 'https://sdn.geekzu.org/avatar/',
  loli: 'https://gravatar.loli.net/avatar/'
}

const onMirrorChange = (key: string): void => {
  if (MIRRORS[key]) config.GRAVATAR_URL = MIRRORS[key]
  else config.GRAVATAR_URL = ''
}

const getHostingEndpointPlaceholder = (): string => {
  const preset = HOSTING_PRESETS[config.IMAGE_HOSTING_PROVIDER]
  return preset?.endpoint || (isS3Provider.value ? 'https://s3.amazonaws.com' : 'https://your-host.com/api')
}

const getHostingEndpointHint = (): string => {
  const preset = HOSTING_PRESETS[config.IMAGE_HOSTING_PROVIDER]
  return preset?.desc || ''
}

const getHostingTokenPlaceholder = (): string => {
  if (config.IMAGE_HOSTING_PROVIDER === 'piclist') return '设置中的 Server Key'
  if (config.IMAGE_HOSTING_PROVIDER === 'chevereto') return 'API v1 key'
  return 'API Token / Key'
}

const getHostingRegionPlaceholder = (): string => {
  if (config.IMAGE_HOSTING_PROVIDER === 'qcloud') return 'ap-guangzhou / ap-shanghai / ...'
  if (config.IMAGE_HOSTING_PROVIDER === 'dogecloud') return 'oss-cn-hangzhou / oss-cn-beijing / ...'
  if (config.IMAGE_HOSTING_PROVIDER === 'r2') return 'auto'
  if (config.IMAGE_HOSTING_PROVIDER === 's3') return 'us-east-1 / auto'
  return 'region'
}

const fetchingModels = ref<Record<string, boolean>>({})
const aiProviders = ref<any[]>([])

const getAiProviderModels = (providerId: string) => {
  const p = aiProviders.value.find((p) => p.id === providerId)
  return p ? p.models : []
}

const addAiProvider = () => {
  aiProviders.value.push({ id: Date.now().toString(), name: '', format: 'openai', endpoint: '', key: '', models: [] })
}

const removeAiProvider = (idx: number) => {
  aiProviders.value.splice(idx, 1)
}

const onFetchModels = async (p: any) => {
  fetchingModels.value[p.id] = true
  try {
    let modelsUrl = p.endpoint
    if (modelsUrl.endsWith('/chat/completions')) modelsUrl = modelsUrl.replace('/chat/completions', '/models')
    else if (!modelsUrl.endsWith('/models')) modelsUrl = modelsUrl.replace(/\/$/, '') + '/models'

    const format = p.format
    const key = p.key
    let res
    if (format === 'gemini') {
      res = await fetch(`${modelsUrl}?key=${encodeURIComponent(key)}`)
    } else if (format === 'anthropic') {
      res = await fetch(modelsUrl, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } })
    } else {
      res = await fetch(modelsUrl, { headers: { Authorization: `Bearer ${key}` } })
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (format === 'gemini' && json.models) {
      p.models = json.models.map((m: any) => m.name?.replace('models/', '')).filter(Boolean).filter((m: string) => m.includes('gemini')).sort()
    } else if (json.data) {
      p.models = json.data.map((m: any) => m.id).filter(Boolean).sort()
    }
    if (p.models.length === 0) ElMessage.info('未获取到可用模型')
    else ElMessage.success(`${p.models.length} 个模型`)
  } catch (e: any) {
    ElMessage.error(`获取失败: ${e.message}`)
  } finally { fetchingModels.value[p.id] = false }
}

// Removed old hardcoded aiProvider logic

const ALL_CHANNELS = [
  { platform: 'serverchan', label: 'Server酱 (微信)', key: 'PUSHOO_SC_KEY', hint: 'SCT...' },
  { platform: 'qmsg', label: 'Qmsg酱 (QQ)', key: 'PUSHOO_QMSG_KEY', hint: 'xxx' },
  { platform: 'dingtalk', label: '钉钉机器人', key: 'PUSHOO_DINGTALK_TOKEN', hint: 'https://oapi.dingtalk.com/robot/send?...' },
  { platform: 'wecombot', label: '企业微信群机器人', key: 'PUSHOO_WECOMBOT_TOKEN', hint: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?...' },
  { platform: 'wecom', label: '企业微信应用', key: 'PUSHOO_WECOM_TOKEN', hint: 'corpId:agentId:secret' },
  { platform: 'feishu', label: '飞书机器人', key: 'PUSHOO_FEISHU_TOKEN', hint: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' },
  { platform: 'telegram', label: 'Telegram Bot', key: 'PUSHOO_TELEGRAM_TOKEN', hint: '123456:ABC-DEF#-456' },
  { platform: 'bark', label: 'Bark (iOS)', key: 'PUSHOO_BARK_TOKEN', hint: 'https://api.day.app/xxx' },
  { platform: 'pushplus', label: 'PushPlus (微信)', key: 'PUSHOO_PUSHPLUS_TOKEN', hint: 'xxx' },
  { platform: 'pushplushxtrip', label: 'PushPlus Hxtrip', key: 'PUSHOO_PUSHPLUSHXTRIP_TOKEN', hint: 'xxx' },
  { platform: 'pushdeer', label: 'PushDeer', key: 'PUSHOO_PUSHDEER_TOKEN', hint: 'PDUxxx' },
  { platform: 'wxpusher', label: 'WxPusher (微信)', key: 'PUSHOO_WXPUSHER_TOKEN', hint: 'AT_xxx' },
  { platform: 'onebot', label: 'OneBot (QQ)', key: 'PUSHOO_ONEBOT_TOKEN', hint: 'http://IP:5700/send_private_msg?...' },
  { platform: 'atri', label: 'Atri (QQ)', key: 'PUSHOO_ATRI_TOKEN', hint: 'xxx' },
  { platform: 'igot', label: 'iGot', key: 'PUSHOO_IGOT_TOKEN', hint: 'xxx' },
  { platform: 'discord', label: 'Discord', key: 'PUSHOO_DISCORD_TOKEN', hint: 'https://discord.com/api/webhooks/...' },
  { platform: 'ifttt', label: 'IFTTT', key: 'PUSHOO_IFTTT_TOKEN', hint: 'xxx#event' },
  { platform: 'join', label: 'Join (Android)', key: 'PUSHOO_JOIN_TOKEN', hint: 'apiKey#deviceId' },
  { platform: 'webhook', label: 'Webhook (自定义)', key: 'PUSHOO_WEBHOOK_TOKEN', hint: 'https://example.com/hook' }
]

const SENSITIVE_KEYS = new Set([
  'SMTP_PASS', 'AKISMET_KEY', 'CAPTCHA_SECRET_KEY',
  'IMAGE_HOSTING_TOKEN', 'IMAGE_HOSTING_ACCESS_KEY', 'IMAGE_HOSTING_SECRET_KEY',
  'NSFW_API_KEY',
  ...ALL_CHANNELS.map(ch => ch.key)
])

const DEFAULTS: Record<string, any> = {
  SITE_NAME: '', SITE_URL: '', MASTER_NAME: '', MASTER: '',
  COMMENT_SORT: 'newest', PAGE_SIZE: 10, COMMENT_LENGTH_MAX: 500,
  REQUIRED_FIELDS: ['nick'],
  ENABLE_LINK_INPUT: true,
  GRAVATAR_URL: 'https://weavatar.com/avatar/', GRAVATAR_DEFAULT: 'identicon',
  MASTER_LABEL: '', COMMENT_BG_IMAGE: '',
  AKISMET_KEY: '', ENABLE_ANTI_SPAM: false,
  AUDIT_MODE: false, COMMENT_RATE_LIMIT: 30000,
  BLOCKED_KEYWORDS: '赌博,博彩,外围,买分,卖分,刷分,代发,推广,SEO,裸聊,约炮,成人,刷屏,恶意攻击,小姐,招嫖',
  AUTO_AUDIT_METHOD: '', AUTO_AUDIT_AI_PROVIDER: '', AUTO_AUDIT_AI_MODEL: '', AUTO_AUDIT_AI_PROMPT: '',
  ENABLE_MAIL_NOTIFICATION: false, SMTP_HOST: '', SMTP_PORT: 587,
  SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '', SMTP_TO: '', SMTP_TLS: false,
  SENDER_EMAIL: '', SENDER_NAME: '',
  MAIL_SUBJECT: '', MAIL_TEMPLATE: '', MAIL_SUBJECT_ADMIN: '', MAIL_TEMPLATE_ADMIN: '',
  CUSTOM_CSS: '', GLOBAL_COLOR: '', ENABLE_VISITOR_COUNTER: true,
  COMMENT_PAGINATION_MODE: 'pagination', CDN_PREFIX: '',
  ENABLE_LIKE: true, ENABLE_DISLIKE: true, ENABLE_EMOTION: true,
  ADMIN_KEYWORD: '#admin,#博主,#管理',
  ENABLE_CODE_HIGHLIGHT: true, CODE_HIGHLIGHT_THEME: 'one-dark-pro',
  CODE_SHOW_LANGUAGE: true, CODE_SHOW_COPY: true,

  IMAGE_HOSTING_PROVIDER: '', IMAGE_HOSTING_ENDPOINT: '',
  IMAGE_HOSTING_TOKEN: '',
  IMAGE_HOSTING_BUCKET: '', IMAGE_HOSTING_REGION: '',
  IMAGE_HOSTING_ACCESS_KEY: '', IMAGE_HOSTING_SECRET_KEY: '',
  IMAGE_HOSTING_CDN_DOMAIN: '',
  ENABLE_NSFW_DETECTION: false, NSFW_SERVICE: 'self',
  NSFW_ENDPOINT: '', NSFW_API_KEY: '', NSFW_THRESHOLD: 0.5,
  ENABLE_CAPTCHA: false, CAPTCHA_PROVIDER: 'turnstile', CAPTCHA_TYPE: 'checkbox',
  CAPTCHA_SITE_KEY: '', CAPTCHA_SECRET_KEY: '',
  IP_REGION_ENABLED: true, SHOW_IP_REGION: 'all', SHOW_UA_INFO: true, CORS_ORIGINS: '',
  ENABLE_IMAGE_UPLOAD: false, ENABLE_ADMIN_KEYWORD: false,
  }

const config = reactive<Record<string, any>>({ ...DEFAULTS })
const savedSnapshot = ref<Record<string, any>>({ ...DEFAULTS })
const maskedFields = reactive<Record<string, boolean>>({})

const requiredFieldsList = computed({
  get: () => config.REQUIRED_FIELDS || [],
  set: (val: string[]) => { config.REQUIRED_FIELDS = val }
})

const codeOptions = computed({
  get: () => {
    const arr: string[] = []
    if (config.CODE_SHOW_LANGUAGE) arr.push('language')
    if (config.CODE_SHOW_COPY) arr.push('copy')
    return arr
  },
  set: (val: string[]) => {
    config.CODE_SHOW_LANGUAGE = val.includes('language')
    config.CODE_SHOW_COPY = val.includes('copy')
  }
})

const isTokenProvider = computed(() => TOKEN_PROVIDERS.has(config.IMAGE_HOSTING_PROVIDER))
const isS3Provider = computed(() => S3_PROVIDERS.has(config.IMAGE_HOSTING_PROVIDER))

// ========== Dirty State ==========
const isDirty = computed(() => {
  const saved = savedSnapshot.value
  for (const key of Object.keys(config)) {
    const a = config[key]
    const b = saved[key]
    if (Array.isArray(a) && Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) return true
    } else if (a !== b) {
      return true
    }
  }
  return false
})

watch(() => config.IMAGE_HOSTING_PROVIDER, (newVal: string) => {
  const preset = HOSTING_PRESETS[newVal]
  if (!preset) return
  if (!config.IMAGE_HOSTING_ENDPOINT && preset.endpoint) config.IMAGE_HOSTING_ENDPOINT = preset.endpoint
  if (!config.IMAGE_HOSTING_REGION && preset.region) config.IMAGE_HOSTING_REGION = preset.region
})

const addedChannelKeys = reactive(new Set<string>())
const enabledChannels = computed(() => ALL_CHANNELS.filter(ch => addedChannelKeys.has(ch.platform)))
const availableChannels = computed(() => ALL_CHANNELS.filter(ch => !addedChannelKeys.has(ch.platform)))

const addChannel = (platform: string): void => {
  const ch = ALL_CHANNELS.find(c => c.platform === platform)
  if (!ch) return
  addedChannelKeys.add(platform)
  if (config[ch.key] === undefined) config[ch.key] = ''
  addingChannel.value = ''
}

const removeChannel = (idx: number): void => {
  const ch = enabledChannels.value[idx]
  if (ch) {
    addedChannelKeys.delete(ch.platform)
    delete config[ch.key]
  }
}

const clearMask = (key: string): void => {
  maskedFields[key] = false
  config[key] = ''
}

const loadConfig = async (): Promise<void> => {
  loading.value = true
  try {
    const result = await adminRequest(props.options.envId, props.token || '', '/api/admin/config')
    if ((result as any).data) {
      const data = (result as any).data
      // Only set keys from server response, don't re-apply DEFAULTS
      for (const key of Object.keys(data)) {
        if (key in config) {
          config[key] = data[key]
        }
      }
      // 检测掩码字段
      for (const key of SENSITIVE_KEYS) {
        if (typeof data[key] === 'string' && data[key].includes('****')) {
          maskedFields[key] = true
        }
      }
      // 恢复已配置的通知渠道
      for (const ch of ALL_CHANNELS) {
        if (data[ch.key] && data[ch.key] !== '') addedChannelKeys.add(ch.platform)
      }
      if (data.AI_PROVIDERS) {
        try { aiProviders.value = JSON.parse(data.AI_PROVIDERS) } catch {}
      }

      // Restore moderation view from server config
      if (config.AUTO_AUDIT_METHOD) {
        activeModerationView.value = config.AUTO_AUDIT_METHOD
      } else {
        activeModerationView.value = 'none'
      }

      savedSnapshot.value = { ...config }
    }
  } catch { ElMessage.warning(t('loadConfigFailed')) }
  finally { loading.value = false }
}

const onSave = async (): Promise<void> => {
  saving.value = true
  try {
    const payload: Record<string, any> = {}
    for (const [key, value] of Object.entries(config)) {
      if (SENSITIVE_KEYS.has(key) && maskedFields[key] && (!value || (typeof value === 'string' && value.includes('****')))) continue
      payload[key] = value
    }
    payload.AI_PROVIDERS = JSON.stringify(aiProviders.value)
    await adminRequest(props.options.envId, props.token || '', '/api/admin/config', 'PUT', { config: payload })
    savedSnapshot.value = { ...config }
    ElMessage.success(t('configSaved'))
  }
  catch (e: any) {
    if (e?.message?.includes('权限')) { emit('expired') }
    ElMessage.error(t('submitFailed'))
  }
  finally { saving.value = false }
}

const onReset = async (): Promise<void> => {
  try { await ElMessageBox.confirm(t('confirmReset'), t('confirm'), { type: 'warning' }) }
  catch { return /* user cancelled */ }

  try {
    await adminRequest(props.options.envId, props.token || '', '/api/admin/config', 'DELETE')
    Object.assign(config, DEFAULTS)
    for (const key of Object.keys(maskedFields)) delete maskedFields[key]
    addedChannelKeys.clear()
    for (const ch of ALL_CHANNELS) delete config[ch.key]
    savedSnapshot.value = { ...config }
    ElMessage.success(t('submitSuccess'))
  } catch (e: any) {
    ElMessage.error(t('submitFailed') + ': ' + (e?.message || '操作失败'))
  }
}

const testEmailAddress = ref('')
const testEmailTemplate = ref('user')
const testEmailLog = ref('')

const onTestEmail = async (): Promise<void> => {
  testing.value = true
  testEmailLog.value = '正在发送...'
  try {
    const res = await adminRequest(props.options.envId, props.token || '', '/api/admin/email-test', 'POST', { email: testEmailAddress.value, template: testEmailTemplate.value })
    if (res && res.success) {
      ElMessage.success(t('emailTestSuccess'))
    } else {
      ElMessage.error(t('emailTestFailed'))
    }
    testEmailLog.value = res ? (res.message || JSON.stringify(res, null, 2)) : '无返回值'
  } catch (err: any) {
    ElMessage.error(t('emailTestFailed'))
    testEmailLog.value = err.message || '请求失败'
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.tk-admin-config {
  position: relative;
}
.tk-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tk-admin-text-secondary, #666);
  margin: 20px 0 12px 0;
  border-left: 3px solid var(--tk-brand, #409eff);
  padding-left: 8px;
}
.tk-config-search {
  position: absolute;
  top: 0;
  right: 16px;
  width: 200px;
  z-index: 10;
}
.tk-admin-config-header {
  position: relative;
  padding-top: 42px;
}
.tk-capsule-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.tk-capsule-tabs :deep(.el-tabs__nav) {
  border-radius: 20px;
  padding: 4px;
}
.tk-capsule-tabs :deep(.el-tabs__item) {
  border-radius: 16px;
  height: 32px;
  line-height: 32px;
  padding: 0 16px !important;
  margin: 0 2px;
  font-weight: 500;
  border: none !important;
}
.tk-capsule-tabs :deep(.el-tabs__item.is-active) {
  background: var(--el-bg-color, #fff);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  color: var(--tk-brand);
}
.tk-capsule-tabs :deep(.el-tabs__active-bar) {
  display: none;
}
@media (max-width: 600px) {
  .tk-config-search {
    position: static;
    width: 100%;
    margin-bottom: 12px;
  }
}

.tk-card {
  border: 1px solid color-mix(in srgb, var(--tk-admin-border) 60%, transparent);
  border-radius: 6px;
  margin-bottom: 6px;
  padding: 0 12px;
}

.tk-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--tk-admin-text-secondary);
  text-transform: uppercase;
  cursor: pointer;
  user-select: none;
}

.tk-card-arrow {
  display: inline-block;
  font-size: 11px;
  color: var(--tk-admin-text-secondary);
  opacity: 0.5;
  transition: transform 0.2s ease;
  transform: rotate(0deg);
}

.tk-card-arrow.open {
  transform: rotate(90deg);
}

.tk-card-body {
  padding: 6px 0 8px;
}

/* 表单项纵向堆叠: label在上, input在下 */
.tk-card-body :deep(.el-form-item) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-bottom: 10px;
}

.tk-card-body :deep(.el-form-item.tk-switch-item) {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.tk-card-body :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.tk-card-body :deep(.el-form-item__label) {
  font-size: 13px;
  font-weight: 500;
  color: var(--tk-admin-text);
  padding-bottom: 4px;
  line-height: 1;
  text-align: left;
}

.tk-card-body :deep(.el-form-item.tk-switch-item .el-form-item__label) {
  padding-bottom: 0;
  height: auto;
  line-height: normal; /* Restore default baseline alignment */
  margin-bottom: 0;
  flex: 1;
}

.tk-card-body :deep(.el-form-item.tk-switch-item .el-form-item__content) {
  flex: none;
  justify-content: flex-end;
}

.tk-card-body :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.tk-card-body :deep(.el-input-number) {
  width: 140px;
}

.tk-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tk-input-group .tk-form-hint {
  margin-top: 0;
  flex: none;
}

/* 敏感字段 */
.tk-sensitive-set {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.tk-sensitive-set .el-input {
  flex: 1;
}

/* 表单提示 */
.tk-form-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--tk-admin-text-secondary);
}

.tk-form-hint-block {
  display: block;
  font-size: 12px;
  line-height: 1.4;
  color: var(--tk-admin-text-secondary);
  margin-bottom: 12px;
}

/* 操作栏 */
.tk-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--tk-admin-border);
}

.tk-dirty-hint {
  font-size: 12px;
  color: var(--tk-warning, #f59e0b);
  margin-right: auto;
}

/* 通知渠道 */
.tk-channel-group-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--tk-admin-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.tk-channel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--tk-admin-border) 50%, transparent);
}

.tk-channel-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 140px;
}

.tk-channel-name {
  font-size: 13px;
  font-weight: 500;
}

.tk-channel-item .el-input {
  flex: 1;
}

.tk-channel-opt {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

/* 颜色行 */
.tk-color-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.tk-color-row .el-input {
  flex: 1;
}

/* 其他 */
.tk-model-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tk-model-row .el-input {
  flex: 1;
}

.tk-mirror-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

/* OAuth 输入框组 — 确保 Client ID 和 Secret 同高 */
.tk-oauth-input {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 120px;
}
.tk-oauth-label {
  font-size: 11px;
  color: var(--tk-admin-text-secondary);
  opacity: .7;
  line-height: 1.2;
}

/* 响应式 */
@media (max-width: 767px) {
  .tk-admin-config-header { padding-top: 0; }
  .tk-channel-item { flex-wrap: wrap; }
  .tk-channel-info { min-width: 100%; margin-bottom: 4px; }
  
  /* AI Provider 移动端适配 */
  .tk-ai-provider-row { flex-direction: column; gap: 8px !important; margin-bottom: 8px !important; }
  .tk-ai-format-item { flex: auto !important; margin-bottom: 8px !important; }
  .tk-ai-endpoint-item { flex: auto !important; }
  .tk-ai-name-input { width: 140px !important; }
}

/* AI 提供商卡片优化 */
.tk-ai-provider-card {
  border: 1px solid var(--tk-admin-border);
  border-radius: 8px;
  background: var(--tk-admin-bg, #fff);
  margin-top: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.tk-ai-provider-card:hover {
  border-color: var(--tk-admin-primary, #409eff);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.tk-ai-provider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: color-mix(in srgb, var(--tk-admin-border) 10%, transparent);
  border-bottom: 1px solid var(--tk-admin-border);
}
.tk-ai-provider-title {
  display: flex;
  align-items: center;
}
.tk-ai-provider-body {
  padding: 16px;
}
</style>
