export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_KEY = 'setforge:theme'

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(pref)
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch {
    /* storage unavailable */
  }
  applyTheme(pref)
}

/** Keep the resolved theme in sync with the OS while preference is "system". */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (getThemePreference() === 'system') applyTheme('system')
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
