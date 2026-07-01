// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TkUa from '../TkUa.vue'

describe('TkUa component', () => {
  it('renders nothing when ua is empty or undefined', () => {
    const wrapper1 = mount(TkUa, { props: { ua: '' } })
    expect(wrapper1.find('.tk-ua').exists()).toBe(false)
    const wrapper2 = mount(TkUa, { props: {} })
    expect(wrapper2.find('.tk-ua').exists()).toBe(false)
  })

  it('detects Windows 10 with Edge browser', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('Windows 10')
    expect(wrapper.text()).toContain('Edge')
    expect(wrapper.find('.i-simple-icons-windows').exists()).toBe(true)
    expect(wrapper.find('.i-simple-icons-microsoftedge').exists()).toBe(true)
  })

  it('detects macOS with Safari', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('macOS')
    expect(wrapper.text()).toContain('Safari')
    expect(wrapper.find('.i-simple-icons-apple').exists()).toBe(true)
    expect(wrapper.find('.i-simple-icons-safari').exists()).toBe(true)
  })

  it('detects iPadOS 13+ desktop mode (Mac OS X + iPad)', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 iPad'
    const wrapper = mount(TkUa, { props: { ua } })
    // Should detect iPadOS, not macOS
    expect(wrapper.text()).toContain('iPadOS')
  })

  it('detects iPhone with iOS', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('iOS')
    expect(wrapper.text()).toContain('Safari')
  })

  it('detects Android with Chrome', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('Android')
    expect(wrapper.text()).toContain('Chrome')
    expect(wrapper.find('.i-simple-icons-android').exists()).toBe(true)
    expect(wrapper.find('.i-simple-icons-googlechrome').exists()).toBe(true)
  })

  it('detects Firefox on Ubuntu Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('Ubuntu')
    expect(wrapper.text()).toContain('Firefox')
    expect(wrapper.find('.i-simple-icons-ubuntu').exists()).toBe(true)
    expect(wrapper.find('.i-simple-icons-firefoxbrowser').exists()).toBe(true)
  })

  it('detects Firefox on generic Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('Linux')
    expect(wrapper.text()).toContain('Firefox')
  })

  it('detects Chrome (not Edge) on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('Chrome')
    expect(wrapper.text()).not.toContain('Edge')
  })

  it('detects Opera browser', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('Opera')
  })

  it('detects Samsung Internet browser on Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/22.0 Chrome/111.0.0.0 Mobile Safari/537.36'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('Samsung Internet')
  })

  it('detects IE via Trident', () => {
    const ua = 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.text()).toContain('IE')
    expect(wrapper.text()).toContain('Windows 7')
  })

  it('returns null for unknown UA strings', () => {
    const ua = 'SomeBot/1.0'
    const wrapper = mount(TkUa, { props: { ua } })
    expect(wrapper.find('.tk-ua').exists()).toBe(false)
  })

  it('extracts browser version number', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const wrapper = mount(TkUa, { props: { ua } })
    // Version should appear as "Chrome 120"
    expect(wrapper.text()).toMatch(/Chrome\s+120/)
  })
})
