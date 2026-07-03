/**
 * Takoio 工具函数库 — 渲染链接（从 index.ts 拆出，Phase 7 Task 7.1.2）
 */

/** 渲染链接（新窗口打开） */
export const renderLinks = (el: Element | Element[] | null): void => {
  if (!el) return
  let aEls: HTMLAnchorElement[] = [] as any
  if (Array.isArray(el)) {
    el.forEach((item) => {
      aEls = [...aEls, ...item.getElementsByTagName('a')]
    })
  } else {
    aEls = Array.from(el.getElementsByTagName('a'))
  }
  for (const aEl of aEls) {
    aEl.setAttribute('target', '_blank')
    aEl.setAttribute('rel', 'noopener noreferrer nofollow ugc')
  }
}
