// @vitest-environment jsdom
/**
 * useImageUpload composable 测试
 * insertAtCursor 是内部函数，通过 removeImage 间接测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useImageUpload } from '../useImageUpload'

vi.mock('../../../../utils', () => ({
  uploadImage: vi.fn(),
  toast: vi.fn(),
  t: (k: string) => k,
}))

describe('useImageUpload', () => {
  const editorRef = { value: document.createElement('textarea') }
  const form = { comment: '' }
  const opts = { envId: 'test', editorRef, form, enabled: true }

  beforeEach(() => { vi.clearAllMocks() })

  it('exposes expected API', () => {
    const api = useImageUpload(opts)
    expect(api).toHaveProperty('imageUploading')
    expect(api).toHaveProperty('uploadedImages')
    expect(api).toHaveProperty('uploadRef')
    expect(api).toHaveProperty('uploadImageFile')
    expect(api).toHaveProperty('removeImage')
    expect(api).toHaveProperty('triggerUpload')
    expect(api).toHaveProperty('onFileChange')
    expect(api).toHaveProperty('onPaste')
  })

  it('removeImage removes the markdown from comment', () => {
    form.comment = '\n![image](https://example.com/img.png)\n'
    const { uploadedImages, removeImage } = useImageUpload(opts)
    uploadedImages.value = ['https://example.com/img.png']
    removeImage(0)
    expect(form.comment).not.toContain('example.com')
    expect(uploadedImages.value).toHaveLength(0)
  })

  it('onFileChange handles null file gracefully', () => {
    const { onFileChange } = useImageUpload(opts)
    const event = { target: { files: null, value: '' } } as unknown as Event
    expect(() => onFileChange(event)).not.toThrow()
  })

  it('onPaste handles missing clipboardData gracefully', () => {
    const { onPaste } = useImageUpload(opts)
    const event = { clipboardData: null, preventDefault: vi.fn() } as unknown as ClipboardEvent
    expect(() => onPaste(event)).not.toThrow()
  })
})