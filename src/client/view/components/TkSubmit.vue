<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, getUrl, getHref, getUserAgent } from '../../utils'
import { submitComment } from '../../utils'
import { getAuthState, onAuthChange, getAvailableProviders, type AvailableProviders } from '../../utils/auth'
import { renderMarkdown } from '../../utils/marked'
import { toast, renderTex } from '../../utils'
import type { TakoioConfig, Comment } from '../../types'

// Composables
import { useFormValidation } from './submit/composables/useFormValidation'
import { useDraft } from './submit/composables/useDraft'
import { useReactions } from './submit/composables/useReactions'
import { useImageUpload } from './submit/composables/useImageUpload'

// Sub-components
import ImagePreview from './submit/components/ImagePreview.vue'
import ReactionBar from './submit/components/ReactionBar.vue'
import CaptchaWidget from './submit/components/CaptchaWidget.vue'
import MarkdownToolbar from './submit/components/MarkdownToolbar.vue'
import LoginDropdown from './submit/components/LoginDropdown.vue'
import PrivacyToggle from './submit/components/PrivacyToggle.vue'
import EmailLoginDialog from './submit/components/EmailLoginDialog.vue'

interface Props { options: TakoioConfig; siteConfig?: Record<string, any>; replyTo?: Comment | null }
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'posted', comment: Comment): void; (e: 'clear-reply'): void; (e: 'admin'): void }>()

// --- Refs ---
const formRef = ref<HTMLFormElement>()
const editorRef = ref<HTMLTextAreaElement>()
const errorMsg = ref('')
const submitting = ref(false)
const showPreview = ref(false)
const previewHtml = ref('')
const previewRef = ref<HTMLElement>()
const isFocused = ref(false) // 焦点态：用于 .tk-submit-card-focus 外发光
const form = reactive({ nick: '', mail: '', link: '', comment: '' })
const defaultEmojis = ['👍', '👎', '❤️', '😂', '🤯', '🎉']
const isGuestActive = ref(false)

// --- Composed state ---
const showUploadBtn = computed(() => props.siteConfig?.ENABLE_IMAGE_UPLOAD && props.siteConfig?.IMAGE_HOSTING_PROVIDER)
const commentMaxLength = computed(() => props.siteConfig?.COMMENT_LENGTH_MAX || 5000)

// --- Form validation (composable) ---
const { errors, validate } = useFormValidation({
  options: props.options,
  siteConfig: props.siteConfig || {},
  form,
})

// --- Draft autosave (composable) ---
const draft = useDraft({
  DRAFT_KEY: 'takoio-draft',
  OLD_DRAFT_KEY: 'twikoo-draft',
  getT: (k: string) => t(k),
  form,
  toast,
})
const { draftTimer, saveDraft, loadDraft } = draft

// --- Reactions (composable) ---
const reactionsApi = useReactions({ options: props.options, toast })
const { reactions, myReactions, fetchReactions, toggleReaction } = reactionsApi

// --- Markdown preview ---
const updatePreview = async (): Promise<void> => {
  if (!showPreview.value) return
  previewHtml.value = await renderMarkdown(form.comment)
  await nextTick()
  if (previewRef.value) await renderTex(previewRef.value, props.options.texRenderer)
}
watch(() => form.comment, updatePreview)
watch(showPreview, (v) => { if (v) updatePreview() })

// --- Form error clear on edit ---
watch(form, () => {
  if (errorMsg.value) errorMsg.value = ''
  errors.nick = ''; errors.mail = ''; errors.link = ''; errors.comment = ''
})

// --- Draft autosave ---
watch(form, () => { saveDraft() }, { deep: true })

// --- Image upload (composable) ---
const { imageUploading, uploadedImages, uploadRef, removeImage, triggerUpload, onFileChange, onPaste } = useImageUpload({
  envId: props.options.envId,
  editorRef,
  form,
  enabled: !!showUploadBtn.value,
})

// --- Captcha (delegated to CaptchaWidget) ---
const captchaToken = ref('')
const captchaError = ref('')

// --- 设计稿新增：免登录 / 登录下拉 / 公开-私密切换 ---
// 1) 登录下拉：仅当未登录 + 启用登录 + 至少一个 provider 时显示
const isLoggedIn = ref(!!getAuthState()?.token)
const currentUser = ref(getAuthState()?.user || null)

// 邮箱登录弹窗
const emailDialogOpen = ref(false)
const onSelectProvider = (provider: 'github' | 'google' | 'email') => {
  if (provider === 'email') {
    emailDialogOpen.value = true
  }
  // github/google 由 LoginDropdown 内部直接跳转，无需处理
}

// 订阅 auth 变化（保持 isLoggedIn / currentUser 同步）
let unsubscribeAuth: (() => void) | null = null

// 后端自动发现的可用 provider（onMounted 拉取）
const availableProviders = ref<AvailableProviders | null>(null)

// 合并三个数据源（按优先级）：
//   1) 用户 init 时显式传入 options.loginProviders
//   2) siteConfig.LOGIN_PROVIDERS（预留扩展点，暂未实现）
//   3) /api/auth/providers 自动发现结果
const loginProviders = computed<Array<'github' | 'google' | 'email'>>(() => {
  // 1) 最高优先级：用户显式配置
  const explicit = props.options.loginProviders
  if (Array.isArray(explicit) && explicit.length > 0) {
    const allow = new Set(['github', 'google', 'email'])
    return explicit.filter((p): p is 'github' | 'google' | 'email' => allow.has(String(p).toLowerCase().trim()))
  }
  // 2) siteConfig.LOGIN_PROVIDERS（字符串或数组）
  const fromConfig = props.siteConfig?.LOGIN_PROVIDERS
  if (fromConfig) {
    const list = Array.isArray(fromConfig) ? fromConfig : String(fromConfig).split(',')
    const allow = new Set(['github', 'google', 'email'])
    const filtered = list
      .map(s => String(s).toLowerCase().trim())
      .filter((p): p is 'github' | 'google' | 'email' => allow.has(p))
    if (filtered.length > 0) return filtered
  }
  // 3) 默认：自动发现
  if (availableProviders.value) {
    const ap = availableProviders.value
    const out: Array<'github' | 'google' | 'email'> = []
    if (ap.github) out.push('github')
    if (ap.google) out.push('google')
    if (ap.email) out.push('email')
    return out
  }
  return []
})
const showLogin = computed(() =>
  !isLoggedIn.value &&
  props.options.enableLogin !== false &&
  loginProviders.value.length > 0
)
// 2) 免登录评论：当未登录 + 后台 ENABLE_GUEST_COMMENT=true 时，垂直堆叠额外信息
const showGuestInfo = computed(() => {
  if (isLoggedIn.value) return false
  const flag = props.siteConfig?.ENABLE_GUEST_COMMENT
  return flag === true || flag === 'true' || flag === 1 || flag === '1'
})
// 3) 公开 / 私密切换（设计稿 296–302 行）：TakoioConfig.privateComment 默认 false
const privateComment = ref<boolean>(!!props.options.privateComment)

// 同步 options 变化（外部动态切换）
watch(() => props.options.privateComment, (v) => { if (typeof v === 'boolean') privateComment.value = v })

// --- Submit ---
const onSubmit = async (): Promise<void> => {
  if (!validate(t)) return
  captchaError.value = ''
  if (props.options.enableCaptcha && !captchaToken.value) { captchaError.value = t('captchaRequired') || '请完成人机验证'; return }
  submitting.value = true
  try {
    const ua = await getUserAgent()
    const result = await submitComment(props.options.envId, {
      url: getUrl(props.options.path, { pathNormalize: props.options.pathNormalize, pathTransform: props.options.pathTransform }),
      href: getHref(props.options.href),
      title: props.options.title || document.title,
      nick: form.nick,
      mail: form.mail,
      link: form.link,
      comment: form.comment,
      ua,
      captchaToken: captchaToken.value || undefined,
      pid: props.replyTo?.pid || props.replyTo?.id || undefined,
      rid: props.replyTo?.id || undefined,
      token: getAuthState()?.token || undefined,
      isPrivate: privateComment.value || undefined,
    })
    emit('posted', result.data)
    form.comment = ''
    uploadedImages.value = []
    localStorage.removeItem('takoio-draft')
    toast(t('submitSuccess'))
  } catch (e: unknown) { toast(e instanceof Error ? e.message : t('submitFailed')) } finally { submitting.value = false }
}

// --- Lifecycle ---
onMounted(async () => {
  fetchReactions()
  loadDraft()
  if (form.nick || form.mail) {
    isGuestActive.value = true
  }
  unsubscribeAuth = onAuthChange((state) => { isLoggedIn.value = !!state; currentUser.value = state?.user || null })
  // 拉取后端实际启用的 provider 列表（无 options.loginProviders 时回退）
  if (props.options.envId) {
    try {
      availableProviders.value = await getAvailableProviders(props.options.envId)
    } catch {
      availableProviders.value = { github: false, google: false, email: false }
    }
  }
})
onBeforeUnmount(() => { if (draftTimer.value) clearTimeout(draftTimer.value as any); if (unsubscribeAuth) unsubscribeAuth() })
</script>

<template>
  <!-- 设计稿：article-level reactions 移至 .tk-submit-card 之上（不在卡片内） -->
  <div
    v-if="!replyTo && options.enableArticleReaction"
    class="tk-article-reactions"
  >
    <ReactionBar
      :emojis="defaultEmojis"
      :reactions="reactions"
      :my-reactions="myReactions"
      @toggle="toggleReaction"
    />
  </div>

  <div
    v-if="replyTo"
    class="tk-reply-to"
  >
    {{ t('replyTo') }} <strong>{{ replyTo.nick }}</strong>：
    <button
      class="tk-btn-link tk-btn-sm"
      :aria-label="t('cancel') || '取消'"
      @click="emit('clear-reply')"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line
          x1="18"
          y1="6"
          x2="6"
          y2="18"
        /><line
          x1="6"
          y1="6"
          x2="18"
          y2="18"
        />
      </svg>
    </button>
  </div>

  <!-- 设计稿：单一卡片容器，聚焦时品牌色外发光 -->
  <div
    ref="formRef"
    class="tk-submit-card"
    :class="{ 'tk-submit-card-focus': isFocused }"
  >
    <form
      class="tk-submit-form"
      @submit.prevent="onSubmit"
    >
      <div class="tk-editor-item">
        <textarea
          ref="editorRef"
          v-model="form.comment"
          class="tk-textarea"
          :aria-label="t('placeholder')"
          :placeholder="t('placeholder')"
          :maxlength="commentMaxLength"
          rows="4"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown.ctrl.enter="onSubmit"
          @paste="onPaste"
        />
        <div class="tk-word-limit">
          <span>{{ form.comment.length }}</span>/{{ commentMaxLength }}
        </div>
      </div>

      <ImagePreview
        :images="uploadedImages"
        :alt-text="t('imageAlt')"
        :remove-label="t('delete')"
        @remove="removeImage"
      />

      <div
        v-if="imageUploading"
        class="tk-image-uploading"
      >
        <svg
          class="tk-spin"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            opacity=".25"
          /><path
            d="M12 2a10 10 0 0 1 10 10"
            stroke-linecap="round"
          />
        </svg>
        <span>{{ t('imageUploading') }}</span>
      </div>

      <div
        v-if="errorMsg"
        class="tk-error-row"
      >
        <span class="tk-error-msg">{{ errorMsg }}</span>
      </div>

      <!-- 设计稿：内嵌工具栏（与 textarea 之间 1px border-top 分隔） -->
      <div class="tk-toolbar">
        <div class="tk-toolbar-left">
          <!-- 设计稿：pill 发送按钮（comment-input.html 263 行） -->
          <button
            type="submit"
            class="tk-btn-send"
            :disabled="submitting || (!isLoggedIn && !isGuestActive)"
            @click.prevent="onSubmit"
          >
            <svg
              v-if="submitting"
              class="tk-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            <svg
              v-else
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><line
              x1="22"
              y1="2"
              x2="11"
              y2="13"
            /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            <span class="tk-btn-send-text">{{ submitting ? (t('submitting') || '提交中…') : (t('submit') || '发送') }}</span>
          </button>

          <!-- 图片上传按钮 -->
          <button
            v-if="showUploadBtn"
            type="button"
            class="tk-btn-icon-ghost"
            :title="t('uploadImage')"
            :aria-label="t('uploadImage')"
            @click="triggerUpload"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line
              x1="12"
              y1="3"
              x2="12"
              y2="15"
            /></svg>
          </button>
          <input
            ref="uploadRef"
            type="file"
            accept="image/*"
            class="tk-hidden-upload"
            @change="onFileChange"
          >

          <!-- 设计稿：7 个 markdown 按钮以紧凑无边框方式排列 -->
          <MarkdownToolbar
            v-model="form.comment"
            :editor-ref="{ value: editorRef }"
            variant="compact"
          />
        </div>

        <div class="tk-toolbar-right">
          <!-- 公开 / 私密切换（设计稿 296–302 行） -->
          <PrivacyToggle
            :model-value="privateComment"
            @update:model-value="privateComment = $event"
            :public-label="t('public') || '公开'"
            :private-label="t('private') || '私密'"
          />
        </div>
      </div>
    </form>
  </div>

  <!-- 已登录：显示用户信息（替代 3 个 input） -->
  <div
    v-if="isLoggedIn"
    class="tk-auth-meta"
  >
    <span class="tk-auth-avatar">
      <img v-if="currentUser?.avatar" :src="currentUser.avatar" :alt="currentUser.name" referrerpolicy="no-referrer">
      <span v-else class="tk-auth-avatar-placeholder">{{ (currentUser?.name || '?')[0] }}</span>
    </span>
    <span class="tk-auth-name">{{ currentUser?.name }}</span>
    <span v-if="currentUser?.email" class="tk-auth-email">{{ currentUser.email }}</span>
    <span class="tk-auth-provider">{{ currentUser?.provider }}</span>
  </div>

  <template v-if="!isLoggedIn && isGuestActive">
    <!-- 顶部 meta-row：未登录态显示 nickname / email（已登录由 tk-auth-meta 替代） -->
    <div
      v-if="!showGuestInfo"
      class="tk-meta-row"
    >
      <div class="tk-meta-item">
        <input
          v-model="form.nick"
          :aria-label="t('nickname')"
          :placeholder="t('nickname')"
          class="tk-input"
          :class="{ 'tk-input-error': errors.nick }"
        >
        <span
          v-if="errors.nick"
          class="tk-field-error"
        >{{ errors.nick }}</span>
      </div>
      <div class="tk-meta-item">
        <input
          v-model="form.mail"
          type="email"
          :aria-label="t('email')"
          :placeholder="t('email')"
          class="tk-input"
          :class="{ 'tk-input-error': errors.mail }"
        >
        <span
          v-if="errors.mail"
          class="tk-field-error"
        >{{ errors.mail }}</span>
      </div>
      <div
        v-if="options.enableLinkInput"
        class="tk-meta-item"
      >
        <input
          v-model="form.link"
          :aria-label="t('link')"
          :placeholder="t('link')"
          class="tk-input"
          :class="{ 'tk-input-error': errors.link }"
        >
        <span
          v-if="errors.link"
          class="tk-field-error"
        >{{ errors.link }}</span>
      </div>
    </div>

    <!-- 设计稿：免登录态垂直堆叠（comment-input-guest.html 218-227 行） -->
    <div
      v-else
      class="tk-guest-info"
    >
      <div class="tk-guest-hint">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle
          cx="12"
          cy="7"
          r="4"
        /></svg>
        {{ t('guestInfoTitle') || '免登录评论需要填写以下信息' }}
      </div>
      <div class="tk-guest-fields">
        <div class="tk-meta-item">
          <label class="tk-field-label">
            {{ t('nickname') }} <span class="tk-required">*</span>
          </label>
          <input
            v-model="form.nick"
            :aria-label="t('nickname')"
            :placeholder="t('nickname')"
            class="tk-input"
            :class="{ 'tk-input-error': errors.nick }"
          >
          <span
            v-if="errors.nick"
            class="tk-field-error"
          >{{ errors.nick }}</span>
        </div>
        <div class="tk-meta-item">
          <label class="tk-field-label">
            {{ t('email') }} <span class="tk-required">*</span>
          </label>
          <input
            v-model="form.mail"
            type="email"
            :aria-label="t('email')"
            :placeholder="t('email')"
            class="tk-input"
            :class="{ 'tk-input-error': errors.mail }"
          >
          <span
            v-if="errors.mail"
            class="tk-field-error"
          >{{ errors.mail }}</span>
        </div>
        <div
          v-if="options.enableLinkInput"
          class="tk-meta-item"
        >
          <label class="tk-field-label">{{ t('link') }}</label>
          <input
            v-model="form.link"
            :aria-label="t('link')"
            :placeholder="t('link')"
            class="tk-input"
            :class="{ 'tk-input-error': errors.link }"
          >
          <span
            v-if="errors.link"
            class="tk-field-error"
          >{{ errors.link }}</span>
        </div>
      </div>
    </div>
  </template>

  <!-- Action Buttons block: A new button container to toggle state or trigger login when not logged in -->
  <div
    v-if="!isLoggedIn"
    class="tk-submit-actions"
  >
    <LoginDropdown
      v-if="showLogin"
      :providers="loginProviders"
      :env-id="options.envId"
      class="tk-toolbar-login"
      @select="onSelectProvider"
    />
    <button
      v-if="showGuestInfo && !isGuestActive"
      type="button"
      class="tk-btn-guest-toggle"
      @click="isGuestActive = true"
    >
      {{ t('guestComment') || '免登录评论' }}
    </button>
  </div>

  <div
    v-show="showPreview"
    ref="previewRef"
    class="tk-preview"
    v-html="previewHtml"
  />

  <!-- Captcha -->
  <CaptchaWidget
    v-if="options.enableCaptcha"
    :provider="(options.captchaProvider as any)"
    :site-key="(options.captchaSiteKey as string)"
    :theme="'auto'"
    :captcha-type="(options.captchaType as any)"
    :model-value="captchaToken"
    @update:model-value="captchaToken = $event"
    @error="captchaError = $event"
  />
  <!-- Email login dialog -->
  <EmailLoginDialog
    v-model="emailDialogOpen"
    :env-id="options.envId"
    @success="() => { /* onAuthChange 自动触发，UI 已登录态自动切换 */ }"
  />
</template>

<style scoped>
.tk-submit { padding:0 0 20px; margin-bottom:24px; }
.tk-reply-to { margin-bottom: 10px; padding: 6px 12px; background: var(--tk-bg-muted); border-radius: var(--tk-r-input); font-size: 13px; display: flex; align-items: center; gap: 6px; }

/* =========================================================
 * 设计稿：单卡片容器 + 聚焦外发光
 * - 半透明背景（适配更多站点，融入页面主题）
 * - 边框 1px，圆角 12px
 * - :focus-within 时品牌色 box-shadow
 * ========================================================= */
.tk-submit-card {
  background: transparent;
  border: 1px solid var(--tk-border-light);
  border-radius: var(--tk-r-card);
  padding: var(--tk-space-md);
  transition: box-shadow .18s ease, border-color .18s ease;
  position: relative;
}
.tk-submit-card:hover {
  border-color: var(--tk-border-strong);
}
.tk-submit-card:focus-within,
.tk-submit-card-focus {
  border-color: var(--tk-brand) !important;
  box-shadow: 0 0 0 1px var(--tk-brand-glow);
}
.tk-submit-form { display: flex; flex-direction: column; gap: var(--tk-space-md); }

/* 设计稿：免登录态垂直堆叠 */
.tk-guest-info { display: flex; flex-direction: column; gap: var(--tk-space-sm); padding-bottom: var(--tk-space-sm); }
.tk-guest-hint {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--tk-text-tertiary);
  font-weight: 500;
}
.tk-guest-fields { display: flex; flex-direction: column; gap: var(--tk-space-sm); }
.tk-field-label {
  display: block; font-size: 12px; font-weight: 500;
  color: var(--tk-text-secondary); margin-bottom: 4px;
}
.tk-required { color: var(--tk-status-error, #ef4444); margin-left: 2px; }

.tk-meta-row { display: flex; gap: 10px; }
.tk-meta-item { flex: 1; min-width: 0; }
.tk-editor-item { position: relative; }

.tk-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 13px;
  font-family: inherit;
  color: inherit;
  background: var(--tk-bg-input);
  border: 1px solid var(--tk-border-light);
  border-radius: var(--tk-r-input);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  box-sizing: border-box;
}
.tk-input:hover { border-color: var(--tk-border-strong); }
.tk-input:focus { border-color: var(--tk-brand); }
.tk-input-error { border-color: var(--tk-danger) !important; }

.tk-textarea {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  font-family: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--tk-border-light);
  border-radius: var(--tk-r-input);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  box-sizing: border-box;
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}
.tk-textarea:hover { border-color: var(--tk-border-strong); }
.tk-textarea:focus { border-color: var(--tk-brand); }

/* Override textarea inside the card to be borderless & transparent */
.tk-submit-card .tk-textarea {
  border: none !important;
  padding: 0 0 16px 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none !important;
}
.tk-submit-card .tk-textarea:hover,
.tk-submit-card .tk-textarea:focus {
  border: none !important;
  box-shadow: none !important;
}

.tk-field-error { font-size: 11px; color: var(--tk-danger); margin-top: 2px; display: block; }
.tk-word-limit { position: absolute; bottom: 8px; right: 10px; font-size: 11px; opacity: .45; pointer-events: none; }
.tk-image-uploading { display: flex; align-items: center; gap: 6px; font-size: 13px; color: inherit; opacity: .6; }
@keyframes tk-rotate { to { transform: rotate(360deg); } }
.tk-spin { animation: tk-rotate 1s linear infinite; }
.tk-hidden-upload { display: none; }
.tk-error-row { width: 100%; box-sizing: border-box; }
.tk-error-msg { font-size: 12px; color: var(--tk-danger); line-height: 1.4; word-break: break-all; }
.tk-avatar-preview { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }

/* 设计稿：内嵌工具栏（与 textarea 之间 1px border-top 分隔，负边距延展至卡片边缘） */
.tk-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  flex-wrap: wrap;
  border-top: 1px solid var(--tk-border-light);
  margin-left: calc(-1 * var(--tk-space-md));
  margin-right: calc(-1 * var(--tk-space-md));
  margin-bottom: calc(-1 * var(--tk-space-md));
  padding-left: var(--tk-space-md);
  padding-right: var(--tk-space-md);
  padding-top: var(--tk-space-sm);
  padding-bottom: var(--tk-space-sm);
}
.tk-toolbar-left { display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0; flex-wrap: wrap; }
.tk-toolbar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.tk-toolbar-login { margin-left: auto; }

/* 设计稿：pill 发送按钮 */
.tk-btn-send {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  background: var(--tk-brand);
  border: none; border-radius: var(--tk-r-pill);
  color: #fff; font-size: 13px; font-weight: 500;
  cursor: pointer; font-family: inherit;
  transition: background .15s, transform .1s;
  flex-shrink: 0;
}
.tk-btn-send:hover { background: var(--tk-brand-hover); }
.tk-btn-send:active { transform: scale(0.98); }
.tk-btn-send:disabled { background: var(--tk-bg-hover); color: var(--tk-text-tertiary); cursor: not-allowed; }

/* 设计稿：紧凑无边框 icon 按钮（与 Markdown 按钮 size 对齐） */
.tk-btn-icon-ghost {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: transparent; border: none; border-radius: var(--tk-r-input);
  color: var(--tk-text-secondary);
  cursor: pointer; opacity: .55; transition: all .15s;
}
.tk-btn-icon-ghost:hover { opacity: 1; background: var(--tk-bg-hover); color: var(--tk-text-primary); }

.tk-btn-circle { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; color: inherit; opacity: .6; cursor: pointer; border-radius: 50%; transition: all .15s; padding: 0; position: relative; flex-shrink: 0; }
.tk-btn-circle:hover { opacity: 1; background: var(--tk-bg-muted); }
.tk-btn-circle[data-tip]::after { content: attr(data-tip); position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); font-size: 11px; background: var(--tk-text); color: var(--tk-bg-popup); padding: 2px 6px; border-radius: 4px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .15s; }
.tk-btn-circle[data-tip]:hover::after { opacity: 1; }

.tk-btn-link { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; color: inherit; opacity: .6; padding: 4px; border-radius: 4px; font-family: inherit; font-size: inherit; }
.tk-btn-link:hover { opacity: 1; }
.tk-btn-sm { padding: 2px; }

.tk-btn-outline { display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px; background: transparent; border: 1px solid var(--tk-border); border-radius: var(--tk-r-input); cursor: pointer; color: inherit; font-size: 13px; font-family: inherit; transition: all .15s; flex-shrink: 0; }
.tk-btn-outline:hover { border-color: var(--tk-brand); color: var(--tk-brand); }

.tk-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 6px 18px; background: var(--tk-brand); border: none; border-radius: var(--tk-r-input); cursor: pointer; color: #fff; font-size: 13px; font-family: inherit; font-weight: 600; transition: all .15s; flex-shrink: 0; }
.tk-btn-primary:hover { filter: brightness(1.1); }
.tk-btn-primary:disabled { opacity: .5; cursor: default; filter: none; }

.tk-preview { margin-top: 12px; padding: 16px; background: var(--tk-bg-inset); border: 1px solid var(--tk-border-soft); border-radius: var(--tk-r-input); min-height: 50px; font-size: 14px; line-height: 1.7; }
.tk-preview :deep(p) { margin: 6px 0; display: inline; }
.tk-preview :deep(pre) { background: var(--tk-bg-code); border: 1px solid var(--tk-border-soft); border-radius: var(--tk-r-input); padding: 12px; font-size: 13px; }
.tk-preview :deep(.tk-owo-emotion) { height: 1.5em; width: 1.5em; vertical-align: middle; display: inline-block; margin: 0 3px; object-fit: contain; }
.tk-preview :deep(.tk-comment-inline-image) { max-width: 100%; max-height: 300px; border-radius: 8px; display: block; margin: 8px 0; }

.tk-captcha { margin-top: 14px; display: flex; flex-direction: column; align-items: center; }
.tk-captcha-error { color: var(--tk-danger); font-size: 12px; margin-top: 6px; }
.tk-article-reactions { display: flex; align-items: center; justify-content: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }

@media (max-width: 640px) {
  .tk-submit { padding: 14px 0; }
  /* 设计稿：meta-row 垂直堆叠（用户偏好：vertical stacking over horizontal） */
  .tk-meta-row { flex-direction: column; gap: 6px; }
  /* 设计稿：工具栏窄屏不强制换行（保留可见 send + image + 关键 md） */
  .tk-toolbar {
    flex-direction: row;
    gap: 8px;
    align-items: center;
    margin-left: -10px;
    margin-right: -10px;
    margin-bottom: -10px;
    padding-left: 10px;
    padding-right: 10px;
  }
  .tk-toolbar-left { flex-wrap: wrap; overflow: visible; }
  .tk-toolbar-right { flex-shrink: 0; }
  .tk-btn-send-text { display: none; } /* 窄屏：发送按钮只显示图标 */
  .tk-submit-card { padding: 10px; }
}
.tk-auth-meta {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: var(--tk-bg-muted);
  border-radius: var(--tk-r-input); font-size: 13px;
}
.tk-auth-avatar {
  width: 24px; height: 24px; border-radius: 50%; overflow: hidden;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--tk-brand, #fbbf24); color: #fff; flex-shrink: 0;
}
.tk-auth-avatar img { width: 100%; height: 100%; object-fit: cover; }
.tk-auth-avatar-placeholder { font-size: 12px; font-weight: 600; }
.tk-auth-name { font-weight: 500; }
.tk-auth-email { color: var(--tk-text-tertiary, #999); font-size: 12px; }
.tk-auth-provider {
  padding: 1px 6px; background: var(--tk-bg-hover, #e5e5e5);
  border-radius: 9999px; font-size: 10px; text-transform: uppercase;
  color: var(--tk-text-tertiary, #999);
}

.tk-submit-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: var(--tk-space-sm, 10px);
}
.tk-btn-guest-toggle {
  background: none;
  border: 1px solid var(--tk-border-light);
  border-radius: var(--tk-r-pill);
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--tk-text-secondary);
  cursor: pointer;
  outline: none;
  transition: all .15s;
}
.tk-btn-guest-toggle:hover,
.tk-btn-guest-toggle:focus {
  background: var(--tk-bg-hover);
  color: var(--tk-text-primary);
}
.tk-submit-card + .tk-auth-meta,
.tk-submit-card + .tk-meta-row,
.tk-submit-card + .tk-guest-info {
  margin-top: var(--tk-space-sm, 10px);
}
.tk-guest-info + .tk-submit-actions,
.tk-meta-row + .tk-submit-actions {
  margin-top: var(--tk-space-sm, 10px);
}
</style>
