import { computed, reactive } from 'vue'
import type { TakoioConfig } from '../../../../types.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

export interface UseFormValidationOptions {
  options: TakoioConfig
  siteConfig: Record<string, any>
  form: { nick: string; mail: string; link: string; comment: string }
}

export function useFormValidation (opts: UseFormValidationOptions) {
  const errors = reactive({ nick: '', mail: '', link: '', comment: '' })

  const requiredFields = computed(() => opts.siteConfig?.REQUIRED_FIELDS ?? ['nick', 'mail'])
  const isNickRequired = computed(() => requiredFields.value.includes('nick'))
  const isMailRequired = computed(() => requiredFields.value.includes('mail'))
  const isLinkRequired = computed(() => opts.options.enableLinkInput && requiredFields.value.includes('link'))

  const validate = (getT: (key: string) => string, isLoggedIn = false): boolean => {
    let ok = true
    errors.nick = ''; errors.mail = ''; errors.link = ''; errors.comment = ''
    if (!isLoggedIn) {
      if (isNickRequired.value && !opts.form.nick.trim()) { errors.nick = getT('required'); ok = false }
      if (isMailRequired.value && !opts.form.mail.trim()) { errors.mail = getT('required'); ok = false }
      if (isLinkRequired.value && !opts.form.link.trim()) { errors.link = getT('required'); ok = false }
      if (opts.form.mail && !EMAIL_RE.test(opts.form.mail.trim())) {
        errors.mail = getT('emailInvalid') || 'Invalid email format'
        ok = false
      }
    }
    if (!opts.form.comment.trim()) { errors.comment = getT('commentTooShort'); ok = false }
    return ok
  }

  return { errors, requiredFields, isNickRequired, isMailRequired, isLinkRequired, validate }
}
