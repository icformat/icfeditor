/** Theme options (Prompt.md §Themes). 'system' follows the OS. */
export type ThemePreference = 'light' | 'dark' | 'system'

/** The concrete theme actually applied after resolving 'system'. */
export type ResolvedTheme = 'light' | 'dark'

export interface AppSettings {
  theme: ThemePreference
  autosave: boolean
  showTipsPanel: boolean
  recentFiles: string[]
}
