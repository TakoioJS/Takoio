// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TkSubmit from '../TkSubmit.vue'
import { submitComment } from '../../../utils'
import { getAuthState } from '../../../utils/auth'

// Mock dependencies
vi.mock('../../../utils', () => ({
  t: (k: string) => k,
  getUrl: vi.fn(() => 'http://example.com/path'),
  getHref: vi.fn(() => 'http://example.com/href'),
  getUserAgent: vi.fn(() => Promise.resolve('test-user-agent')),
  submitComment: vi.fn(() => Promise.resolve({ data: { id: 'comment-123', nick: 'Guest', comment: 'test content' } })),
  toast: vi.fn(),
  renderTex: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../utils/auth', () => ({
  getAuthState: vi.fn(() => ({ token: null, user: null })),
  onAuthChange: vi.fn(() => {
    return () => {} // unsubscribe function
  }),
  getAvailableProviders: vi.fn(() => Promise.resolve({ github: false, google: false, email: false })),
}))

vi.mock('../../../utils/marked', () => ({
  renderMarkdown: vi.fn((txt) => Promise.resolve(`<p>${txt}</p>`)),
}))

describe('TkSubmit.vue', () => {
  const defaultProps = {
    options: {
      envId: 'test-env-123',
      enableArticleReaction: false,
      enableLinkInput: true,
      enableCaptcha: false,
    } as any,
    siteConfig: {
      ENABLE_GUEST_COMMENT: true,
      COMMENT_LENGTH_MAX: 1000,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the semantic form outer wrapper', () => {
    const wrapper = mount(TkSubmit, { props: defaultProps })
    const form = wrapper.find('form.tk-submit')
    expect(form.exists()).toBe(true)
    expect(form.find('.tk-submit-card').exists()).toBe(true)
    expect(form.find('.tk-submit-form').exists()).toBe(true)
    // The inner form element should not exist anymore (replaced with div)
    expect(form.find('.tk-submit-card form').exists()).toBe(false)
  })

  it('shows the guest toggle button initially if not logged in and not active', () => {
    const wrapper = mount(TkSubmit, { props: defaultProps })
    const guestBtn = wrapper.find('.tk-btn-guest-toggle')
    expect(guestBtn.exists()).toBe(true)
    expect(wrapper.find('.tk-meta-row').exists()).toBe(false)
    expect(wrapper.find('.tk-guest-info').exists()).toBe(false)
  })

  it('activates guest mode when the toggle button is clicked', async () => {
    const wrapper = mount(TkSubmit, { props: defaultProps })
    const guestBtn = wrapper.find('.tk-btn-guest-toggle')
    await guestBtn.trigger('click')
    expect(wrapper.find('.tk-btn-guest-toggle').exists()).toBe(false)
    expect(wrapper.find('.tk-guest-info').exists()).toBe(true)
  })

  it('prefills isGuestActive as true when a draft containing nickname or email is loaded from localStorage', async () => {
    // Write draft to localStorage
    const draft = {
      nick: 'TestUser',
      mail: 'test@example.com',
      link: 'http://test.com',
      comment: 'Saved draft comment',
      _ts: Date.now(),
    }
    localStorage.setItem('takoio-draft', JSON.stringify(draft))

    const wrapper = mount(TkSubmit, { props: defaultProps })
    // Wait for onMounted to run loadDraft synchronously
    await nextTick()

    // Since draft contains nick and mail, isGuestActive should be prefilled as true, and guest fields should show
    expect(wrapper.find('.tk-guest-info').exists()).toBe(true)
    expect(wrapper.find('.tk-btn-guest-toggle').exists()).toBe(false)

    // Check prefilled values
    const nickInput = wrapper.find('.tk-guest-fields input[placeholder="nickname"]')
    expect((nickInput.element as HTMLInputElement).value).toBe('TestUser')
    const mailInput = wrapper.find('.tk-guest-fields input[placeholder="email"]')
    expect((mailInput.element as HTMLInputElement).value).toBe('test@example.com')
  })

  it('submits comment correctly with guest details', async () => {
    const wrapper = mount(TkSubmit, { props: defaultProps })
    // Activate guest mode
    await wrapper.find('.tk-btn-guest-toggle').trigger('click')

    // Fill the inputs
    const textarea = wrapper.find('.tk-textarea')
    await textarea.setValue('This is a test comment')
    const nickInput = wrapper.find('.tk-guest-fields input[placeholder="nickname"]')
    await nickInput.setValue('John Doe')
    const mailInput = wrapper.find('.tk-guest-fields input[placeholder="email"]')
    await mailInput.setValue('john@example.com')

    // Submit
    const form = wrapper.find('form.tk-submit')
    await form.trigger('submit')

    expect(submitComment).toHaveBeenCalledWith('test-env-123', expect.objectContaining({
      nick: 'John Doe',
      mail: 'john@example.com',
      comment: 'This is a test comment',
    }))
  })
})
