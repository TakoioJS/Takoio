<template>
  <div class="tk-submit">
    <div v-if="!replyTo" class="tk-article-reactions">
      <div class="tk-reaction-list">
        <button v-for="emoji in defaultEmojis" :key="emoji" :class="['tk-reaction-btn', { active: myReactions.includes(emoji) }]" @click="toggleReaction(emoji)">
          {{ emoji }} <span class="tk-reaction-count" v-if="reactions[emoji]">{{ reactions[emoji] }}</span>
        </button>
      </div>
    </div>

    <div v-if="replyTo" class="tk-reply-to">
      回复 <strong>{{ replyTo.nick }}</strong>：
      <button class="tk-btn-link tk-btn-sm" @click="emit('clear-reply')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <form ref="formRef">
      <div class="tk-meta-row">
        <div class="tk-meta-item">
          <input v-model="form.nick" :placeholder="t('nickname')" class="tk-input" :class="{ 'tk-input-error': errors.nick }" />
          <span v-if="errors.nick" class="tk-field-error">{{ errors.nick }}</span>
        </div>
        <div class="tk-meta-item">
          <input v-model="form.mail" type="email" :placeholder="t('email')" class="tk-input" :class="{ 'tk-input-error': errors.mail }" />
          <span v-if="errors.mail" class="tk-field-error">{{ errors.mail }}</span>
        </div>
        <div v-if="options.enableLinkInput !== false" class="tk-meta-item">
          <input v-model="form.link" :placeholder="t('link')" class="tk-input" :class="{ 'tk-input-error': errors.link }" />
          <span v-if="errors.link" class="tk-field-error">{{ errors.link }}</span>
        </div>
      </div>

      <div class="tk-editor-item">
        <textarea ref="editorRef" v-model="form.comment" class="tk-textarea" :placeholder="t('placeholder')" :maxlength="commentMaxLength" rows="4" @keydown.ctrl.enter="onSubmit" @paste="onPaste"></textarea>
        <div class="tk-word-limit"><span>{{ form.comment.length }}</span>/500</div>
      </div>

      <div v-if="uploadedImages.length" class="tk-image-previews">
        <div v-for="(img, idx) in uploadedImages" :key="idx" class="tk-image-thumb">
          <img :src="img" :alt="t('imageAlt')" />
          <button class="tk-image-remove" @click="removeImage(idx)" :title="t('delete')">&times;</button>
        </div>
      </div>
      <div v-if="imageUploading" class="tk-image-uploading">
        <svg class="tk-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
        <span>{{ t('imageUploading') }}</span>
      </div>

      <div class="tk-toolbar">
        <div class="tk-toolbar-left">
          <button type="button" v-if="options.enableEmotion !== false" class="tk-btn-circle" data-tip="表情" @click="showEmotion = !showEmotion">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          <button type="button" class="tk-btn-circle" data-tip="加粗" @click="insertText('**', '**')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
          </button>
          <button type="button" class="tk-btn-circle" data-tip="斜体" @click="insertText('*', '*')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </button>
          <button type="button" class="tk-btn-circle" data-tip="引用" @click="insertText('> ', '')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
          </button>
          <button type="button" class="tk-btn-circle" data-tip="链接" @click="insertText('[', '](https://)')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <button type="button" class="tk-btn-circle" data-tip="代码" @click="insertText('`', '`')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
          <button type="button" v-if="showUploadBtn" class="tk-btn-circle" data-tip="图片上传" @click="triggerUpload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <input ref="uploadRef" type="file" accept="image/*" class="tk-hidden-upload" @change="onFileChange" />
        </div>

        <div class="tk-toolbar-right">
          <span v-if="errorMsg" class="tk-error-msg">{{ errorMsg }}</span>
          <button type="button" class="tk-btn-link" title="管理" @click="emit('admin')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <img v-if="avatarPreview" :src="avatarPreview" class="tk-avatar-preview" />
          <button type="button" class="tk-btn-outline" @click="showPreview = !showPreview">{{ showPreview ? t('fold') : t('preview') }}</button>
          <button type="button" class="tk-btn-primary" :disabled="submitting || captchaLoading" @click="onSubmit">
            <svg v-if="submitting || captchaLoading" class="tk-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
            {{ submitting ? t('submitting') : t('submit') }}
          </button>
        </div>
      </div>
    </form>

    <div v-show="showEmotion" class="tk-emotions">
      <div class="tk-emotion-tabs">
        <button v-for="(_, name) in emotions" :key="name" :class="['tk-emotion-tab', { active: activeEmotionGroup === name }]" role="tab" :aria-selected="activeEmotionGroup === name" @click="activeEmotionGroup = name">{{ name }}</button>
      </div>
      <div class="tk-emotion-grid">
        <span v-for="(em, idx) in (emotions[activeEmotionGroup] || [])" :key="idx" class="tk-emotion" :title="em.text" @click="insertEmotion(em)">{{ em.icon }}</span>
      </div>
    </div>

    <div v-if="options.enableCaptcha" class="tk-captcha">
      <div v-if="options.captchaProvider === 'turnstile'" ref="turnstileRef" class="cf-turnstile" />
      <div v-else-if="options.captchaProvider === 'recaptcha'" ref="recaptchaRef" />
      <div v-else-if="options.captchaProvider === 'hcaptcha'" ref="hcaptchaRef" class="h-captcha" />
      <div v-else-if="options.captchaProvider === 'geetest'" class="tk-geetest"><div id="tk-geetest-container" ref="geetestRef" /></div>
      <span v-if="captchaError" class="tk-captcha-error">{{ captchaError }}</span>
    </div>

    <div v-show="showPreview" class="tk-preview" v-html="previewHtml" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { t, call, getUrl, getHref, getUserAgent } from '../../utils'
import { uploadImage, submitComment } from '../../utils/api'
import { renderMarkdown } from '../../utils/marked'
import { getEmotions } from '../../utils/emotion'
import { toast, md5 } from '../../utils'
import type { TakoioConfig, Comment } from '../../types'

interface Props { options: TakoioConfig; siteConfig?: Record<string, any>; replyTo?: Comment | null }
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'posted', comment: Comment): void; (e: 'clear-reply'): void; (e: 'admin'): void }>()

const showUploadBtn = computed(() => props.siteConfig?.ENABLE_IMAGE_UPLOAD && props.siteConfig?.IMAGE_HOSTING_PROVIDER)
const commentMaxLength = computed(() => props.siteConfig?.COMMENT_LENGTH_MAX || 5000)
const formRef = ref<HTMLFormElement>()
const editorRef = ref<HTMLTextAreaElement>()
const uploadRef = ref<HTMLInputElement>()
const errorMsg = ref('')
const turnstileRef = ref(); const recaptchaRef = ref(); const hcaptchaRef = ref(); const geetestRef = ref()
const form = reactive({ nick: '', mail: '', link: '', comment: '' })
const errors = reactive({ nick: '', mail: '', link: '', comment: '' })

const submitting = ref(false); const captchaLoading = ref(false); const captchaError = ref('')
const captchaToken = ref(''); const captchaWidgetId = ref<number | null>(null)
const showEmotion = ref(false); const showPreview = ref(false); const previewHtml = ref('')
const emotions = ref(getEmotions()); const activeEmotionGroup = ref('')
const uploadedImages = ref<string[]>([]); const imageUploading = ref(false)
const defaultEmojis = ['👍', '👎', '❤️', '😂', '🤯', '🎉']
const mailMd5 = ref('')
const avatarPreview = computed(() => {
  if (!mailMd5.value) return ''
  const base = props.options.GRAVATAR_URL || 'https://weavatar.com/avatar/'
  return `${base.replace(/\/+$/, '')}/${mailMd5.value}?d=identicon&s=40`
})
watch(() => form.mail, async (v) => {
  if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) mailMd5.value = await md5(v.trim().toLowerCase())
  else mailMd5.value = ''
})
const reactions = ref<Record<string, number>>({}); const myReactions = ref<string[]>([])

const fetchReactions = async () => {
  try { const res = await call('REACTION_GET', { envId: props.options.envId, url: getUrl(props.options.path) }); const d = (res as any).result || (res as any).data || res; if (d?.reactions) { reactions.value = d.reactions; myReactions.value = d.myReactions || [] } } catch {}
}
const toggleReaction = async (emoji: string) => {
  try { const res = await call('REACTION_SUBMIT', { envId: props.options.envId, url: getUrl(props.options.path), emoji }); const d = (res as any).result || (res as any).data || res; if (d?.reactions) { reactions.value = d.reactions; myReactions.value = d.myReactions || [] } } catch { toast(t('actionFailed') || t('submitFailed')) }
}

const isNickRequired = computed(() => (props.siteConfig?.REQUIRED_FIELDS || ['nick']).includes('nick'))
const isMailRequired = computed(() => (props.siteConfig?.REQUIRED_FIELDS || []).includes('mail'))
const isLinkRequired = computed(() => props.options.enableLinkInput && (props.siteConfig?.REQUIRED_FIELDS || []).includes('link'))

const validate = (): boolean => {
  let ok = true; errors.nick = ''; errors.mail = ''; errors.link = ''; errors.comment = ''
  if (isNickRequired.value && !form.nick.trim()) { errors.nick = t('required'); ok = false }
  if (isMailRequired.value && !form.mail.trim()) { errors.mail = t('required'); ok = false }
  if (isLinkRequired.value && !form.link.trim()) { errors.link = t('required'); ok = false }
  if (!form.comment.trim()) { errors.comment = t('commentTooShort'); ok = false }
  if (form.mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.mail)) { errors.mail = t('email') + ' ' + t('required'); ok = false }
  return ok
}

const triggerUpload = (): void => { uploadRef.value?.click() }
const insertEmotion = (em: { text: string; icon: string }): void => { form.comment += em.icon }
const insertText = (prefix: string, suffix: string) => {
  const ta = editorRef.value; if (!ta) return
  const s = ta.selectionStart; const e = ta.selectionEnd
  const sel = form.comment.substring(s, e)
  form.comment = form.comment.substring(0, s) + prefix + sel + suffix + form.comment.substring(e)
  setTimeout(() => { ta.focus(); ta.setSelectionRange(s + prefix.length, s + prefix.length + sel.length) }, 0)
}

const uploadImageFile = async (file: File): Promise<void> => {
  if (file.size > 5 * 1024 * 1024) { toast(t('imageTooLarge')); return }
  imageUploading.value = true
  try {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = async () => {
      try {
        const result = await uploadImage(props.options.envId, reader.result as string)
        if (result.url) { form.comment += `\n![image](${result.url})\n`; uploadedImages.value.push(result.url); toast(t('imageUploadSuccess')) }
      } catch { toast(t('imageUploadFailed')) } finally { imageUploading.value = false }
    }
    reader.onerror = () => { toast(t('imageUploadFailed')); imageUploading.value = false }
  } catch { toast(t('imageUploadFailed')); imageUploading.value = false }
}
const onFileChange = (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) uploadImageFile(f); (e.target as HTMLInputElement).value = '' }

const onPaste = (e: ClipboardEvent): void => {
  if (!showUploadBtn.value) return; const items = e.clipboardData?.items; if (!items) return
  for (let i = 0; i < items.length; i++) { if (items[i].type.startsWith('image/')) { e.preventDefault(); const f = items[i].getAsFile(); if (f) { toast(t('pasteImageUpload')); uploadImageFile(f) }; return } }
}

const SESSION_KEY = 'takoio-admin-session'
const OLD_SESSION_KEY = 'twikoo-admin-session'
const DRAFT_KEY = 'takoio-draft'
const OLD_DRAFT_KEY = 'twikoo-draft'
const getAdminToken = (): string | null => {
  const readSession = (key: string) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const { token, expires } = JSON.parse(raw)
      if (expires && Date.now() > expires) {
        localStorage.removeItem(key)
        return null
      }
      return token || null
    } catch { return null }
  }

  let token = readSession(SESSION_KEY)
  // Backward compatibility: migrate old Twikoo session to new key
  if (!token) {
    token = readSession(OLD_SESSION_KEY)
    if (token) {
      localStorage.removeItem(OLD_SESSION_KEY)
    }
  }
  return token
}

const removeImage = (idx: number): void => { const url = uploadedImages.value[idx]; uploadedImages.value.splice(idx, 1); form.comment = form.comment.replace(`\n![image](${url})\n`, '') }

const onSubmit = async (): Promise<void> => {
  if (!validate()) return
  captchaError.value = ''
  if (props.options.enableCaptcha && !captchaToken.value) { captchaError.value = '请完成人机验证'; return }
  submitting.value = true
  try {
    const ua = await getUserAgent(); const adminToken = getAdminToken()
    const result = await submitComment(props.options.envId, {
      url: getUrl(props.options.path), href: getHref(props.options.href),
      title: props.options.title || document.title,
      nick: form.nick, mail: form.mail, link: form.link, comment: form.comment, ua,
      captchaToken: captchaToken.value || undefined,
      pid: props.replyTo?.pid || props.replyTo?.id || undefined,
      rid: props.replyTo?.id || undefined,
      ...(adminToken ? { _token: adminToken } : {}),
    })
    emit('posted', result.data); form.comment = ''; uploadedImages.value = []; localStorage.removeItem(DRAFT_KEY); resetCaptcha()
    toast(t('submitSuccess'))
  } catch (e: any) { toast(e?.message || t('submitFailed')) } finally { submitting.value = false }
}

const updatePreview = async (): Promise<void> => { if (showPreview.value) previewHtml.value = await renderMarkdown(form.comment) }
watch(() => form.comment, updatePreview)
watch(form, () => { if (errorMsg.value) errorMsg.value = ''; errors.nick = ''; errors.mail = ''; errors.link = ''; errors.comment = '' })
watch(showPreview, (v) => { if (v) updatePreview() })

let _draftTimer: ReturnType<typeof setTimeout> | null = null
watch(form, () => {
  if (_draftTimer) clearTimeout(_draftTimer)
  _draftTimer = setTimeout(() => {
    if (form.comment.trim() || form.nick.trim() || form.mail.trim()) try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, _ts: Date.now() })) } catch {}
  }, 3000)
}, { deep: true })

const loadDraft = (): void => {
  try {
    // Try new key first, fall back to old key for backward compatibility
    let raw = localStorage.getItem(DRAFT_KEY)
    let usedOldKey = false
    if (!raw) {
      raw = localStorage.getItem(OLD_DRAFT_KEY)
      usedOldKey = !!raw
    }
    if (!raw) return
    const draft = JSON.parse(raw)
    if (draft._ts && Date.now() - draft._ts > 86400000) {
      localStorage.removeItem(usedOldKey ? OLD_DRAFT_KEY : DRAFT_KEY)
      return
    }
    // Migrate old key to new
    if (usedOldKey) {
      localStorage.removeItem(OLD_DRAFT_KEY)
      localStorage.setItem(DRAFT_KEY, raw)
    }
    delete draft._ts; Object.assign(form, draft); if (form.comment || form.nick) toast(t('draftRestored') || '已为您恢复上次未提交的草稿')
  } catch {}
}

onMounted(() => { fetchReactions(); const em = getEmotions(); emotions.value = em; activeEmotionGroup.value = Object.keys(em)[0] || ''; loadDraft(); initCaptcha() })

const initCaptcha = (): void => {
  if (!props.options.enableCaptcha) return; const provider = props.options.captchaProvider; const siteKey = props.options.captchaSiteKey; if (!siteKey) return; captchaLoading.value = true
  const onSuccess = (token: string) => { captchaToken.value = token; captchaError.value = ''; captchaLoading.value = false }
  const onError = () => { captchaError.value = '验证加载失败，请刷新重试'; captchaLoading.value = false }
  const loadScript = (src: string, cb: () => void) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = cb; document.head.appendChild(s) }
  if (provider === 'turnstile') loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', () => { const w = (window as any).turnstile; if (w && turnstileRef.value) w.render(turnstileRef.value, { sitekey: siteKey, callback: onSuccess, 'error-callback': onError, theme: 'auto' }) })
  else if (provider === 'recaptcha') loadScript('https://www.google.com/recaptcha/api.js?render=explicit', () => { const w = (window as any).grecaptcha; if (w && recaptchaRef.value) { captchaWidgetId.value = w.render(recaptchaRef.value, { sitekey: siteKey, size: props.options.captchaType === 'invisible' ? 'invisible' : 'normal', callback: onSuccess, 'error-callback': onError }) } })
  else if (provider === 'hcaptcha') loadScript('https://js.hcaptcha.com/1/api.js?render=explicit', () => { const w = (window as any).hcaptcha; if (w && hcaptchaRef.value) { captchaWidgetId.value = w.render(hcaptchaRef.value, { sitekey: siteKey, callback: onSuccess, 'error-callback': onError }) } })
  else if (provider === 'geetest') loadScript('https://static.geetest.com/v4/gt4.js', () => { const w = (window as any).initGeetest4; if (w && geetestRef.value) { w({ captchaId: siteKey, product: 'bind' }, (c: any) => { c.appendTo('#tk-geetest-container'); c.onReady(() => { captchaLoading.value = false }); c.onSuccess(() => { const r = c.getValidate(); captchaToken.value = `${r.lot_number}|${r.captcha_output}|${r.pass_token}|${r.gen_time}`; captchaError.value = '' }); c.onError(() => onError()); (window as any).__geetest_captcha = c }) } })
}

const resetCaptcha = (): void => {
  captchaToken.value = ''; const w = (window as any)
  if (props.options.captchaProvider === 'turnstile') w.turnstile?.reset(turnstileRef.value)
  else if (props.options.captchaProvider === 'recaptcha' && captchaWidgetId.value != null) w.grecaptcha?.reset(captchaWidgetId.value)
  else if (props.options.captchaProvider === 'hcaptcha' && captchaWidgetId.value != null) w.hcaptcha?.reset(captchaWidgetId.value)
  else if (props.options.captchaProvider === 'geetest') w.__geetest_captcha?.reset()
}
</script>

<style scoped>
.tk-submit { background: transparent; padding: 20px; margin-bottom: 24px; }
.tk-reply-to { margin-bottom: 10px; padding: 6px 12px; background: rgba(128,128,128,0.06); border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.tk-meta-row { display: flex; gap: 10px; margin-bottom: 10px; }
.tk-meta-item { flex: 1; margin-bottom: 0; }
.tk-editor-item { margin-bottom: 0; position: relative; }

.tk-input, .tk-textarea { width: 100%; padding: 8px 12px; font-size: 14px; font-family: inherit; color: inherit; background: transparent; border: 1px solid rgba(128,128,128,0.15); border-radius: 6px; outline: none; transition: border-color .15s; box-sizing: border-box; }
.tk-textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
.tk-input:hover, .tk-textarea:hover { border-color: rgba(128,128,128,0.25); }
.tk-input:focus, .tk-textarea:focus { border-color: var(--tk-brand-ring); }
.tk-input-error { border-color: rgba(220,38,38,0.5) !important; }
.tk-field-error { font-size: 11px; color: #dc2626; margin-top: 2px; display: block; }
.tk-word-limit { position: absolute; bottom: 8px; right: 10px; font-size: 11px; opacity: .45; pointer-events: none; }

.tk-image-previews { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.tk-image-thumb { position: relative; width: 64px; height: 64px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(128,128,128,0.15); }
.tk-image-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tk-image-remove { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: #fff; font-size: 13px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
.tk-image-remove:hover { background: rgba(220,38,38,0.8); }
.tk-image-uploading { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 13px; color: inherit; opacity: .6; }
@keyframes tk-rotate { to { transform: rotate(360deg); } }
.tk-spin { animation: tk-rotate 1s linear infinite; }
.tk-hidden-upload { display: none; }

.tk-toolbar { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
.tk-toolbar-left { display: flex; gap: 4px; align-items: center; }
.tk-toolbar-right { display: flex; gap: 10px; align-items: center; }

.tk-btn-circle { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; color: inherit; opacity: .6; cursor: pointer; border-radius: 50%; transition: all .15s; padding: 0; position: relative; }
.tk-btn-circle:hover { opacity: 1; background: rgba(128,128,128,0.06); }
.tk-btn-circle[data-tip]::after { content: attr(data-tip); position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); font-size: 11px; background: rgba(0,0,0,0.75); color: #fff; padding: 2px 6px; border-radius: 4px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .15s; }
.tk-btn-circle[data-tip]:hover::after { opacity: 1; }

.tk-btn-link { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; color: inherit; opacity: .6; padding: 4px; border-radius: 4px; font-family: inherit; font-size: inherit; }
.tk-btn-link:hover { opacity: 1; }
.tk-btn-sm { padding: 2px; }

.tk-btn-outline { display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px; background: transparent; border: 1px solid rgba(128,128,128,0.2); border-radius: 6px; cursor: pointer; color: inherit; font-size: 13px; font-family: inherit; transition: all .15s; }
.tk-btn-outline:hover { border-color: var(--tk-brand); color: var(--tk-brand); }

.tk-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 6px 18px; background: var(--tk-brand); border: none; border-radius: 6px; cursor: pointer; color: #fff; font-size: 13px; font-family: inherit; font-weight: 600; transition: all .15s; }
.tk-btn-primary:hover { filter: brightness(1.1); }
.tk-btn-primary:disabled { opacity: .5; cursor: default; filter: none; }

.tk-error-msg { font-size: 12px; color: #dc2626; margin-right: 8px; }

.tk-avatar-preview { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }

.tk-emotions { margin-top: 12px; background: rgba(255,255,255,0.95); border: 1px solid rgba(128,128,128,0.12); border-radius: 8px; overflow: hidden; }
.tk-emotion-tabs { display: flex; gap: 4px; padding: 8px 8px 0; overflow-x: auto; background: rgba(128,128,128,0.04); border-bottom: 1px solid rgba(128,128,128,0.08); }
.tk-emotion-tab { padding: 6px 12px; border: none; background: transparent; color: inherit; opacity: .6; cursor: pointer; font-size: 13px; border-radius: 6px 6px 0 0; white-space: nowrap; transition: all .15s; font-family: inherit; }
.tk-emotion-tab:hover { opacity: .8; }
.tk-emotion-tab.active { background: rgba(255,255,255,0.95); opacity: 1; color: var(--tk-brand); }
.tk-emotion-grid { display: flex; flex-wrap: wrap; gap: 4px; padding: 10px; max-height: 200px; overflow-y: auto; }
.tk-emotion { display: flex; align-items: center; justify-content: center; min-width: 36px; height: 36px; cursor: pointer; font-size: 14px; padding: 0 8px; box-sizing: border-box; border-radius: 6px; transition: all .15s; }
.tk-emotion:hover { background: var(--tk-brand-light); transform: scale(1.15); }

.tk-preview { margin-top: 12px; padding: 16px; background: rgba(128,128,128,0.04); border: 1px solid rgba(128,128,128,0.08); border-radius: 6px; min-height: 50px; font-size: 14px; line-height: 1.7; }
.tk-preview :deep(p) { margin: 6px 0; }
.tk-preview :deep(pre) { background: rgba(128,128,128,0.04); border: 1px solid rgba(128,128,128,0.08); border-radius: 4px; padding: 12px; font-size: 13px; }

.tk-captcha { margin-top: 14px; display: flex; flex-direction: column; align-items: center; }
.tk-captcha-error { color: #f56c6c; font-size: 12px; margin-top: 6px; }

.tk-article-reactions { display: flex; align-items: center; justify-content: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
.tk-reaction-list { display: flex; gap: 8px; flex-wrap: wrap; }
.tk-reaction-btn { background: rgba(128,128,128,0.06); border: 1px solid rgba(128,128,128,0.12); border-radius: 12px; padding: 2px 8px; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; color: inherit; font-family: inherit; }
.tk-reaction-btn:hover { background: rgba(128,128,128,0.1); border-color: rgba(128,128,128,0.2); }
.tk-reaction-btn.active { background: var(--tk-brand-light); border-color: var(--tk-brand); color: var(--tk-brand); }
.tk-reaction-count { font-size: 12px; opacity: 0.8; }

@media (max-width: 640px) {
  .tk-submit { padding: 14px 0; }
  .tk-meta-row { flex-direction: column; gap: 6px; }
  .tk-toolbar { flex-direction: column; gap: 10px; align-items: stretch; }
  .tk-toolbar-right { justify-content: flex-end; }
}
</style>