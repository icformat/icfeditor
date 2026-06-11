import type { ThemePreference } from '../models/settings'

/**
 * Renderer-side settings facade. Persistence lives in the main process
 * (electron-store) and is reached through the preload bridge; this service
 * adds typed accessors and tolerates running outside Electron (tests) by
 * falling back to in-memory values.
 */
export class SettingsService {
  private readonly memory = new Map<string, unknown>()

  private get bridge() {
    return typeof window !== 'undefined' ? window.api : undefined
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (this.bridge) return this.bridge.getSetting<T>(key)
    return this.memory.get(key) as T | undefined
  }

  async set(key: string, value: unknown): Promise<void> {
    if (this.bridge) return this.bridge.setSetting(key, value)
    this.memory.set(key, value)
  }

  async getTheme(): Promise<ThemePreference> {
    return (await this.get<ThemePreference>('theme')) ?? 'system'
  }

  async setTheme(theme: ThemePreference): Promise<void> {
    await this.set('theme', theme)
  }

  async getRecentFiles(): Promise<string[]> {
    if (this.bridge) return this.bridge.getRecentFiles()
    return (this.memory.get('recentFiles') as string[]) ?? []
  }

  async addRecentFile(path: string): Promise<string[]> {
    if (this.bridge) return this.bridge.addRecentFile(path)
    const list = [path, ...((this.memory.get('recentFiles') as string[]) ?? [])].slice(0, 12)
    this.memory.set('recentFiles', list)
    return list
  }
}
