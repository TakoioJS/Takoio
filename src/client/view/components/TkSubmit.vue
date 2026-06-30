<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { t, getUrl, getHref, getUserAgent } from '../../utils'
import { submitComment } from '../../utils/api'
import { renderMarkdown } from '../../utils/marked'
import { toast } from '../../utils'
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
const form = reactive({ nick: '', mail: '', link: '', comment: '' })
const defaultEmojis = ['👍', '👎', '❤️', '😂', '🤯', '🎉']

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
const updatePreview = async (): Promise<void> => { if (showPreview.value) previewHtml.value = await renderMarkdown(form.comment) }
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

// --- Submit ---
const onSubmit = async (): Promise<void> => {
  if (!validate(t)) return
  captchaError.value = ''
  if (props.options.enableCaptcha && !captchaToken.value) { captchaError.value = t('captchaRequired') || '请完成人机验证'; return }
  submitting.value = true
  try {
    const ua = await getUserAgent()
    const result = await submitComment(props.options.envId, {
      url: getUrl(props.options.path),
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
    })
    emit('posted', result.data)
    form.comment = ''
    uploadedImages.value = []
    localStorage.removeItem('takoio-draft')
    toast(t('submitSuccess'))
  } catch (e: unknown) { toast(e instanceof Error ? e.message : t('submitFailed')) } finally { submitting.value = false }
}

// --- Lifecycle ---
onMounted(() => { fetchReactions(); loadDraft() })
onBeforeUnmount(() => { if (draftTimer.value) clearTimeout(draftTimer.value as any) })
</script>

<template>
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

  <form ref="formRef">
    <div class="tk-meta-row">
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

    <div class="tk-editor-item">
      <textarea
        ref="editorRef"
        v-model="form.comment"
        class="tk-textarea"
        :aria-label="t('placeholder')"
        :placeholder="t('placeholder')"
        :maxlength="commentMaxLength"
        rows="4"
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

    <div class="tk-toolbar">
      <div class="tk-toolbar-left">
        <MarkdownToolbar
          v-model="form.comment"
          :editor-ref="{ value: editorRef }"
        />
      </div>

      <div class="tk-toolbar-right">
        <button
          v-if="showUploadBtn"
          type="button"
          class="tk-btn-outline"
          @click="triggerUpload"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line
            x1="12"
            y1="3"
            x2="12"
            y2="15"
          /></svg>
          {{ t('uploadImage') }}
        </button>
        <input
          ref="uploadRef"
          type="file"
          accept="image/*"
          class="tk-hidden-upload"
          @change="onFileChange"
        >
        <button
          type="button"
          class="tk-btn-outline"
          @click="showPreview = !showPreview"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
            cx="12"
            cy="12"
            r="3"
          /></svg>
          {{ t('preview') }}
        </button>
        <button
          type="submit"
          class="tk-btn-primary"
          :disabled="submitting"
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
          {{ submitting ? (t('submitting') || '提交中…') : t('submit') }}
        </button>
      </div>
    </div>
  </form>

  <div
    v-show="showPreview"
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
</template>

<style scoped>
.tk-submit { padding:0 0 20px; margin-bottom:24px; }
.tk-reply-to { margin-bottom: 10px; padding: 6px 12px; background: var(--tk-bg-muted); border-radius: var(--tk-r-input); font-size: 13px; display: flex; align-items: center; gap: 6px; }
.tk-meta-row { display: flex; gap: 10px; margin-bottom: 10px; }
.tk-meta-item { flex: 1; margin-bottom: 0; }
.tk-editor-item { margin-bottom: 0; position: relative; }

.tk-input, .tk-textarea { width: 100%; padding: 8px 12px; font-size: 14px; font-family: inherit; color: inherit; background: transparent; border: 1px solid var(--tk-border); border-radius: var(--tk-r-input); outline: none; transition: border-color .15s; box-sizing: border-box; }
.tk-textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
.tk-input:hover, .tk-textarea:hover { border-color: var(--tk-border-strong); }
.tk-input:focus,.tk-textarea:focus{
  border-color:var(--tk-border-strong);
  border-bottom-color:var(--tk-brand);
  box-shadow:inset 0 -1px 0 var(--tk-brand);
  background:var(--tk-bg-inset);}
.tk-input-error { border-color: var(--tk-danger) !important; }
.tk-field-error { font-size: 11px; color: var(--tk-danger); margin-top: 2px; display: block; }
.tk-word-limit { position: absolute; bottom: 8px; right: 10px; font-size: 11px; opacity: .45; pointer-events: none; }
.tk-image-uploading { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 13px; color: inherit; opacity: .6; }
@keyframes tk-rotate { to { transform: rotate(360deg); } }
.tk-spin { animation: tk-rotate 1s linear infinite; }
.tk-hidden-upload { display: none; }
.tk-error-row { width: 100%; margin-bottom: 8px; padding: 0 4px; box-sizing: border-box; }
.tk-error-msg { font-size: 12px; color: var(--tk-danger); line-height: 1.4; word-break: break-all; }
.tk-avatar-preview { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }

.tk-toolbar { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; flex-wrap: wrap; gap: 12px; }
.tk-toolbar-left { display: flex; gap: 4px; align-items: center; flex: 1; min-width: 0; }
.tk-toolbar-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

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
  .tk-meta-row { flex-direction: column; gap: 6px; }
  .tk-toolbar { flex-direction: column; gap: 8px; align-items: stretch; }
  .tk-toolbar-left { flex-wrap: nowrap; overflow-x: auto; }
  .tk-toolbar-right { justify-content: flex-end; }
}
</style>
