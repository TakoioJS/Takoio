<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { t } from '../../../../utils'

const props = defineProps<{
  provider: string
  siteKey: string
  theme?: string
  captchaType?: string
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', token: string): void
  (e: 'error', msg: string): void
  (e: 'ready'): void
}>()

const containerRef = ref<HTMLElement>()
const errorMsg = ref('')
const widgetId = ref<number | null>(null)
const loading = ref(false)
const timer = ref<ReturnType<typeof setTimeout>>()

const scriptUrl = computed(() => {
  if (props.provider === 'turnstile') return 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  if (props.provider === 'recaptcha') return 'https://www.google.com/recaptcha/api.js?render=explicit'
  if (props.provider === 'hcaptcha') return 'https://js.hcaptcha.com/1/api.js?render=explicit'
  if (props.provider === 'geetest') return 'https://static.geetest.com/v4/gt4.js'
  return ''
})

const loadScript = (src: string): void => {
  if (document.querySelector(`script[src="${src}"]`)) return
  const s = document.createElement('script')
  s.src = src; s.async = true; document.head.appendChild(s)
}

const onSuccess = (token: string): void => {
  emit('update:modelValue', token)
  emit('ready')
  errorMsg.value = ''
}

const onError = (msg: string): void => {
  errorMsg.value = msg
  emit('error', msg)
}

const init = (): void => {
  if (!props.siteKey || !containerRef.value) return
  loading.value = true
  const w = window as any

  if (props.provider === 'turnstile') {
    loadScript(scriptUrl.value)
    timer.value = setTimeout(() => {
      if (w.turnstile) w.turnstile.render(containerRef.value!, { sitekey: props.siteKey, callback: onSuccess, 'error-callback': () => onError(t('captchaLoadFailed') || '验证加载失败'), theme: props.theme || 'auto' })
      loading.value = false
    }, 300)
  } else if (props.provider === 'recaptcha') {
    loadScript(scriptUrl.value)
    timer.value = setTimeout(() => {
      if (w.grecaptcha) widgetId.value = w.grecaptcha.render(containerRef.value!, { sitekey: props.siteKey, size: props.captchaType === 'invisible' ? 'invisible' : 'normal', callback: onSuccess, 'error-callback': () => onError(t('captchaLoadFailed') || '验证加载失败') })
      loading.value = false
    }, 300)
  } else if (props.provider === 'hcaptcha') {
    loadScript(scriptUrl.value)
    timer.value = setTimeout(() => {
      if (w.hcaptcha) widgetId.value = w.hcaptcha.render(containerRef.value!, { sitekey: props.siteKey, callback: onSuccess, 'error-callback': () => onError(t('captchaLoadFailed') || '验证加载失败') })
      loading.value = false
    }, 300)
  } else if (props.provider === 'geetest') {
    loadScript(scriptUrl.value)
    timer.value = setTimeout(() => {
      if (w.initGeetest4) {
        w.initGeetest4({ captchaId: props.siteKey, product: 'bind' }, (c: any) => {
          c.appendTo(containerRef.value!)
          c.onReady(() => { loading.value = false; emit('ready') })
          c.onSuccess(() => { const r = c.getValidate(); onSuccess(`${r.lot_number}|${r.captcha_output}|${r.pass_token}|${r.gen_time}`) })
          c.onError(() => onError(t('captchaLoadFailed') || '验证加载失败'))
          ;(w as any).__geetest_captcha = c
        })
      }
    }, 300)
  }
}

const reset = (): void => {
  const w = window as any
  if (props.provider === 'turnstile') w.turnstile?.reset(containerRef.value!)
  else if (props.provider === 'recaptcha' && widgetId.value != null) w.grecaptcha?.reset(widgetId.value)
  else if (props.provider === 'hcaptcha' && widgetId.value != null) w.hcaptcha?.reset(widgetId.value)
  else if (props.provider === 'geetest') w.__geetest_captcha?.reset()
}

watch(() => [props.provider, props.siteKey], init, { deep: true })
watch(() => props.modelValue, (v) => { if (!v) errorMsg.value = '' })

defineExpose({ reset })

onMounted(init)
onBeforeUnmount(() => { if (timer.value) clearTimeout(timer.value) })
</script>

<template>
  <div class="tk-captcha-widget">
    <div
      v-if="loading"
      class="tk-captcha-loading"
    >
      {{ t('loading') || '加载中…' }}
    </div>
    <div
      ref="containerRef"
      class="tk-captcha-container"
    />
    <span
      v-if="errorMsg"
      class="tk-captcha-error"
    >{{ errorMsg }}</span>
  </div>
</template>

<style scoped>
.tk-captcha-widget { display: flex; flex-direction: column; align-items: center; }
.tk-captcha-container { min-height: 60px; display: flex; align-items: center; justify-content: center; }
.tk-captcha-loading { font-size: 13px; opacity: .6; padding: 12px; }
.tk-captcha-error { font-size: 12px; color: var(--tk-danger); margin-top: 6px; }
</style>
