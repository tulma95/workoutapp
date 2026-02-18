export interface RestTimerSettings {
  enabled: boolean
  durationSeconds: number
}

const STORAGE_KEY = 'restTimerSettings'
const DEFAULTS: RestTimerSettings = { enabled: true, durationSeconds: 180 }

export function getRestTimerSettings(): RestTimerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
      durationSeconds: typeof parsed.durationSeconds === 'number' && parsed.durationSeconds >= 30 && parsed.durationSeconds <= 600
        ? parsed.durationSeconds
        : DEFAULTS.durationSeconds,
    }
  } catch {
    return DEFAULTS
  }
}

export function saveRestTimerSettings(settings: RestTimerSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
