/**
 * Plugin Registry — manages plugin registration and lifecycle.
 *
 * Plugins are registered at startup. The registry holds references
 * and provides lookup for the pipeline engine.
 */

import type { TakoioPlugin, PluginContext } from './types'
import { logger } from '../utils/logger'

/** Global plugin registry */
const plugins = new Map<string, TakoioPlugin>()

/** Initialize a plugin if it has an onInit hook */
async function initPlugin (plugin: TakoioPlugin): Promise<void> {
  if (!plugin.onInit) return
  const ctx: PluginContext = {
    config: {},
    logger: {
      debug: (...args) => logger.debug({ tag: `plugin:${plugin.name}` }, ...args),
      info: (...args) => logger.info({ tag: `plugin:${plugin.name}` }, ...args),
      warn: (...args) => logger.warn({ tag: `plugin:${plugin.name}` }, ...args),
      error: (...args) => logger.error({ tag: `plugin:${plugin.name}` }, ...args),
    },
  }
  await plugin.onInit(ctx)
}

/** Register a plugin */
export async function registerPlugin (plugin: TakoioPlugin): Promise<void> {
  if (plugins.has(plugin.name)) {
    logger.warn(`[plugins] Plugin "${plugin.name}" already registered, skipping`)
    return
  }
  plugins.set(plugin.name, plugin)
  logger.info(`[plugins] Registered: ${plugin.name} v${plugin.version}`)
  await initPlugin(plugin)
}

/** Unregister a plugin — calls onDestroy if defined */
export async function unregisterPlugin (name: string): Promise<void> {
  const plugin = plugins.get(name)
  if (!plugin) return
  if (plugin.onDestroy) {
    try { await plugin.onDestroy() } catch (e) {
      logger.error(`[plugins] Error destroying "${name}":`, e)
    }
  }
  plugins.delete(name)
  logger.info(`[plugins] Unregistered: ${name}`)
}

/** Get all registered plugins */
export function getPlugins (): TakoioPlugin[] {
  return Array.from(plugins.values())
}

/** Get a specific plugin by name */
export function getPlugin (name: string): TakoioPlugin | undefined {
  return plugins.get(name)
}

/** Get plugins that implement a specific hook */
export function getPluginsWithHook<K extends keyof TakoioPlugin & string> (
  hook: K
): TakoioPlugin[] {
  return getPlugins().filter(p => typeof p[hook] === 'function')
}

/** Get the number of registered plugins */
export function getPluginCount (): number {
  return plugins.size
}

/** Initialize all registered plugins that haven't been initialized yet */
export async function initAllPlugins (): Promise<void> {
  for (const plugin of plugins.values()) {
    await initPlugin(plugin)
  }
}

/** Shutdown all plugins gracefully */
export async function shutdownPlugins (): Promise<void> {
  const names = Array.from(plugins.keys())
  for (const name of names) {
    await unregisterPlugin(name)
  }
}
