export type {
  TakoioPlugin,
  HookContext,
  HookResult,
  PluginContext,
  PluginRoute,
  PipelineHookName,
  PipelineResult,
} from './types'

export { HOOK_TIMEOUTS } from './types'

export {
  registerPlugin,
  unregisterPlugin,
  getPlugins,
  getPlugin,
  getPluginsWithHook,
  getPluginCount,
  initAllPlugins,
  shutdownPlugins,
} from './registry'

export {
  runPreSubmit,
  runPostSubmit,
  runPreApprove,
  runPreDelete,
  runPreRender,
  runPostRender,
} from './pipeline'

// Re-export namespaced config for plugin development
export { toNamespaced, createConfigProxy } from '../config-ns'
export type { NamespacedConfig, SiteConfig, CommentConfig, ModerationConfig, NotificationConfig, AppearanceConfig, CaptchaConfig, ImageHostingConfig, SecurityConfig, AIConfig } from '../config-ns'
