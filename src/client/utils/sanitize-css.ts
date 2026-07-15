/**
 * CSS 消毒工具 — 过滤自定义 CSS 中的危险特性，防止 XSS。
 * 被 view/index.ts（CDN 入口）和 view/App.vue（Vue 组件入口）共同消费，
 * 确保两条 CSS 注入路径使用完全相同的消毒规则。
 *
 * 注意：正则过滤存在局限，完全安全方案需要 CSS 解析器沙箱。
 */

export const sanitizeCustomCSS = (css: string): string =>
  css
    .replace(/url\s*\([^)]*\)/gi, '/* url() blocked */')
    .replace(/@import/gi, '/* @import blocked */')
    .replace(/expression\s*\([^)]*\)/gi, '/* expression() blocked */')
    .replace(/-moz-binding\s*:/gi, '/* -moz-binding blocked */')
    .replace(/javascript\s*:/gi, '/* javascript: blocked */')
    .replace(/vbscript\s*:/gi, '/* vbscript: blocked */')
    .replace(/behavior\s*:/gi, '/* behavior blocked */')
    .replace(/@keyframes\s+[^{]*\{/gi, '/* @keyframes blocked */')
    .replace(/pointer-events?\s*:/gi, '/* pointer-events blocked */')
