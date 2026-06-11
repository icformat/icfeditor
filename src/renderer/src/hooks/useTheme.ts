import { useEffect } from 'react'
import { useUiStore } from '../stores/uiStore'
import type { ResolvedTheme } from '../models/settings'
import { services } from '../services/container'

/** Resolves 'system' against the OS preference. */
function resolve(theme: string): ResolvedTheme {
  if (theme === 'light' || theme === 'dark') return theme
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

/**
 * Applies the chosen theme to the document root (Tailwind `class` strategy) and
 * keeps it in sync with the OS when set to 'system'. Persists the preference
 * through SettingsService. Returns the currently resolved theme.
 */
export function useTheme(): ResolvedTheme {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  // Load the persisted preference once.
  useEffect(() => {
    void services.settings.getTheme().then(setTheme)
  }, [setTheme])

  useEffect(() => {
    const apply = () => {
      const resolved = resolve(theme)
      document.documentElement.classList.toggle('dark', resolved === 'dark')
      document.documentElement.dataset['theme'] = resolved
    }
    apply()
    void services.settings.setTheme(theme)

    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  return resolve(theme)
}
