import { ref, type Ref } from 'vue'
import { uploadImage } from '../../../../utils/api'
import { toast, t } from '../../../../utils'

interface UseImageUploadOptions {
  envId: string
  editorRef: Ref<HTMLTextAreaElement | undefined>
  form: { comment: string }
  enabled: boolean
}

export const useImageUpload = (opts: UseImageUploadOptions) => {
  const imageUploading = ref(false)
  const uploadedImages = ref<string[]>([])
  const uploadRef = ref<HTMLInputElement>()

  const insertAtCursor = (text: string): void => {
    const ta = opts.editorRef.value
    if (ta) {
      const s = ta.selectionStart; const e = ta.selectionEnd
      opts.form.comment = opts.form.comment.substring(0, s) + text + opts.form.comment.substring(e)
      setTimeout(() => { ta.setSelectionRange(s + text.length, s + text.length); ta.focus() }, 0)
    } else {
      opts.form.comment += text
    }
  }

  const uploadImageFile = async (file: File): Promise<void> => {
    if (file.size > 5 * 1024 * 1024) { toast(t('imageTooLarge')); return }
    imageUploading.value = true
    try {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        try {
          const result = await uploadImage(opts.envId, reader.result as string)
          if (result.url) {
            insertAtCursor(`\n![image](${result.url})\n`)
            uploadedImages.value.push(result.url)
            toast(t('imageUploadSuccess'))
          }
        } catch { toast(t('imageUploadFailed')) } finally { imageUploading.value = false }
      }
      reader.onerror = () => { toast(t('imageUploadFailed')); imageUploading.value = false }
    } catch { toast(t('imageUploadFailed')); imageUploading.value = false }
  }

  const removeImage = (idx: number): void => {
    const url = uploadedImages.value[idx]
    uploadedImages.value.splice(idx, 1)
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    opts.form.comment = opts.form.comment.replace(new RegExp(`\n!\\[image\\]\\(${escaped}\\)\n`, 'g'), '')
  }

  const triggerUpload = (): void => { uploadRef.value?.click() }

  const onFileChange = (e: Event): void => {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (f) uploadImageFile(f)
    ;(e.target as HTMLInputElement).value = ''
  }

  const onPaste = (e: ClipboardEvent): void => {
    if (!opts.enabled) return
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const f = items[i].getAsFile()
        if (f) { toast(t('pasteImageUpload')); uploadImageFile(f) }
        return
      }
    }
  }

  return {
    imageUploading, uploadedImages, uploadRef,
    uploadImageFile, removeImage, triggerUpload, onFileChange, onPaste,
  }
}
