/**
 * Takoio 工具函数库 — Toast 提示（从 index.ts 拆出，Phase 7 Task 7.1.5）
 */

// ponytail: tiny DOM toast, replaces ElMessage
export const toast = (msg: string, type: 'success' | 'error' | 'info' = 'success', duration = 3000): void => {
  const el = document.createElement('div')
  el.textContent = msg; el.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 20px;border-radius:8px;font-size:14px;color:#fff;background:${type === 'error' ? '#ef4444' : type === 'info' ? '#6b7280' : '#10b981'};box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity .3s;opacity:0`
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.style.opacity = '1' })
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300) }, duration)
}
